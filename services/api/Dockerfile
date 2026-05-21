# Build from repo root only (Railway Root Directory = /).
# Same as /Dockerfile.api — paths assume monorepo root as Docker context.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-impress \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/services/api

COPY services/api/pyproject.toml ./
COPY services/api/app ./app
COPY python-packages /python-packages
COPY prompts /prompts

ENV PYTHONPATH=/python-packages:/app/services/api
ENV PROMPTS_DIR=/prompts

RUN pip install --no-cache-dir -e ".[llm]" \
    && pip install pdf2image

EXPOSE 8000
ENV PORT=8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
