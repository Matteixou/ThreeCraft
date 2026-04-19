import * as THREE from 'three';

const PLAYER_HEIGHT   = 1.8;  // hauteur de la hitbox (pieds → tête)
const EYE_OFFSET      = 1.6;  // hauteur des yeux au-dessus des pieds
const PLAYER_RADIUS   = 0.3;  // demi-largeur de la hitbox
const GRAVITY         = -28;
const JUMP_FORCE      = 9;
const MOVE_SPEED      = 5.5;
const MOUSE_SENS      = 0.002;

export class Player {
  constructor(camera, world, input) {
    this.camera = camera;
    this.world  = world;
    this.input  = input;

    // position = bas des pieds
    this.position = new THREE.Vector3(8, 70, 8);
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.yaw      = 0;
    this.pitch    = 0;
  }

  update(dt) {
    this._look();
    this._move(dt);
    this._physics(dt);
    this._syncCamera();
  }

  _look() {
    const { x, y } = this.input.consumeMouseDelta();
    this.yaw   -= x * MOUSE_SENS;
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - y * MOUSE_SENS));
  }

  _move(dt) {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    let vx = 0, vz = 0;
    if (this.input.isKeyDown('KeyW')) { vx -= sin; vz -= cos; }
    if (this.input.isKeyDown('KeyS')) { vx += sin; vz += cos; }
    if (this.input.isKeyDown('KeyA')) { vx -= cos; vz += sin; }
    if (this.input.isKeyDown('KeyD')) { vx += cos; vz -= sin; }

    const len = Math.sqrt(vx * vx + vz * vz);
    if (len > 0) { vx /= len; vz /= len; }

    this.velocity.x = vx * MOVE_SPEED;
    this.velocity.z = vz * MOVE_SPEED;

    if (this.input.isKeyDown('Space') && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround   = false;
    }
  }

  _physics(dt) {
    // Gravité toujours active (même au sol — force minime pour maintenir le contact)
    this.velocity.y += GRAVITY * dt;
    this.velocity.y  = Math.max(this.velocity.y, -50);
    this.onGround    = false;

    this.position.x += this.velocity.x * dt;
    this._resolveX();

    this.position.z += this.velocity.z * dt;
    this._resolveZ();

    this.position.y += this.velocity.y * dt;
    this._resolveY();
  }

  // Voxel solide en coordonnées continues ?
  _solid(x, y, z) {
    return this.world.getVoxelWorld(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
  }

  _resolveX() {
    const r = PLAYER_RADIUS;
    const checkY = [0, 0.5, 1.0, PLAYER_HEIGHT - 0.01];
    for (const dy of checkY) {
      const cy = this.position.y + dy;
      if (this.velocity.x > 0) {
        if (this._solid(this.position.x + r, cy, this.position.z + r) ||
            this._solid(this.position.x + r, cy, this.position.z - r)) {
          this.position.x = Math.floor(this.position.x + r) - r;
          this.velocity.x = 0; break;
        }
      } else if (this.velocity.x < 0) {
        if (this._solid(this.position.x - r, cy, this.position.z + r) ||
            this._solid(this.position.x - r, cy, this.position.z - r)) {
          this.position.x = Math.floor(this.position.x - r) + 1 + r;
          this.velocity.x = 0; break;
        }
      }
    }
  }

  _resolveZ() {
    const r = PLAYER_RADIUS;
    const checkY = [0, 0.5, 1.0, PLAYER_HEIGHT - 0.01];
    for (const dy of checkY) {
      const cy = this.position.y + dy;
      if (this.velocity.z > 0) {
        if (this._solid(this.position.x + r, cy, this.position.z + r) ||
            this._solid(this.position.x - r, cy, this.position.z + r)) {
          this.position.z = Math.floor(this.position.z + r) - r;
          this.velocity.z = 0; break;
        }
      } else if (this.velocity.z < 0) {
        if (this._solid(this.position.x + r, cy, this.position.z - r) ||
            this._solid(this.position.x - r, cy, this.position.z - r)) {
          this.position.z = Math.floor(this.position.z - r) + 1 + r;
          this.velocity.z = 0; break;
        }
      }
    }
  }

  _resolveY() {
    const r = PLAYER_RADIUS;
    const corners = [
      [this.position.x + r, this.position.z + r],
      [this.position.x - r, this.position.z + r],
      [this.position.x + r, this.position.z - r],
      [this.position.x - r, this.position.z - r],
    ];

    if (this.velocity.y <= 0) {
      // Vérifie les pieds
      for (const [cx, cz] of corners) {
        if (this._solid(cx, this.position.y, cz)) {
          this.position.y = Math.floor(this.position.y) + 1;
          this.velocity.y = 0;
          this.onGround   = true;
          return;
        }
      }
    } else {
      // Vérifie la tête
      const headY = this.position.y + PLAYER_HEIGHT;
      for (const [cx, cz] of corners) {
        if (this._solid(cx, headY, cz)) {
          this.position.y = Math.floor(headY) - PLAYER_HEIGHT;
          this.velocity.y = 0;
          return;
        }
      }
    }
  }

  _syncCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_OFFSET,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y     = this.yaw;
    this.camera.rotation.x     = this.pitch;
  }

  getCameraDirection() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }
}
