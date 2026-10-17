.PHONY: prepare up down install test test-postgres lint schema skills

prepare:
	python3 scripts/dev.py prepare

up:
	python3 scripts/dev.py up

down:
	python3 scripts/dev.py down

install:
	cd backend && uv sync --frozen --group dev

test:
	cd backend && uv run --frozen pytest -q

test-postgres:
	python3 scripts/dev.py test-postgres

lint:
	cd backend && uv run --frozen ruff check .

schema:
	cd backend && uv run --frozen python manage.py spectacular --file ../contracts/openapi.yaml --validate --fail-on-warn

skills:
	node scripts/tooling/verify-skills.mjs
