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
npm run dev