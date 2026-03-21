import { useEffect, useRef } from 'react';

import { getCachedSprite } from '../office/sprites/spriteCache.js';
import { getCharacterSprites } from '../office/sprites/spriteData.js';
import { Direction } from '../office/types.js';

interface CharacterPreviewProps {
  palette: number;
  hueShift: number;
  size?: number;
}

export function CharacterPreview({ palette, hueShift, size = 2 }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = getCharacterSprites(palette, hueShift);
    // walk.down[1] is the standing frame (walk2)
    const sprite = sprites.walk[Direction.DOWN][1];
    const w = sprite[0].length;
    const h = sprite.length;

    canvas.width = w * size;
    canvas.height = h * size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cached = getCachedSprite(sprite, size);
    ctx.drawImage(cached, 0, 0);
  }, [palette, hueShift, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        imageRendering: 'pixelated',
        display: 'block',
      }}
    />
  );
}
