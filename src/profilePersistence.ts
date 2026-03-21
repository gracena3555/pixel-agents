import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { LAYOUT_FILE_DIR, PROFILES_FILE_NAME } from './constants.js';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  palette: number;
  hueShift: number;
  systemPrompt: string;
  allowedTools: string[];
  model?: string;
}

function getProfilesFilePath(): string {
  return path.join(os.homedir(), LAYOUT_FILE_DIR, PROFILES_FILE_NAME);
}

export function readProfilesFromFile(): AgentProfile[] {
  const filePath = getProfilesFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AgentProfile[];
  } catch (err) {
    console.error('[Pixel Agents] Failed to read profiles file:', err);
    return [];
  }
}

export function writeProfilesToFile(profiles: AgentProfile[]): void {
  const filePath = getProfilesFilePath();
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const json = JSON.stringify(profiles, null, 2);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, json, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error('[Pixel Agents] Failed to write profiles file:', err);
  }
}
