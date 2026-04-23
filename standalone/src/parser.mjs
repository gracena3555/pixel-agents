import * as path from 'path';

const BASH_MAX = 60;
const TASK_MAX = 60;

function basename(p) {
  return typeof p === 'string' ? path.basename(p) : '';
}

export function formatToolStatus(toolName, input) {
  input = input || {};
  switch (toolName) {
    case 'Read': return `Reading ${basename(input.file_path)}`;
    case 'Edit': return `Editing ${basename(input.file_path)}`;
    case 'Write': return `Writing ${basename(input.file_path)}`;
    case 'Bash': {
      const cmd = String(input.command || '');
      return `Running: ${cmd.length > BASH_MAX ? cmd.slice(0, BASH_MAX) + '\u2026' : cmd}`;
    }
    case 'Glob': return 'Searching files';
    case 'Grep': return 'Searching code';
    case 'WebFetch': return 'Fetching web content';
    case 'WebSearch': return 'Searching the web';
    case 'Task':
    case 'Agent': {
      const desc = String(input.description || '');
      return desc
        ? `Subtask: ${desc.length > TASK_MAX ? desc.slice(0, TASK_MAX) + '\u2026' : desc}`
        : 'Running subtask';
    }
    case 'AskUserQuestion': return 'Waiting for your answer';
    case 'EnterPlanMode': return 'Planning';
    case 'NotebookEdit': return 'Editing notebook';
    case 'TodoWrite': return 'Updating todos';
    default: return `Using ${toolName}`;
  }
}

/**
 * Parse one JSONL line and return an array of messages to send to the webview.
 * Simplified MVP: handles tool_use, tool_result, turn_duration, text-only completions.
 */
export function processLine(agentId, line, agentState) {
  const out = [];
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return out;
  }

  agentState.lastDataAt = Date.now();

  // turn end: system + turn_duration
  if (record.type === 'system' && record.subtype === 'turn_duration') {
    return finishTurn(agentId, agentState);
  }

  const content = record.message?.content ?? record.content;

  if (record.type === 'assistant' && Array.isArray(content)) {
    const toolUses = content.filter((b) => b && b.type === 'tool_use');
    if (toolUses.length === 0) {
      // Pure text response - we'll let text-idle timer (in server) handle waiting state.
      // Mark agent as active briefly so it animates.
      out.push({ type: 'agentStatus', id: agentId, status: 'active' });
      agentState.hadToolsInTurn = false;
      return out;
    }
    // Tool calls
    out.push({ type: 'agentStatus', id: agentId, status: 'active' });
    agentState.hadToolsInTurn = true;
    agentState.isWaiting = false;
    for (const block of toolUses) {
      if (!block.id || !block.name) continue;
      const status = formatToolStatus(block.name, block.input || {});
      agentState.activeToolIds.add(block.id);
      agentState.activeToolStatuses.set(block.id, status);
      agentState.activeToolNames.set(block.id, block.name);
      out.push({
        type: 'agentToolStart',
        id: agentId,
        toolId: block.id,
        status,
        toolName: block.name,
      });
    }
    return out;
  }

  if (record.type === 'user' && Array.isArray(content)) {
    for (const block of content) {
      if (block && block.type === 'tool_result' && block.tool_use_id) {
        const tid = block.tool_use_id;
        if (agentState.activeToolIds.has(tid)) {
          agentState.activeToolIds.delete(tid);
          agentState.activeToolStatuses.delete(tid);
          agentState.activeToolNames.delete(tid);
          out.push({ type: 'agentToolDone', id: agentId, toolId: tid });
        }
      }
    }
    return out;
  }

  return out;
}

export function finishTurn(agentId, agentState) {
  const out = [];
  agentState.activeToolIds.clear();
  agentState.activeToolStatuses.clear();
  agentState.activeToolNames.clear();
  agentState.isWaiting = true;
  agentState.hadToolsInTurn = false;
  out.push({ type: 'agentToolsClear', id: agentId });
  out.push({ type: 'agentStatus', id: agentId, status: 'waiting' });
  return out;
}
