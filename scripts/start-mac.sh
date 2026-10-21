#!/usr/bin/env bash
# Start Prelegal in Docker on macOS.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env file. Copy .env.example to .env and set OPENROUTER_API_KEY." >&2
  exit 1
fi

docker compose up --build --detach --wait
echo "Prelegal is running at http://localhost:8000/"
