# F008 — Verification Spec (run on the deployed servers)

## Topology
- [ ] Three separate servers: `web` (frontend), `api` (backend), `db` (MySQL).
- [ ] `sudo ss -tulpn` on `web`: public listeners only `22`, `443`; Kestrel only on `127.0.0.1:5000`.
- [ ] `sudo ss -tulpn` on `api`: `3000` only on `127.0.0.1`; `443` reachable **only** from `web` (`ufw status`).
- [ ] `db`: `3306` reachable **only** from `api`; app user is not `root` and has DML grants only.
- [ ] From the host: `curl -k https://api.dima.lab` and `nc -zv 10.10.10.30 3306` fail; `curl -I http://web.dima.lab` fails (port 80 closed).

## Services
- [ ] `systemctl is-enabled frontendnet nginx` → `enabled`; `Restart=always`.
- [ ] Reboot all three VMs → app works without manual steps (rubric test 5).
- [ ] `kill -9` the Kestrel PID → systemd restarts it within 5 s.
- [ ] `db`: `systemctl list-timers backup-db.timer` active; one manual run leaves a `0600` dump in `/var/backups/dima`.
- [ ] VMs survive deletion of the F008 worktree (`VAGRANT_DOTFILE_PATH` outside the repo, `default_prefix = "dima_"`).

## Security
- [ ] HTTPS with the lab CA trusted in the browser; HSTS header present.
- [ ] Response headers: CSP, `nosniff`, `X-Frame-Options`, no `Server` version (`server_tokens off`).
- [ ] Cookie `.frontendnet` has `Secure; HttpOnly; SameSite=Strict`.
- [ ] Data Protection keys in `/var/lib/frontendnet/keys` (mode `700`, owner `frontendnet`); restarting `frontendnet` keeps users logged in.
- [ ] nginx and app logs written; failed logins visible in Bitácora with the **browser's** IP.
- [ ] 11 failed logins for one email from one browser do not lock out a different user (backend `${ip}:${email}` limiter, `DEC-016`).
- [ ] `git status` clean of secrets: `certs/`, `out/`, `.env.deploy`, `.vagrant/` ignored; no secret in `appsettings*.json` or unit files.

## End-to-end (from the host browser at `https://web.dima.lab`)
- [ ] Admin: CRUD category, upload image, product with cover, view orders, Bitácora.
- [ ] Usuario: self-register, add to cart, checkout, see the order in Mis pedidos.

## Rubric live tests
1. [ ] Client validation blocks invalid forms.
2. [ ] API rejects invalid input without the client (curl/Swagger from `web`).
3. [ ] Private sections: anonymous → `/Auth`; Usuario → AccessDenied on admin pages.
4. [ ] Injected error in a controller does not take the API down (backend owner).
5. [ ] Auto-start after reboot.
6. [ ] JWT refresh visible (`Set-Authorization` → cookie re-issued) within the last 5 minutes.
7. [ ] `netstat -tulpn`/`ss -tulpn` shows 3000 and 80 closed to the outside.
