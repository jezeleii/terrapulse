#!/usr/bin/env bash
set -euo pipefail

LIMIT="${1:-200}"
PDF_DIR="${2:-agent/pdf}"
PDF_TOP_K="${3:-3}"

while true; do
  OUTPUT="$(python agent/generate_insights.py --no-llm --use-pdf-sources --pdf-dir "$PDF_DIR" --pdf-top-k "$PDF_TOP_K" --limit "$LIMIT")"
  echo "$OUTPUT"
  PROCESSED="$(python - <<'PY'
import json, sys
data = json.load(sys.stdin)
print(data.get("processed", 0))
PY
<<< "$OUTPUT")"
  if [ "$PROCESSED" -eq 0 ]; then
    break
  fi
done
