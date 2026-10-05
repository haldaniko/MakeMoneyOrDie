# MakeMoneyOrDie

Publishing site with a React frontend, Django REST Framework backend, PostgreSQL, and OpenRouter article generation.

## Local development

```bash
docker compose up --build -d --remove-orphans
```

- Site: http://localhost:3000
- Frontend admin: http://localhost:3000/admin
- API health: http://localhost:4000/api/health

The backend runs Django migrations and imports data from the previous Node backend's tables on startup. It does not delete those tables or the existing PostgreSQL and uploads volumes. Repeating the import is safe.

If no admin exists, create one with:

```bash
docker compose exec backend python manage.py createsuperuser
```

Sign in at `/admin` with the username or email and password. Existing admin accounts are imported and their bcrypt passwords are upgraded after login.

Configure the OpenRouter API key, model, prompt, request limits, timezone, and automatic generation schedule in the frontend admin's **AI generation settings**. The API key is encrypted in PostgreSQL using `DJANGO_SECRET_KEY` and is never sent back to the browser. Keep that secret stable across deployments. Generated posts and uploaded cover images also live in persistent volumes.

The separate `scheduler` service reads the same settings and triggers scheduled generation. Manual generation is available from the admin toolbar.

## Production

Copy `.env.production.example` to `.env.production`, set the database password, a long stable Django secret, allowed host, frontend origin, and public API URL, then run:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d --remove-orphans
```

The frontend is exposed on port 8080, the API on port 4000. PostgreSQL stays internal. Back up the PostgreSQL and uploads volumes before upgrades. Do not use `docker compose down -v` if you want to retain data.

## API

Existing frontend routes remain available: `/api/posts`, `/api/posts/search`, `/api/posts/:slug`, `/api/subscribe`, `/api/auth/*`, `/api/admin/posts`, `/api/admin/media/covers`, `/api/admin/settings`, and `/api/ai/generate-article`.
