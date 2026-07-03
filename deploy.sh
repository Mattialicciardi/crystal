#!/usr/bin/env bash
# Crystal — build statica + deploy su GitHub Pages (branch gh-pages).
# Usa il sectors.json già versionato in web/public (NON rigenera dai dati ISTAT:
# per aggiornare i dati al nuovo rilascio ISTAT, lancia prima la pipeline —
#   python3 pipeline/fetch_istat.py && python3 pipeline/build.py — poi committa).
set -euo pipefail
cd "$(dirname "$0")"

REPO_SSH="git@github.com:Mattialicciardi/crystal.git"

echo "→ build statica"
npm --prefix web install --no-audit --no-fund >/dev/null 2>&1 || true
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
