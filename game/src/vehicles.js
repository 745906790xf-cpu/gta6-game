// Cars in Port Solace: the one Rex drives, the parked ones he can steal, and
// the ambient traffic that cruises the grid. Driving is simple arcade physics
// (throttle, steering that bites with speed, friction); traffic follows the
// road lanes and turns at intersections.

import { ROAD_STEP, ROAD_WIDTH, WORLD, BEACH_Y, pointBlocked } from './city.js';
import { pickFrom, rangeBetween } from './random.js';

export const CAR_COLORS = ['#c0392b', '#2471a3', '#f39c12', '#27ae60', '#8e44ad', '#ecf0f1', '#16a085', '#d35400', '#2e4053', '#f1c40f'];

export function createCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind: kind || 'traffic',
    health: 100,
    lane: 1,
    turnCooldown: 0,
    sirenPhase: 0,
    driverGone: false,
  };
}

export function spawnParkedCars(random, city) {
  const cars = [];
  for (let i = 0; i < 26; i += 1) {
    const gx = Math.floor(random() * 11) * ROAD_STEP;
    const gy = Math.floor(random() * 10) * ROAD_STEP;
    const vertical = random() < 0.5;
    const x = vertical ? gx + 16 : gx + rangeBetween(random, 90, 230);
    const y = vertical ? gy + rangeBetween(random, 90, 230) : gy + 16;
    if (pointBlocked(city, x, y, 20)) continue;
    cars.push(createCar(x, y, vertical ? Math.PI / 2 : 0, pickFrom(random, CAR_COLORS), 'parked'));
  }
  return cars;
}

export function spawnTraffic(random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const gx = Math.floor(random() * 12) * ROAD_STEP;
    const gy = Math.floor(random() * 10) * ROAD_STEP;
    const vertical = random() < 0.5;
    const laneOffset = ROAD_WIDTH * 0.72;
    const x = vertical ? gx + laneOffset : gx + rangeBetween(random, 80, 240);
    const y = vertical ? gy + rangeBetween(random, 80, 240) : gy + laneOffset;
    const car = createCar(x, y, vertical ? Math.PI / 2 : 0, pickFrom(random, CAR_COLORS), 'traffic');
    car.speed = rangeBetween(random, 90, 150);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function drivePlayerCar(car, held, dt) {
  const throttle = (held.up ? 1 : 0) - (held.down ? 1 : 0);
  const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (throttle > 0) car.speed += 260 * dt;
  else if (throttle < 0) car.speed -= (car.speed > 8 ? 340 : 150) * dt;
  car.speed -= car.speed * 0.55 * dt;
  if (held.shift) car.speed -= car.speed * 2.2 * dt;
  car.speed = Math.max(-130, Math.min(430, car.speed));
  const grip = Math.min(1, Math.abs(car.speed) / 90);
  car.angle += steer * 2.1 * grip * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
  car.y = Math.max(24, Math.min(BEACH_Y - 6, car.y));
}

function snapToLane(car) {
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  if (vertical) {
    const gx = Math.round((car.x - ROAD_WIDTH * 0.72) / ROAD_STEP) * ROAD_STEP;
    car.x += (gx + ROAD_WIDTH * 0.72 - car.x) * 0.08;
  } else {
    const gy = Math.round((car.y - ROAD_WIDTH * 0.72) / ROAD_STEP) * ROAD_STEP;
    car.y += (gy + ROAD_WIDTH * 0.72 - car.y) * 0.08;
  }
}

export function updateTrafficCar(car, random, dt, obstacles) {
  car.turnCooldown -= dt;
  const mx = ((car.x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const my = ((car.y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const atCrossing = mx < ROAD_WIDTH && my < ROAD_WIDTH;
  if (atCrossing && car.turnCooldown <= 0 && random() < 0.012) {
    car.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
    car.turnCooldown = 2.5;
  }
  let want = car.cruise || 120;
  for (let i = 0; i < obstacles.length; i += 1) {
    const o = obstacles[i];
    if (o === car) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 62 && side < 20) want = Math.min(want, 18);
  }
  car.speed += (want - car.speed) * Math.min(1, dt * 2.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.x < 30 || car.x > WORLD.width - 30 || car.y < 30 || car.y > BEACH_Y - 20) {
    car.angle += Math.PI;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(BEACH_Y - 20, car.y));
  }
  snapToLane(car);
}

export function collideCarWithBuildings(car, city) {
  const noseX = car.x + Math.cos(car.angle) * 24;
  const noseY = car.y + Math.sin(car.angle) * 24;
  const tailX = car.x - Math.cos(car.angle) * 24;
  const tailY = car.y - Math.sin(car.angle) * 24;
  if (pointBlocked(city, noseX, noseY, 13) || pointBlocked(city, tailX, tailY, 13) || pointBlocked(city, car.x, car.y, 15)) {
    car.x -= Math.cos(car.angle) * car.speed * 0.02;
    car.y -= Math.sin(car.angle) * car.speed * 0.02;
    car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.045);
    car.speed *= -0.22;
    return true;
  }
  return false;
}

export function drawCar(ctx, car, elapsed, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  if (night > 0.3 && Math.abs(car.speed) > 4) {
    ctx.save();
    ctx.rotate(car.angle);
    const grad = ctx.createRadialGradient(26, 0, 4, 26, 0, 130);
    grad.addColorStop(0, 'rgba(255,240,170,0.34)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.arc(24, 0, 130, -0.42, 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 5, 27, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#15181d';
  ctx.fillRect(13, -14, 10, 5); ctx.fillRect(13, 9, 10, 5);
  ctx.fillRect(-23, -14, 10, 5); ctx.fillRect(-23, 9, 10, 5);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-26, -13, 52, 26, 7); else ctx.rect(-26, -13, 52, 26);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(-26, -13, 52, 4);
  ctx.fillStyle = '#1c2733';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-9, -10, 20, 20, 5); else ctx.rect(-9, -10, 20, 20);
  ctx.fill();
  ctx.fillStyle = '#3d5a73';
  ctx.fillRect(8, -9, 4, 18);
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(23, -10, 4, 5); ctx.fillRect(23, 5, 4, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-26, -10, 3, 5); ctx.fillRect(-26, 5, 3, 5);
  if (car.health < 55) {
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    ctx.beginPath(); ctx.arc(16, 0, 7 + Math.sin(elapsed * 6 + car.x) * 2, 0, Math.PI * 2); ctx.fill();
  }
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -13, 16, 26);
    ctx.fillStyle = '#1b2a4a';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const flash = Math.floor(elapsed * 6 + car.sirenPhase) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
    ctx.beginPath(); ctx.arc(-2, -5, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(-2, 5, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
