import { createNoise2D } from 'simplex-noise';

// PRNG déterministe (Mulberry32) pour un seed reproductible
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class NoiseGenerator {
  constructor(seed = 42) {
    const rng = mulberry32(seed);
    this.noise2D = createNoise2D(rng);
  }

  // Retourne une hauteur normalisée [0, 1] via FBM (3 octaves)
  getHeight(x, z) {
    let h = 0;
    h += this.noise2D(x * 0.004, z * 0.004) * 0.55; // grandes collines
    h += this.noise2D(x * 0.018, z * 0.018) * 0.30; // détails moyens
    h += this.noise2D(x * 0.07,  z * 0.07)  * 0.15; // micro-relief
    return (h + 1) / 2; // normalise [-1,1] → [0,1]
  }
}
