import * as THREE from 'three';

const CLOUD_Y = 54;   // altitude des nuages
const CLOUD_H = 2;    // épaisseur (blocs)
const CELL    = 12;   // largeur d'une cellule de nuage (unités monde)
const HALF    = 28;   // grille de (HALF*2+1)² cellules autour du joueur
const WIND    = 2.0;  // vitesse du vent (unités/sec)

// Hash déterministe → [0, 1]
function hash(x, z) {
  let n = ((x * 374761393) ^ (z * 1073741789)) | 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return n / 0xFFFFFFFF;
}

// Présence d'un bloc nuage en cellule (gx, gz)
function cloudAt(gx, gz) {
  // Macro-cellule 3×3 : détermine les grandes masses nuageuses
  const mx = Math.floor(gx / 3);
  const mz = Math.floor(gz / 3);
  if (hash(mx * 7, mz * 13) < 0.44) return false;
  // Fine : perfore les masses pour éviter un plafond uniforme
  return hash(gx, gz) > 0.18;
}

export class CloudSystem {
  constructor(scene) {
    this.scene = scene;
    this.wind  = 0;   // décalage vent en X (base space)
    this.baseX = 0;   // origine X de la grille actuelle (base space)
    this.baseZ = 0;

    const geo = new THREE.BoxGeometry(CELL, CLOUD_H, CELL);
    this.mat  = new THREE.MeshLambertMaterial({
      color: 0xfefeff,
      transparent: true,
      opacity: 0.92,
    });

    const maxCount = (HALF * 2 + 1) ** 2;
    this.inst = new THREE.InstancedMesh(geo, this.mat, maxCount);
    this.inst.castShadow    = false;
    this.inst.receiveShadow = false;
    this.inst.frustumCulled = false;
    scene.add(this.inst);

    this._rebuild(0, 0);
  }

  // Reconstruit la grille centrée sur (wx, wz) en espace base (sans décalage vent)
  _rebuild(wx, wz) {
    const gcx  = Math.round(wx / CELL);
    const gcz  = Math.round(wz / CELL);
    this.baseX = gcx * CELL;
    this.baseZ = gcz * CELL;

    const dummy = new THREE.Object3D();
    let count = 0;

    for (let dz = -HALF; dz <= HALF; dz++) {
      for (let dx = -HALF; dx <= HALF; dx++) {
        const gx = gcx + dx;
        const gz = gcz + dz;
        if (cloudAt(gx, gz)) {
          dummy.position.set(gx * CELL + CELL / 2, CLOUD_Y + CLOUD_H / 2, gz * CELL + CELL / 2);
          dummy.updateMatrix();
          this.inst.setMatrixAt(count++, dummy.matrix);
        }
      }
    }

    this.inst.count = count;
    this.inst.instanceMatrix.needsUpdate = true;
  }

  update(playerX, playerZ, dt) {
    this.wind += WIND * dt;
    // Le mesh entier se déplace avec le vent — les instances restent en base space
    this.inst.position.x = this.wind;

    // Recalcul si le joueur s'éloigne du centre de la grille (en base space)
    const localX = playerX - this.wind - this.baseX;
    const localZ = playerZ - this.baseZ;
    if (Math.abs(localX) > CELL * 6 || Math.abs(localZ) > CELL * 6) {
      this._rebuild(playerX - this.wind, playerZ);
    }
  }
}
