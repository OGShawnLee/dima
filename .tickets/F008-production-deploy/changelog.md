# F008 — Changelog

## Step A — Reconcile deploy files (2026-11-27, no VMs started)

### Files touched
| File | Change |
| :--- | :--- |
| `frontendnet/deploy/Vagrantfile` | Taken from `1c38d2c` (`debian/bookworm64` default, libvirt + virtualbox, web 1024 / api 768 / db 1024 MB, 1 vCPU, `DIMA_*` overrides, `--force-confdef/--force-confold`). Added `lv.default_prefix = "dima_"` (domains `dima_web|api|db`), kept VirtualBox names `dima-<name>`, warning when `VAGRANT_DOTFILE_PATH` is unset. |
| `frontendnet/deploy/deploy-all.sh` | **New.** Host orchestrator, phases `certs|up|db|api|seed|web|all`, each idempotent. Generates `backendnode/deploy/.env.deploy` once (mode 600, `openssl rand`, never printed, refuses if the path is not git-ignored). Stages the committed backend (`git archive HEAD backendnode`) in a private temp dir outside the repo, adds only the role's keys (+ api certs from `frontendnet/deploy/certs/`), uploads to a `0700` dir on the VM, extracts as root and runs `install-db.sh` / `install-api.sh` unchanged; uploads are deleted by an EXIT trap. Seeds once (marker `/var/lib/dima-deploy/seeded`, `DIMA_RESEED=1`). Defaults `VAGRANT_DOTFILE_PATH=$HOME/.local/share/dima-vagrant`, `DIMA_PROVIDER=libvirt`; honours `DIMA_BOX`. |
| `frontendnet/deploy/publish-web.sh` | Staging moved out of the repo (`mktemp`, removed by trap); private upload dir on the VM; remote bundle removed on every exit path; defaults `VAGRANT_DOTFILE_PATH`; checks certs exist. |
| `frontendnet/deploy/install-web.sh` | `apt-get update` + dpkg conf options; installs the distro ICU (`libicu72` Debian 12 / `libicu74` Ubuntu 24.04) required by the self-contained .NET app; bundle deleted by EXIT trap (also on failure); `restart` instead of `enable --now` so redeploys pick up new binaries; Kestrel readiness wait; nginx smoke check via `--resolve`; explicit error if the API is unreachable. |
| `frontendnet/deploy/frontendnet.service` | `UMask=0077` so `/var/lib/frontendnet/keys` is `0700` and key files `0600`; dropped unused `LogsDirectory` (logs → journal); `DOTNET_gcServer=0` for the 1 GB VM. Keys path and `UrlWebAPI` identical to `appsettings.Production.json`. |
| `frontendnet/deploy/nginx-frontendnet.conf` | Single owner per header: nginx sends HSTS + `nosniff` (`always`) and hides the app's copies (`proxy_hide_header`); CSP / XFO / Referrer / Permissions come only from `SecurityHeadersMiddleware`. Rate limit now applies to POST only and is case-insensitive (`/Auth`, `/auth`, `/Auth/Index`, `/Registro`). `ssl_session_tickets off`. Still no port-80 listener. |
| `frontendnet/deploy/dima-proxy.conf` | Still overwrites `X-Forwarded-For` with `$remote_addr`; strips `X-Forwarded-Host`. |
| `frontendnet/deploy/make-certs.sh` | Idempotent: keeps valid leaf certs (`DIMA_RENEW_CERTS=1` re-issues); CA has explicit `basicConstraints=critical,CA:TRUE` + `keyUsage`; leaf `CA:FALSE`; `umask 077`. |
| `frontendnet/deploy/.gitignore` | Adds `.env.deploy` (keeps `certs/`, `out/`, `.vagrant/`, `*.tgz`). |
| `frontendnet/deploy/DEPLOY-PLAN.md` | Rewritten around `deploy-all.sh` and the backend scripts; secrets/certs flow; the 2 host manual steps with exact commands; Vagrant state outside the repo; reboot via `vagrant reload` / `dima_*` domains. |
| `frontendnet/appsettings.Production.json` | No secrets; `UrlWebAPI=https://api.dima.lab`; logging `Warning` (+ `Hosting.Lifetime` Information for startup lines); `AllowedHosts=web.dima.lab;localhost;127.0.0.1`; `DataProtection:KeysPath=/var/lib/frontendnet/keys` (matches the unit). |

