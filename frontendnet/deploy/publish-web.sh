#!/usr/bin/env bash
# Host-side: build frontendnet, bundle it with deploy files + web certs, upload to the "web" VM and install.
# Run from frontendnet/deploy/ after `vagrant up` and `./make-certs.sh` (deploy-all.sh calls it as phase "web").
# The bundle (it contains the web TLS private key) is staged in a private temp dir OUTSIDE the repository
# and removed on exit, locally and on the VM.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
export VAGRANT_DOTFILE_PATH="${VAGRANT_DOTFILE_PATH:-$HOME/.local/share/dima-vagrant}"

for f in dima-lab-ca.crt web.dima.lab.crt web.dima.lab.key; do
  [[ -f "certs/$f" ]] || { echo "ERROR: certs/$f missing; run ./make-certs.sh first" >&2; exit 1; }
done

umask 077
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/dima-web.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
BUNDLE="$STAGE/dima-bundle"
mkdir -p "$BUNDLE/deploy" "$BUNDLE/certs"

dotnet publish "$HERE/../frontendnet.csproj" -c Release -r linux-x64 --self-contained true \
  -p:PublishSingleFile=false -o "$BUNDLE/frontendnet"

cp "$HERE"/{frontendnet.service,nginx-frontendnet.conf,dima-proxy.conf,install-web.sh} "$BUNDLE/deploy/"
cp "$HERE"/certs/{web.dima.lab.crt,web.dima.lab.key,dima-lab-ca.crt} "$BUNDLE/certs/"

tar -C "$STAGE" -czf "$STAGE/dima-bundle.tgz" dima-bundle

# Upload into a vagrant-only (0700) directory, extract as root into a root-only directory, install,
# and always delete the uploaded copies (they contain the TLS key) even if the install fails.
UP=/tmp/dima-upload-web
vagrant ssh web -c "sudo rm -rf $UP && install -d -m 700 $UP"
vagrant upload "$STAGE/dima-bundle.tgz" "$UP/dima-bundle.tgz" web
vagrant ssh web -c "sudo bash -c 'set -euo pipefail
  trap \"rm -rf /tmp/dima-bundle $UP\" EXIT
  rm -rf /tmp/dima-bundle && install -d -m 700 /tmp/dima-bundle
  tar --no-same-owner -C /tmp -xzf $UP/dima-bundle.tgz
  bash /tmp/dima-bundle/deploy/install-web.sh'"
