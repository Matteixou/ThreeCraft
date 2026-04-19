import * as THREE from 'three';
import { BlockType, BlockColor } from './Voxel.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

// Les 6 faces d'un cube : normale + 4 coins (0/1 par axe)
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] }, // +X
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] }, // -X
  { dir: [ 0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] }, // +Y dessus
  { dir: [ 0,-1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] }, // -Y dessous
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] }, // +Z
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }, // -Z
];

// Ombrage directionnel de base
const FACE_SHADE = [0.8, 0.8, 1.0, 0.5, 0.75, 0.75];

// Pour chaque face × chaque coin : [offset_side1, offset_side2, offset_corner]
// Utilisé pour calculer l'AO de chaque vertex (3 blocs voisins)
const AO_KERNELS = [
  // +X
  [[[1,-1,0],[1,0,-1],[1,-1,-1]],[[1,1,0],[1,0,-1],[1,1,-1]],[[1,1,0],[1,0,1],[1,1,1]],[[1,-1,0],[1,0,1],[1,-1,1]]],
  // -X
  [[[-1,-1,0],[-1,0,1],[-1,-1,1]],[[-1,1,0],[-1,0,1],[-1,1,1]],[[-1,1,0],[-1,0,-1],[-1,1,-1]],[[-1,-1,0],[-1,0,-1],[-1,-1,-1]]],
  // +Y
  [[[0,1,-1],[-1,1,0],[-1,1,-1]],[[0,1,1],[-1,1,0],[-1,1,1]],[[0,1,1],[1,1,0],[1,1,1]],[[0,1,-1],[1,1,0],[1,1,-1]]],
  // -Y
  [[[0,-1,1],[-1,-1,0],[-1,-1,1]],[[0,-1,-1],[-1,-1,0],[-1,-1,-1]],[[0,-1,-1],[1,-1,0],[1,-1,-1]],[[0,-1,1],[1,-1,0],[1,-1,1]]],
  // +Z
  [[[0,-1,1],[1,0,1],[1,-1,1]],[[0,1,1],[1,0,1],[1,1,1]],[[0,1,1],[-1,0,1],[-1,1,1]],[[0,-1,1],[-1,0,1],[-1,-1,1]]],
  // -Z
  [[[0,-1,-1],[-1,0,-1],[-1,-1,-1]],[[0,1,-1],[-1,0,-1],[-1,1,-1]],[[0,1,-1],[1,0,-1],[1,1,-1]],[[0,-1,-1],[1,0,-1],[1,-1,-1]]],
];

// Blocs rendus en géométrie croisée (X shape) plutôt qu'en cube
const CROSS_BLOCKS = new Set([BlockType.TALL_GRASS, BlockType.FLOWER_RED, BlockType.FLOWER_YEL]);

// Luminosité AO : 0 coin très sombre → 3 coin très éclairé
const AO_BRIGHTNESS = [0.45, 0.65, 0.82, 1.0];

// Couleur par face selon le type de bloc
// Permet d'avoir herbe verte dessus + terre sur les côtés, bois avec grain, etc.
function getFaceColor(voxel, faceIdx) {
  switch (voxel) {
    case BlockType.GRASS:
      if (faceIdx === 2) return 0x5a8f3c; // dessus : herbe verte
      if (faceIdx === 3) return 0x8b6340; // dessous : terre
      return 0x8b5e3c;                    // côtés  : terre + liseré

    case BlockType.SNOW:
      if (faceIdx === 2) return 0xeef4ff; // dessus : blanc neige
      if (faceIdx === 3) return 0x8b6340; // dessous : terre
      return 0xc8d8e0;                    // côtés  : neige tassée

    case BlockType.WOOD:
      if (faceIdx === 2 || faceIdx === 3) return 0x8a6235; // bout : grain clair
      return 0x6b4226;                                      // écorce : sombre

    case BlockType.DIRT:
      return 0x8b6340;

    case BlockType.STONE:
      return 0x7a7a7a;

    case BlockType.SAND:
      return 0xe2c47a;

    case BlockType.LEAVES:
      return faceIdx === 2 ? 0x347a34 : 0x2d7a2d; // dessus légèrement plus clair

    case BlockType.CACTUS:
      if (faceIdx === 2 || faceIdx === 3) return 0x3a8a20; // dessus/dessous
      return 0x2d7a1f;                                      // côtés avec légère crête

    default:
      return BlockColor[voxel] ?? 0xffffff;
  }
}

// Calcule l'indice AO d'un vertex (0 = sombre, 3 = éclairé)
function vertexAO(s1, s2, corner) {
  if (s1 && s2) return 0; // coin complètement obstrué
  return 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (corner ? 1 : 0);
}

