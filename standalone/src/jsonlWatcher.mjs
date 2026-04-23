import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { processLine, finishTurn } from './parser.mjs';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SCAN_INTERVAL_MS = 1000;
const POLL_INTERVAL_MS = 500;
const TEXT_IDLE_DELAY_MS = 5000;
const STALE_AGENT_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h — keep characters alive while session exists
const STALE_CHECK_INTERVAL_MS = 60_000;

/**
 * Watches ~/.claude/projects/ for new JSONL files and tails them.
 * For every new session, allocates an agent ID and emits messages.
 */
export class JsonlWatcher {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.agents = new Map(); // agentId -> agent state
    this.files = new Map(); // filePath -> { agentId, offset, buffer, idleTimer, folderName }
    this.dormantOffsets = new Map(); // filePath -> size at last dormancy (pre-existing or evicted); adopted when size grows past this
    this.nextAgentId = 1;
  }

  start() {
    // Record current size of every pre-existing JSONL. We don't adopt them yet —
    // adoption fires only when a file grows beyond its recorded size (i.e. the
    // session is actively writing). This lets dormant historical sessions stay
    // silent while live-but-idle sessions wake up on their next write.
    for (const { filePath } of collectAllJsonlFiles()) {
      try {
        const stat = fs.statSync(filePath);
        this.dormantOffsets.set(filePath, stat.size);
      } catch {}
    }
    console.log(`[watcher] dormant: ${this.dormantOffsets.size} pre-existing JSONL files (will adopt on next write)`);
    this.scanInterval = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
    this.pollInterval = setInterval(() => this.pollAll(), POLL_INTERVAL_MS);
    this.staleInterval = setInterval(() => this.evictStale(), STALE_CHECK_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.scanInterval);
    clearInterval(this.pollInterval);
    clearInterval(this.staleInterval);
    for (const meta of this.files.values()) {
      if (meta.idleTimer) clearTimeout(meta.idleTimer);
    }
  }

  /** Get current agents for sending to a newly-connected webview client */
  getExistingAgents() {
    return [...this.agents.entries()].map(([id, a]) => ({
      id,
      folderName: a.folderName,
    }));
  }

  scan() {
    for (const { filePath, projectDir, isSubagent } of collectAllJsonlFiles()) {
      if (this.files.has(filePath)) continue;
      const dormantSize = this.dormantOffsets.get(filePath);
      if (dormantSize !== undefined) {
        // Pre-existing or previously-evicted: adopt only if the file has grown.
        let stat;
        try { stat = fs.statSync(filePath); } catch { continue; }
        if (stat.size <= dormantSize) continue;
        this.dormantOffsets.delete(filePath);
        this.adoptFile(filePath, projectDir, isSubagent, dormantSize);
      } else {
        this.adoptFile(filePath, projectDir, isSubagent, 0);
      }
    }
  }

  adoptFile(filePath, projectHash, isSubagent = false, initialOffset = 0) {
    const agentId = this.nextAgentId++;
    // project hash is original path with separators replaced by '-'; folderName = last segment
    const baseName = decodeFolderName(projectHash);
    const folderName = isSubagent ? `${baseName} (sub)` : baseName;
    const agentState = {
      sessionId: path.basename(filePath, '.jsonl'),
      projectDir: path.dirname(filePath),
      activeToolIds: new Set(),
      activeToolStatuses: new Map(),
      activeToolNames: new Map(),
      isWaiting: false,
      hadToolsInTurn: false,
      lastDataAt: Date.now(),
    };
    this.agents.set(agentId, agentState);
    this.files.set(filePath, { agentId, offset: initialOffset, buffer: '', idleTimer: null, folderName });

    console.log(`[watcher] adopted agent ${agentId}: ${path.basename(filePath)} (folder: ${folderName})`);
    this.broadcast({ type: 'agentCreated', id: agentId, folderName });

    // Read whatever's already there immediately
    this.poll(filePath);
  }

  pollAll() {
    for (const filePath of this.files.keys()) {
      this.poll(filePath);
    }
  }

  poll(filePath) {
    const meta = this.files.get(filePath);
    if (!meta) return;
    let stat;
    try { stat = fs.statSync(filePath); } catch {
      // File deleted - despawn
      this.removeFile(filePath);
      return;
    }
    if (stat.size <= meta.offset) return;

    const stream = fs.createReadStream(filePath, { start: meta.offset, end: stat.size - 1 });
    let chunk = '';
    stream.on('data', (d) => { chunk += d.toString(); });
    stream.on('end', () => {
      meta.offset = stat.size;
      const combined = meta.buffer + chunk;
      const lines = combined.split('\n');
      meta.buffer = lines.pop() ?? '';
      const agent = this.agents.get(meta.agentId);
      if (!agent) return;
      let sawText = false;
      for (const line of lines) {
        if (!line.trim()) continue;
        const msgs = processLine(meta.agentId, line, agent);
        for (const m of msgs) {
          this.broadcast(m);
          if (m.type === 'agentStatus' && m.status === 'active' && !agent.hadToolsInTurn) {
            sawText = true;
          }
        }
      }
      // Manage text-idle timer (mark waiting after TEXT_IDLE_DELAY_MS of silence after a text-only response)
      if (meta.idleTimer) {
        clearTimeout(meta.idleTimer);
        meta.idleTimer = null;
      }
      if (sawText && !agent.hadToolsInTurn) {
        meta.idleTimer = setTimeout(() => {
          const msgs = finishTurn(meta.agentId, agent);
          for (const m of msgs) this.broadcast(m);
          meta.idleTimer = null;
        }, TEXT_IDLE_DELAY_MS);
      }
    });
    stream.on('error', () => {});
  }

  removeFile(filePath) {
    const meta = this.files.get(filePath);
    if (!meta) return;
    if (meta.idleTimer) clearTimeout(meta.idleTimer);
    this.files.delete(filePath);
    this.agents.delete(meta.agentId);
    this.broadcast({ type: 'agentClosed', id: meta.agentId });
    console.log(`[watcher] removed agent ${meta.agentId}`);
  }

  evictStale() {
    const now = Date.now();
    for (const [filePath, meta] of [...this.files]) {
      const agent = this.agents.get(meta.agentId);
      if (!agent) continue;
      if (now - agent.lastDataAt > STALE_AGENT_TIMEOUT_MS) {
        console.log(`[watcher] evicting stale agent ${meta.agentId} (no data ${Math.round((now - agent.lastDataAt) / 1000)}s)`);
        // Return file to the dormant pool at its current size so it can be re-adopted
        // the next time the session writes more content.
        try {
          const stat = fs.statSync(filePath);
          this.dormantOffsets.set(filePath, stat.size);
        } catch {}
        this.removeFile(filePath);
      }
    }
  }
}

