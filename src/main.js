import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { PLACEABLE_BLOCKS, BlockName, BlockType } from './Voxel.js';
import { CHUNK_SIZE } from './Chunk.js';

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ── Scène ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog        = new THREE.FogExp2(0x87ceeb, 0.012);

// ── Caméra ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

// ── Lumières ──────────────────────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
sun.position.set(60, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far  = 300;
sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
sun.shadow.camera.right = sun.shadow.camera.top   =  80;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xcce8ff, 0.6));

// ── Systèmes ──────────────────────────────────────────────────────────────────
const input  = new InputHandler();
const world  = new World(scene, 42);
const player = new Player(camera, world, input);

// ── Pointer lock ──────────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());

// ── Sélection de bloc (molette) ───────────────────────────────────────────────
let selectedIdx = 0;
const hudEl   = document.getElementById('hud');
const debugEl = document.getElementById('debug');

function updateHUD() {
  const name = BlockName[PLACEABLE_BLOCKS[selectedIdx]];
  hudEl.textContent = `Bloc : ${name}  |  WASD déplacement  |  Espace saut  |  Clic gauche casser  |  Clic droit poser  |  Molette changer`;
}
updateHUD();

document.addEventListener('wheel', e => {
  const dir = e.deltaY > 0 ? 1 : -1;
  selectedIdx = (selectedIdx + dir + PLACEABLE_BLOCKS.length) % PLACEABLE_BLOCKS.length;
  updateHUD();
}, { passive: true });

// ── Boucle de jeu ─────────────────────────────────────────────────────────────
let last = 0;
let interactCooldown = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1); // cap à 100ms pour éviter les tunnels
  last = now;

  if (input.isLocked) {
    overlay.style.display = 'none';

    player.update(dt);
    world.update(player.position);

    // Interaction avec les blocs
    interactCooldown -= dt;
    if (interactCooldown <= 0) {
      const hit = world.raycast(camera.position, player.getCameraDirection());
      if (hit) {
        if (input.consumeMouseButton(0)) {
          // Clic gauche : casser
          world.setVoxelWorld(hit.x, hit.y, hit.z, BlockType.AIR);
          rebuildAround(hit.x, hit.y, hit.z);
          interactCooldown = 0.15;
        } else if (input.consumeMouseButton(2)) {
          // Clic droit : poser
          const px = hit.x + hit.face[0];
          const py = hit.y + hit.face[1];
          const pz = hit.z + hit.face[2];
          // Ne pas poser dans la hitbox du joueur
          if (!collidesWithPlayer(px, py, pz)) {
            world.setVoxelWorld(px, py, pz, PLACEABLE_BLOCKS[selectedIdx]);
            rebuildAround(px, py, pz);
          }
          interactCooldown = 0.15;
        }
      }
    }

    // Debug HUD
    const p = player.position;
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`;
  } else {
    overlay.style.display = 'flex';
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(loop);

// ── Utilitaires ───────────────────────────────────────────────────────────────

function rebuildAround(wx, wy, wz) {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  for (const [dx, dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) {
    const c = world.getChunk(cx + dx, cz + dz);
    if (c) c.buildMesh(scene);
  }
}

function collidesWithPlayer(bx, by, bz) {
  const p  = player.position;
  const r  = 0.3;
  const h  = 1.8;
  return bx + 1 > p.x - r && bx < p.x + r &&
         by + 1 > p.y      && by < p.y + h &&
         bz + 1 > p.z - r  && bz < p.z + r;
}

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
