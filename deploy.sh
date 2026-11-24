#!/usr/bin/env bash
# BoxLens deploy helpers — pick one host. All are free for static sites.
# Usage:  bash deploy.sh <host>   where <host> = pages | netlify | vercel | surge | local
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

HOST="${1:-local}"

case "$HOST" in
  local)
    echo ">> Serving BoxLens on http://localhost:8000  (Ctrl-C to stop)"
    python3 -m http.server 8000
    ;;
  pages)
    echo ">> GitHub Pages deploys automatically via .github/workflows/deploy-pages.yml"
    echo ">> One-time: repo Settings → Pages → Source = 'GitHub Actions'."
    echo ">> Then push to main:"
    echo "   git add -A && git commit -m 'Deploy BoxLens' && git push"
    ;;
  netlify)
    echo ">> Netlify CLI deploy"
    if ! command -v netlify >/dev/null 2>&1; then
      echo "   installing netlify CLI..."; npm install -g netlify-cli
    fi
    # First time: 'netlify login' then 'netlify sites:create --name boxlens'
    netlify deploy --prod --dir="$HERE"
    ;;
  vercel)
    echo ">> Vercel deploy"
    if ! command -v vercel >/dev/null 2>&1; then
      echo "   installing vercel CLI..."; npm install -g vercel
    fi
    vercel --prod --yes
    ;;
  surge)
    echo ">> Surge.sh deploy (free, no card needed)"
    DOMAIN="${2:-boxlens-demo.surge.sh}"
    if ! command -v surge >/dev/null 2>&1; then
      echo "   installing surge..."; npm install -g surge
    fi
    surge "$HERE" "$DOMAIN"
    ;;
  *)
    echo "Unknown host: $HOST"
    echo "Usage: bash deploy.sh [local|pages|netlify|vercel|surge [domain]]"
    exit 1
    ;;
esac
