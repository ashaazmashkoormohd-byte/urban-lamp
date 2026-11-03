import * as THREE from 'three';

// Cache generated textures so we don't recreate them needlessly
const textureCache: Record<string, THREE.CanvasTexture> = {};

export function createRoadTexture(lanes: number = 2, hasCrosswalk: boolean = true): THREE.CanvasTexture {
  const cacheKey = `road_${lanes}_${hasCrosswalk}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let i = 0; i < 6000; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Outer solid white road lines
  ctx.strokeStyle = '#e7f3f8';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(35, 0); ctx.lineTo(35, 512);
  ctx.moveTo(477, 0); ctx.lineTo(477, 512);
  ctx.stroke();

  // Center dashed yellow lane dividers
  ctx.strokeStyle = '#f5c042';
  ctx.lineWidth = 8;
  ctx.setLineDash([36, 28]);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosswalk zebra stripes if requested
  if (hasCrosswalk) {
    ctx.fillStyle = '#ffffff';
    for (let y = 30; y < 140; y += 22) {
      ctx.fillRect(50, y, 412, 12);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache[cacheKey] = texture;
  return texture;
}

export function createSidewalkTexture(): THREE.CanvasTexture {
  const cacheKey = 'sidewalk_paving';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#263345';
  ctx.fillRect(0, 0, 256, 256);

  // Concrete slabs grid
  ctx.strokeStyle = '#1b2432';
  ctx.lineWidth = 4;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  textureCache[cacheKey] = texture;
  return texture;
}

export function createBuildingFacadeTexture(
  theme: 'cyber-cyan' | 'corporate-blue' | 'warm-amber' | 'residential',
  litRatio: number = 0.65
): THREE.CanvasTexture {
  const cacheKey = `facade_${theme}_${litRatio}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark architectural structural frame
  ctx.fillStyle = theme === 'cyber-cyan' ? '#0b1626' : theme === 'corporate-blue' ? '#0e1b2d' : '#141d28';
  ctx.fillRect(0, 0, 512, 512);

  // Window grid layout
  const cols = 8;
  const rows = 12;
  const cellW = 512 / cols;
  const cellH = 512 / rows;
  const marginX = 8;
  const marginY = 6;

  const litColors = {
    'cyber-cyan': ['#28d9ec', '#5ce8f7', '#1ba3b2', '#0ff'],
    'corporate-blue': ['#87ceeb', '#60a5fa', '#38bdf8', '#bae6fd'],
    'warm-amber': ['#fcd34d', '#f59e0b', '#fbbf24', '#fef08a'],
    'residential': ['#fef3c7', '#fed7aa', '#93c5fd', '#fef9c3'],
  }[theme];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + marginX;
      const wy = r * cellH + marginY;
      const ww = cellW - marginX * 2;
      const wh = cellH - marginY * 2;

      const isLit = Math.random() < litRatio;
      if (isLit) {
        const color = litColors[Math.floor(Math.random() * litColors.length)];
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, ww, wh);

        // Blinds / divider effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(wx, wy + wh * 0.45, ww, 2);
      } else {
        // Unlit reflective dark glass
        ctx.fillStyle = '#070f1a';
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache[cacheKey] = texture;
  return texture;
}

export function createSolarGridTexture(): THREE.CanvasTexture {
  const cacheKey = 'solar_array';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep navy blue monocrystalline wafer
  ctx.fillStyle = '#0d2238';
  ctx.fillRect(0, 0, 256, 256);

  // Silver conductor busbars
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 248);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1;
  for (let x = 16; x < 256; x += 16) {
    ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 252); ctx.stroke();
  }
  for (let y = 32; y < 256; y += 32) {
    ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(252, y); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  textureCache[cacheKey] = texture;
  return texture;
}

export function createHelipadTexture(): THREE.CanvasTexture {
  const cacheKey = 'helipad';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c2635';
  ctx.fillRect(0, 0, 256, 256);

  // Outer red circle
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 105, 0, Math.PI * 2);
  ctx.stroke();

  // White inner circle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 85, 0, Math.PI * 2);
  ctx.stroke();

  // Bold "H" letter
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 90px -apple-system, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache[cacheKey] = texture;
  return texture;
}

export function createNeonSignTexture(text: string, colorHex: string = '#28d9ec'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#060b13';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
