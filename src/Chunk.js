import * as THREE from 'three';
import { BlockType } from './Voxel.js';
import { getBlockTile, tileUV } from './TextureAtlas.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

// Les 6 faces : normale + 4 coins (coordonnées 0/1 locales au bloc)
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] }, // +X
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] }, // -X
  { dir: [ 0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] }, // +Y dessus
  { dir: [ 0,-1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] }, // -Y dessous
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] }, // +Z
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }, // -Z
];

// Kernels AO : pour chaque face × chaque coin → [offset_side1, offset_side2, offset_corner]
const AO_KERNELS = [
  [[[1,-1,0],[1,0,-1],[1,-1,-1]],[[1,1,0],[1,0,-1],[1,1,-1]],[[1,1,0],[1,0,1],[1,1,1]],[[1,-1,0],[1,0,1],[1,-1,1]]],
  [[[-1,-1,0],[-1,0,1],[-1,-1,1]],[[-1,1,0],[-1,0,1],[-1,1,1]],[[-1,1,0],[-1,0,-1],[-1,1,-1]],[[-1,-1,0],[-1,0,-1],[-1,-1,-1]]],
  [[[0,1,-1],[-1,1,0],[-1,1,-1]],[[0,1,1],[-1,1,0],[-1,1,1]],[[0,1,1],[1,1,0],[1,1,1]],[[0,1,-1],[1,1,0],[1,1,-1]]],
  [[[0,-1,1],[-1,-1,0],[-1,-1,1]],[[0,-1,-1],[-1,-1,0],[-1,-1,-1]],[[0,-1,-1],[1,-1,0],[1,-1,-1]],[[0,-1,1],[1,-1,0],[1,-1,1]]],
  [[[0,-1,1],[1,0,1],[1,-1,1]],[[0,1,1],[1,0,1],[1,1,1]],[[0,1,1],[-1,0,1],[-1,1,1]],[[0,-1,1],[-1,0,1],[-1,-1,1]]],
  [[[0,-1,-1],[-1,0,-1],[-1,-1,-1]],[[0,1,-1],[-1,0,-1],[-1,1,-1]],[[0,1,-1],[1,0,-1],[1,1,-1]],[[0,-1,-1],[1,0,-1],[1,-1,-1]]],
];

// Blocs rendus en X-shape (herbe haute, fleurs) — pas de face culling
const CROSS_BLOCKS = new Set([BlockType.TALL_GRASS, BlockType.FLOWER_RED, BlockType.FLOWER_YEL]);

// Luminosité AO : 0 = coin très sombre → 3 = plein jour
const AO_BRIGHTNESS = [0.40, 0.60, 0.80, 1.0];

// UV corners pour les 4 vertices d'un quad (identiques pour toutes les faces)
const UV_CORNERS = [[0, 0], [0, 1], [1, 1], [1, 0]];

function vertexAO(s1, s2, corner) {
  if (s1 && s2) return 0;
  return 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (corner ? 1 : 0);
}

export class Chunk {
  constructor(chunkX, chunkZ, world) {
    this.chunkX    = chunkX;
    this.chunkZ    = chunkZ;
    this.world     = world;
    this.voxels    = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh      = null;  // blocs solides
    this.meshCross = null;  // décors X-shape
    this.isDirty   = true;
  }

