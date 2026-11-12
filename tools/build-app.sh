#!/usr/bin/env bash
# Builds the shop copy of the Flowzyn agents app into plugins/flowzyn/app from the
# source in flowzynagents/flowzyn-connector (app/). Usage: tools/build-app.sh <connector-dir> <version>
set -euo pipefail
SRC="$1/app"; VER="$2"; OUT="$(cd "$(dirname "$0")/.." && pwd)/plugins/flowzyn/app"
rm -rf "$OUT"; mkdir -p "$OUT/files/boards"
for f in index.html core.js templates.js kit.js agent-rules.js overview.js setup.js tasks.js plan.js welcome.js activity.js v3.js v3.css connect.js; do cp "$SRC/$f" "$OUT/files/"; done
# Only the boards the page loads. Retired boards (Target Areas and the old extras) stay in the source repo and are not shipped.
for b in $(grep -o 'src="boards/[a-z-]*\.js"' "$SRC/index.html" | sed 's/src="boards\///; s/"//'); do cp "$SRC/boards/$b" "$OUT/files/boards/"; done
# Mark it as a shop's own copy, before anything else loads.
printf 'window.FZ_SHOP_COPY = true; document.documentElement.classList.add("fz-shopcopy");\n' > "$OUT/files/shop-copy.js"
python3 - "$OUT/files/index.html" <<'P'
import sys; p=sys.argv[1]; t=open(p).read()
t=t.replace('<script src="/stub.js"></script>','')
assert '<script src="core.js"></script>' in t
t=t.replace('<script src="core.js"></script>','<script src="shop-copy.js"></script><script src="core.js"></script>',1)
open(p,'w').write(t)
P
printf '%s\n' "$VER" > "$OUT/files/VERSION"
printf '%s\n' "$VER" > "$OUT/VERSION"
cp "$(dirname "$0")/app-capabilities.json" "$OUT/capabilities.json"
( cd "$OUT/files" && find . -type f | sed 's#^\./##' | sort ) > "$OUT/FILES"
echo "Built app $VER: $(wc -l < "$OUT/FILES") files"
