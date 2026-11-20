// Heads-up display for Neon Harbor: cash, health and armor bars, wanted
// stars, the mission objective card, the bust meter, the day clock, the
// corner minimap, and the full-screen title, pause and busted panels.

import { WORLD, BEACH_Y, ROAD_STEP, ROAD_WIDTH } from './city.js';
import { currentMission, currentObjective } from './missions.js';

export const VIEW = { width: 1280, height: 720 };

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(10,16,28,' + (alpha || 0.72) + ')';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,62,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, frac, color, label, value) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, 13);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 13);
  ctx.fillStyle = '#eef3f8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label + ' ' + Math.round(value), x + 5, y + 7);
}

export function drawWantedStars(ctx, x, y, stars, elapsed) {
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    const lit = i < stars;
    const flash = stars > 0 && Math.floor(elapsed * 3) % 2 === 0;
    ctx.fillStyle = lit ? (flash ? '#ffd23e' : '#ff9f1a') : 'rgba(255,255,255,0.18)';
    ctx.fillText('★', x + i * 30, y);
  }
}

export function drawHud(ctx, game) {
  const player = game.player;
  panel(ctx, VIEW.width - 300, 16, 284, 118);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('$' + player.cash.toLocaleString('en-US'), VIEW.width - 32, 40);
  drawWantedStars(ctx, VIEW.width - 286, 40, game.wanted.stars, game.elapsed);
  bar(ctx, VIEW.width - 284, 62, 252, player.health / 100, '#e5534b', 'HEALTH', player.health);
  bar(ctx, VIEW.width - 284, 82, 252, player.armor / 100, '#4fc3f7', 'ARMOR', player.armor);
  const hour = Math.floor(game.clock);
  const minute = Math.floor((game.clock - hour) * 60);
  ctx.fillStyle = '#cfe3f5';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + '  Port Solace', VIEW.width - 32, 116);

  const mission = currentMission(game.missions);
  const objective = currentObjective(game.missions);
  panel(ctx, 16, 16, 380, mission ? 96 : 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(mission ? mission.title : 'Free Roam — Port Solace', 30, 38);
  ctx.fillStyle = '#eef3f8';
  ctx.font = '14px system-ui, sans-serif';
  if (objective) {
    ctx.fillText(objective.label, 30, 62);
    const dist = Math.round(Math.hypot(player.x - objective.x, player.y - objective.y));
    ctx.fillStyle = '#9fb6cc';
    ctx.fillText('Follow the gold marker  ·  ' + dist + ' m', 30, 84);
  } else {
    ctx.fillText('The harbor is yours. Drive, explore, cause trouble.', 30, 62);
  }

  if (game.missions.bannerTimer > 0 && game.missions.banner) {
    panel(ctx, VIEW.width / 2 - 340, 16, 680, 46, 0.82);
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.missions.banner, VIEW.width / 2, 40);
  }

  if (player.bustTimer > 0.05) {
    panel(ctx, VIEW.width / 2 - 150, VIEW.height - 120, 300, 52, 0.85);
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN...', VIEW.width / 2, VIEW.height - 102);
    bar(ctx, VIEW.width / 2 - 130, VIEW.height - 90, 260, player.bustTimer / 2.2, '#ff3b30', '', 0);
  }

  ctx.fillStyle = 'rgba(238,243,248,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const hint = player.inCar
    ? 'W A S D drive · Shift brake · E exit car · Esc pause'
    : 'W A S D move · Shift sprint · E enter car · Click / Space punch & shoot · Esc pause';
  ctx.fillText(hint, 16, VIEW.height - 18);
  if (game.nearCar && !player.inCar) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to enter the car', VIEW.width / 2, VIEW.height - 52);
  }
}

