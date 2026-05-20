FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-impress \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
COPY ../../python-packages /python-packages
COPY ../../prompts /prompts

ENV PYTHONPATH=/python-packages:/app
RUN pip install --no-cache-dir -e ".[llm]" \
    && pip install playwright pdf2image \
    && playwright install chromium --with-deps || playwright install chromium

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
