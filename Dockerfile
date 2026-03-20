FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    GLOBALFLOW_AUTOPILOT_ENABLED=1

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY globalflow/requirements.txt ./globalflow/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY globalflow ./globalflow

RUN useradd --create-home appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn globalflow.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*'"]
