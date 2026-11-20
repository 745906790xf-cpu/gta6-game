// Neon Harbor — boot, the one game loop, and the world state that ties every
// system together: Port Solace, Rex, cars, traffic, pedestrians, police,
// missions, combat, the day clock, saving, and the ?shot= screenshot scenes.

import { createRandom, pickFrom, rangeBetween } from './random.js';
import { buildCity, drawCity, pointBlocked, WORLD, BEACH_Y, ROAD_STEP, ROAD_WIDTH } from './city.js';
import { createPlayer, updatePlayerOnFoot, drawPlayer, damagePlayer } from './player.js';
import { createCar, spawnParkedCars, spawnTraffic, drivePlayerCar, updateTrafficCar, collideCarWithBuildings, drawCar, CAR_COLORS } from './vehicles.js';
import { createWantedState, reportCrime, coolWanted, wantedPoliceCount, spawnPoliceNear, updatePoliceCar } from './police.js';
import { createMissionState, advanceMission, drawMissionMarker, showMissionBanner, currentMission, MISSIONS } from './missions.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_SHOOT } from './input.js';
import { drawHud, drawMinimap, drawTitleScreen, drawPauseScreen, drawBustedScreen, VIEW } from './hud.js';

const SAVE_KEY = 'neon-harbor.save.v1';
const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const PED_COLORS = ['#e67e22', '#9b59b6', '#1abc9c', '#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#e91e63'];

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
const audio = createAudio();

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function writeSave(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.player.cash,
      health: game.player.health,
      armor: game.player.armor,
      missionIndex: game.missions.index,
      x: game.player.x,
      y: game.player.y,
    }));
  } catch (err) {
    // Private windows can refuse storage; the run simply lasts this visit.
  }
}

function createPedestrian() {
  const gx = Math.floor(random() * 11) * ROAD_STEP;
  const gy = Math.floor(random() * 10) * ROAD_STEP;
  const vertical = random() < 0.5;
  return {
    x: vertical ? gx + ROAD_WIDTH + 14 : gx + rangeBetween(random, 80, 240),
    y: vertical ? gy + rangeBetween(random, 80, 240) : gy + ROAD_WIDTH + 14,
    angle: vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
    speed: rangeBetween(random, 42, 74),
    color: pickFrom(random, PED_COLORS),
    health: 30,
    panic: 0,
    walkPhase: random() * 6,
    down: 0,
  };
}

function createGame() {
  const city = buildCity(random);
  const saved = shotName ? null : loadSave();
  const startX = saved && typeof saved.x === 'number' ? saved.x : 1250;
  const startY = saved && typeof saved.y === 'number' ? saved.y : 2140;
  const player = createPlayer(startX, startY);
  if (saved) {
    if (typeof saved.cash === 'number') player.cash = saved.cash;
    if (typeof saved.health === 'number') player.health = Math.max(20, saved.health);
    if (typeof saved.armor === 'number') player.armor = saved.armor;
  }
  const game = {
    city,
    player,
    parked: spawnParkedCars(random, city),
    traffic: spawnTraffic(random, 16),
    police: [],
    peds: [],
    wanted: createWantedState(),
    missions: createMissionState(saved && typeof saved.missionIndex === 'number' ? saved.missionIndex : 0),
    elapsed: 0,
    clock: 10.2,
    screen: 'title',
    tracers: [],
    nearCar: null,
    savedNote: saved ? 'Saved progress found: $' + player.cash + ', mission ' + Math.min(6, gameSafeMission(saved) + 1) + ' of 5.' : '',
    overReason: 'busted',
    saveTimer: 0,
    sirenTimer: 0,
  };
  for (let i = 0; i < 26; i += 1) game.peds.push(createPedestrian());
  const first = currentMission(game.missions);
  if (first) showMissionBanner(game.missions, first.title + ': ' + first.stops[0].label);
  return game;
}

function gameSafeMission(saved) {
  return typeof saved.missionIndex === 'number' ? saved.missionIndex : 0;
}

function nightFactor(clock) {
  if (clock >= 7 && clock <= 17.5) return 0;
  if (clock > 17.5 && clock < 20) return (clock - 17.5) / 2.5;
  if (clock >= 20 || clock < 5) return 1;
  return 1 - (clock - 5) / 2;
}

function allCars(game) {
  return game.parked.concat(game.traffic, game.police);
}

