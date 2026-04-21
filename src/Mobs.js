import * as THREE from 'three';
import { BlockType, ItemType } from './Voxel.js';
import { CHUNK_HEIGHT } from './Chunk.js';

const AGGRO_RANGE  = 14;
const ATTACK_RANGE = 1.4;
const MOB_SPEED    = 2.2;
const MOB_GRAVITY  = -20;
const MAX_MOBS     = 8;
const ATTACK_CD    = 0.8;

function mkBox(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function createZombieGroup() {
  const g    = new THREE.Group();
  const head = mkBox(0.65, 0.65, 0.65, 0x4a8c3a,  0,    1.50,  0);
  const body = mkBox(0.80, 1.00, 0.45, 0x2e6020,  0,    0.83,  0);
  const lArm = mkBox(0.32, 0.90, 0.32, 0x2e6020, -0.56, 0.83,  0);
  const rArm = mkBox(0.32, 0.90, 0.32, 0x2e6020,  0.56, 0.83,  0);
  const lLeg = mkBox(0.32, 0.90, 0.32, 0x1e4018, -0.20, 0.02,  0);
  const rLeg = mkBox(0.32, 0.90, 0.32, 0x1e4018,  0.20, 0.02,  0);
  // yeux rouges
  const lEye = mkBox(0.12, 0.10, 0.02, 0xff2020, -0.16, 1.55, -0.33);
  const rEye = mkBox(0.12, 0.10, 0.02, 0xff2020,  0.16, 1.55, -0.33);
  g.add(head, body, lArm, rArm, lLeg, rLeg, lEye, rEye);
  g._lArm = lArm;
  g._rArm = rArm;
  g._lLeg = lLeg;
  g._rLeg = rLeg;
  return g;
}

export class Mob {
  constructor(scene, world, x, y, z) {
    this._scene   = scene;
    this._world   = world;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3();
    this.health   = 10;
    this.onGround = false;

    this._attackCD  = 0;
    this._wanderCD  = 0;
    this._wanderDir = new THREE.Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this._walkPhase = Math.random() * Math.PI * 2;

    this.mesh = createZombieGroup();
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  isDead() { return this.health <= 0; }

  takeDamage(n) { this.health -= n; }

  getDrop() {
    const r = Math.random();
    if (r < 0.50) return ItemType.RAW_BEEF;
    if (r < 0.80) return ItemType.BONE;
    return ItemType.FEATHER;
  }

  remove() {
    this._scene.remove(this.mesh);
    this.mesh.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  }

  update(dt, playerPos) {
    const dx   = playerPos.x - this.position.x;
    const dz   = playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let mvx = 0, mvz = 0;
    if (dist < AGGRO_RANGE && dist > 0.3) {
      mvx = (dx / dist) * MOB_SPEED;
      mvz = (dz / dist) * MOB_SPEED;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      this._wanderCD -= dt;
      if (this._wanderCD <= 0) {
        this._wanderCD = 3 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2;
        this._wanderDir.set(Math.cos(a), Math.sin(a));
      }
      mvx = this._wanderDir.x * MOB_SPEED * 0.35;
      mvz = this._wanderDir.y * MOB_SPEED * 0.35;
    }

    this.velocity.x = mvx;
    this.velocity.z = mvz;
    this.velocity.y += MOB_GRAVITY * dt;
    this.velocity.y  = Math.max(this.velocity.y, -25);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Collision sol simplifiée : scan depuis la position courante
    const bx     = Math.floor(this.position.x);
    const bz     = Math.floor(this.position.z);
    const scanY  = Math.min(CHUNK_HEIGHT - 1, Math.ceil(this.position.y) + 3);
    let groundY  = 1;
    for (let y = scanY; y >= 0; y--) {
      if (this._world.getVoxelWorld(bx, y, bz) !== BlockType.AIR) { groundY = y + 1; break; }
    }
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.onGround   = true;
    } else {
      this.onGround = false;
    }

    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // Animation de marche
    if (mvx !== 0 || mvz !== 0) {
      this._walkPhase += dt * 9;
      const sw = Math.sin(this._walkPhase) * 0.75;
      this.mesh._lArm.rotation.x =  sw;
      this.mesh._rArm.rotation.x = -sw;
      this.mesh._lLeg.rotation.x = -sw;
      this.mesh._rLeg.rotation.x =  sw;
    }

    this._attackCD -= dt;
  }

  tryAttack(playerPos) {
    const d = this.position.distanceTo(playerPos);
    if (d < ATTACK_RANGE && this._attackCD <= 0) {
      this._attackCD = ATTACK_CD;
      return 2;
    }
    return 0;
  }

  // Intersection rayon-AABB, retourne la distance ou null
  rayIntersect(origin, dir) {
    const r = 0.4, h = 1.9;
    const mnX = (this.position.x - r - origin.x) / dir.x;
    const mxX = (this.position.x + r - origin.x) / dir.x;
    const mnY = (this.position.y     - origin.y) / dir.y;
    const mxY = (this.position.y + h - origin.y) / dir.y;
    const mnZ = (this.position.z - r - origin.z) / dir.z;
    const mxZ = (this.position.z + r - origin.z) / dir.z;
    const tEnter = Math.max(Math.min(mnX, mxX), Math.min(mnY, mxY), Math.min(mnZ, mxZ));
    const tExit  = Math.min(Math.max(mnX, mxX), Math.max(mnY, mxY), Math.max(mnZ, mxZ));
    if (tExit < 0 || tEnter > tExit || tEnter > 6) return null;
    return Math.max(0, tEnter);
  }
}

export class MobManager {
  constructor(scene, world) {
    this._scene  = scene;
    this._world  = world;
    this.mobs    = [];
    this._spawnCD = 25;
  }

  // Retourne la liste des drops (ItemType) des mobs morts ce tick
  update(dt, playerPos, timeOfDay) {
    this._spawnCD -= dt;
    const isNight = timeOfDay > 0.52 || timeOfDay < 0.02;
    if (isNight && this._spawnCD <= 0 && this.mobs.length < MAX_MOBS) {
      this._spawnCD = 15 + Math.random() * 20;
      this._trySpawn(playerPos);
    }

    for (const mob of this.mobs) mob.update(dt, playerPos);

    const drops = [];
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].isDead()) {
        drops.push(this.mobs[i].getDrop());
        this.mobs[i].remove();
        this.mobs.splice(i, 1);
      }
    }
    return drops;
  }

  getMobAttackDamage(playerPos) {
    let total = 0;
    for (const mob of this.mobs) total += mob.tryAttack(playerPos);
    return total;
  }

  // Retourne le mob touché par le rayon (plus proche que le bloc ciblé)
  findHitMob(origin, dir, blockHit) {
    const blockDist = blockHit
      ? origin.distanceTo(new THREE.Vector3(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5))
      : Infinity;
    let best = null, bestDist = Math.min(blockDist, 6);
    for (const mob of this.mobs) {
      const d = mob.rayIntersect(origin, dir);
      if (d !== null && d < bestDist) { bestDist = d; best = mob; }
    }
    return best;
  }

  _trySpawn(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 14 + Math.random() * 8;
    const sx    = playerPos.x + Math.cos(angle) * dist;
    const sz    = playerPos.z + Math.sin(angle) * dist;

    let sy = -1;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this._world.getVoxelWorld(Math.floor(sx), y, Math.floor(sz)) !== BlockType.AIR) {
        sy = y + 1; break;
      }
    }
    if (sy < 2 || sy <= 13) return; // pas dans l'eau / hors monde
    this.mobs.push(new Mob(this._scene, this._world, sx, sy, sz));
  }
}