export class Chunk {
  constructor(chunkX, chunkZ, world) {
    this.chunkX    = chunkX;
    this.chunkZ    = chunkZ;
    this.world     = world;
    this.voxels    = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh      = null;  // mesh des blocs solides
    this.meshCross = null;  // mesh des décors croisés (herbe, fleurs)
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

    // Nettoyage des anciens meshes
    for (const key of ['mesh', 'meshCross']) {
      if (this[key]) {
        scene.remove(this[key]);
        this[key].geometry.dispose();
        this[key].material.dispose();
        this[key] = null;
      }
    }

    const sPos = [], sNorm = [], sCol = [], sIdx = []; // blocs solides
    const cPos = [], cNorm = [], cCol = [], cIdx = []; // décors croisés

    const ox  = this.chunkX * CHUNK_SIZE;
    const oz  = this.chunkZ * CHUNK_SIZE;
    const col = new THREE.Color();

    // Retourne true si le bloc est opaque (contribue à l'AO et au face culling)
    const isSolid = (bx, by, bz) => {
      const v = this.getVoxel(bx, by, bz);
      return v !== BlockType.AIR && !CROSS_BLOCKS.has(v);
    };

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const voxel = this.getVoxel(x, y, z);
          if (voxel === BlockType.AIR) continue;

          // Légère variation pseudo-aléatoire de couleur par bloc (±4%)
          // Casse l'aspect trop uniforme sans nécessiter de texture
          const rng       = ((x * 374761393 + y * 1073741789 + z * 2654435761) >>> 0) / 0xFFFFFFFF;
          const variation = 0.96 + rng * 0.08;

          // ── Décors croisés : herbe haute, fleurs ──────────────────────────────
          if (CROSS_BLOCKS.has(voxel)) {
            col.setHex(BlockColor[voxel] ?? 0x00ff00);
            const h   = voxel === BlockType.TALL_GRASS ? 0.85 : 0.7;
            const r   = col.r * variation;
            const g   = col.g * variation;
            const b   = col.b * variation;
            const ndx = cPos.length / 3;

            // Deux plans en diagonale formant un X vu du dessus
            cPos.push(
              ox+x+0.15, y,   oz+z+0.15,   ox+x+0.15, y+h, oz+z+0.15,
              ox+x+0.85, y+h, oz+z+0.85,   ox+x+0.85, y,   oz+z+0.85,
              ox+x+0.85, y,   oz+z+0.15,   ox+x+0.85, y+h, oz+z+0.15,
              ox+x+0.15, y+h, oz+z+0.85,   ox+x+0.15, y,   oz+z+0.85,
            );
            for (let i = 0; i < 8; i++) { cNorm.push(0, 1, 0); cCol.push(r, g, b); }
            cIdx.push(
              ndx,   ndx+1, ndx+2,   ndx,   ndx+2, ndx+3,
              ndx+4, ndx+5, ndx+6,   ndx+4, ndx+6, ndx+7,
            );
            continue;
          }

          // ── Blocs solides : face culling + AO ────────────────────────────────
          for (let f = 0; f < FACES.length; f++) {
            const { dir, corners } = FACES[f];

            // Rendre la face seulement si le voisin est transparent
            if (isSolid(x + dir[0], y + dir[1], z + dir[2])) continue;

            const shade  = FACE_SHADE[f];
            const kernel = AO_KERNELS[f];
            col.setHex(getFaceColor(voxel, f));

            // Calcul AO des 4 coins du quad
            const aoV = kernel.map(([s1, s2, sc]) => vertexAO(
              isSolid(x + s1[0], y + s1[1], z + s1[2]),
              isSolid(x + s2[0], y + s2[1], z + s2[2]),
              isSolid(x + sc[0], y + sc[1], z + sc[2]),
            ));

            // Flip du quad pour éviter les artefacts de diagonale AO
            const flip = aoV[0] + aoV[2] > aoV[1] + aoV[3];
            const ndx  = sPos.length / 3;

            for (let v = 0; v < 4; v++) {
              const [cx, cy, cz] = corners[v];
              sPos.push(ox + x + cx, y + cy, oz + z + cz);
              sNorm.push(...dir);
              const bright = shade * AO_BRIGHTNESS[aoV[v]] * variation;
              sCol.push(col.r * bright, col.g * bright, col.b * bright);
            }

            if (flip) sIdx.push(ndx, ndx+1, ndx+3,   ndx+1, ndx+2, ndx+3);
            else      sIdx.push(ndx, ndx+1, ndx+2,   ndx,   ndx+2, ndx+3);
          }
        }
      }
    }

    // Création du mesh solide
    if (sPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(sPos,  3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(sNorm, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(sCol,  3));
      geo.setIndex(sIdx);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.mesh.receiveShadow = this.mesh.castShadow = true;
      scene.add(this.mesh);
    }

    // Création du mesh croisé (herbe, fleurs) — DoubleSide pour visibilité des deux côtés
    if (cPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(cPos,  3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(cNorm, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(cCol,  3));
      geo.setIndex(cIdx);
      this.meshCross = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }));
      scene.add(this.meshCross);
    }
  }
}
