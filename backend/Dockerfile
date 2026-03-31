FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for bcrypt / cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x startup.sh

# Default SQLite path — override with DATABASE_URL env var for production
ENV DATABASE_URL=sqlite+aiosqlite:///./neardrop.db

EXPOSE 8000

CMD ["./startup.sh"]
