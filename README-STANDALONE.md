# Pixel Agents Standalone (macOS launchd)

Pixel Agents를 VS Code 없이 **브라우저에서 독립 실행**하는 버전입니다.
Claude Code의 서브에이전트까지 캐릭터로 시각화되고, macOS 로그인 시 자동으로 떠 있습니다.

원본: [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) (MIT)

## 추가된 것

- `standalone/` — Node.js 기반 HTTP + WebSocket 서버 (VS Code 의존성 없음)
- `webview-ui/src/vscodeApi.ts` — `acquireVsCodeApi()` 대체용 WebSocket 브리지
- **서브에이전트(sidechain) 시각화** — `~/.claude/projects/<proj>/<session>/subagents/*.jsonl`을 재귀 스캔해 별도 캐릭터로 스폰
- `install.sh` / `install/*.plist.template` — macOS launchd 자동 시작 설치기

## 요구사항

- macOS (Darwin)
- Node.js 18+ (`brew install node` 권장)
- git

## 설치

```bash
git clone https://github.com/gracena3555/pixel-agents.git
cd pixel-agents
./install.sh
```

완료되면 브라우저에서 [http://localhost:7891](http://localhost:7891) 열기.
새 Claude Code 터미널을 띄우면 캐릭터가 자동으로 픽셀 오피스에 나타납니다.

포트를 바꾸고 싶으면: `./install.sh 8080`

## 관리 커맨드

```bash
# 상태 확인
launchctl list | grep pixel-agents

# 실시간 로그
tail -f ~/Library/Logs/pixel-agents.log

# 수동 재시작 (코드 수정 후 등)
launchctl kickstart -k gui/$(id -u)/com.dwcts.pixel-agents

# 중지
launchctl unload ~/Library/LaunchAgents/com.dwcts.pixel-agents.plist

# 다시 시작
launchctl load ~/Library/LaunchAgents/com.dwcts.pixel-agents.plist
```

## 제거

```bash
launchctl unload ~/Library/LaunchAgents/com.dwcts.pixel-agents.plist
rm ~/Library/LaunchAgents/com.dwcts.pixel-agents.plist
rm ~/Library/Logs/pixel-agents.log ~/Library/Logs/pixel-agents.err.log
```

리포지토리 삭제는 `rm -rf`로.

## 동작 구조

```
Claude Code 세션 (~/.claude/projects/...)
        │
        │ JSONL 쓰기
        ▼
standalone/src/jsonlWatcher.mjs  ─── subagents/ 재귀 스캔
        │
        │ agentCreated / agentStatus / ...
        ▼
WebSocketServer (포트 7891)
        │
        ▼
브라우저 (React + Canvas, 픽셀 오피스)
```

`vscodeApi.ts`가 `acquireVsCodeApi()` 대신 WebSocket으로 같은 메시지를 주고받아
VS Code 확장과 거의 동일한 webview-ui 코드를 재사용합니다.

## Troubleshooting

**캐릭터가 안 떠요**
- `tail -f ~/Library/Logs/pixel-agents.log` 에서 `[watcher] adopted agent ...` 뜨는지 확인
- 뜨면 브라우저 문제 → `Cmd+Shift+R` 하드 리프레시 + DevTools Console 에러 확인
- 안 뜨면 서버 문제 → `~/Library/Logs/pixel-agents.err.log` 확인

**60초 뒤 캐릭터가 사라져요**
- `STALE_AGENT_TIMEOUT_MS` (기본 60초) 때문. 해당 세션에서 아무 프롬프트도 안 보내면 자동 제거됩니다.
- 완화하려면 `standalone/src/jsonlWatcher.mjs`에서 상수 수정 후 `launchctl kickstart -k gui/$(id -u)/com.dwcts.pixel-agents`.

## 업스트림 동기화

fork 기반이라 `git pull origin main`으로 업스트림 변경사항 수용 가능.
단, 이 브랜치의 커스텀 파일(`standalone/`, `install.sh` 등)은 유지됩니다.
