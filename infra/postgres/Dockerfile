FROM pgvector/pgvector:0.8.7-pg17

ARG PG_TEXTSEARCH_VERSION=1.3.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
    postgresql-server-dev-17 \
  && git clone --branch "v${PG_TEXTSEARCH_VERSION}" --depth 1 \
    https://github.com/timescale/pg_textsearch.git /tmp/pg_textsearch \
  && make -C /tmp/pg_textsearch \
  && make -C /tmp/pg_textsearch install \
  && rm -rf /tmp/pg_textsearch \
  && apt-get purge -y build-essential git postgresql-server-dev-17 \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
