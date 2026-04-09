FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

ARG TUS_JS_VERSION=4.2.3

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    assimp-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -U pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/static/vendor \
    && curl -fsSL "https://cdn.jsdelivr.net/npm/tus-js-client@${TUS_JS_VERSION}/dist/tus.min.js" \
       -o /app/static/vendor/tus.min.js

EXPOSE 8080

CMD ["gunicorn", "--workers", "1", "--worker-class", "gthread", "--threads", "8", "--timeout", "120", "--bind", "0.0.0.0:8080", "wsgi:application"]