function findNearCar(game) {
  let best = null;
  let bestDist = 52;
  const cars = allCars(game);
  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    if (c.kind === 'police') continue;
    const d = Math.hypot(game.player.x - c.x, game.player.y - c.y);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

function enterOrExitCar(game) {
  const player = game.player;
  if (player.inCar) {
    const car = player.inCar;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    if (pointBlocked(game.city, player.x, player.y, 11)) { player.x = car.x; player.y = car.y + 36; }
    player.inCar = null;
    audio.door();
    audio.setEngine(false, 0);
    return;
  }
  const car = findNearCar(game);
  if (!car) return;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  audio.door();
  if (car.kind !== 'parked' || car.speed > 2) {
    reportCrime(game.wanted, 0.7, game.elapsed);
    showMissionBanner(game.missions, 'Car stolen! The Port Solace police have been alerted.');
  } else if (car.kind === 'parked') {
    reportCrime(game.wanted, 0.45, game.elapsed);
  }
  car.kind = 'player';
}

function playerShoot(game, aimAngle) {
  const player = game.player;
  player.angle = aimAngle;
  player.shootTimer = 0.16;
  audio.shoot();
  const range = 330;
  const endX = player.x + Math.cos(aimAngle) * range;
  const endY = player.y + Math.sin(aimAngle) * range;
  game.tracers.push({ x1: player.x + Math.cos(aimAngle) * 16, y1: player.y + Math.sin(aimAngle) * 16, x2: endX, y2: endY, life: 0.09 });
  reportCrime(game.wanted, 0.5, game.elapsed);
  let bestT = 1;
  let hitPed = null;
  let hitCar = null;
  for (let i = 0; i < game.peds.length; i += 1) {
    const p = game.peds[i];
    if (p.down > 0) continue;
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const along = dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle);
    const side = Math.abs(-dx * Math.sin(aimAngle) + dy * Math.cos(aimAngle));
    if (along > 8 && along < range && side < 13 && along / range < bestT) { bestT = along / range; hitPed = p; hitCar = null; }
  }
  const cars = allCars(game);
  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    const dx = c.x - player.x;
    const dy = c.y - player.y;
    const along = dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle);
    const side = Math.abs(-dx * Math.sin(aimAngle) + dy * Math.cos(aimAngle));
    if (along > 8 && along < range && side < 24 && along / range < bestT) { bestT = along / range; hitCar = c; hitPed = null; }
  }
  if (hitPed) {
    hitPed.health -= 30;
    hitPed.panic = 3;
    reportCrime(game.wanted, 0.8, game.elapsed);
    if (hitPed.health <= 0) { hitPed.down = 6; reportCrime(game.wanted, 0.8, game.elapsed); }
  } else if (hitCar) {
    hitCar.health = Math.max(0, hitCar.health - 12);
    if (hitCar.kind === 'police') reportCrime(game.wanted, 0.9, game.elapsed);
  }
  for (let i = 0; i < game.peds.length; i += 1) {
    const p = game.peds[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) < 260) p.panic = Math.max(p.panic, 2.4);
  }
}

function playerPunch(game, aimAngle) {
  const player = game.player;
  player.angle = aimAngle;
  player.punchTimer = 0.22;
  audio.punch();
  for (let i = 0; i < game.peds.length; i += 1) {
    const p = game.peds[i];
    if (p.down > 0) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 34) {
      p.health -= 12;
      p.panic = 3;
      p.x += Math.cos(aimAngle) * 14;
      p.y += Math.sin(aimAngle) * 14;
      reportCrime(game.wanted, 0.4, game.elapsed);
      if (p.health <= 0) p.down = 6;
      return;
    }
  }
}

