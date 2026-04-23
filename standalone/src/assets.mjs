import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

const CHAR_COUNT = 6;
const CHAR_FRAMES_PER_ROW = 7;
const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const FLOOR_TILE_SIZE = 16;
const WALL_BITMASK_COUNT = 16;
const WALL_PIECE_W = 16;
const WALL_PIECE_H = 32;
const WALL_GRID_COLS = 4;

const PNG_ALPHA_THRESHOLD = 2;

function pngToSpriteData(buf, width, height) {
  const png = PNG.sync.read(buf);
  const sprite = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * png.width + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];
      if (a < PNG_ALPHA_THRESHOLD) {
        row.push('');
      } else if (a < 255) {
        row.push(`#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`);
      } else {
        row.push(`#${hex(r)}${hex(g)}${hex(b)}`);
      }
    }
    sprite.push(row);
  }
  return sprite;
}

function hex(n) {
  return n.toString(16).padStart(2, '0');
}

function decodeRegion(png, x0, y0, w, h) {
  const sprite = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const idx = ((y0 + y) * png.width + (x0 + x)) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];
      if (a < PNG_ALPHA_THRESHOLD) row.push('');
      else if (a < 255) row.push(`#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`);
      else row.push(`#${hex(r)}${hex(g)}${hex(b)}`);
    }
    sprite.push(row);
  }
  return sprite;
}

function decodeCharacterPng(buf) {
  const png = PNG.sync.read(buf);
  const dirs = ['down', 'up', 'right'];
  const result = { down: [], up: [], right: [] };
  for (let row = 0; row < 3; row++) {
    for (let frame = 0; frame < CHAR_FRAMES_PER_ROW; frame++) {
      const x0 = frame * CHAR_FRAME_W;
      const y0 = row * CHAR_FRAME_H;
      result[dirs[row]].push(decodeRegion(png, x0, y0, CHAR_FRAME_W, CHAR_FRAME_H));
    }
  }
  return result;
}

