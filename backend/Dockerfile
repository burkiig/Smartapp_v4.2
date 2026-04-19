FROM python:3.12-slim

WORKDIR /app

# System deps for insightface / onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install psycopg2 for PostgreSQL support
RUN pip install --no-cache-dir psycopg2-binary

COPY . .

EXPOSE 8000

CMD ["gunicorn", "main:app", \
     "-w", "2", "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "--timeout", "120"]
