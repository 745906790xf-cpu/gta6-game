// Seeded pseudo-random generator (mulberry32). The same seed always builds the
// same Port Solace, which is what makes the ?shot= screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

export function rangeBetween(random, low, high) {
  return low + random() * (high - low);
}
