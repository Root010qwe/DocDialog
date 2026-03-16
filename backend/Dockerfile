FROM python:3.11-slim

WORKDIR /app

# Install system deps for docling, pdfplumber, python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-rus \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding & reranker models to avoid cold start
ENV HF_HOME=/app/.model_cache
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('intfloat/multilingual-e5-large'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2') \
"

COPY . .

# Create storage directory
RUN mkdir -p /app/storage/uploads

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
