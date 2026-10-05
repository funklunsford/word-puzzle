#!/usr/bin/env bash
# Publish the built game to GitHub Pages: only the site files, never the source.
#
#   npm run deploy        # → https://funklunsford.github.io/strokes/
#
# Builds, adds the licence notices the word list and definitions require on every copy, and
# force-pushes the result as a single commit to the public repo below (creating it and turning
# on Pages the first time). Needs the GitHub CLI, logged in (`gh auth login`).
set -euo pipefail

REPO="${STROKES_REPO:-funklunsford/strokes}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

# Licences: SCOWL's notice (from the word list's header) and WordNet's licence.
mkdir -p dist/licenses
grep '^#' data/familiar-4.txt | sed -E 's/^# ?//' > dist/licenses/SCOWL.txt
cp data/WORDNET-LICENSE.txt dist/licenses/WORDNET.txt
touch dist/.nojekyll # serve files as they are
cat > dist/README.md <<'MD'
# Strokes

A word maze where every letter is built from pen strokes. Play it at https://funklunsford.github.io/strokes/

This repository holds only the built site, published from a private source project.

- Word list derived from [SCOWL](https://wordlist.aspell.net) by Kevin Atkinson (notice in `licenses/SCOWL.txt`) and ENABLE (public domain).
- Definitions from [WordNet](https://wordnet.princeton.edu) 3.0, Copyright 2006 by Princeton University (licence in `licenses/WORDNET.txt`), with hand-written additions.
MD

SITE="$(mktemp -d)"
cp -R dist/. "$SITE"
# Git authenticates with the GitHub CLI's login for these commands only (git's settings are untouched).
# Keep the live version's scripts and styles too: GitHub Pages lets browsers cache index.html for
# 10 minutes, and one still holding the old page would otherwise ask for files that are gone.
AUTH=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
if gh repo view "$REPO" >/dev/null 2>&1; then
  LIVE="$(mktemp -d)"
  git "${AUTH[@]}" clone -q --depth 1 "https://github.com/${REPO}.git" "$LIVE"
  for f in $(grep -o 'assets/[^"]*' "$LIVE/index.html" 2>/dev/null || true); do
    [ -e "$SITE/$f" ] || cp "$LIVE/$f" "$SITE/$f"
  done
fi
SOURCE="$(git rev-parse --short HEAD)"
cd "$SITE"
git init -q -b main
git add -A
git commit -q -m "Deploy Strokes (source ${SOURCE})

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "Strokes: a word maze where every letter is built from pen strokes"
fi
git "${AUTH[@]}" push -q --force "https://github.com/${REPO}.git" main
if ! gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/${REPO}/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

echo "Published: https://${REPO%%/*}.github.io/${REPO##*/}/ (GitHub may take a minute to update it)"
