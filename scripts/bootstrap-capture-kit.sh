#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage:
  scripts/bootstrap-capture-kit.sh <target-project-path> [--skip-install] [--force]

Defaults:
  - Installs all required dependencies automatically.
  - Installs Playwright Chromium browser binary automatically.

Options:
  --skip-install  Skip npm dependency + browser install.
  --force         Overwrite existing workflow-recorder.config.json in target project.
HELP
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TARGET=""
INSTALL_DEPS="true"
FORCE_CONFIG="false"

for arg in "$@"; do
  case "$arg" in
    --skip-install) INSTALL_DEPS="false" ;;
    --force) FORCE_CONFIG="true" ;;
    -* )
      echo "Unknown option: $arg" >&2
      usage
      exit 1
      ;;
    * )
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

RECORDER_SRC="$ROOT_DIR/scripts/record-workflow.js"
CONFIG_TEMPLATE="$ROOT_DIR/templates/workflow-recorder.template.json"

if [[ ! -f "$RECORDER_SRC" ]]; then
  echo "Missing source file: $RECORDER_SRC" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_TEMPLATE" ]]; then
  echo "Missing source file: $CONFIG_TEMPLATE" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR/scripts"
cp "$RECORDER_SRC" "$TARGET_DIR/scripts/record-workflow.js"

if [[ "$FORCE_CONFIG" == "true" || ! -f "$TARGET_DIR/workflow-recorder.config.json" ]]; then
  cp "$CONFIG_TEMPLATE" "$TARGET_DIR/workflow-recorder.config.json"
else
  echo "Skipped workflow-recorder.config.json (already exists). Use --force to overwrite."
fi

if [[ ! -f "$TARGET_DIR/package.json" ]]; then
  (cd "$TARGET_DIR" && npm init -y >/dev/null)
fi

TARGET_PACKAGE="$TARGET_DIR/package.json" node <<'NODE'
const fs = require('fs');

const packagePath = process.env.TARGET_PACKAGE;
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

pkg.scripts = pkg.scripts || {};
pkg.scripts['workflow:record'] = 'node scripts/record-workflow.js --config workflow-recorder.config.json';
pkg.scripts['workflow:record:headful'] = 'node scripts/record-workflow.js --config workflow-recorder.config.json --headful';
pkg.scripts['workflow:install'] = 'npx playwright install chromium';

pkg.devDependencies = pkg.devDependencies || {};
if (!pkg.devDependencies.playwright) pkg.devDependencies.playwright = '^1.53.0';
if (!pkg.devDependencies['ffmpeg-static']) pkg.devDependencies['ffmpeg-static'] = '^5.2.0';

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
NODE

if [[ "$INSTALL_DEPS" == "true" ]]; then
  (
    cd "$TARGET_DIR"
    npm install --save-dev playwright@^1.53.0 ffmpeg-static@^5.2.0
    npm run workflow:install
  )
fi

cat <<DONE
Universal workflow recorder bootstrapped in:
  $TARGET_DIR

Added:
  scripts/record-workflow.js
  workflow-recorder.config.json
  package.json scripts: workflow:record, workflow:record:headful, workflow:install

Run in target project:
  npm run workflow:record

Output:
  output/workflow-recorder/*.mp4
  output/workflow-recorder/artifacts/WORKFLOW_REPORT.md
DONE