function updatePedestrians(game, dt) {
  for (let i = 0; i < game.peds.length; i += 1) {
    const p = game.peds[i];
    if (p.down > 0) {
      p.down -= dt;
      if (p.down <= 0) game.peds[i] = createPedestrian();
      continue;
    }
    p.panic = Math.max(0, p.panic - dt);
    const speed = p.speed * (p.panic > 0 ? 2.1 : 1);
    if (p.panic > 0) {
      p.angle = Math.atan2(p.y - game.player.y, p.x - game.player.x);
    } else if (random() < 0.004) {
      p.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    const nx = p.x + Math.cos(p.angle) * speed * dt;
    const ny = p.y + Math.sin(p.angle) * speed * dt;
    if (!pointBlocked(game.city, nx, ny, 8)) { p.x = nx; p.y = ny; }
    else p.angle += Math.PI;
    p.x = Math.max(16, Math.min(WORLD.width - 16, p.x));
    p.y = Math.max(16, Math.min(BEACH_Y - 8, p.y));
    p.walkPhase += dt * 8;
  }
}

function carHitsPedestrian(game, car, isPlayerCar) {
  if (Math.abs(car.speed) < 55) return;
  for (let i = 0; i < game.peds.length; i += 1) {
    const p = game.peds[i];
    if (p.down > 0) continue;
    if (Math.hypot(p.x - car.x, p.y - car.y) < 30) {
      p.down = 6;
      p.health = 0;
      if (isPlayerCar) {
        reportCrime(game.wanted, 0.9, game.elapsed);
        damagePlayer(game.player, 1.5);
        audio.crash();
      }
    }
  }
}

function carHitsCar(game, car, isPlayerCar) {
  const cars = allCars(game);
  for (let i = 0; i < cars.length; i += 1) {
    const o = cars[i];
    if (o === car) continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const ux = (car.x - o.x) / d;
      const uy = (car.y - o.y) / d;
      car.x += ux * push;
      car.y += uy * push;
      o.x -= ux * push;
      o.y -= uy * push;
      const impact = Math.abs(car.speed) + Math.abs(o.speed);
      if (impact > 90) {
        car.health = Math.max(0, car.health - impact * 0.05);
        o.health = Math.max(0, o.health - impact * 0.05);
        if (isPlayerCar) {
          reportCrime(game.wanted, 0.45, game.elapsed);
          damagePlayer(game.player, impact * 0.02);
          audio.crash();
        }
      }
      car.speed *= 0.55;
      o.speed *= 0.55;
    }
  }
}

function updatePolice(game, dt) {
  const want = wantedPoliceCount(game.wanted.stars);
  while (game.police.length < want) game.police.push(spawnPoliceNear(game.player, random, game.police.length));
  while (game.police.length > want) game.police.pop();
  const player = game.player;
  const target = {
    x: player.x, y: player.y,
    vx: player.inCar ? Math.cos(player.inCar.angle) * player.inCar.speed : Math.cos(player.angle) * player.speed,
    vy: player.inCar ? Math.sin(player.inCar.angle) * player.inCar.speed : Math.sin(player.angle) * player.speed,
  };
  let nearest = Infinity;
  let seen = false;
  for (let i = 0; i < game.police.length; i += 1) {
    const cop = game.police[i];
    const dist = updatePoliceCar(cop, target, dt, game.wanted.stars);
    nearest = Math.min(nearest, dist);
    if (dist < 520) seen = true;
    collideCarWithBuildings(cop, game.city);
    carHitsCar(game, cop, false);
    if (dist < 58 && Math.abs(cop.speed) > 130) {
      damagePlayer(player, 4 * dt * 8);
      if (player.inCar) player.inCar.speed *= 0.985;
    }
  }
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
  if (game.wanted.stars > 0 && nearest < 72 && playerSpeed < 55) {
    player.bustTimer += dt;
    if (player.bustTimer > 2.2) {
      game.screen = 'over';
      game.overReason = 'busted';
      player.cash = Math.max(0, player.cash - 150);
      game.wanted.stars = 0;
      game.wanted.heat = 0;
      game.police.length = 0;
      player.bustTimer = 0;
      writeSave(game);
    }
  } else {
    player.bustTimer = Math.max(0, player.bustTimer - dt * 1.6);
  }
  coolWanted(game.wanted, dt, game.elapsed, seen);
  audio.setSiren(game.police.length > 0, game.elapsed);
}

