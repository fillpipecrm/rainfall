#!/usr/bin/env bash
set -euo pipefail

PG_CTL="/Users/briandavidson/Applications/Postgres.app/Contents/Versions/16/bin/pg_ctl"
PG_DATA="/Users/briandavidson/.local/share/postgres-rainfall-go/data"

if [[ ! -x "${PG_CTL}" ]]; then
  echo "pg_ctl not found at ${PG_CTL}" >&2
  exit 1
fi

"${PG_CTL}" -D "${PG_DATA}" stop
