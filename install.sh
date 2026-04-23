#!/usr/bin/env bash
# Pixel Agents Standalone — macOS launchd installer
# Usage: ./install.sh [port]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-${PIXEL_AGENTS_PORT:-7891}}"
PLIST_LABEL="com.dwcts.pixel-agents"
PLIST_TEMPLATE="$REPO_DIR/install/${PLIST_LABEL}.plist.template"
PLIST_TARGET="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$HOME/Library/Logs"

echo "==> Pixel Agents Standalone 설치 시작"
echo "    repo: $REPO_DIR"
echo "    port: $PORT"
echo ""

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "❌ 이 설치 스크립트는 macOS 전용입니다."
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "❌ node가 설치되어 있지 않습니다. https://nodejs.org 또는 brew install node 로 설치하세요."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm이 필요합니다."
    exit 1
fi

NODE_BIN="$(command -v node)"
echo "==> node 경로: $NODE_BIN"
echo ""

echo "==> webview-ui 의존성 설치 + 빌드"
cd "$REPO_DIR/webview-ui"
npm install --no-audit --no-fund
cd "$REPO_DIR"

echo ""
echo "==> standalone 의존성 설치 + webview 빌드"
cd "$REPO_DIR/standalone"
npm install --no-audit --no-fund
npm run build
cd "$REPO_DIR"

if [[ ! -f "$REPO_DIR/dist/webview/index.html" ]]; then
    echo "❌ 빌드 산출물이 없습니다: $REPO_DIR/dist/webview/index.html"
    exit 1
fi

echo ""
echo "==> LaunchAgents / Logs 디렉토리 생성"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

echo "==> 기존 서비스가 있으면 언로드"
launchctl unload "$PLIST_TARGET" 2>/dev/null || true

echo "==> plist 템플릿 치환하여 배치: $PLIST_TARGET"
sed \
    -e "s|__NODE_BIN__|${NODE_BIN}|g" \
    -e "s|__REPO_DIR__|${REPO_DIR}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__HOME__|${HOME}|g" \
    "$PLIST_TEMPLATE" > "$PLIST_TARGET"

echo "==> launchctl load"
launchctl load "$PLIST_TARGET"

sleep 2

echo ""
if launchctl list | grep -q "$PLIST_LABEL"; then
    echo "✅ 설치 완료: $PLIST_LABEL"
else
    echo "⚠️  로드는 됐으나 launchctl list에 안 보임. 로그 확인 필요:"
    echo "    tail -f $LOG_DIR/pixel-agents.err.log"
fi

echo ""
echo "== 사용법 =="
echo "  브라우저:    http://localhost:$PORT"
echo "  실시간 로그: tail -f $LOG_DIR/pixel-agents.log"
echo "  재시작:      launchctl kickstart -k gui/\$(id -u)/$PLIST_LABEL"
echo "  제거:        launchctl unload $PLIST_TARGET && rm $PLIST_TARGET"
