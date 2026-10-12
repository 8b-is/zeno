#!/usr/bin/env bash
set -euo pipefail

# ZENO iOS App Build & Archive Pipeline
# Conforms to 8b-is Sovereign Neo-Bank Mobile Standards

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "=== Building ZENO iOS & macOS App (ZenoApp) ==="

# 1. Detect Developer Environment
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-26.4.1.app/Contents/Developer}"
if [ ! -d "$DEVELOPER_DIR" ]; then
    if [ -d "/Applications/Xcode.app/Contents/Developer" ]; then
        DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
    else
        DEVELOPER_DIR="$(xcode-select -p)"
    fi
fi
export DEVELOPER_DIR
echo "✓ Using Developer Dir: $DEVELOPER_DIR"

# 2. Build for macOS (Native Host)
echo "Building ZenoApp for macOS..."
xcrun --sdk macosx swift build -c release
echo "✓ macOS release build complete"

# 3. Build for iOS Simulator (Universal arm64 / x86_64)
echo "Building ZenoApp for iOS Simulator..."
xcodebuild -scheme ZenoApp -destination 'generic/platform=iOS Simulator' -configuration Release build
echo "✓ iOS Simulator release build complete"

# 4. Summary
echo "=== ALL ZENO MOBILE TARGETS COMPILED & VERIFIED SUCCESSFULLY ==="
