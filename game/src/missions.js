// The story of Neon Harbor: five jobs for Mara Voss, the fixer who owns half
// of Port Solace's docks. Each mission is a chain of marker stops (go, pick
// up, deliver, escape); finishing one pays cash, unlocks the next, and the
// chain ends with Rex owning a piece of the harbor he used to steal from.

export const MISSIONS = [
  {
    id: 'first-run',
    title: 'First Run',
    briefing: 'Mara Voss: "Rex, welcome back to Port Solace. Grab the package at Harbor Market and bring it to the Starlight Motel. No questions, easy money."',
    reward: 400,
    stops: [
      { x: 900, y: 1150, label: 'Pick up the package at Harbor Market', action: 'pickup' },
      { x: 1550, y: 1450, label: 'Deliver the package to the Starlight Motel', action: 'deliver' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Mara: "A buyer at the North Depot wants a fast car, no paperwork. Steal any car and deliver it to the depot. The cops will not like it."',
    reward: 750,
    stops: [
      { x: 650, y: 450, label: 'Steal a car and deliver it to the North Depot', action: 'deliver-car' },
    ],
  },
  {
    id: 'dock-run',
    title: 'Dock Run',
    briefing: 'Mara: "Copper Docks, tonight. Collect the ledger from the warehouse office and get it to Voss Tower before the night crew notices."',
    reward: 1100,
    stops: [
      { x: 2850, y: 2950, label: 'Collect the ledger at the Copper Docks', action: 'pickup' },
      { x: 2350, y: 850, label: 'Deliver the ledger to Voss Tower', action: 'deliver' },
    ],
  },
  {
    id: 'pier-pressure',
    title: 'Pier Pressure',
    briefing: 'Mara: "Someone is skimming my pier money. Meet my contact at Solace Pier, then shake any tail and come back to the garage."',
    reward: 1600,
    stops: [
      { x: 1750, y: 3050, label: 'Meet the contact at Solace Pier', action: 'pickup' },
      { x: 1250, y: 2050, label: 'Return to Marlowe Garage', action: 'deliver' },
    ],
  },
  {
    id: 'harbor-king',
    title: 'Harbor King',
    briefing: 'Mara: "Last job. The park meet at Palm Court decides who runs this harbor. Show up, take the briefcase, and bring it home. Then the docks are ours."',
    reward: 3000,
    stops: [
      { x: 2050, y: 1750, label: 'Take the briefcase at Palm Court Park', action: 'pickup' },
      { x: 1250, y: 2050, label: 'Bring the briefcase to Marlowe Garage', action: 'deliver' },
    ],
  },
];

export function createMissionState(savedIndex) {
  return {
    index: Math.min(savedIndex || 0, MISSIONS.length),
    stop: 0,
    banner: '',
    bannerTimer: 0,
    complete: false,
  };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.stops[state.stop] || null;
}

export function showMissionBanner(state, text) {
  state.banner = text;
  state.bannerTimer = 6;
}

export function advanceMission(state, player, onCrime) {
  const mission = currentMission(state);
  if (!mission) return false;
  const stop = mission.stops[state.stop];
  if (!stop) return false;
  const dist = Math.hypot(player.x - stop.x, player.y - stop.y);
  if (dist > 46) return false;
  if (stop.action === 'deliver-car' && !player.inCar) return false;
  state.stop += 1;
  if (state.stop >= mission.stops.length) {
    player.cash += mission.reward;
    state.index += 1;
    state.stop = 0;
    const next = currentMission(state);
    if (next) {
      showMissionBanner(state, 'Mission complete: ' + mission.title + '  +$' + mission.reward + '   Next: ' + next.title);
    } else {
      state.complete = true;
      showMissionBanner(state, 'Story complete: Rex Marlowe runs the harbor. Free roam unlocked.  +$' + mission.reward);
    }
    return true;
  }
  showMissionBanner(state, mission.title + ': ' + mission.stops[state.stop].label);
  return true;
}

export function drawMissionMarker(ctx, state, elapsed) {
  const stop = currentObjective(state);
  if (!stop) return;
  const pulse = 1 + Math.sin(elapsed * 4) * 0.16;
  ctx.save();
  ctx.translate(stop.x, stop.y);
  ctx.fillStyle = 'rgba(255,210,62,0.22)';
  ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(0, -26 + Math.sin(elapsed * 3) * 4);
  ctx.lineTo(-10, -42 + Math.sin(elapsed * 3) * 4);
  ctx.lineTo(10, -42 + Math.sin(elapsed * 3) * 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
