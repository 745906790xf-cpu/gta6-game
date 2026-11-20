// Port Solace: the city itself. A seeded grid of roads and blocks with
// buildings, sidewalks, parks, a beach and open water to the south, plus named
// landmarks the missions point at. Everything here is plain data plus drawing;
// movement and collision queries read the same layout the renderer paints.

import { pickFrom, rangeBetween } from './random.js';

export const WORLD = { width: 3600, height: 3600 };
export const ROAD_STEP = 300;
export const ROAD_WIDTH = 68;
export const WATER_Y = 3240;
export const BEACH_Y = 3130;

const ROOF_COLORS = ['#8a5a44', '#6b7f8e', '#a08b6d', '#7d6b8a', '#5f7d6b', '#96655a', '#71869c', '#b09a7a'];
const WALL_COLORS = ['#c9b8a3', '#b7c3cc', '#d6c9ae', '#c4b3cc', '#aec4b4', '#d3b3a6', '#b9c9d8', '#e0cdb2'];

export const LANDMARKS = [
  { id: 'pier', name: 'Solace Pier', x: 1750, y: 3050 },
  { id: 'market', name: 'Harbor Market', x: 900, y: 1150 },
  { id: 'tower', name: 'Voss Tower', x: 2350, y: 850 },
  { id: 'depot', name: 'North Depot', x: 650, y: 450 },
  { id: 'garage', name: 'Marlowe Garage', x: 1250, y: 2050 },
  { id: 'park', name: 'Palm Court Park', x: 2050, y: 1750 },
  { id: 'docks', name: 'Copper Docks', x: 2850, y: 2950 },
  { id: 'motel', name: 'Starlight Motel', x: 1550, y: 1450 },
];

