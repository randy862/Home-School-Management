# Hosted Deployment Runbook

## Purpose
Stand up the first hosted single-tenant deployment across `APP001`, `WEB001`, and `SQL001`.

## APP001
1. Copy `server/` to `/home/debian/apps/home-school-management/server`.
2. Install dependencies with `npm install`.
3. Apply PostgreSQL migrations with `node src/scripts/migrate-postgres.js`.
4. Seed the bootstrap admin with `node src/scripts/seed-postgres-admin.js`.
5. Install the user service from `infra/systemd/home-school-management.service`.
6. Enable and start the service with:
   - `systemctl --user daemon-reload`
   - `systemctl --user enable --now home-school-management.service`
7. Verify with:
   - `systemctl --user status home-school-management.service`
   - `curl http://127.0.0.1:3000/health`

## WEB001
1. Copy `web/` to `/var/www/home-school-management/web`.
2. Copy `infra/apache/home-school-management.conf` to `/etc/apache2/sites-available/home-school-management.conf`.
3. Enable Apache modules:
   - `sudo a2enmod proxy`
   - `sudo a2enmod proxy_http`
4. Enable the site:
   - `sudo a2ensite home-school-management.conf`
5. Reload Apache:
   - `sudo systemctl reload apache2`
6. Verify:
   - `curl http://127.0.0.1/health`

## SQL001
1. Ensure `appuser` owns or can create in schema `public`.
2. Verify tables with `\dt`.
3. Verify the seeded admin exists in `users`.

## Current Test URLs
- API health: `http://192.168.1.200:3000/health`
- Planned hosted web URL after Apache deployment: `http://192.168.1.210/`
