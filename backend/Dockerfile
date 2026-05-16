FROM python:3.11-slim

# Increment to bust Railway's build cache (forces full rebuild without baked-in ML models)
ARG CACHEBUST=2

WORKDIR /app

# Install system deps for docling, pdfplumber, python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-rus \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/.model_cache

COPY . .

RUN mkdir -p /app/storage/uploads

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
