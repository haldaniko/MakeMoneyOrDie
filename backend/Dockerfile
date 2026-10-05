FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 4000

FROM base AS dev
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py import_legacy && python manage.py runserver 0.0.0.0:4000"]

FROM base AS prod
RUN python manage.py collectstatic --noinput
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py import_legacy && gunicorn config.wsgi:application --bind 0.0.0.0:4000 --workers 2 --timeout 1000"]