function decodeFloorPng(buf) {
  return pngToSpriteData(buf, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
}

function parseWallPng(buf) {
  const png = PNG.sync.read(buf);
  const sprites = [];
  for (let i = 0; i < WALL_BITMASK_COUNT; i++) {
    const col = i % WALL_GRID_COLS;
    const row = Math.floor(i / WALL_GRID_COLS);
    sprites.push(decodeRegion(png, col * WALL_PIECE_W, row * WALL_PIECE_H, WALL_PIECE_W, WALL_PIECE_H));
  }
  return sprites;
}

// Recursively flatten manifest groups (rotation/state/animation)
function flattenManifest(group, inherited) {
  const out = [];
  const isRotation = group.groupType === 'rotation';
  const scheme = group.rotationScheme ?? inherited.rotationScheme;

  for (const member of group.members) {
    const childInherited = { ...inherited };
    if (isRotation && member.orientation) childInherited.orientation = member.orientation;
    if (group.groupType === 'state' && member.state) childInherited.state = member.state;

    if (member.type === 'group') {
      out.push(...flattenManifest(member, childInherited));
    } else {
      const id = member.id ?? buildAssetId(inherited.groupId, childInherited.orientation, childInherited.state);
      out.push({
        id,
        name: inherited.name,
        label: inherited.name,
        category: inherited.category,
        file: member.file ?? `${id}.png`,
        width: member.width,
        height: member.height,
        footprintW: member.footprintW,
        footprintH: member.footprintH,
        isDesk: inherited.category === 'desks',
        canPlaceOnWalls: inherited.canPlaceOnWalls,
        canPlaceOnSurfaces: inherited.canPlaceOnSurfaces,
        backgroundTiles: inherited.backgroundTiles,
        groupId: inherited.groupId,
        orientation: childInherited.orientation,
        state: childInherited.state,
        rotationScheme: scheme,
      });
    }
  }
  return out;
}

function buildAssetId(groupId, orientation, state) {
  const parts = [groupId];
  if (orientation) parts.push(orientation.toUpperCase());
  if (state) parts.push(state.toUpperCase());
  return parts.join('_');
}

export async function loadFurnitureAssets(workspaceRoot) {
  const furnitureDir = path.join(workspaceRoot, 'assets', 'furniture');
  if (!fs.existsSync(furnitureDir)) return null;

  const entries = fs.readdirSync(furnitureDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const catalog = [];
  const sprites = {};

  for (const dir of dirs) {
    const itemDir = path.join(furnitureDir, dir.name);
    const manifestPath = path.join(itemDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const inherited = {
        groupId: manifest.id,
        name: manifest.name,
        category: manifest.category,
        canPlaceOnWalls: manifest.canPlaceOnWalls,
        canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
        backgroundTiles: manifest.backgroundTiles,
      };

      let assets;
      if (manifest.type === 'asset') {
        assets = [{
          id: manifest.id,
          name: manifest.name,
          label: manifest.name,
          category: manifest.category,
          file: manifest.file ?? `${manifest.id}.png`,
          width: manifest.width,
          height: manifest.height,
          footprintW: manifest.footprintW,
          footprintH: manifest.footprintH,
          isDesk: manifest.category === 'desks',
          canPlaceOnWalls: manifest.canPlaceOnWalls,
          canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
          backgroundTiles: manifest.backgroundTiles,
          groupId: manifest.id,
        }];
      } else {
        if (manifest.rotationScheme) inherited.rotationScheme = manifest.rotationScheme;
        const rootGroup = {
          type: 'group',
          groupType: manifest.groupType,
          rotationScheme: manifest.rotationScheme,
          members: manifest.members,
        };
        assets = flattenManifest(rootGroup, inherited);
      }

      for (const asset of assets) {
        const assetPath = path.join(itemDir, asset.file);
        if (!fs.existsSync(assetPath)) continue;
        try {
          const pngBuffer = fs.readFileSync(assetPath);
          sprites[asset.id] = pngToSpriteData(pngBuffer, asset.width, asset.height);
        } catch (e) {
          console.warn(`[assets] failed to load ${asset.id}: ${e.message}`);
        }
      }
      catalog.push(...assets);
    } catch (e) {
      console.warn(`[assets] manifest error in ${dir.name}: ${e.message}`);
    }
  }

  console.log(`[assets] loaded ${Object.keys(sprites).length}/${catalog.length} furniture sprites`);
  return { catalog, sprites };
}

export async function loadFloorTiles(workspaceRoot) {
  const floorsDir = path.join(workspaceRoot, 'assets', 'floors');
  if (!fs.existsSync(floorsDir)) return null;
  const files = fs.readdirSync(floorsDir)
    .map((f) => /^floor_(\d+)\.png$/i.exec(f) ? { i: parseInt(RegExp.$1, 10), name: f } : null)
    .filter(Boolean)
    .sort((a, b) => a.i - b.i);
  const sprites = files.map((f) => decodeFloorPng(fs.readFileSync(path.join(floorsDir, f.name))));
  console.log(`[assets] loaded ${sprites.length} floor patterns`);
  return { sprites };
}

export async function loadWallTiles(workspaceRoot) {
  const wallsDir = path.join(workspaceRoot, 'assets', 'walls');
  if (!fs.existsSync(wallsDir)) return null;
  const files = fs.readdirSync(wallsDir)
    .map((f) => /^wall_(\d+)\.png$/i.exec(f) ? { i: parseInt(RegExp.$1, 10), name: f } : null)
    .filter(Boolean)
    .sort((a, b) => a.i - b.i);
  const sets = files.map((f) => parseWallPng(fs.readFileSync(path.join(wallsDir, f.name))));
  console.log(`[assets] loaded ${sets.length} wall sets`);
  return { sets };
}

export async function loadCharacterSprites(workspaceRoot) {
  const charDir = path.join(workspaceRoot, 'assets', 'characters');
  const characters = [];
  for (let ci = 0; ci < CHAR_COUNT; ci++) {
    const filePath = path.join(charDir, `char_${ci}.png`);
    if (!fs.existsSync(filePath)) return null;
    characters.push(decodeCharacterPng(fs.readFileSync(filePath)));
  }
  console.log(`[assets] loaded ${characters.length} character sprite sets`);
  return { characters };
}

export function loadDefaultLayout(workspaceRoot) {
  const assetsDir = path.join(workspaceRoot, 'assets');
  if (!fs.existsSync(assetsDir)) return null;
  let bestRev = 0;
  let bestPath = null;
  for (const file of fs.readdirSync(assetsDir)) {
    const m = /^default-layout-(\d+)\.json$/.exec(file);
    if (m) {
      const rev = parseInt(m[1], 10);
      if (rev > bestRev) {
        bestRev = rev;
        bestPath = path.join(assetsDir, file);
      }
    }
  }
  if (!bestPath) {
    const fallback = path.join(assetsDir, 'default-layout.json');
    if (fs.existsSync(fallback)) bestPath = fallback;
  }
  if (!bestPath) return null;
  console.log(`[assets] loaded default layout from ${path.basename(bestPath)}`);
  return JSON.parse(fs.readFileSync(bestPath, 'utf-8'));
}
