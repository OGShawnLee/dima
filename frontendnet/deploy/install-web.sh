#!/usr/bin/env bash
# Installs/updates frontendnet on the "web" VM. Run inside the VM as root:
#   sudo bash /tmp/dima-bundle/deploy/install-web.sh   (publish-web.sh does this for you)
# Expects (uploaded by `vagrant upload`):
#   /tmp/dima-bundle/frontendnet/  self-contained publish output (linux-x64)
#   /tmp/dima-bundle/deploy/       service + nginx files
#   /tmp/dima-bundle/certs/        web.dima.lab.{crt,key}, dima-lab-ca.crt
set -euo pipefail

APP_DIR=/opt/frontendnet

# 1. Packages
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx ufw

# 2. Trust the lab CA (needed for HttpClient -> https://api.dima.lab)
install -m 644 /tmp/dima-bundle/certs/dima-lab-ca.crt /usr/local/share/ca-certificates/dima-lab-ca.crt
update-ca-certificates

# 3. Service account + app files (read-only for the service user)
id frontendnet &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin frontendnet
systemctl stop frontendnet 2>/dev/null || true
rm -rf "$APP_DIR"
install -d -o root -g root -m 755 "$APP_DIR"
cp -a /tmp/dima-bundle/frontendnet/. "$APP_DIR"/
chown -R root:root "$APP_DIR"
chmod 755 "$APP_DIR/frontendnet"

# 4. systemd unit
install -m 644 /tmp/dima-bundle/deploy/frontendnet.service /etc/systemd/system/frontendnet.service
systemctl daemon-reload
systemctl enable --now frontendnet

# 5. TLS + nginx reverse proxy
install -d -m 755 /etc/ssl/dima
install -m 644 /tmp/dima-bundle/certs/web.dima.lab.crt /etc/ssl/dima/web.dima.lab.crt
install -m 600 /tmp/dima-bundle/certs/web.dima.lab.key /etc/ssl/dima/web.dima.lab.key
install -m 644 /tmp/dima-bundle/deploy/dima-proxy.conf /etc/nginx/snippets/dima-proxy.conf
install -m 644 /tmp/dima-bundle/deploy/nginx-frontendnet.conf /etc/nginx/sites-available/frontendnet
ln -sf /etc/nginx/sites-available/frontendnet /etc/nginx/sites-enabled/frontendnet
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

# 6. Firewall: only SSH and HTTPS
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 443/tcp
ufw --force enable

# 7. Smoke checks
sleep 3
systemctl is-active frontendnet nginx
curl -fsS http://127.0.0.1:5000/health && echo " <- Kestrel OK"
curl -fsS https://web.dima.lab/health && echo " <- nginx TLS OK"
curl -fsS https://api.dima.lab/health && echo " <- API reachable from web OK"
ss -tulpn | grep -E ':(80|443|3000|5000)\b' || true

# 8. Remove the uploaded bundle (contains the TLS private key)
rm -rf /tmp/dima-bundle /tmp/dima-bundle.tgz
