import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { BlockType } from './Voxel.js';
import { NoiseGenerator } from './NoiseGenerator.js';

// Paramètres de terrain par biome
const BIOME_DATA = {
  PLAINS:    { base: 14, amp: 12, freq: 1.0, surface: BlockType.GRASS, sub: BlockType.DIRT  },
  FOREST:    { base: 15, amp: 18, freq: 1.2, surface: BlockType.GRASS, sub: BlockType.DIRT  },
  DESERT:    { base: 11, amp:  7, freq: 0.6, surface: BlockType.SAND,  sub: BlockType.SAND  },
  MOUNTAINS: { base: 18, amp: 42, freq: 1.8, surface: BlockType.STONE, sub: BlockType.STONE },
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
    this.scene  = scene;
    this.chunks = new Map();
    this.noise  = new NoiseGenerator(seed);
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

  // Détermine le biome depuis température [0,1] et humidité [0,1]
  _getBiome(wx, wz) {
    const temp = this.noise.getTemperature(wx, wz);
    const humi = this.noise.getHumidity(wx, wz);
    if (temp < 0.33)               return 'SNOW';
    if (temp > 0.62)               return 'DESERT';
    if (humi < 0.22)               return 'MOUNTAINS';
    if (humi > 0.60)               return 'FOREST';
    return 'PLAINS';
  }

  _generateChunk(chunk) {
    // Passe 1 : terrain par biome
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx    = chunk.chunkX * CHUNK_SIZE + x;
        const wz    = chunk.chunkZ * CHUNK_SIZE + z;
        const biome = this._getBiome(wx, wz);
        const bd    = BIOME_DATA[biome];
        const h     = Math.floor(bd.base + this.noise.getHeight(wx, wz, bd.freq) * bd.amp);

        // Blocs de surface selon biome (et altitude pour les montagnes)
        let surfaceBlock = bd.surface;
        let subBlock     = bd.sub;
        if (biome === 'MOUNTAINS') {
          if      (h > 48) { surfaceBlock = BlockType.SNOW;  subBlock = BlockType.STONE; }
          else if (h > 36) { surfaceBlock = BlockType.STONE; subBlock = BlockType.STONE; }
          else             { surfaceBlock = BlockType.GRASS; subBlock = BlockType.DIRT;  }
        }

        for (let y = 0; y <= h && y < CHUNK_HEIGHT; y++) {
          let type;
          if      (y === h)    type = surfaceBlock;
          else if (y >= h - 3) type = subBlock;
          else                 type = BlockType.STONE;
          chunk.setVoxel(x, y, z, type);
        }
      }
    }

    // Passe 2 : décors
    this._generateDecorations(chunk);
    chunk.isDirty = true;
  }

  _generateDecorations(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Surface = bloc solide le plus haut
        let surfaceY = -1;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (chunk.getVoxel(x, y, z) !== BlockType.AIR) { surfaceY = y; break; }
        }
        if (surfaceY < 0 || surfaceY + 1 >= CHUNK_HEIGHT) continue;

        const wx      = chunk.chunkX * CHUNK_SIZE + x;
        const wz      = chunk.chunkZ * CHUNK_SIZE + z;
        const biome   = this._getBiome(wx, wz);
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
    const RENDER_DIST = 5;
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
        const chunk = this.getOrCreateChunk(pcx + dx, pcz + dz);
        chunk.buildMesh(this.scene);
      }
    }

    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DIST + 1 || Math.abs(cz - pcz) > RENDER_DIST + 1) {
        for (const key of ['mesh', 'meshCross']) {
          if (chunk[key]) {
            this.scene.remove(chunk[key]);
            chunk[key].geometry.dispose();
            chunk[key].material.dispose();
            chunk[key] = null;
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
