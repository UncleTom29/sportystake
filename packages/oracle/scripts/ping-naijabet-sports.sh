#!/usr/bin/env bash
set -euo pipefail

docker run --rm -v "$PWD/scripts:/work" python:3.10-slim sh -lc '
  pip install --no-cache-dir requests >/dev/null
  python /work/naijabet_extended_probe.py \
    --bookmaker bet9ja \
    --mode discover \
    --sports soccer,basketball,tennis,volleyball,baseball,ice \
    --max-competitions-per-sport 6
'
