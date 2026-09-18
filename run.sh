#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "MD2Naver Paste UI v0.3 starting: http://localhost:8766"
echo "Press Ctrl+C to stop the server."
python3 -m http.server 8766
