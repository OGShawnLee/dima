#!/usr/bin/env bash
# Installs/updates frontendnet on the "web" VM (Debian 12 or Ubuntu 24.04). Run inside the VM as root:
#   sudo bash /tmp/dima-bundle/deploy/install-web.sh   (publish-web.sh does this for you)
# Expects (extracted by publish-web.sh into the root-only /tmp/dima-bundle):
#   /tmp/dima-bundle/frontendnet/  self-contained publish output (linux-x64)
#   /tmp/dima-bundle/deploy/       service + nginx files
#   /tmp/dima-bundle/certs/        web.dima.lab.{crt,key}, dima-lab-ca.crt
# Idempotent: safe to re-run for every redeploy.
set -euo pipefail

BUNDLE=/tmp/dima-bundle
APP_DIR=/opt/frontendnet
export DEBIAN_FRONTEND=noninteractive
DPKG_OPTS=(-o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold")

# The bundle contains the TLS private key: remove it on every exit path (success or failure)
trap 'rm -rf "$BUNDLE" /tmp/dima-bundle.tgz' EXIT

# 1. Packages. The self-contained .NET app still needs the distro ICU library
#    (libicu72 on Debian 12, libicu74 on Ubuntu 24.04): pick the newest available.
apt-get update -y
ICU_PKG="$(apt-cache pkgnames libicu | grep -E '^libicu[0-9]+$' | sort -V | tail -n 1 || true)"
if [[ -z "$ICU_PKG" ]]; then
  echo "ERROR: no libicuNN package found in the APT sources" >&2
  exit 1
fi
apt-get install -y "${DPKG_OPTS[@]}" nginx ufw curl ca-certificates "$ICU_PKG"

# 2. Trust the lab CA (needed for HttpClient -> https://api.dima.lab)
install -m 644 "$BUNDLE/certs/dima-lab-ca.crt" /usr/local/share/ca-certificates/dima-lab-ca.crt
update-ca-certificates

# 3. Service account + app files (read-only for the service user)
id frontendnet &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin frontendnet
systemctl stop frontendnet 2>/dev/null || true
rm -rf "$APP_DIR"
install -d -o root -g root -m 755 "$APP_DIR"
cp -a "$BUNDLE/frontendnet/." "$APP_DIR"/
chown -R root:root "$APP_DIR"
chmod -R go-w,go+rX "$APP_DIR"
chmod 755 "$APP_DIR"   # cp -a copies the 700 bundle dir mode over $APP_DIR; the service user must traverse it
chmod 755 "$APP_DIR/frontendnet"

# 4. systemd unit (StateDirectory creates /var/lib/frontendnet 0700 frontendnet; keys live in .../keys)
install -m 644 "$BUNDLE/deploy/frontendnet.service" /etc/systemd/system/frontendnet.service
systemctl daemon-reload
systemctl enable frontendnet
systemctl restart frontendnet

# 5. TLS + nginx reverse proxy (443 only; the distro "default" site on port 80 is removed)
install -d -m 755 /etc/ssl/dima
install -m 644 "$BUNDLE/certs/web.dima.lab.crt" /etc/ssl/dima/web.dima.lab.crt
install -m 600 "$BUNDLE/certs/web.dima.lab.key" /etc/ssl/dima/web.dima.lab.key
install -d -m 755 /etc/nginx/snippets
install -m 644 "$BUNDLE/deploy/dima-proxy.conf" /etc/nginx/snippets/dima-proxy.conf
install -m 644 "$BUNDLE/deploy/nginx-frontendnet.conf" /etc/nginx/sites-available/frontendnet
ln -sf /etc/nginx/sites-available/frontendnet /etc/nginx/sites-enabled/frontendnet
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# 6. Firewall: only SSH and HTTPS
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
# SSH only from the management CIDR (same pattern as install-db.sh / install-api.sh) plus the Vagrant
# management network (libvirt NAT 192.168.121.0/24) so `vagrant ssh` keeps working (AUD-F008-02).
ufw allow from "${MGMT_CIDR:-10.10.10.0/24}" to any port 22 proto tcp
ufw allow from "${VAGRANT_MGMT_CIDR:-192.168.121.0/24}" to any port 22 proto tcp
ufw allow from 10.0.2.0/24 to any port 22 proto tcp   # VirtualBox NAT (teammates on the virtualbox provider)
if [[ -n "${SSH_CONNECTION:-}" ]]; then
  SSH_PEER_IP="${SSH_CONNECTION%% *}"
  if [[ "$SSH_PEER_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    ufw allow from "${SSH_PEER_IP}/32" to any port 22 proto tcp
  fi
fi
ufw allow 443/tcp
ufw --force enable

# 7. Smoke checks (Kestrel can take a few seconds on a 1-vCPU VM)
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:5000/health && break
  sleep 1
done
systemctl is-active frontendnet nginx
curl -fsS http://127.0.0.1:5000/health || { echo "ERROR: Kestrel health check failed (see journalctl -u frontendnet)" >&2; exit 1; }
echo " <- Kestrel OK"
curl -fsS --resolve web.dima.lab:443:127.0.0.1 https://web.dima.lab/health || { echo "ERROR: nginx TLS health check failed" >&2; exit 1; }
echo " <- nginx TLS OK"
if ! curl -fsS https://api.dima.lab/health; then
  echo "ERROR: https://api.dima.lab/health is not reachable from web (is the api VM installed?)" >&2
  exit 1
fi
echo " <- API reachable from web OK"
ss -tulpn | grep -E ':(80|443|3000|5000)\b' || true
