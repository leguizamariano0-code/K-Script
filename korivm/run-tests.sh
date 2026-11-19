#!/usr/bin/env bash
# Ejecuta la suite completa de tests en local. Uso: ./run-tests.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> cargo fmt --check"
cargo fmt --all -- --check

echo "==> cargo clippy"
cargo clippy --all-targets -- -D warnings

echo "==> cargo test --all-targets"
cargo test --all-targets --verbose

echo "==> cargo test --doc"
cargo test --doc --verbose

echo ""
echo "✅ Todo verde."