### Decisions
- Certificates/keys never go into `backendnode/deploy/certs/` (not git-ignored); they are placed directly in the uploaded bundle so `install-api.sh`'s default `CERTS_DIR` finds them on the VM.
- Least privilege per VM: `db` never receives `JWT_SECRET`; `api` never receives `DB_ROOT_PASSWORD`.
- `DB_DATABASE=mercadolibrenode` in `.env.deploy` (the name `SCHEMA.sql` creates), plus a `backup-db.service` drop-in on `db` with the same name — workaround for backend issue 1 below.
- Backend deployed from committed `HEAD` (warns if `backendnode/` has uncommitted changes).
- Seeder runs with `NODE_ENV=development` for that one process (env beats `--env-file`); failures are not masked (`|| true` from the backend README is not used).

### Static checks (output)
```text
$ bash -n frontendnet/deploy/*.sh
bash -n OK deploy-all.sh / install-web.sh / make-certs.sh / publish-web.sh
$ shellcheck -x frontendnet/deploy/*.sh        # ShellCheck 0.11.0 (pip shellcheck-py, scratch venv)
exit=0   (also exit=0 on backendnode/deploy/*.sh, read-only)
$ ruby -c frontendnet/deploy/Vagrantfile
Syntax OK
$ VAGRANT_DOTFILE_PATH=<scratch> vagrant validate      (also with DIMA_BOX=cloud-image/ubuntu-24.04)
Vagrantfile validated successfully.                     (no VM created, no .vagrant/ in the repo)
$ docker run --rm --network none nginx:alpine nginx -t  (site + snippet + throwaway certs mounted)
nginx: [warn] the "listen ... http2" directive is deprecated   <- 1.25+ only; kept for nginx 1.22/1.24
nginx: configuration file /etc/nginx/nginx.conf test is successful
$ make-certs.sh <scratch> (twice)
2nd run: "Keeping existing ... certificate"; web cert: OK against CA; CA: Basic Constraints critical, CA:TRUE
$ stage_backend api|db (functions from deploy-all.sh, throwaway env + certs)
api keys: DB_PASSWORD JWT_SECRET DB_DATABASE DB_USER; db keys: DB_ROOT_PASSWORD DB_APP_PASSWORD DB_DATABASE DB_USER
stage dir 700, .env.deploy 600, api key 600; tarball has 0 node_modules/.env entries
$ dotnet build frontendnet/frontendnet.csproj -c Release
0 Warning(s)  0 Error(s)
$ git check-ignore -v backendnode/deploy/.env.deploy
.gitignore:8:.env.*  backendnode/deploy/.env.deploy
$ git status --ignored   -> only tracked deploy files modified; no certs/, out/, .env.deploy, .vagrant/ present or tracked
```

### Backend-script issues found (for the router → `BACK-HANDOFF.md`; `backendnode/**` not edited)
1. **Database name mismatch (blocking without workaround).** `SCHEMA.sql` hard-codes `CREATE DATABASE`/`USE mercadolibrenode` (and `setup-env.mjs` defaults to it), but `install-db.sh`, `install-api.sh`, `backup-db.sh`, `backup-db.service` (`Environment=DB_DATABASE=dima_db`), `README.md` and `.env.example` default to `dima_db`. With defaults: grants go to a non-existent `dima_db`, the API cannot read any table, and the nightly backup fails. Worked around here (`DB_DATABASE=mercadolibrenode` + service drop-in); fix: one name everywhere, and make `backup-db.service` read it from a config file.
2. **`backup-db.sh` leaves a world-readable partial dump on failure**: the `> "$BACKUP_FILE"` redirect creates the file with the default umask before `chmod 600`; with `pipefail` a failed `mysqldump` exits before the chmod. Fix: `umask 077` at the top.
3. **README §1 step 3 says to copy `api.dima.lab.key` into `backendnode/deploy/certs/`, which is not git-ignored** (risk of committing a private key). Fix: ignore `backendnode/deploy/certs/` or document `CERTS_DIR` outside the repo.
4. **README upload command `vagrant upload backendnode /tmp/backendnode`** ships the working tree (incl. `node_modules/`, a developer `.env`) and the full `.env.deploy` (root DB password) to every VM, and leaves it in world-readable `/tmp` afterwards. `deploy-all.sh` avoids this; the README should point to it.
5. **Seed command in README ends with `|| true`**, hiding seeding failures; and the seeder creates `gvera@uv.mx` / `patito@uv.mx` with password `patito` in the production DB — change these passwords after the demo (F009 / audit note).
6. **MySQL bound to `10.10.10.30`** while `mysql.service` only orders after `network.target`: after a reboot mysqld can start before the private interface has its address and fail to bind. Suggest a drop-in `After=network-online.target` / `Wants=network-online.target` (verify in the step-B reboot drill).
7. Minor: `install-db.sh` sets the root password only while socket auth still works; rotating `DB_ROOT_PASSWORD` later silently desyncs `/etc/dima/backup.cnf`. `DB_SSL=false` by default (DB traffic in clear on the isolated lab network).