export function drawMinimap(ctx, game) {
  const size = 190;
  const x0 = VIEW.width - size - 16;
  const y0 = VIEW.height - size - 16;
  const sx = size / WORLD.width;
  const sy = size / WORLD.height;
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 0.8);
  ctx.fillStyle = '#5d7d52';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0, y0 + BEACH_Y * sy, size, size - BEACH_Y * sy);
  ctx.fillStyle = '#3a3f47';
  for (let gx = 0; gx <= WORLD.width; gx += ROAD_STEP) ctx.fillRect(x0 + gx * sx, y0, Math.max(1.5, ROAD_WIDTH * sx), BEACH_Y * sy);
  for (let gy = 0; gy < BEACH_Y; gy += ROAD_STEP) ctx.fillRect(x0, y0 + gy * sy, size, Math.max(1.5, ROAD_WIDTH * sy));
  const objective = currentObjective(game.missions);
  if (objective) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x0 + objective.x * sx, y0 + objective.y * sy, 5 + Math.sin(game.elapsed * 4) * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff3b30';
  for (let i = 0; i < game.police.length; i += 1) {
    const c = game.police[i];
    ctx.fillRect(x0 + c.x * sx - 2.5, y0 + c.y * sy - 2.5, 5, 5);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * sx, y0 + game.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * sx, y0 + game.player.y * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#cfe3f5';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLACE', x0 + 4, y0 + 14);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      yy += lineHeight;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export function drawTitleScreen(ctx, game) {
  ctx.fillStyle = 'rgba(6,10,20,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 400, 74, 800, 520, 0.9);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('NEON HARBOR', VIEW.width / 2, 158);
  ctx.fillStyle = '#7ee0ff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('P O R T   S O L A C E', VIEW.width / 2, 192);
  ctx.fillStyle = '#eef3f8';
  ctx.font = '16px system-ui, sans-serif';
  wrapText(ctx, 'Rex Marlowe just got out and came home to Port Solace with $250 and a debt. Mara Voss runs the docks and has five jobs that can make Rex rich — or get him busted. Steal cars, run packages, outdrive the police, and take the harbor.', VIEW.width / 2, 232, 680, 23);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('CONTROLS', VIEW.width / 2, 330);
  ctx.fillStyle = '#cfe3f5';
  ctx.font = '15px system-ui, sans-serif';
  const lines = [
    'W A S D / Arrows — move and drive      Shift — sprint / brake',
    'E — enter and exit cars      Click or Space — punch and shoot',
    'Mouse — aim      Esc / P — pause      Follow the gold mission marker',
    'Crimes raise your wanted stars. Lose the police or get busted.',
  ];
  for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], VIEW.width / 2, 358 + i * 24);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText('Click or press Space to start', VIEW.width / 2, 492);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Progress saves in this browser. Sound starts after your first click or key.', VIEW.width / 2, 524);
  if (game.savedNote) ctx.fillText(game.savedNote, VIEW.width / 2, 548);
}

export function drawPauseScreen(ctx) {
  ctx.fillStyle = 'rgba(6,10,20,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 260, 250, 520, 200, 0.92);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 322);
  ctx.fillStyle = '#eef3f8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Port Solace waits for no one, Rex.', VIEW.width / 2, 358);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('Press Esc or P to keep driving', VIEW.width / 2, 398);
}

export function drawBustedScreen(ctx, game, reason) {
  ctx.fillStyle = 'rgba(20,4,6,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 320, 210, 640, 280, 0.94);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b5e';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(reason === 'wasted' ? 'WASTED' : 'BUSTED', VIEW.width / 2, 292);
  ctx.fillStyle = '#eef3f8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(reason === 'wasted' ? 'Rex Marlowe flatlined in Port Solace.' : 'The Port Solace police finally boxed Rex in.', VIEW.width / 2, 330);
  ctx.fillText('Cash: $' + game.player.cash.toLocaleString('en-US') + '   ·   Missions done: ' + game.missions.index + ' / 5', VIEW.width / 2, 362);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('Click or press Space to try again', VIEW.width / 2, 422);
}
