#!/usr/bin/env bash
set -euo pipefail

docker run --rm -v "$PWD/scripts:/work" python:3.10-slim sh -lc '
  pip install --no-cache-dir requests >/dev/null
  python /work/bet9ja_live_compare.py --league PREMIERLEAGUE
'
