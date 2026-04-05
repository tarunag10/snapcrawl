#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage:
  scripts/bootstrap-capture-kit.sh <target-project-path> [--skip-install] [--force]

Installs both the workflow recorder (MP4 video) and screenshot capture
tools into a target project, along with all required dependencies.

Defaults:
  - Installs all required dependencies automatically.
  - Installs Playwright Chromium browser binary automatically.

Options:
  --skip-install  Skip npm dependency + browser install.
  --force         Overwrite existing config files in target project.
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
CAPTURE_SRC="$ROOT_DIR/scripts/capture-from-config.js"
SHARED_SRC="$ROOT_DIR/lib/shared.js"
RECORDER_TEMPLATE="$ROOT_DIR/templates/workflow-recorder.template.json"
CAPTURE_TEMPLATE="$ROOT_DIR/templates/capture-config.template.json"

for file in "$RECORDER_SRC" "$CAPTURE_SRC" "$SHARED_SRC" "$RECORDER_TEMPLATE" "$CAPTURE_TEMPLATE"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing source file: $file" >&2
    exit 1
  fi
done

# Copy scripts and shared library
mkdir -p "$TARGET_DIR/scripts"
mkdir -p "$TARGET_DIR/lib"
cp "$RECORDER_SRC" "$TARGET_DIR/scripts/record-workflow.js"
cp "$CAPTURE_SRC" "$TARGET_DIR/scripts/capture-from-config.js"
cp "$SHARED_SRC" "$TARGET_DIR/lib/shared.js"

# Copy config templates (skip if already present unless --force)
if [[ "$FORCE_CONFIG" == "true" || ! -f "$TARGET_DIR/workflow-recorder.config.json" ]]; then
  cp "$RECORDER_TEMPLATE" "$TARGET_DIR/workflow-recorder.config.json"
else
  echo "Skipped workflow-recorder.config.json (already exists). Use --force to overwrite."
fi

if [[ "$FORCE_CONFIG" == "true" || ! -f "$TARGET_DIR/capture-config.json" ]]; then
  cp "$CAPTURE_TEMPLATE" "$TARGET_DIR/capture-config.json"
else
  echo "Skipped capture-config.json (already exists). Use --force to overwrite."
fi

# Ensure target has a package.json
if [[ ! -f "$TARGET_DIR/package.json" ]]; then
  (cd "$TARGET_DIR" && npm init -y >/dev/null)
fi

# Add npm scripts and devDependencies
TARGET_PACKAGE="$TARGET_DIR/package.json" node <<'NODE'
const fs = require('fs');

const packagePath = process.env.TARGET_PACKAGE;
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

pkg.scripts = pkg.scripts || {};
pkg.scripts['workflow:record'] = 'node scripts/record-workflow.js --config workflow-recorder.config.json';
pkg.scripts['workflow:record:headful'] = 'node scripts/record-workflow.js --config workflow-recorder.config.json --headful';
pkg.scripts['capture:screenshots'] = 'node scripts/capture-from-config.js --config capture-config.json';
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

Capture toolkit bootstrapped in:
  $TARGET_DIR

Added:
  lib/shared.js
  scripts/record-workflow.js
  scripts/capture-from-config.js
  workflow-recorder.config.json
  capture-config.json
  package.json scripts:
    workflow:record          — Record MP4 demo video (headless)
    workflow:record:headful  — Record MP4 demo video (visible browser)
    capture:screenshots      — Capture multi-viewport screenshots
    workflow:install         — Install Chromium browser binary

Run in target project:
  npm run workflow:record        # MP4 video
  npm run capture:screenshots    # Screenshots

Output:
  output/workflow-recorder/*.mp4
  output/workflow-recorder/artifacts/WORKFLOW_REPORT.md
  output/social/*.png
  output/social/WORKFLOW.md
DONE
