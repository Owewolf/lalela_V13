#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/dist"
PUBLIC_DIR="${REPO_ROOT}/public"
STATIC_DIR="${SCRIPT_DIR}/lalela-static"
ZIP_PATH="${SCRIPT_DIR}/lalela-static.zip"
COMMIT_MESSAGE="${1:-Update deployment assets}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1" >&2
        exit 1
    fi
}

require_command git
require_command npm
require_command rsync
require_command zip

echo "Running Expo Doctor..."
cd "${REPO_ROOT}"
if ! npx expo-doctor; then
    echo "Expo Doctor found issues. Please fix them before deploying." >&2
    exit 1
fi

echo "Running lint check (tsc --noEmit)..."
cd "${REPO_ROOT}"
if ! npm run lint; then
    echo "Lint check failed. Fix TypeScript errors before deploying." >&2
    exit 1
fi

echo "Building frontend assets..."
npm run build

if [[ ! -d "${BUILD_DIR}" ]]; then
    echo "Build output not found: ${BUILD_DIR}" >&2
    exit 1
fi

echo "Refreshing deploy/lalela-static..."
rm -rf "${STATIC_DIR}"
mkdir -p "${STATIC_DIR}"
rsync -a --delete "${BUILD_DIR}/" "${STATIC_DIR}/"

if [[ -d "${PUBLIC_DIR}" ]]; then
    rsync -a "${PUBLIC_DIR}/" "${STATIC_DIR}/"
fi

echo "Recreating deploy/lalela-static.zip..."
rm -f "${ZIP_PATH}"
(
    cd "${STATIC_DIR}"
    zip -rq "${ZIP_PATH}" .
)

echo "Running Firebase backend deployment..."
cd "${REPO_ROOT}"
firebase deploy --only functions,firestore,storage

echo "Staging source changes..."
cd "${REPO_ROOT}"
git add .

if git diff --cached --quiet; then
    echo "No source changes to commit."
else
    echo "Committing source changes..."
    git commit -m "${COMMIT_MESSAGE}"

    echo "Pushing..."
    git push
fi

echo "Queueing EAS Builds for Android (APK) and iOS (IPA)..."
cd "${REPO_ROOT}"
eas build --platform all --profile preview --non-interactive --no-wait

echo "Done. All operations executed successfully!"
echo "- deploy/lalela-static.zip is ready for your web host."
echo "- Firebase Functions & Firestore Rules are deployed."
echo "- EAS Builds (Android & iOS) are queued! Check your Expo Dashboard to download the APK and IPA."