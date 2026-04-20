import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { BlockType } from './Voxel.js';
import { NoiseGenerator } from './NoiseGenerator.js';
import { createTextureAtlas } from './TextureAtlas.js';
import { placeVillage, placeCastle, placeRuin, placeChamber } from './Structures.js';

// Paramètres de terrain par biome
const BIOME_DATA = {
  PLAINS:    { base: 14, amp: 12, freq: 1.0, surface: BlockType.GRASS, sub: BlockType.DIRT  },
  FOREST:    { base: 15, amp: 18, freq: 1.2, surface: BlockType.GRASS, sub: BlockType.DIRT  },
  DESERT:    { base: 11, amp:  7, freq: 0.6, surface: BlockType.SAND,  sub: BlockType.SAND  },
  MOUNTAINS: { base: 18, amp: 28, freq: 1.8, surface: BlockType.STONE, sub: BlockType.STONE },
  SNOW:      { base: 13, amp: 15, freq: 1.0, surface: BlockType.SNOW,  sub: BlockType.DIRT  },
};

// Hash déterministe (x,z) → [0,1]
function hash(x, z) {
  let n = (x * 374761393 + z * 1073741789) | 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return n / 0xFFFFFFFF;
}

export class World {
  constructor(scene, seed = 42) {
    this.scene      = scene;
    this.chunks     = new Map();
    this.noise      = new NoiseGenerator(seed);
    this.renderDist = 3;

    // Atlas de textures partagé entre tous les chunks
    this.atlas    = createTextureAtlas();
    this.solidMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.crossMat = new THREE.MeshLambertMaterial({
      map: this.atlas, vertexColors: true,
      side: THREE.DoubleSide, alphaTest: 0.1,
    });
  }

  _key(cx, cz) { return `${cx},${cz}`; }

  getChunk(cx, cz) {
    return this.chunks.get(this._key(cx, cz));
  }

