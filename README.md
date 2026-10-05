# MakeMoneyOrDie

Publishing site with a React frontend, Django REST Framework backend, PostgreSQL, and OpenRouter article generation.

## Production deployment

The production configuration is kept in one `docker-compose.yml`. Runtime settings such as the domains, ports, database name, CORS, and Vite API URL are fixed there. The root `.env` contains the database and Django secrets, allowed hosts, and optional OpenRouter defaults.

```bash
cp .env.sample .env
```

Set `POSTGRES_PASSWORD` to a strong database password and `DJANGO_SECRET_KEY` to a long random value. Keep both values stable across deployments. `DJANGO_SECRET_KEY` also encrypts the OpenRouter key stored in the database. Set `DJANGO_ALLOWED_HOSTS` to `makemoneyordie.com,www.makemoneyordie.com`. OpenRouter settings can be supplied in `.env`; values saved in the admin take precedence. The API key can also be set in the admin, where it is encrypted in PostgreSQL.

Start or update the site:

```bash
docker compose up --build -d --remove-orphans
```

Nginx proxies the site to `127.0.0.1:9005` and routes `/api/` and `/uploads/` on the same `makemoneyordie.com` domain to the backend at `127.0.0.1:8018`; no API subdomain is needed. The config is in `deploy/nginx/makemoneyordie.conf`.

The backend runs Django migrations and imports data from the previous Node backend's tables on startup. The import does not delete the old tables. PostgreSQL and uploads use persistent Docker volumes. Back them up before upgrades, and do not run `docker compose down -v` if you want to keep the data.

Create an administrator if one does not already exist:

```bash
docker compose exec backend python manage.py createsuperuser
```

Configure the OpenRouter key, model, prompt, request limits, timezone, and automatic generation schedule in the frontend admin's **AI generation settings**. The key is encrypted in PostgreSQL. The `scheduler` service reads those settings and triggers scheduled generation.

## API

Existing frontend routes remain available: `/api/posts`, `/api/posts/search`, `/api/posts/:slug`, `/api/subscribe`, `/api/auth/*`, `/api/admin/posts`, `/api/admin/media/covers`, `/api/admin/settings`, and `/api/ai/generate-article`.
