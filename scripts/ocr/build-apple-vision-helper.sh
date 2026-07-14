#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

mkdir -p .cache/swift-module-cache .cache/clang-module-cache .bin

SWIFT_MODULECACHE_PATH="$ROOT/.cache/swift-module-cache" \
CLANG_MODULE_CACHE_PATH="$ROOT/.cache/clang-module-cache" \
xcrun swiftc \
  scripts/ocr/apple-vision-ocr.swift \
  -framework Vision \
  -framework AppKit \
  -framework ImageIO \
  -o .bin/apple-vision-ocr

echo "$ROOT/.bin/apple-vision-ocr"
