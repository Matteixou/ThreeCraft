import { createNoise2D } from 'simplex-noise';

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
    // 3 instances indépendantes pour terrain, température et humidité
    this.noise2D  = createNoise2D(mulberry32(seed));
    this.noiseT   = createNoise2D(mulberry32(seed + 1));
    this.noiseH   = createNoise2D(mulberry32(seed + 2));
  }

  // FBM terrain, freq optionnel pour varier la forme par biome
  getHeight(x, z, freq = 1.0) {
    let h = 0;
    h += this.noise2D(x * 0.004 * freq, z * 0.004 * freq) * 0.55;
    h += this.noise2D(x * 0.018 * freq, z * 0.018 * freq) * 0.30;
    h += this.noise2D(x * 0.07  * freq, z * 0.07  * freq) * 0.15;
    return (h + 1) / 2; // [0, 1]
  }

  // Température : varie lentement → détermine chaud/froid
  getTemperature(x, z) {
    return (this.noiseT(x * 0.0006, z * 0.0006) + 1) / 2;
  }

  // Humidité : varie lentement → détermine sec/humide
  getHumidity(x, z) {
    return (this.noiseH(x * 0.0006, z * 0.0006) + 1) / 2;
  }
}
