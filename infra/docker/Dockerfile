FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY apps/core /app/apps/core
COPY apps/cli /app/apps/cli
COPY infra /app/infra
COPY index.html app.js style.css sound.js favicon.svg og.svg _headers robots.txt sitemap.xml beacon.json /app/

RUN pip install --no-cache-dir /app/apps/core

EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8089/healthz || exit 1

CMD ["python3", "-m", "http.server", "8089"]
