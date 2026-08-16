#!/usr/bin/env bash
set -euo pipefail

docker run --rm python:3.10-slim sh -lc "
  pip install --no-cache-dir NaijaBet-Api requests arrow aiohttp beautifulsoup4 lxml jmespath >/dev/null
  python - <<'PY'
from NaijaBet_Api.bookmakers.bet9ja import Bet9ja
from NaijaBet_Api.id import Betid

api = Bet9ja()
rows = api.get_league(Betid.PREMIERLEAGUE)

print('source=NaijaBet_Api bookmaker=Bet9ja league=PREMIERLEAGUE')
print('rows', len(rows))
if rows:
    first = rows[0]
    print('sample_match', first.get('match'))
    print('sample_odds', first.get('home'), first.get('draw'), first.get('away'))
PY
"