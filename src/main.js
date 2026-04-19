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
const skyColor = new THREE.Color(0x87ceeb);
const scene    = new THREE.Scene();
scene.background = skyColor;
scene.fog        = new THREE.FogExp2(skyColor.clone(), 0.012);

// ── Caméra ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

// ── Lumières ──────────────────────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near   = 0.5;
sun.shadow.camera.far    = 300;
sun.shadow.camera.left   = sun.shadow.camera.bottom = -60;
sun.shadow.camera.right  = sun.shadow.camera.top    =  60;
scene.add(sun);
scene.add(sun.target); // la cible doit être dans la scène

// Lune : lumière bleutée et douce, active la nuit
const moon = new THREE.DirectionalLight(0x4466bb, 0.0);
scene.add(moon);
scene.add(moon.target);

const ambient = new THREE.AmbientLight(0xcce8ff, 0.6);
scene.add(ambient);

// ── Systèmes ──────────────────────────────────────────────────────────────────
const input  = new InputHandler();
const world  = new World(scene, 42);
const player = new Player(camera, world, input);

// ── Spawn au sol ──────────────────────────────────────────────────────────────
// Génère les chunks du spawn avant la boucle pour pouvoir lire la hauteur de terrain
world.update(player.position);
const SPAWN_X = Math.round(player.position.x);
const SPAWN_Z = Math.round(player.position.z);
for (let y = 63; y >= 0; y--) {
  if (world.getVoxelWorld(SPAWN_X, y, SPAWN_Z) !== BlockType.AIR) {
    player.position.y = y + 1; // pieds posés juste au-dessus du sol
    break;
  }
}

// ── Pointer lock ──────────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());

// ── Sélection de bloc ─────────────────────────────────────────────────────────
let selectedIdx = 0;
const hudEl   = document.getElementById('hud');
const debugEl = document.getElementById('debug');

function updateHUD() {
  hudEl.textContent = `Bloc : ${BlockName[PLACEABLE_BLOCKS[selectedIdx]]}  |  WASD déplacer  |  Espace sauter  |  Clic G casser  |  Clic D poser  |  Molette changer`;
}
updateHUD();

document.addEventListener('wheel', e => {
  selectedIdx = (selectedIdx + (e.deltaY > 0 ? 1 : -1) + PLACEABLE_BLOCKS.length) % PLACEABLE_BLOCKS.length;
  updateHUD();
}, { passive: true });

// ── Cycle jour / nuit ─────────────────────────────────────────────────────────
const CYCLE_DURATION = 120; // secondes pour un cycle complet
let timeOfDay = 0.3;        // 0 = minuit · 0.25 = aube · 0.5 = midi · 0.75 = crépuscule

// Couleurs clés pour les interpolations
const C_SKY_DAY    = new THREE.Color(0x87ceeb);
const C_SKY_DUSK   = new THREE.Color(0xee5522);
const C_SKY_NIGHT  = new THREE.Color(0x050510);
const C_AMB_DAY    = new THREE.Color(0xcce8ff);
const C_AMB_NIGHT  = new THREE.Color(0x112244);
const _tmp         = new THREE.Color();

function updateDayNight(dt) {
  timeOfDay = (timeOfDay + dt / CYCLE_DURATION) % 1;

  // Angle du soleil : 0 = aube, π/2 = midi, π = crépuscule, 3π/2 = minuit
  const angle = (timeOfDay - 0.25) * Math.PI * 2;
  const sunH  = Math.sin(angle); // −1 (nuit) … +1 (midi)
  const dayF  = Math.max(0, sunH);

  // Positions soleil et lune (opposées sur le même axe)
  const sx = Math.cos(angle) * 150;
  const sy = sunH * 150;
  sun.position.set(sx, sy, 60);
  moon.position.set(-sx, -sy, 60);

  // Intensités
  sun.intensity   = Math.max(0, sunH * 1.8);
  moon.intensity  = Math.max(0, -sunH * 0.25);
  ambient.intensity = 0.08 + dayF * 0.55;

  // Ombres seulement quand le soleil est assez haut
  sun.castShadow = sunH > 0.2;

  // Couleur du ciel : nuit → aube/crépuscule orangée → journée bleue
  if (sunH > 0.2) {
    skyColor.copy(C_SKY_DAY);
    ambient.color.copy(C_AMB_DAY);
  } else if (sunH > -0.15) {
    const t = (sunH + 0.15) / 0.35; // 0 = nuit, 1 = jour
    if (t < 0.5) {
      skyColor.lerpColors(C_SKY_NIGHT, C_SKY_DUSK, t * 2);
      ambient.color.lerpColors(C_AMB_NIGHT, C_AMB_DAY, t * 2);
    } else {
      skyColor.lerpColors(C_SKY_DUSK, C_SKY_DAY, (t - 0.5) * 2);
      ambient.color.lerpColors(C_AMB_NIGHT, C_AMB_DAY, t);
    }
  } else {
    skyColor.copy(C_SKY_NIGHT);
    ambient.color.copy(C_AMB_NIGHT);
  }

  // Brouillard = même couleur que le ciel
  scene.fog.color.copy(skyColor);

  // L'ombre suit le joueur (frustum toujours centré sur lui)
  sun.target.position.copy(player.position);
  sun.target.updateMatrixWorld();
  moon.target.position.copy(player.position);
  moon.target.updateMatrixWorld();
}

// ── Boucle de jeu ─────────────────────────────────────────────────────────────
let last = 0;
let interactCooldown = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (input.isLocked) {
    overlay.style.display = 'none';

    player.update(dt);
    world.update(player.position);
    updateDayNight(dt);

    interactCooldown -= dt;
    if (interactCooldown <= 0) {
      const hit = world.raycast(camera.position, player.getCameraDirection());
      if (hit) {
        if (input.consumeMouseButton(0)) {
          world.setVoxelWorld(hit.x, hit.y, hit.z, BlockType.AIR);
          rebuildAround(hit.x, hit.z);
          interactCooldown = 0.15;
        } else if (input.consumeMouseButton(2)) {
          const px = hit.x + hit.face[0];
          const py = hit.y + hit.face[1];
          const pz = hit.z + hit.face[2];
          if (!collidesWithPlayer(px, py, pz)) {
            world.setVoxelWorld(px, py, pz, PLACEABLE_BLOCKS[selectedIdx]);
            rebuildAround(px, pz);
          }
          interactCooldown = 0.15;
        }
      }
    }

    const p   = player.position;
    const h   = Math.round(timeOfDay * 24);
    const min = Math.round((timeOfDay * 24 - h) * 60);
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ${String(h % 24).padStart(2,'0')}h${String(Math.abs(min)).padStart(2,'0')}`;
  } else {
    overlay.style.display = 'flex';
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(loop);

// ── Utilitaires ───────────────────────────────────────────────────────────────
function rebuildAround(wx, wz) {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  for (const [dx, dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) {
    const c = world.getChunk(cx + dx, cz + dz);
    if (c) c.buildMesh(scene);
  }
}

function collidesWithPlayer(bx, by, bz) {
  const p = player.position;
  const r = 0.3, h = 1.8;
  return bx + 1 > p.x - r && bx < p.x + r &&
         by + 1 > p.y      && by < p.y + h &&
         bz + 1 > p.z - r  && bz < p.z + r;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
