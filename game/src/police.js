// The Port Solace police and the wanted system. Crimes raise Rex's stars
// (0-5); patrol cars spawn in proportion and chase him down. Staying slow
// next to a cruiser fills the bust meter; breaking line of sight and lying
// low lets the stars cool off one at a time.

import { createCar } from './vehicles.js';
import { WORLD, BEACH_Y } from './city.js';

export function createWantedState() {
  return { stars: 0, heat: 0, coolTimer: 0, lastCrimeAt: -99 };
}

export function reportCrime(wanted, amount, elapsed) {
  wanted.heat = Math.min(5, wanted.heat + amount);
  wanted.stars = Math.min(5, Math.ceil(wanted.heat));
  wanted.lastCrimeAt = elapsed;
  wanted.coolTimer = 0;
}

export function coolWanted(wanted, dt, elapsed, seenByPolice) {
  if (wanted.stars <= 0) return;
  if (seenByPolice || elapsed - wanted.lastCrimeAt < 6) {
    wanted.coolTimer = 0;
    return;
  }
  wanted.coolTimer += dt;
  if (wanted.coolTimer > 9) {
    wanted.coolTimer = 0;
    wanted.heat = Math.max(0, wanted.heat - 1);
    wanted.stars = Math.ceil(wanted.heat);
  }
}

export function wantedPoliceCount(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, stars))];
}

export function spawnPoliceNear(player, random, index) {
  const angle = random() * Math.PI * 2;
  const dist = 420 + random() * 160;
  const x = Math.max(40, Math.min(WORLD.width - 40, player.x + Math.cos(angle) * dist));
  const y = Math.max(40, Math.min(BEACH_Y - 40, player.y + Math.sin(angle) * dist));
  const car = createCar(x, y, Math.atan2(player.y - y, player.x - x), '#f4f6f8', 'police');
  car.sirenPhase = index * 0.7;
  car.speed = 200;
  return car;
}

export function updatePoliceCar(car, target, dt, aggression) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const lead = Math.min(0.5, dist / 600);
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 3.2 * dt));
  const topSpeed = 335 + aggression * 26;
  const desired = dist > 46 ? topSpeed : 60;
  car.speed += (desired - car.speed) * Math.min(1, dt * 1.8);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
  car.y = Math.max(24, Math.min(BEACH_Y - 6, car.y));
  return dist;
}
