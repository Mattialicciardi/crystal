#!/usr/bin/env bash
# Crystal — build statica + deploy su GitHub Pages.
# Il sito pubblico resta https://mattialicciardi.github.io/crystal/
# GitHub Pages serve il branch gh-pages dalla radice. Vite usa base './',
# quindi gli asset restano relativi al project site.
# I conti SBS Italia sono già in web/public/sbs-it.json.
# Per rigenerarli dall'estratto Eurostat:
#   python3 pipeline/build_sbs_it.py
set -euo pipefail
cd "$(dirname "$0")"

REPO_SSH="git@github.com:Mattialicciardi/crystal.git"

echo "→ verifica dati e test"
generated="$(mktemp)"
trap 'rm -f "$generated"' EXIT
python3 - "$generated" <<'PYTHON'
import json
import sys
from pathlib import Path
from pipeline.build_sbs_it import build

Path(sys.argv[1]).write_text(
    json.dumps(build(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
)
PYTHON
cmp -s "$generated" web/public/sbs-it.json || {
  echo "Rigenera web/public/sbs-it.json con python3 pipeline/build_sbs_it.py" >&2
  exit 1
}
python3 -m pytest tests/
npm --prefix web ci --no-audit --no-fund
npm --prefix web test

echo "→ build statica"
npm --prefix web run build
touch web/dist/.nojekyll

echo "→ deploy su gh-pages"
rm -rf web/dist/.git
(
  cd web/dist
  git init -q
  git checkout -q -b gh-pages
  git add -A
  git -c user.name="Mattia Licciardi" -c user.email="mattialicciardi00@gmail.com" \
      commit -qm "deploy $(date -u +%Y-%m-%dT%H:%MZ)"
  git push -qf "$REPO_SSH" gh-pages
)
echo "✓ live: https://mattialicciardi.github.io/crystal/"
