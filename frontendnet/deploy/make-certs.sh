#!/usr/bin/env bash
# Creates a private lab CA and TLS certificates for web.dima.lab and api.dima.lab.
# Run on the HOST from frontendnet/deploy/. Output goes to ./certs (git-ignored: never commit keys).
# Idempotent: existing CA and leaf certificates are kept; set DIMA_RENEW_CERTS=1 to re-issue the leaf certs.
set -euo pipefail

OUT="${1:-certs}"
DAYS=825
RENEW="${DIMA_RENEW_CERTS:-0}"
umask 077
mkdir -p "$OUT"
chmod 700 "$OUT"
cd "$OUT"

if [[ ! -f dima-lab-ca.key || ! -f dima-lab-ca.crt ]]; then
  openssl genrsa -out dima-lab-ca.key 4096
  openssl req -x509 -new -key dima-lab-ca.key -sha256 -days 3650 \
    -subj "/CN=Dima Lab CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out dima-lab-ca.crt
fi

for host in web.dima.lab api.dima.lab; do
  if [[ "$RENEW" != "1" && -f "$host.key" && -f "$host.crt" ]] \
    && openssl verify -CAfile dima-lab-ca.crt "$host.crt" >/dev/null 2>&1; then
    echo "Keeping existing $host certificate (DIMA_RENEW_CERTS=1 to re-issue)."
    continue
  fi
  openssl genrsa -out "$host.key" 2048
  openssl req -new -key "$host.key" -subj "/CN=$host" -out "$host.csr"
  printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\nbasicConstraints=CA:FALSE\n' "$host" > "$host.ext"
  openssl x509 -req -in "$host.csr" -CA dima-lab-ca.crt -CAkey dima-lab-ca.key -CAcreateserial \
    -out "$host.crt" -days "$DAYS" -sha256 -extfile "$host.ext"
  rm -f "$host.csr" "$host.ext"
done

chmod 600 ./*.key
chmod 644 ./*.crt
echo "Done. Import $OUT/dima-lab-ca.crt into your browser (Authorities); the deploy scripts install it on the VMs."
