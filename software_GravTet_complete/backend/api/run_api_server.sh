#!/usr/bin/env bash
# Wrapper to run the API server with the same python3 on PATH.
# PYTHONPATH must include the backend root so `import api` resolves (package is backend/api/).
cd "$(dirname "$0")/.."
export PYTHONPATH=.
exec python3 api/api_server.py

