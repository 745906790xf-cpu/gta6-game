// Rex Marlowe on foot: walking, sprinting, punching and shooting, plus the
// little top-down figure the camera follows. Driving lives in vehicles.js;
// this file only moves Rex while his boots are on the pavement.

import { pointBlocked } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: 100,
    armor: 50,
    cash: 250,
    inCar: null,
    punchTimer: 0,
    shootTimer: 0,
    walkPhase: 0,
    bustTimer: 0,
  };
}

export function damagePlayer(player, amount) {
  let rest = amount;
  if (player.armor > 0) {
    const soaked = Math.min(player.armor, rest * 0.6);
    player.armor -= soaked;
    rest -= soaked;
  }
  player.health = Math.max(0, player.health - rest);
}

export function updatePlayerOnFoot(player, city, held, dt) {
  let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  const sprint = held.shift ? 1.55 : 1;
  const topSpeed = 215 * sprint;
  if (len > 0) {
    dx /= len; dy /= len;
    player.angle = Math.atan2(dy, dx);
    player.speed = Math.min(topSpeed, player.speed + 900 * dt);
    player.walkPhase += dt * (held.shift ? 13 : 9);
  } else {
    player.speed = Math.max(0, player.speed - 1100 * dt);
  }
  const vx = Math.cos(player.angle) * player.speed;
  const vy = Math.sin(player.angle) * player.speed;
  const nextX = player.x + vx * dt;
  const nextY = player.y + vy * dt;
  if (!pointBlocked(city, nextX, player.y, 11)) player.x = nextX;
  if (!pointBlocked(city, player.x, nextY, 11)) player.y = nextY;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
}

export function drawPlayer(ctx, player, elapsed) {
  const bob = Math.sin(player.walkPhase) * 1.6;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(3, 5, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(player.angle);
  ctx.fillStyle = '#20344d';
  ctx.fillRect(-4 + bob * 0.3, -11, 7, 5);
  ctx.fillRect(-4 - bob * 0.3, 6, 7, 5);
  ctx.fillStyle = '#e8b04b';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c894';
  ctx.beginPath(); ctx.arc(3, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.arc(2, 0, 5.5, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
  if (player.punchTimer > 0) {
    ctx.fillStyle = '#f2c894';
    ctx.beginPath(); ctx.arc(16, -6, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (player.shootTimer > 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(20, 0, 5 + Math.sin(elapsed * 40) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
