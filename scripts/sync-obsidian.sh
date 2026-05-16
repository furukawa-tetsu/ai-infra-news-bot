#!/usr/bin/env bash
set -euo pipefail

DEST="/mnt/c/Users/古川哲/Documents/Note/Articles/AI-Infra-news"

mkdir -p "$DEST"

rclone sync r2:ai-infra-news-md/obsidian "$DEST" \
  --include "*.md" \
  --create-empty-src-dirs
