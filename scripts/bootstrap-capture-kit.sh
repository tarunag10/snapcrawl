#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-capture-kit.sh <target-project-path> [--install] [--force]

Options:
  --install  Also install Playwright and browser binaries in target project.
  --force    Overwrite existing capture-config.json in target project.
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TARGET=""
INSTALL_DEPS="false"
FORCE_CONFIG="false"

for arg in "$@"; do
  case "$arg" in
    --install) INSTALL_DEPS="true" ;;
    --force) FORCE_CONFIG="true" ;;
    -*)
      echo "Unknown option: $arg" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$arg"
      else
        echo "Only one target project path is allowed." >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="$(cd "$TARGET" && pwd)"

RUNNER_SRC="$ROOT_DIR/scripts/capture-from-config.js"
CONFIG_TEMPLATE="$ROOT_DIR/templates/capture-config.template.json"

if [[ ! -f "$RUNNER_SRC" ]]; then
  echo "Missing source file: $RUNNER_SRC" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_TEMPLATE" ]]; then
  echo "Missing source file: $CONFIG_TEMPLATE" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR/scripts"
cp "$RUNNER_SRC" "$TARGET_DIR/scripts/capture-from-config.js"

if [[ "$FORCE_CONFIG" == "true" || ! -f "$TARGET_DIR/capture-config.json" ]]; then
  cp "$CONFIG_TEMPLATE" "$TARGET_DIR/capture-config.json"
else
  echo "Skipped capture-config.json (already exists). Use --force to overwrite."
fi

if [[ ! -f "$TARGET_DIR/package.json" ]]; then
  (cd "$TARGET_DIR" && npm init -y >/dev/null)
fi

TARGET_PACKAGE="$TARGET_DIR/package.json" node <<'EOF'
const fs = require("fs");

const pkgPath = process.env.TARGET_PACKAGE;
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts["capture:social"] = "node scripts/capture-from-config.js --config capture-config.json";
pkg.scripts["capture:site"] = "node scripts/capture-from-config.js --config capture-config.json";
pkg.scripts["capture:install"] = "npx playwright install chromium";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
EOF

if [[ "$INSTALL_DEPS" == "true" ]]; then
  (cd "$TARGET_DIR" && npm install --save-dev playwright && npm run capture:install)
fi

cat <<EOF
Bootstrap complete for:
  $TARGET_DIR

Added:
  scripts/capture-from-config.js
  capture-config.json
  package.json scripts: capture:social, capture:site, capture:install

Next:
  1) Edit capture-config.json crawl/scenario settings for this website.
  2) Run: npm run capture:site
EOF