export function isOnRoad(x, y) {
  if (y > BEACH_Y) return false;
  const mx = ((x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const my = ((y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  return mx < ROAD_WIDTH || my < ROAD_WIDTH;
}

export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / ROAD_STEP) * ROAD_STEP + ROAD_WIDTH / 2;
  const gy = Math.round(y / ROAD_STEP) * ROAD_STEP + ROAD_WIDTH / 2;
  if (Math.abs(gx - x) < Math.abs(gy - y)) return { x: gx, y };
  return { x, y: gy };
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parkBlocks = new Set(['6,5', '7,5', '2,8']);
  const cols = Math.floor(WORLD.width / ROAD_STEP);
  const rows = Math.floor(BEACH_Y / ROAD_STEP);

  for (let by = 0; by < rows; by += 1) {
    for (let bx = 0; bx < cols; bx += 1) {
      const blockX = bx * ROAD_STEP + ROAD_WIDTH;
      const blockY = by * ROAD_STEP + ROAD_WIDTH;
      const blockW = ROAD_STEP - ROAD_WIDTH;
      const blockH = ROAD_STEP - ROAD_WIDTH;
      if (parkBlocks.has(bx + ',' + by)) {
        for (let i = 0; i < 16; i += 1) {
          trees.push({
            x: blockX + 18 + random() * (blockW - 36),
            y: blockY + 18 + random() * (blockH - 36),
            r: rangeBetween(random, 10, 18),
          });
        }
        continue;
      }
      const lots = random() < 0.45 ? 1 : 2;
      for (let i = 0; i < lots; i += 1) {
        const w = lots === 1 ? rangeBetween(random, 150, 200) : rangeBetween(random, 70, 95);
        const h = lots === 1 ? rangeBetween(random, 140, 190) : rangeBetween(random, 90, 180);
        const x = blockX + 16 + (lots === 2 ? i * (blockW / 2) : (blockW - w) / 2) + rangeBetween(random, -4, 4);
        const y = blockY + (blockH - h) / 2 + rangeBetween(random, -6, 6);
        buildings.push({
          x, y, w, h,
          roof: pickFrom(random, ROOF_COLORS),
          wall: pickFrom(random, WALL_COLORS),
          floors: 2 + Math.floor(random() * 5),
        });
      }
      if (random() < 0.6) {
        trees.push({ x: blockX + 14, y: blockY + 14, r: rangeBetween(random, 8, 12) });
        trees.push({ x: blockX + blockW - 14, y: blockY + blockH - 14, r: rangeBetween(random, 8, 12) });
      }
    }
  }

  for (let gx = 0; gx <= WORLD.width; gx += ROAD_STEP) {
    for (let gy = 0; gy < BEACH_Y; gy += ROAD_STEP) {
      lamps.push({ x: gx + ROAD_WIDTH + 6, y: gy + ROAD_WIDTH + 6 });
      lamps.push({ x: gx - 6, y: gy + ROAD_STEP - 6 });
    }
  }

  return { buildings, trees, lamps, parkBlocks };
}

export function circleHitsBuilding(city, x, y, radius) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

export function pointBlocked(city, x, y, radius) {
  if (x < radius || y < radius || x > WORLD.width - radius || y > WATER_Y - 4) return true;
  return circleHitsBuilding(city, x, y, radius) !== null;
}

function drawRoads(ctx, view) {
  ctx.fillStyle = '#3a3f47';
  const startX = Math.max(0, Math.floor(view.x / ROAD_STEP) * ROAD_STEP - ROAD_STEP);
  const endX = Math.min(WORLD.width, view.x + view.w + ROAD_STEP);
  const startY = Math.max(0, Math.floor(view.y / ROAD_STEP) * ROAD_STEP - ROAD_STEP);
  const endY = Math.min(BEACH_Y, view.y + view.h + ROAD_STEP);
  for (let x = startX; x <= endX; x += ROAD_STEP) ctx.fillRect(x, 0, ROAD_WIDTH, BEACH_Y);
  for (let y = startY; y <= endY; y += ROAD_STEP) ctx.fillRect(0, y, WORLD.width, ROAD_WIDTH);
  ctx.fillStyle = '#e8d98a';
  for (let x = startX; x <= endX; x += ROAD_STEP) {
    for (let y = startY; y <= endY; y += 46) {
      const my = ((y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
      if (my < ROAD_WIDTH) continue;
      ctx.fillRect(x + ROAD_WIDTH / 2 - 2, y, 4, 22);
    }
  }
  for (let y = startY; y <= endY; y += ROAD_STEP) {
    for (let x = startX; x <= endX; x += 46) {
      const mx = ((x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
      if (mx < ROAD_WIDTH) continue;
      ctx.fillRect(x, y + ROAD_WIDTH / 2 - 2, 22, 4);
    }
  }
}

function drawBuilding(ctx, b, night) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 7);
  ctx.fillStyle = night > 0.45 ? '#ffd98a' : 'rgba(30,40,55,0.5)';
  const cols = Math.max(2, Math.floor(b.w / 26));
  const rows = Math.max(2, Math.floor(b.h / 30));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      if (((i * 7 + j * 13 + b.floors) % 3) === 0) continue;
      ctx.fillRect(b.x + 16 + i * ((b.w - 28) / cols), b.y + 18 + j * ((b.h - 30) / rows), 9, 11);
    }
  }
}

export function drawCity(ctx, city, view, night, elapsed) {
  ctx.fillStyle = '#7fae6d';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = '#9aa08f';
  const cols = Math.floor(WORLD.width / ROAD_STEP);
  const rows = Math.floor(BEACH_Y / ROAD_STEP);
  for (let by = 0; by < rows; by += 1) {
    for (let bx = 0; bx < cols; bx += 1) {
      const x = bx * ROAD_STEP + ROAD_WIDTH - 10;
      const y = by * ROAD_STEP + ROAD_WIDTH - 10;
      if (x + ROAD_STEP > view.x && x < view.x + view.w && y + ROAD_STEP > view.y && y < view.y + view.h) {
        ctx.fillStyle = city.parkBlocks.has(bx + ',' + by) ? '#6fae62' : '#9aa08f';
        ctx.fillRect(x, y, ROAD_STEP - ROAD_WIDTH + 20, ROAD_STEP - ROAD_WIDTH + 20);
      }
    }
  }
  drawRoads(ctx, view);
  ctx.fillStyle = '#e6d29a';
  ctx.fillRect(0, BEACH_Y, WORLD.width, WATER_Y - BEACH_Y);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    for (let x = Math.max(0, view.x); x <= Math.min(WORLD.width, view.x + view.w); x += 40) {
      const y = WATER_Y + 14 + i * 52 + Math.sin(elapsed * 1.4 + x * 0.012 + i) * 5;
      if (x === Math.max(0, view.x)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(1680, BEACH_Y - 30, 160, WATER_Y - BEACH_Y + 90);
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (b.x + b.w > view.x - 30 && b.x < view.x + view.w + 30 && b.y + b.h > view.y - 30 && b.y < view.y + view.h + 30) {
      drawBuilding(ctx, b, night);
    }
  }
  for (let i = 0; i < city.trees.length; i += 1) {
    const t = city.trees[i];
    if (t.x < view.x - 30 || t.x > view.x + view.w + 30 || t.y < view.y - 30 || t.y > view.y + view.h + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a34c';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  if (night > 0.25) {
    ctx.fillStyle = 'rgba(255,214,120,' + (0.5 * night).toFixed(2) + ')';
    for (let i = 0; i < city.lamps.length; i += 1) {
      const l = city.lamps[i];
      if (l.x < view.x - 40 || l.x > view.x + view.w + 40 || l.y < view.y - 40 || l.y > view.y + view.h + 40) continue;
      ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < LANDMARKS.length; i += 1) {
    const lm = LANDMARKS[i];
    if (lm.x < view.x - 120 || lm.x > view.x + view.w + 120 || lm.y < view.y - 60 || lm.y > view.y + view.h + 60) continue;
    ctx.fillText(lm.name, lm.x, lm.y - 64);
  }
}
