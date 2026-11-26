#!/usr/bin/env bash
# Host-side: build frontendnet, bundle it with deploy files + web certs, upload to the "web" VM and install.
# Run from frontendnet/deploy/ after `vagrant up` and `./make-certs.sh`.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
BUNDLE="$OUT/dima-bundle"

rm -rf "$OUT"
mkdir -p "$BUNDLE/deploy" "$BUNDLE/certs"

dotnet publish "$HERE/../frontendnet.csproj" -c Release -r linux-x64 --self-contained true \
  -p:PublishSingleFile=false -o "$BUNDLE/frontendnet"

cp "$HERE"/{frontendnet.service,nginx-frontendnet.conf,dima-proxy.conf,install-web.sh} "$BUNDLE/deploy/"
cp "$HERE"/certs/{web.dima.lab.crt,web.dima.lab.key,dima-lab-ca.crt} "$BUNDLE/certs/"

tar -C "$OUT" -czf "$OUT/dima-bundle.tgz" dima-bundle
vagrant upload "$OUT/dima-bundle.tgz" /tmp/dima-bundle.tgz web
vagrant ssh web -c "sudo rm -rf /tmp/dima-bundle && sudo tar -C /tmp -xzf /tmp/dima-bundle.tgz && sudo bash /tmp/dima-bundle/deploy/install-web.sh"

# The bundle contains a private key: remove local copies once uploaded
rm -rf "$OUT"
