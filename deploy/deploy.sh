#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1" >&2
        exit 1
    fi
}

require_command npm
require_command eas

echo "Running Expo Doctor..."
cd "${REPO_ROOT}"
if ! npx expo-doctor; then
    echo "Expo Doctor found issues. Please fix them before building." >&2
    exit 1
fi

echo "Running lint check (tsc --noEmit)..."
cd "${REPO_ROOT}"
if ! npm run lint; then
    echo "Lint check failed. Fix TypeScript errors before building." >&2
    exit 1
fi

echo "Starting EAS Android build (APK, profile: preview)..."
eas build --platform android --profile preview --non-interactive

echo "Starting EAS iOS build (IPA, profile: ios-ipa)..."
eas build --platform ios --profile ios-ipa --non-interactive

echo "Done. Mobile build pipeline completed successfully."
echo "- Android build profile: preview (APK)"
echo "- iOS build profile: ios-ipa (IPA)"