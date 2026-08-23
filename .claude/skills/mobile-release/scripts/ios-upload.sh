#!/usr/bin/env bash
# iOSシェルを TestFlight にアップロードする（Mac専用・Xcode GUI不要）。
#   archive → exportArchive(destination=upload) の2段。ビルド番号は Xcode が
#   App Store Connect 上の最大+1 に自動採番する（manageAppVersionAndBuildNumber）。
#   採番結果を標準出力の最終行 "UPLOADED_BUILD=<n>" に出し、pbxproj の
#   CURRENT_PROJECT_VERSION もその値に書き換える。
#
# 使い方:  .claude/skills/mobile-release/scripts/ios-upload.sh [出力ディレクトリ]
# 前提:    Xcode にアップロード権限のある Apple ID がサインイン済み（Settings → Accounts）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
OUT="${1:-${TMPDIR:-/tmp}/engnavi-ios-release}"
PROJ_DIR="$REPO_ROOT/mobile/ios/App"
PBXPROJ="$PROJ_DIR/App.xcodeproj/project.pbxproj"
TEAM_ID="KFW7UH97T3"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "ERROR: iOSのアップロードはmacOS + Xcodeが必要です（クラウドセッションでは実行できません）" >&2
  exit 2
fi
command -v xcodebuild >/dev/null || { echo "ERROR: xcodebuild が見つかりません" >&2; exit 2; }

mkdir -p "$OUT"
rm -rf "$OUT/App.xcarchive" "$OUT/export"

cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><true/>
</dict></plist>
PLIST

echo "==> [1/3] cap sync（本番URL焼き込み）"
(cd "$REPO_ROOT/mobile" && npm run sync >/dev/null)

echo "==> [2/3] archive  (log: $OUT/archive.log)"
xcodebuild -project "$PROJ_DIR/App.xcodeproj" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/App.xcarchive" \
  archive -allowProvisioningUpdates > "$OUT/archive.log" 2>&1 \
  || { tail -30 "$OUT/archive.log" >&2; echo "ERROR: archive failed" >&2; exit 1; }

echo "==> [3/3] export + upload  (log: $OUT/upload.log)"
xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" \
  -allowProvisioningUpdates > "$OUT/upload.log" 2>&1 \
  || { grep -i "error" "$OUT/upload.log" | tail -10 >&2; echo "ERROR: upload failed" >&2; exit 1; }

grep -q "Upload succeeded" "$OUT/upload.log" || { tail -20 "$OUT/upload.log" >&2; echo "ERROR: 'Upload succeeded' が出ていません" >&2; exit 1; }

# 採番結果: Xcodeの配布ログ（ContentDelivery.log）に ASC へ送った cfBundleVersion が残る
DIST_LOGS="$(grep -o '/.*\.xcdistributionlogs' "$OUT/upload.log" | tail -1 || true)"
BUILD=""
if [[ -n "$DIST_LOGS" && -f "$DIST_LOGS/ContentDelivery.log" ]]; then
  BUILD="$(grep -o '"cfBundleVersion":"[0-9]*"' "$DIST_LOGS/ContentDelivery.log" | tail -1 | grep -o '[0-9]*' || true)"
fi
VERSION="$(/usr/libexec/PlistBuddy -c 'Print ApplicationProperties:CFBundleShortVersionString' "$OUT/App.xcarchive/Info.plist" 2>/dev/null || echo '?')"

if [[ -z "$BUILD" ]]; then
  echo "WARN: 採番結果をログから特定できませんでした。App Store Connect → TestFlight で確認し、pbxproj の CURRENT_PROJECT_VERSION を手で合わせてください" >&2
  echo "UPLOADED_VERSION=$VERSION"
  echo "UPLOADED_BUILD=unknown"
  exit 0
fi

# リポジトリ側のビルド番号を実際に上がった値に揃える（GUI手順との二重管理を防ぐ）
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = ${BUILD};/g" "$PBXPROJ"
echo "pbxproj: CURRENT_PROJECT_VERSION = $BUILD に更新"
echo "UPLOADED_VERSION=$VERSION"
echo "UPLOADED_BUILD=$BUILD"
