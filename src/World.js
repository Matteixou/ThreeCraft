import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { BlockType } from './Voxel.js';
import { NoiseGenerator } from './NoiseGenerator.js';

const SEA_LEVEL  = 12; // y minimum du terrain
const MAX_HEIGHT = 38; // amplitude max en blocs

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

  _generateChunk(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = chunk.chunkX * CHUNK_SIZE + x;
        const wz = chunk.chunkZ * CHUNK_SIZE + z;
        const h  = Math.floor(SEA_LEVEL + this.noise.getHeight(wx, wz) * MAX_HEIGHT);

        for (let y = 0; y <= h && y < CHUNK_HEIGHT; y++) {
          let type;
          if      (y === h)     type = BlockType.GRASS;
          else if (y >= h - 3)  type = BlockType.DIRT;
          else                  type = BlockType.STONE;
          chunk.setVoxel(x, y, z, type);
        }
      }
    }
    chunk.isDirty = true;
  }

  // Lecture en coordonnées monde (cross-chunk safe)
  getVoxelWorld(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.STONE;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.AIR; // chunk non chargé
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getVoxel(lx, wy, lz);
  }

  // Écriture en coordonnées monde + marquage dirty du/des chunk(s) concerné(s)
  setVoxelWorld(wx, wy, wz, type) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setVoxel(lx, wy, lz, type);

    // Rebuild des voisins si le bloc est sur une frontière
    if (lx === 0)               { this._markDirty(cx - 1, cz); }
    if (lx === CHUNK_SIZE - 1)  { this._markDirty(cx + 1, cz); }
    if (lz === 0)               { this._markDirty(cx, cz - 1); }
    if (lz === CHUNK_SIZE - 1)  { this._markDirty(cx, cz + 1); }
  }

  _markDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c) c.isDirty = true;
  }

  // Chargement/déchargement des chunks autour du joueur
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

    // Suppression des chunks trop éloignés
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DIST + 1 || Math.abs(cz - pcz) > RENDER_DIST + 1) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh.material.dispose();
          chunk.mesh = null;
        }
        this.chunks.delete(key);
      }
    }
  }

  // DDA raycast — retourne { x, y, z, face } ou null
  raycast(origin, direction, maxDist = 6) {
    let { x: ox, y: oy, z: oz } = origin;
    const { x: dx, y: dy, z: dz } = direction;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDX = Math.abs(1 / dx);
    const tDY = Math.abs(1 / dy);
    const tDZ = Math.abs(1 / dz);

    let tMaxX = dx > 0 ? (x + 1 - ox) / dx : (ox - x) / -dx;
    let tMaxY = dy > 0 ? (y + 1 - oy) / dy : (oy - y) / -dy;
    let tMaxZ = dz > 0 ? (z + 1 - oz) / dz : (oz - z) / -dz;

    let face = null;
    let dist = 0;

    while (dist < maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; dist = tMaxX; tMaxX += tDX;
        face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; dist = tMaxY; tMaxY += tDY;
        face = [0, -stepY, 0];
      } else {
        z += stepZ; dist = tMaxZ; tMaxZ += tDZ;
        face = [0, 0, -stepZ];
      }

      if (this.getVoxelWorld(x, y, z) !== BlockType.AIR) {
        return { x, y, z, face };
      }
    }
    return null;
  }
}
