#!/usr/bin/env bash
# Creates a private lab CA and TLS certificates for web.dima.lab and api.dima.lab.
# Run on the HOST from frontendnet/deploy/. Output goes to ./certs (git-ignored: never commit keys).
set -euo pipefail

OUT="${1:-certs}"
DAYS=825
mkdir -p "$OUT"
chmod 700 "$OUT"
cd "$OUT"

if [[ ! -f dima-lab-ca.key ]]; then
  openssl genrsa -out dima-lab-ca.key 4096
  openssl req -x509 -new -key dima-lab-ca.key -sha256 -days 3650 \
    -subj "/CN=Dima Lab CA" -out dima-lab-ca.crt
fi

for host in web.dima.lab api.dima.lab; do
  openssl genrsa -out "$host.key" 2048
  openssl req -new -key "$host.key" -subj "/CN=$host" -out "$host.csr"
  printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n' "$host" > "$host.ext"
  openssl x509 -req -in "$host.csr" -CA dima-lab-ca.crt -CAkey dima-lab-ca.key -CAcreateserial \
    -out "$host.crt" -days "$DAYS" -sha256 -extfile "$host.ext"
  rm -f "$host.csr" "$host.ext"
done

chmod 600 ./*.key
echo "Done. Import $OUT/dima-lab-ca.crt into your browser (Authorities) and into each VM trust store."
