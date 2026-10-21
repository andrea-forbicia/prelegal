#!/usr/bin/env bash
# Stop Prelegal on Windows (run from Git Bash). The database is discarded with the container.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose down
echo "Prelegal stopped."