function decodeFolderName(projectHash) {
  // project hash: path with /:\ -> '-'. Take the last segment after final '-'.
  const parts = projectHash.split('-').filter(Boolean);
  return parts[parts.length - 1] || projectHash;
}

/**
 * Collect every JSONL file under PROJECTS_DIR, including sub-agent files at
 * <project>/<sessionId>/subagents/*.jsonl. Returns [{ filePath, projectDir, isSubagent }].
 */
function collectAllJsonlFiles() {
  const result = [];
  if (!fs.existsSync(PROJECTS_DIR)) return result;

  let projectEntries;
  try { projectEntries = fs.readdirSync(PROJECTS_DIR); } catch { return result; }

  for (const projectDir of projectEntries) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    let projectStat;
    try { projectStat = fs.statSync(projectPath); } catch { continue; }
    if (!projectStat.isDirectory()) continue;

    let entries;
    try { entries = fs.readdirSync(projectPath); } catch { continue; }

    for (const entry of entries) {
      const entryPath = path.join(projectPath, entry);

      if (entry.endsWith('.jsonl')) {
        result.push({ filePath: entryPath, projectDir, isSubagent: false });
        continue;
      }

      // Check if it's a session directory with a subagents/ child
      const subagentDir = path.join(entryPath, 'subagents');
      let subStat;
      try { subStat = fs.statSync(subagentDir); } catch { continue; }
      if (!subStat.isDirectory()) continue;

      let subEntries;
      try { subEntries = fs.readdirSync(subagentDir); } catch { continue; }
      for (const sub of subEntries) {
        if (!sub.endsWith('.jsonl')) continue;
        result.push({
          filePath: path.join(subagentDir, sub),
          projectDir,
          isSubagent: true,
        });
      }
    }
  }
  return result;
}
