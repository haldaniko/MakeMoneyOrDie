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

## Telegram publishing integration

The bot API is available at `https://makemoneyordie.com/api/bot/v1/` (or the configured `SITE_URL` in local development). Every request requires `Authorization: Bearer <BOT_INTEGRATION_TOKEN>`; this is a site-specific secret and is not a Telegram token or an admin JWT.

Supported endpoints are `GET options/`, `POST articles/`, `GET articles/<external_id>/`, `PUT articles/<external_id>/image/`, and `POST articles/<external_id>/publish/`. Bot-created posts are stored as drafts until the publish endpoint is called. Repeating a request with the same UUID and payload is safe; changing the payload returns `409`.

Required site environment variables:

```text
SITE_URL=https://makemoneyordie.com
BOT_INTEGRATION_TOKEN=<site-specific-secret>
```

Run `python manage.py migrate` after updating the deployment. The ready-to-add bot configuration is:

```json
{"id":"makemoneyordie","name":"MakeMoneyOrDie","api_base":"https://makemoneyordie.com/api/bot/v1/","token_env":"MAKEMONEYORDIE_INTEGRATION_TOKEN"}
```

Set `MAKEMONEYORDIE_INTEGRATION_TOKEN` in the bot environment to exactly the same secret as this site's `BOT_INTEGRATION_TOKEN`.

## Book checkout and delivery

The home page includes a digital-book offer backed by Stripe Checkout. Copy the final PDF to `private/make-money-or-die.pdf`; this directory is mounted read-only into the backend and the PDF is ignored by Git. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`, along with the optional book title, price, currency, file path, and download lifetime shown in `.env.sample`.

In Stripe Workbench, create a webhook destination for:

```text
https://makemoneyordie.com/api/stripe/webhook
```

Subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then place its signing secret in `STRIPE_WEBHOOK_SECRET`. Successful orders receive a signed, time-limited download URL; the PDF is never served from a public static directory.
