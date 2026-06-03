# uCeltic
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
npm start
```
The development server will start on `http://localhost:3000` and proxy API requests to the backend on port 8080.

#### 4. Python Dependencies (for search algorithms)
```bash
cd server/service
pip install -r requirements.txt
```

## Testing & Coverage

HTTP-layer integration tests (Django + DRF `APITestCase`).

```bash
cd backend
coverage run manage.py test    # requires local Postgres (auto-creates test_uceltic)
coverage report
```

Backend coverage: 79% — view layer & core search/parse services ≥ 85%.