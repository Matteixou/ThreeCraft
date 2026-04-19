import * as THREE from 'three';
import { BlockType, BlockColor } from './Voxel.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

// Les 6 faces d'un cube : direction de la normale + 4 coins (en coordonnées locales 0/1)
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] }, // +X
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] }, // -X
  { dir: [ 0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] }, // +Y (dessus)
  { dir: [ 0,-1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] }, // -Y (dessous)
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] }, // +Z
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }, // -Z
];

// Facteur d'ombre par direction : dessus = clair, côtés = moyen, dessous = sombre
const FACE_SHADE = [0.8, 0.8, 1.0, 0.5, 0.75, 0.75];

export class Chunk {
  constructor(chunkX, chunkZ, world) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.world  = world;

    // Tableau plat de voxels : index = x + SIZE*(y + HEIGHT*z)
    this.voxels  = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh    = null;
    this.isDirty = true;
  }

  _index(x, y, z) {
    return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z);
  }

  // Lecture locale — délègue au World pour les bords de chunk
  getVoxel(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return this.world.getVoxelWorld(
        this.chunkX * CHUNK_SIZE + x, y,
        this.chunkZ * CHUNK_SIZE + z
      );
    }
    return this.voxels[this._index(x, y, z)];
  }

  setVoxel(x, y, z, type) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.voxels[this._index(x, y, z)] = type;
    this.isDirty = true;
  }

  // Reconstruit le mesh par face culling : seules les faces exposées à l'air sont rendues
  buildMesh(scene) {
    if (!this.isDirty) return;
    this.isDirty = false;

    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    const positions = [];
    const normals   = [];
    const colors    = [];
    const indices   = [];

    const ox = this.chunkX * CHUNK_SIZE;
    const oz = this.chunkZ * CHUNK_SIZE;
    const col = new THREE.Color();

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const voxel = this.getVoxel(x, y, z);
          if (voxel === BlockType.AIR) continue;

          col.setHex(BlockColor[voxel] ?? 0xffffff);

          for (let f = 0; f < FACES.length; f++) {
            const { dir, corners } = FACES[f];
            const neighbor = this.getVoxel(x + dir[0], y + dir[1], z + dir[2]);
            if (neighbor !== BlockType.AIR) continue; // face masquée

            const shade = FACE_SHADE[f];
            const ndx   = positions.length / 3;

            for (const [cx, cy, cz] of corners) {
              positions.push(ox + x + cx, y + cy, oz + z + cz);
              normals.push(...dir);
              colors.push(col.r * shade, col.g * shade, col.b * shade);
            }
            // Deux triangles par face (quad)
            indices.push(ndx, ndx + 1, ndx + 2, ndx, ndx + 2, ndx + 3);
          }
        }
      }
    }

    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
    geo.setIndex(indices);

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow    = true;
    scene.add(this.mesh);
  }
}
