# uCeltic
  
[![CI](https://github.com/uCeltic/uCeltic/actions/workflows/ci.yml/badge.svg)](https://github.com/uCeltic/uCeltic/actions/workflows/ci.yml)


All in one universal app for Medieval Irish text




# Project title: Web-based Annotator for Medieval Irish Text

## Author: Zhou Dejian

## Overview

Celtic Finder is a web-based text annotation tool specifically designed for Medieval Irish texts. It provides text similarity search functionality and annotation capabilities to help researchers and scholars work with historical Irish texts.

## For Developers

## Stack
- Frontend: React 19 + TypeScript + Vite + Zustand + Tailwind
- Backend: Django 6 + Django REST Framework
- Database: PostgreSQL

## Run with Docker Compose (full stack)

One command brings up **PostgreSQL + Django (gunicorn) + the built React bundle + Caddy**.
Caddy is a reverse proxy serving everything on a single origin: `/api`, `/admin` and
`/static` go to Django, everything else is the React app.

```bash
cp .env.example .env
# In .env set DB_PASSWORD and DJANGO_SUPERUSER_PASSWORD, then generate a SECRET_KEY.
# Use token_urlsafe — Compose treats a literal `$` in a value as variable interpolation:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # paste into SECRET_KEY=

docker compose up --build        # add -d to run in the background
```

Open **http://localhost**. The database starts empty — load a document through the admin:

1. Go to **http://localhost/admin** and log in with the `DJANGO_SUPERUSER_*` credentials
   from `.env` (the admin user is created automatically on first boot).
2. **TEI Documents → Add**, set a title, choose a `.xml`/`.tei` file, and **Save**
   (it is parsed automatically on upload).
3. Back on **http://localhost**, pick the document and search.

Secrets are read from `.env` only and are never committed (`.env` is gitignored — commit
`.env.example` instead). Uploaded files persist in the `media` volume and database data in
`pgdata`. This layer enforces **no authentication** by design; the access gate is added at
deploy time.

## Getting started
### Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Database env variable
python manage.py migrate
python manage.py runserver

### Frontend
cd client
npm install
npm run dev



### Testing & Coverage

HTTP-layer integration tests (Django + DRF `APITestCase`).

```bash
cd backend
coverage run manage.py test    # requires local Postgres (auto-creates test_uceltic)
coverage report
```

Backend coverage: 79% — view layer & core search/parse services ≥ 85%.


### Frontend tests

Vitest + Testing Library (jsdom). One command runs the whole suite:

```bash
cd client
npm test            # vitest run
npm run test:watch  # watch mode

Covers the Zustand stores (search / document / workspace), the wordRange
word-span → DOM Range helper, and one render test that drives the search flow
with the API layer mocked.