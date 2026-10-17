FROM python:3.12.14-slim-trixie AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.23 /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./

FROM builder AS test
RUN uv sync --frozen --group dev
CMD ["/app/.venv/bin/pytest", "-q"]

FROM python:3.12.14-slim-trixie AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home --uid 10001 janamen
WORKDIR /app
COPY --from=builder /app /app
COPY --chmod=755 scripts/deploy/entrypoint.sh /entrypoint.sh
RUN mkdir -p /app/staticfiles /app/runtime && chown -R janamen:janamen /app/staticfiles /app/runtime
USER janamen
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