function stepGame(game, input, dt) {
  game.elapsed += dt;
  game.clock = (game.clock + dt * (24 / 260)) % 24;
  if (game.missions.bannerTimer > 0) game.missions.bannerTimer -= dt;
  for (let i = game.tracers.length - 1; i >= 0; i -= 1) {
    game.tracers[i].life -= dt;
    if (game.tracers[i].life <= 0) game.tracers.splice(i, 1);
  }
  const player = game.player;
  game.nearCar = player.inCar ? null : findNearCar(game);

  if (player.inCar) {
    const car = player.inCar;
    drivePlayerCar(car, input.held, dt);
    if (collideCarWithBuildings(car, game.city)) {
      damagePlayer(player, Math.abs(car.speed) * 0.03 + 1);
      audio.crash();
    }
    carHitsPedestrian(game, car, true);
    carHitsCar(game, car, true);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    audio.setEngine(true, car.speed / 430);
  } else {
    updatePlayerOnFoot(player, game.city, input.held, dt);
    audio.setEngine(false, 0);
  }

  const obstacles = allCars(game);
  obstacles.push({ x: player.x, y: player.y, speed: 0 });
  for (let i = 0; i < game.traffic.length; i += 1) {
    const car = game.traffic[i];
    if (car === player.inCar) continue;
    updateTrafficCar(car, random, dt, obstacles);
    collideCarWithBuildings(car, game.city);
  }
  updatePedestrians(game, dt);
  updatePolice(game, dt);

  const before = game.missions.index;
  if (advanceMission(game.missions, player)) {
    audio.cash();
    writeSave(game);
    if (game.missions.index > before && game.missions.index === 1) {
      reportCrime(game.wanted, 0.6, game.elapsed);
    }
  }

  if (player.health <= 0 && game.screen === 'play') {
    game.screen = 'over';
    game.overReason = 'wasted';
    player.cash = Math.max(0, player.cash - 200);
    writeSave(game);
  }

  game.saveTimer += dt;
  if (game.saveTimer > 6) {
    game.saveTimer = 0;
    writeSave(game);
  }
  audio.updateMusic(dt, Boolean(player.inCar), game.wanted.stars);
}