  _index(x, y, z) { return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z); }

  getVoxel(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return this.world.getVoxelWorld(this.chunkX * CHUNK_SIZE + x, y, this.chunkZ * CHUNK_SIZE + z);
    }
    return this.voxels[this._index(x, y, z)];
  }

  setVoxel(x, y, z, type) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.voxels[this._index(x, y, z)] = type;
    this.isDirty = true;
  }

  buildMesh(scene) {
    if (!this.isDirty) return;
    this.isDirty = false;

    // Cleanup : géométries seulement (matériaux partagés via world)
    for (const key of ['mesh', 'meshCross']) {
      if (this[key]) { scene.remove(this[key]); this[key].geometry.dispose(); this[key] = null; }
    }

    const sPos=[], sNorm=[], sCol=[], sUV=[], sIdx=[];  // solides
    const cPos=[], cNorm=[], cCol=[], cUV=[], cIdx=[];  // croisés

    const ox = this.chunkX * CHUNK_SIZE;
    const oz = this.chunkZ * CHUNK_SIZE;

    // Retourne true si le bloc bloque la lumière (opaque, non-croisé)
    const isSolid = (bx, by, bz) => {
      const v = this.getVoxel(bx, by, bz);
      return v !== BlockType.AIR && !CROSS_BLOCKS.has(v);
    };

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const voxel = this.getVoxel(x, y, z);
          if (voxel === BlockType.AIR) continue;

          // Micro-variation de luminosité par bloc (±4%) — casse l'uniformité
          const rng = ((x * 374761393 + y * 1073741789 + z * 2654435761) >>> 0) / 0xFFFFFFFF;
          const var_ = 0.96 + rng * 0.08;

          // ── Blocs croisés (herbe haute, fleurs) ───────────────────────────
          if (CROSS_BLOCKS.has(voxel)) {
            const [u0, v0, u1, v1] = tileUV(getBlockTile(voxel, 0));
            const h   = voxel === BlockType.TALL_GRASS ? 0.88 : 0.72;
            const br  = var_; // pas d'AO sur les décors croisés
            const ndx = cPos.length / 3;

            // Deux plans diagonaux formant un X vu du dessus
            cPos.push(
              ox+x+0.12,y,   oz+z+0.12,  ox+x+0.12,y+h,oz+z+0.12,
              ox+x+0.88,y+h, oz+z+0.88,  ox+x+0.88,y,  oz+z+0.88,
              ox+x+0.88,y,   oz+z+0.12,  ox+x+0.88,y+h,oz+z+0.12,
              ox+x+0.12,y+h, oz+z+0.88,  ox+x+0.12,y,  oz+z+0.88,
            );
            // UV : bas → haut de la tuile
            for (let i = 0; i < 4; i++) { cUV.push(u0, v0); cNorm.push(0,1,0); cCol.push(br,br,br); }
            cUV[cUV.length-8]=u0; cUV[cUV.length-7]=v0;
            cUV[cUV.length-6]=u0; cUV[cUV.length-5]=v1;
            cUV[cUV.length-4]=u1; cUV[cUV.length-3]=v1;
            cUV[cUV.length-2]=u1; cUV[cUV.length-1]=v0;
            // Répéter pour plan 2
            for (let i = 0; i < 4; i++) { cNorm.push(0,1,0); cCol.push(br,br,br); }
            cUV.push(u0,v0, u0,v1, u1,v1, u1,v0);
            cIdx.push(
              ndx,ndx+1,ndx+2, ndx,ndx+2,ndx+3,
              ndx+4,ndx+5,ndx+6, ndx+4,ndx+6,ndx+7,
            );
            continue;
          }

          // ── Blocs solides : UV + AO ────────────────────────────────────────
          for (let f = 0; f < FACES.length; f++) {
            const { dir, corners } = FACES[f];
            if (isSolid(x + dir[0], y + dir[1], z + dir[2])) continue;

            const [u0, v0, u1, v1] = tileUV(getBlockTile(voxel, f));
            const kernel = AO_KERNELS[f];

            const aoV = kernel.map(([s1, s2, sc]) => vertexAO(
              isSolid(x+s1[0], y+s1[1], z+s1[2]),
              isSolid(x+s2[0], y+s2[1], z+s2[2]),
              isSolid(x+sc[0], y+sc[1], z+sc[2]),
            ));

            // Flip du quad pour éviter les artefacts de diagonale AO
            const flip = aoV[0] + aoV[2] > aoV[1] + aoV[3];
            const ndx  = sPos.length / 3;

            for (let v = 0; v < 4; v++) {
              const [cx, cy, cz] = corners[v];
              sPos.push(ox + x + cx, y + cy, oz + z + cz);
              sNorm.push(...dir);
              // Vertex color = AO × variation → multiplie la texture
              const bright = AO_BRIGHTNESS[aoV[v]] * var_;
              sCol.push(bright, bright, bright);
              // UV corner correspondant
              const [uc, vc] = UV_CORNERS[v];
              sUV.push(u0 + uc * (u1 - u0), v0 + vc * (v1 - v0));
            }

            if (flip) sIdx.push(ndx,ndx+1,ndx+3, ndx+1,ndx+2,ndx+3);
            else      sIdx.push(ndx,ndx+1,ndx+2, ndx,  ndx+2,ndx+3);
          }
        }
      }
    }

    // Mesh solide (matériau partagé depuis world.solidMat)
    if (sPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(sPos,  3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(sNorm, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(sCol,  3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(sUV,   2));
      geo.setIndex(sIdx);
      this.mesh = new THREE.Mesh(geo, this.world.solidMat);
      this.mesh.receiveShadow = true;
      scene.add(this.mesh);
    }

    // Mesh croisé (DoubleSide + alphaTest pour transparence herbe/fleurs)
    if (cPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(cPos,  3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(cNorm, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(cCol,  3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(cUV,   2));
      geo.setIndex(cIdx);
      this.meshCross = new THREE.Mesh(geo, this.world.crossMat);
      scene.add(this.meshCross);
    }
  }
}
