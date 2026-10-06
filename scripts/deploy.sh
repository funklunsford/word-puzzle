#!/usr/bin/env bash
# Publish the built game to GitHub Pages: only the site files, never the source.
#
#   npm run deploy        # → https://funklunsford.github.io/strokes/
#
# Builds, adds the licence notices the word list and definitions require on every copy, and
# force-pushes the result as a single commit to the public repo below (creating it and turning
# on Pages the first time).
#
# Every push to main runs this in GitHub Actions (.github/workflows/deploy.yml), with DEPLOY_KEY
# set to an SSH key that can push to that repo (scripts/setup-deploy-key.sh adds one). Run by
# hand, it needs the GitHub CLI, logged in (`gh auth login`).
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
if [ -n "${DEPLOY_KEY:-}" ]; then
  # In CI: git pushes over SSH with the deploy key, and commits as the GitHub Actions bot.
  KEY="$(mktemp)"
  trap 'rm -f "$KEY"' EXIT
  printf '%s\n' "$DEPLOY_KEY" >"$KEY"
  chmod 600 "$KEY"
  export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  export GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'
  export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
  REMOTE="git@github.com:${REPO}.git"
  AUTH=()
  EXISTS=true
else
  # By hand: git authenticates with the GitHub CLI's login for these commands only (git's settings
  # are untouched).
  REMOTE="https://github.com/${REPO}.git"
  AUTH=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
  EXISTS="$(gh repo view "$REPO" >/dev/null 2>&1 && echo true || echo false)"
fi
# Keep the live version's scripts and styles too: GitHub Pages lets browsers cache index.html for
# 10 minutes, and one still holding the old page would otherwise ask for files that are gone.
if [ "$EXISTS" = true ]; then
  LIVE="$(mktemp -d)"
  git ${AUTH[@]+"${AUTH[@]}"} clone -q --depth 1 "$REMOTE" "$LIVE"
  for f in $(grep -o 'assets/[^"]*' "$LIVE/index.html" 2>/dev/null || true); do
    [ -e "$SITE/$f" ] || cp "$LIVE/$f" "$SITE/$f"
  done
fi
SOURCE="$(git rev-parse --short HEAD)"
cd "$SITE"
git init -q -b main
git add -A
if [ -n "${DEPLOY_KEY:-}" ]; then
  git commit -q -m "Deploy Strokes (source ${SOURCE})"
else
  git commit -q -m "Deploy Strokes (source ${SOURCE})

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi

if [ "$EXISTS" != true ]; then
  gh repo create "$REPO" --public --description "Strokes: a word maze where every letter is built from pen strokes"
fi
git ${AUTH[@]+"${AUTH[@]}"} push -q --force "$REMOTE" main
if [ -z "${DEPLOY_KEY:-}" ] && ! gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/${REPO}/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

echo "Published: https://${REPO%%/*}.github.io/${REPO##*/}/ (GitHub may take a minute to update it)"