function drawPedestrian(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (p.down > 0) {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, p.angle, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(p.angle);
  const bob = Math.sin(p.walkPhase) * 1.4;
  ctx.fillStyle = '#333a45';
  ctx.fillRect(-3 + bob * 0.3, -9, 6, 4);
  ctx.fillRect(-3 - bob * 0.3, 5, 6, 4);
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c894';
  ctx.beginPath(); ctx.arc(2, 0, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function renderGame(game) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(window.innerWidth * dpr);
  const ch = Math.round(window.innerHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const scale = Math.min(cw / VIEW.width, ch / VIEW.height);
  const offX = (cw - VIEW.width * scale) / 2;
  const offY = (ch - VIEW.height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(scale, 0, 0, scale, offX, offY);

  const player = game.player;
  const lookAhead = player.inCar ? 70 : 26;
  const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2 + Math.cos(player.angle) * lookAhead));
  const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2 + Math.sin(player.angle) * lookAhead));
  const night = nightFactor(game.clock);
  const view = { x: camX, y: camY, w: VIEW.width, h: VIEW.height };

  ctx.save();
  ctx.translate(-camX, -camY);
  drawCity(ctx, game.city, view, night, game.elapsed);
  drawMissionMarker(ctx, game.missions, game.elapsed);
  for (let i = 0; i < game.parked.length; i += 1) drawCar(ctx, game.parked[i], game.elapsed, night);
  for (let i = 0; i < game.traffic.length; i += 1) drawCar(ctx, game.traffic[i], game.elapsed, night);
  for (let i = 0; i < game.peds.length; i += 1) drawPedestrian(ctx, game.peds[i]);
  for (let i = 0; i < game.police.length; i += 1) drawCar(ctx, game.police[i], game.elapsed, night);
  if (!player.inCar) drawPlayer(ctx, player, game.elapsed);
  ctx.strokeStyle = '#ffe9a3';
  ctx.lineWidth = 2;
  for (let i = 0; i < game.tracers.length; i += 1) {
    const t = game.tracers[i];
    ctx.globalAlpha = Math.max(0, t.life / 0.09);
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (night > 0.02) {
    ctx.fillStyle = 'rgba(10,16,48,' + (night * 0.42).toFixed(2) + ')';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = 'rgba(255,140,60,' + (night * (1 - night) * 0.35).toFixed(2) + ')';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (game.screen === 'title') {
    drawTitleScreen(ctx, game);
    return;
  }
  drawHud(ctx, game);
  drawMinimap(ctx, game);
  if (game.screen === 'paused') drawPauseScreen(ctx);
  if (game.screen === 'over') drawBustedScreen(ctx, game, game.overReason);
}

function aimAngleFromMouse(game, input) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = VIEW.width / rect.width;
  const scaleY = VIEW.height / rect.height;
  const mx = input.mouse.x * scaleX;
  const my = input.mouse.y * scaleY;
  return Math.atan2(my - VIEW.height / 2, mx - VIEW.width / 2);
}

function resetRun(game) {
  const fresh = createGame();
  game.city = fresh.city;
  game.player = fresh.player;
  game.parked = fresh.parked;
  game.traffic = fresh.traffic;
  game.police = [];
  game.peds = fresh.peds;
  game.wanted = createWantedState();
  game.missions = createMissionState(0);
  game.elapsed = 0;
  game.clock = 10.2;
  game.tracers = [];
  game.overReason = 'busted';
  const first = currentMission(game.missions);
  if (first) showMissionBanner(game.missions, first.title + ': ' + first.stops[0].label);
}

function stageShot(game, name) {
  const player = game.player;
  const fakeInput = { held: { up: false, down: false, left: false, right: false, shift: false }, mouse: { x: 640, y: 360, down: false } };
  function run(seconds) {
    const steps = Math.floor(seconds / STEP);
    for (let i = 0; i < steps; i += 1) stepGame(game, fakeInput, STEP);
  }
  if (name === 'title') {
    game.screen = 'title';
    game.clock = 18.1;
    player.x = 1550;
    player.y = 1600;
    run(3);
    game.screen = 'title';
    return;
  }
  game.screen = 'play';
  if (name === 'city') {
    game.clock = 10.4;
    const car = createCar(1180, 1534, 0, '#c0392b', 'player');
    car.speed = 250;
    game.parked.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.cash = 1850;
    fakeInput.held.up = true;
    run(2.6);
    fakeInput.held.up = false;
    player.health = 100;
    player.armor = 50;
    player.bustTimer = 0;
    game.screen = 'play';
    return;
  }
  if (name === 'chase') {
    game.clock = 19.6;
    const car = createCar(2134, 1250, Math.PI / 2, '#2471a3', 'player');
    car.speed = 310;
    game.parked.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.cash = 2400;
    player.health = 82;
    reportCrime(game.wanted, 3, 0);
    run(0.2);
    for (let i = 0; i < game.police.length; i += 1) {
      const cop = game.police[i];
      cop.x = car.x + (i - 1) * 55;
      cop.y = car.y - 95 - i * 45;
      cop.angle = Math.PI / 2;
      cop.speed = 290;
    }
    fakeInput.held.up = true;
    run(1.1);
    fakeInput.held.up = false;
    game.wanted.stars = 3;
    game.wanted.heat = 3;
    player.health = 82;
    player.armor = 39;
    player.bustTimer = 0;
    game.screen = 'play';
    return;
  }
  game.clock = 9.1;
  player.x = 980;
  player.y = 1210;
  player.angle = -0.6;
  player.cash = 650;
  run(2.4);
  game.screen = 'play';
}

function runShotMode(game, name) {
  stageShot(game, name);
  let painted = 0;
  function paint() {
    renderGame(game);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runLiveGame(game) {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    statusEl.textContent = message;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & (ACTION_CONFIRM | ACTION_SHOOT)) audio.unlock();
    if (game.screen === 'title' && (actions & ACTION_CONFIRM)) {
      game.screen = 'play';
      audio.unlock();
      announce('Neon Harbor. Follow the gold marker to Harbor Market.');
    } else if (game.screen === 'over' && (actions & ACTION_CONFIRM)) {
      resetRun(game);
      game.screen = 'play';
      announce('New run in Port Solace.');
    } else if (game.screen === 'play' && (actions & ACTION_PAUSE)) {
      game.screen = 'paused';
      announce('Paused.');
    } else if (game.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      game.screen = 'play';
      announce('Playing.');
    }
    if (game.screen === 'play') {
      if (actions & ACTION_ENTER_CAR) enterOrExitCar(game);
      if ((actions & ACTION_SHOOT) && !game.player.inCar) {
        const aim = aimAngleFromMouse(game, input);
        const nearPed = game.peds.some((p) => p.down <= 0 && Math.hypot(p.x - game.player.x, p.y - game.player.y) < 38);
        if (nearPed) playerPunch(game, aim);
        else playerShoot(game, aim);
      }
      while (accumulator >= STEP && game.screen === 'play') {
        stepGame(game, input, STEP);
        accumulator -= STEP;
      }
    } else if (game.screen === 'title') {
      const idle = { held: { up: false, down: false, left: false, right: false, shift: false } };
      while (accumulator >= STEP) {
        stepGame(game, idle, STEP);
        accumulator -= STEP;
      }
      game.screen = 'title';
    } else {
      accumulator = 0;
    }
    renderGame(game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.screen = 'paused';
  });

  announce('Neon Harbor. Click or press Space to start.');
  requestAnimationFrame(frame);
}

const game = createGame();
if (shotName) runShotMode(game, shotName);
else runLiveGame(game);