  getOrCreateChunk(cx, cz) {
    const key = this._key(cx, cz);
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(cx, cz, this);
      this._generateChunk(chunk);
      this.chunks.set(key, chunk);
    }
    return this.chunks.get(key);
  }

  // Smoothstep helper
  _ss(v, lo, hi) {
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }

  // Poids de chaque biome en un point (normalisés, somme = 1)
  _getBiomeWeights(temp, humi) {
    const ss = this._ss.bind(this);
    const snowW   = 1 - ss(temp, 0.28, 0.40);
    const desW    = ss(temp, 0.56, 0.68);
    const rem     = 1 - snowW - desW;
    const mountW  = rem * (1 - ss(humi, 0.18, 0.28));
    const remMD   = rem - mountW;
    const forW    = remMD * ss(humi, 0.52, 0.65);
    const plainsW = Math.max(0, remMD - forW);
    const total   = snowW + desW + mountW + forW + plainsW || 1;
    return {
      SNOW:      snowW   / total,
      DESERT:    desW    / total,
      MOUNTAINS: mountW  / total,
      FOREST:    forW    / total,
      PLAINS:    plainsW / total,
    };
  }

  // Biome dominant (le plus fort en ce point)
  _getDominantBiome(wx, wz) {
    const temp = this.noise.getTemperature(wx, wz);
    const humi = this.noise.getHumidity(wx, wz);
    const w = this._getBiomeWeights(temp, humi);
    return Object.entries(w).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }

  // Hauteur de terrain lissée (moyenne pondérée entre biomes voisins)
  _getBlendedHeight(wx, wz) {
    const temp = this.noise.getTemperature(wx, wz);
    const humi = this.noise.getHumidity(wx, wz);
    const w = this._getBiomeWeights(temp, humi);
    let h = 0;
    for (const [biome, weight] of Object.entries(w)) {
      if (weight < 0.001) continue;
      const bd = BIOME_DATA[biome];
      h += (bd.base + this.noise.getHeight(wx, wz, bd.freq) * bd.amp) * weight;
    }
    return Math.floor(h);
  }

  // Détermine le biome depuis température [0,1] et humidité [0,1] (legacy — gardé pour compat)
  _getBiome(wx, wz) {
    return this._getDominantBiome(wx, wz);
  }

  _generateChunk(chunk) {
    const N = CHUNK_SIZE * CHUNK_SIZE;
    // Cache par colonne : évite de recalculer temp/humi/biome à chaque passe
    const colBiome = new Array(N);
    const colH     = new Int8Array(N);

    // Passe 1 : terrain avec hauteur blendée + bedrock + grottes
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx   = chunk.chunkX * CHUNK_SIZE + x;
        const wz   = chunk.chunkZ * CHUNK_SIZE + z;
        const temp = this.noise.getTemperature(wx, wz);
        const humi = this.noise.getHumidity(wx, wz);
        const w    = this._getBiomeWeights(temp, humi);
        const biome = Object.entries(w).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
        let h = 0;
        for (const [b, wt] of Object.entries(w)) {
          if (wt < 0.001) continue;
          const bd = BIOME_DATA[b];
          h += (bd.base + this.noise.getHeight(wx, wz, bd.freq) * bd.amp) * wt;
        }
        const height = Math.max(1, Math.min(CHUNK_HEIGHT - 2, Math.floor(h)));
        const idx    = x + z * CHUNK_SIZE;
        colBiome[idx] = biome;
        colH[idx]     = height;

        const bd = BIOME_DATA[biome];
        let surfaceBlock = bd.surface;
        let subBlock     = bd.sub;
        if (biome === 'MOUNTAINS') {
          if      (height > 40) { surfaceBlock = BlockType.SNOW;  subBlock = BlockType.STONE; }
          else if (height > 28) { surfaceBlock = BlockType.STONE; subBlock = BlockType.STONE; }
          else                  { surfaceBlock = BlockType.GRASS; subBlock = BlockType.DIRT;  }
        }

        // Bedrock à y=0
        chunk.setVoxel(x, 0, z, BlockType.STONE);

        for (let y = 1; y <= height && y < CHUNK_HEIGHT; y++) {
          let type;
          if      (y === height)    type = surfaceBlock;
          else if (y >= height - 3) type = subBlock;
          else                      type = BlockType.STONE;

          // Grottes : pattern sinusoïdal avec phase variable par région
          if (y > 3 && y < height - 1) {
            const rx = wx >> 4, rz = wz >> 4, ry = y >> 4;
            const ph = hash(rx * 7 + ry * 13, rz * 11 + 200) * 3.14159;
            const cave = Math.sin(wx * 0.22 + ph + y * 0.38)
                       * Math.sin(wz * 0.26 + ph * 0.7 + y * 0.29)
                       * Math.cos(y * 0.44 + ph * 0.4);
            if (cave > 0.32) continue; // laisse AIR
          }

          chunk.setVoxel(x, y, z, type);
        }
      }
    }

    // Passe 2 : minerais
    this._generateOres(chunk);

    // Passe 3 : décors (utilise le cache colonne)
    this._generateDecorations(chunk, colBiome, colH);

    // Passe 4 : structures (villages, châteaux, ruines, chambres secrètes)
    this._applyStructures(chunk);

    chunk.isDirty = true;
  }

  _generateOres(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = chunk.chunkX * CHUNK_SIZE + x;
        const wz = chunk.chunkZ * CHUNK_SIZE + z;
        // Surface height to avoid placing ores above terrain
        let surfY = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (chunk.getVoxel(x, y, z) !== BlockType.AIR) { surfY = y; break; }
        }
        for (let y = 1; y < Math.min(surfY - 1, 40); y++) {
          if (chunk.getVoxel(x, y, z) !== BlockType.STONE) continue;
          const r = hash(wx * 7 + y * 3, wz * 11 + y * 7);
          // COAL: y 4-36, freq ~1/30
          if (y <= 36 && r < 0.033) { chunk.setVoxel(x, y, z, BlockType.COAL_ORE); continue; }
          // IRON: y 4-30, freq ~1/60
          if (y <= 30 && r < 0.050 && r >= 0.033) { chunk.setVoxel(x, y, z, BlockType.IRON_ORE); continue; }
          // GOLD: y 4-16, freq ~1/200
          if (y <= 16 && r < 0.055 && r >= 0.050) { chunk.setVoxel(x, y, z, BlockType.GOLD_ORE); continue; }
          // DIAMOND: y 1-9, freq ~1/500
          if (y <= 9  && r < 0.0572 && r >= 0.055) { chunk.setVoxel(x, y, z, BlockType.DIAMOND_ORE); continue; }
          // GRAVEL patches deep
          if (y <= 16 && hash(wx * 13 + y, wz * 9 + y) < 0.018) chunk.setVoxel(x, y, z, BlockType.GRAVEL);
        }
      }
    }
  }

  _generateDecorations(chunk, colBiome, colH) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Utilise le cache si disponible, sinon scan
        let surfaceY, biome;
        if (colBiome) {
          const idx = x + z * CHUNK_SIZE;
          biome    = colBiome[idx];
          surfaceY = colH[idx];
          // Les grottes peuvent avoir modifié la surface : vérification rapide
          if (chunk.getVoxel(x, surfaceY, z) === BlockType.AIR) {
            // Surface a été creusée par une grotte, scanner depuis le haut
            surfaceY = -1;
            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
              if (chunk.getVoxel(x, y, z) !== BlockType.AIR) { surfaceY = y; break; }
            }
          }
        } else {
          surfaceY = -1;
          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            if (chunk.getVoxel(x, y, z) !== BlockType.AIR) { surfaceY = y; break; }
          }
          const wx2 = chunk.chunkX * CHUNK_SIZE + x;
          const wz2 = chunk.chunkZ * CHUNK_SIZE + z;
          biome = this._getDominantBiome(wx2, wz2);
        }
        if (surfaceY < 0 || surfaceY + 1 >= CHUNK_HEIGHT) continue;

        const wx      = chunk.chunkX * CHUNK_SIZE + x;
        const wz      = chunk.chunkZ * CHUNK_SIZE + z;
        const r       = hash(wx, wz);
        const surface = chunk.getVoxel(x, surfaceY, z);
        const inBounds = x >= 2 && x < CHUNK_SIZE - 2 && z >= 2 && z < CHUNK_SIZE - 2;

        switch (biome) {
          case 'PLAINS':
            if      (r < 0.003 && inBounds) this._placeTree(chunk, x, surfaceY + 1, z);
            else if (r < 0.13)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            else if (r < 0.15)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.FLOWER_RED);
            else if (r < 0.17)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.FLOWER_YEL);
            break;

          case 'FOREST':
            if      (r < 0.014 && inBounds) this._placeTree(chunk, x, surfaceY + 1, z);
            else if (r < 0.28)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            else if (r < 0.30)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.FLOWER_RED);
            else if (r < 0.32)  chunk.setVoxel(x, surfaceY + 1, z, BlockType.FLOWER_YEL);
            break;

          case 'DESERT':
            if (r < 0.012 && x >= 1 && x < CHUNK_SIZE - 1 && z >= 1 && z < CHUNK_SIZE - 1) {
              this._placeCactus(chunk, x, surfaceY + 1, z);
            }
            break;

          case 'MOUNTAINS':
            // Arbres seulement en zone herbeuse (basse altitude)
            if (surface === BlockType.GRASS && r < 0.003 && inBounds) {
              this._placeTree(chunk, x, surfaceY + 1, z);
            }
            break;

          case 'SNOW':
            // Arbres clairsemés, pas de fleurs
            if (r < 0.004 && inBounds) this._placeTree(chunk, x, surfaceY + 1, z);
            break;
        }
      }
    }
  }

  _placeTree(chunk, x, baseY, z) {
    const wx     = chunk.chunkX * CHUNK_SIZE + x;
    const wz     = chunk.chunkZ * CHUNK_SIZE + z;
    const trunkH = 4 + (hash(wx + 7, wz + 3) > 0.5 ? 1 : 0);

    for (let i = 0; i < trunkH && baseY + i < CHUNK_HEIGHT; i++) {
      chunk.setVoxel(x, baseY + i, z, BlockType.WOOD);
    }

    const topY   = baseY + trunkH;
    const levels = [[0, 2], [1, 2], [2, 1], [3, 0]]; // [dy, rayon]

    for (const [dy, radius] of levels) {
      const ly = topY + dy;
      if (ly < 0 || ly >= CHUNK_HEIGHT) continue;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx * lx + lz * lz > radius * radius + radius) continue;
          const nx = x + lx, nz = z + lz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          if (chunk.getVoxel(nx, ly, nz) === BlockType.AIR) {
            chunk.setVoxel(nx, ly, nz, BlockType.LEAVES);
          }
        }
      }
    }
  }

  _placeCactus(chunk, x, baseY, z) {
    const h = 2 + (hash(x * 31, z * 17) > 0.6 ? 1 : 0); // 2 ou 3 blocs
    for (let i = 0; i < h && baseY + i < CHUNK_HEIGHT; i++) {
      chunk.setVoxel(x, baseY + i, z, BlockType.CACTUS);
    }
  }

  // ── Structures procédurales ───────────────────────────────────────────────────
  // Chaque région (REGION=9 chunks) peut contenir une structure au centre.
  // On détermine si ce chunk "possède" le centre de sa région (cx%R===R/2, cz%R===R/2)
  // puis on choisit la structure selon le biome et un hash déterministe.
  _applyStructures(chunk) {
    const R = 9; // taille de région en chunks
    const cx = chunk.chunkX;
    const cz = chunk.chunkZ;

    // Centre de région
    const rcx = Math.floor(cx / R) * R + Math.floor(R / 2);
    const rcz = Math.floor(cz / R) * R + Math.floor(R / 2);

    // Seul le chunk central de chaque région place la structure
    if (cx !== rcx || cz !== rcz) return;

    // Centre monde de la région
    const wx = rcx * CHUNK_SIZE + Math.floor(CHUNK_SIZE / 2);
    const wz = rcz * CHUNK_SIZE + Math.floor(CHUNK_SIZE / 2);

    // Trouver la hauteur de surface en ce point
    let surfY = -1;
    const lx = Math.floor(CHUNK_SIZE / 2);
    const lz = Math.floor(CHUNK_SIZE / 2);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (chunk.getVoxel(lx, y, lz) !== BlockType.AIR) { surfY = y; break; }
    }
    if (surfY < 2) return;

    const biome = this._getDominantBiome(wx, wz);
    const seed  = (rcx * 374761393 + rcz * 1073741789) | 0;
    const r     = ((seed ^ (seed >>> 13)) >>> 0) / 0xFFFFFFFF;

    // Pas de structure dans les déserts (trop plats) ni montagnes hautes
    if (biome === 'DESERT' && r > 0.3) return;
    if (biome === 'MOUNTAINS' && surfY > 40) return;

    if (biome === 'PLAINS' || biome === 'FOREST') {
      if      (r < 0.35) placeVillage(chunk, wx, wz, surfY, seed);
      else if (r < 0.55) placeCastle(chunk, wx, wz, surfY, seed);
      else if (r < 0.75) placeRuin(chunk, wx, wz, surfY, seed);
      else               placeChamber(chunk, wx, wz, surfY, seed);
    } else if (biome === 'SNOW') {
      if      (r < 0.30) placeRuin(chunk, wx, wz, surfY, seed);
      else if (r < 0.55) placeCastle(chunk, wx, wz, surfY, seed);
      else               placeChamber(chunk, wx, wz, surfY, seed);
    } else if (biome === 'DESERT') {
      placeRuin(chunk, wx, wz, surfY, seed);
    } else {
      if (r < 0.5) placeChamber(chunk, wx, wz, surfY, seed);
      else         placeRuin(chunk, wx, wz, surfY, seed);
    }
  }

  // Lecture en coordonnées monde
  getVoxelWorld(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.STONE;
    const cx    = Math.floor(wx / CHUNK_SIZE);
    const cz    = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getVoxel(lx, wy, lz);
  }

  // Écriture en coordonnées monde
  setVoxelWorld(wx, wy, wz, type) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx    = Math.floor(wx / CHUNK_SIZE);
    const cz    = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setVoxel(lx, wy, lz, type);

    if (lx === 0)              this._markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this._markDirty(cx + 1, cz);
    if (lz === 0)              this._markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this._markDirty(cx, cz + 1);
  }

  _markDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c) c.isDirty = true;
  }

  update(playerPos) {
    const RENDER_DIST = this.renderDist;
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    // Trier les chunks nécessaires du plus proche au plus loin
    const needed = [];
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++)
      for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
        needed.push({ cx: pcx + dx, cz: pcz + dz, d2: dx * dx + dz * dz });
    needed.sort((a, b) => a.d2 - b.d2);

    // Max 1 chunk généré + 1 mesh reconstruit par frame pour éviter les freezes
    let newThisFrame = 0;
    let rebuiltThisFrame = 0;
    for (const { cx, cz } of needed) {
      const key = this._key(cx, cz);
      if (!this.chunks.has(key)) {
        if (newThisFrame >= 1) continue;
        newThisFrame++;
        const chunk = new Chunk(cx, cz, this);
        this._generateChunk(chunk);
        this.chunks.set(key, chunk);
      }
      const chunk = this.chunks.get(key);
      if (chunk.isDirty) {
        if (rebuiltThisFrame >= 1) continue;
        rebuiltThisFrame++;
      }
      chunk.buildMesh(this.scene);
    }

    // Décharger les chunks hors portée (ne pas disposer le matériau — il est partagé !)
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DIST + 1 || Math.abs(cz - pcz) > RENDER_DIST + 1) {
        for (const mk of ['mesh', 'meshCross']) {
          if (chunk[mk]) {
            this.scene.remove(chunk[mk]);
            chunk[mk].geometry.dispose();
            chunk[mk] = null;
          }
        }
        this.chunks.delete(key);
      }
    }
  }

  // DDA raycast
  raycast(origin, direction, maxDist = 6) {
    let { x: ox, y: oy, z: oz } = origin;
    const { x: dx, y: dy, z: dz } = direction;

    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDX = Math.abs(1 / dx);
    const tDY = Math.abs(1 / dy);
    const tDZ = Math.abs(1 / dz);

    let tMaxX = dx > 0 ? (x + 1 - ox) / dx : (ox - x) / -dx;
    let tMaxY = dy > 0 ? (y + 1 - oy) / dy : (oy - y) / -dy;
    let tMaxZ = dz > 0 ? (z + 1 - oz) / dz : (oz - z) / -dz;

    let face = null, dist = 0;

    while (dist < maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; dist = tMaxX; tMaxX += tDX; face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; dist = tMaxY; tMaxY += tDY; face = [0, -stepY, 0];
      } else {
        z += stepZ; dist = tMaxZ; tMaxZ += tDZ; face = [0, 0, -stepZ];
      }
      if (this.getVoxelWorld(x, y, z) !== BlockType.AIR) return { x, y, z, face };
    }
    return null;
  }
}
