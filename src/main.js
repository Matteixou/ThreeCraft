import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { PLACEABLE_BLOCKS, BlockName, BlockType } from './Voxel.js';
import { CHUNK_SIZE } from './Chunk.js';
import { getBlockTile } from './TextureAtlas.js';

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
scene.add(sun.target);

const moon = new THREE.DirectionalLight(0x4466bb, 0.0);
scene.add(moon);
scene.add(moon.target);

const ambient = new THREE.AmbientLight(0xcce8ff, 0.6);
scene.add(ambient);

// ── Disque soleil ─────────────────────────────────────────────────────────────
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(12, 24),
  new THREE.MeshBasicMaterial({ color: 0xfffde0, fog: false }),
);
scene.add(sunDisc);

// ── Disque lune ───────────────────────────────────────────────────────────────
const moonDisc = new THREE.Mesh(
  new THREE.CircleGeometry(8, 24),
  new THREE.MeshBasicMaterial({ color: 0xd8e8ff, fog: false }),
);
scene.add(moonDisc);

// ── Étoiles ───────────────────────────────────────────────────────────────────
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0, fog: false });
const starMesh = (() => {
  const COUNT = 800;
  const pos   = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 200;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, starMat);
})();
scene.add(starMesh);

// ── Boîte de sélection ────────────────────────────────────────────────────────
const selectionBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.004, 1.004, 1.004),
  new THREE.MeshBasicMaterial({ wireframe: true, color: 0x000000, transparent: true, opacity: 0.5 }),
);
selectionBox.visible = false;
scene.add(selectionBox);

// ── Systèmes ──────────────────────────────────────────────────────────────────
const input  = new InputHandler();
const world  = new World(scene, 42);
const player = new Player(camera, world, input);

// ── Spawn au sol ──────────────────────────────────────────────────────────────
world.update(player.position);
const SPAWN_X = Math.round(player.position.x);
const SPAWN_Z = Math.round(player.position.z);
for (let y = 63; y >= 0; y--) {
  if (world.getVoxelWorld(SPAWN_X, y, SPAWN_Z) !== BlockType.AIR) {
    player.position.y = y + 1;
    break;
  }
}

// ── Pointer lock ──────────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());

// ── Hotbar ────────────────────────────────────────────────────────────────────
const hotbarCanvas = document.getElementById('hotbar');
const hCtx         = hotbarCanvas.getContext('2d');
const SLOT  = 52;
const SLOTS = PLACEABLE_BLOCKS.length;
hotbarCanvas.width  = SLOT * SLOTS + 4;
hotbarCanvas.height = SLOT + 4;

function drawHotbar() {
  const atlas = world.atlas.image; // canvas from createTextureAtlas
  const T = 16, COLS = 16;
  hCtx.imageSmoothingEnabled = false;
  hCtx.clearRect(0, 0, hotbarCanvas.width, hotbarCanvas.height);

  for (let i = 0; i < SLOTS; i++) {
    const bx       = i * SLOT + 2;
    const by       = 2;
    const blockType = PLACEABLE_BLOCKS[i];
    const sel       = i === selectedIdx;

    hCtx.fillStyle = sel ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.60)';
    hCtx.fillRect(bx, by, SLOT, SLOT);

    const tileId = getBlockTile(blockType, 2); // face +Y (top)
    const col    = tileId % COLS;
    const row    = Math.floor(tileId / COLS);
    hCtx.drawImage(atlas, col * T, row * T, T, T, bx + 6, by + 6, SLOT - 12, SLOT - 12);

    hCtx.strokeStyle = sel ? '#ffffff' : '#555555';
    hCtx.lineWidth   = sel ? 2.5 : 1;
    hCtx.strokeRect(bx + 0.5, by + 0.5, SLOT - 1, SLOT - 1);
  }
}

// ── Sélection de bloc ─────────────────────────────────────────────────────────
let selectedIdx = 0;
const hudEl   = document.getElementById('hud');
const debugEl = document.getElementById('debug');

function updateHUD() {
  hudEl.textContent = BlockName[PLACEABLE_BLOCKS[selectedIdx]];
  drawHotbar();
}
updateHUD();

document.addEventListener('wheel', e => {
  selectedIdx = (selectedIdx + (e.deltaY > 0 ? 1 : -1) + SLOTS) % SLOTS;
  updateHUD();
}, { passive: true });

// ── Cycle jour / nuit ─────────────────────────────────────────────────────────
const CYCLE_DURATION = 120;
let timeOfDay = 0.3;

const C_SKY_DAY   = new THREE.Color(0x87ceeb);
const C_SKY_DUSK  = new THREE.Color(0xee5522);
const C_SKY_NIGHT = new THREE.Color(0x050510);
const C_AMB_DAY   = new THREE.Color(0xcce8ff);
const C_AMB_NIGHT = new THREE.Color(0x112244);

const _sunDir  = new THREE.Vector3();
const _moonDir = new THREE.Vector3();

function updateDayNight(dt) {
  timeOfDay = (timeOfDay + dt / CYCLE_DURATION) % 1;

  const angle = (timeOfDay - 0.25) * Math.PI * 2;
  const sunH  = Math.sin(angle);
  const dayF  = Math.max(0, sunH);

  const sx = Math.cos(angle) * 150;
  const sy = sunH * 150;
  sun.position.set(sx, sy, 60);
  moon.position.set(-sx, -sy, 60);

  sun.intensity    = Math.max(0, sunH * 1.8);
  moon.intensity   = Math.max(0, -sunH * 0.25);
  ambient.intensity = 0.08 + dayF * 0.55;
  sun.castShadow   = sunH > 0.2;

  if (sunH > 0.2) {
    skyColor.copy(C_SKY_DAY);
    ambient.color.copy(C_AMB_DAY);
  } else if (sunH > -0.15) {
    const t = (sunH + 0.15) / 0.35;
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
  scene.fog.color.copy(skyColor);

  sun.target.position.copy(player.position);
  sun.target.updateMatrixWorld();
  moon.target.position.copy(player.position);
  moon.target.updateMatrixWorld();

  // Disques soleil / lune — positionnés dans la direction de chaque astre
  _sunDir.set(sx, sy, 60).normalize();
  sunDisc.position.copy(camera.position).addScaledVector(_sunDir, 180);
  sunDisc.lookAt(camera.position);
  sunDisc.visible = sunH > -0.15;
  sunDisc.material.color.setHSL(sunH > 0.2 ? 0.14 : 0.07, 1.0, 0.68 + dayF * 0.25);

  _moonDir.set(-sx, -sy, 60).normalize();
  moonDisc.position.copy(camera.position).addScaledVector(_moonDir, 180);
  moonDisc.lookAt(camera.position);
  moonDisc.visible = sunH < 0.15;

  // Étoiles — opacity inversement proportionnelle au soleil
  starMesh.position.copy(camera.position);
  starMat.opacity = Math.max(0, Math.min(1, (-sunH - 0.05) / 0.25));
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
    const hit = world.raycast(camera.position, player.getCameraDirection());

    // Boîte de sélection autour du bloc visé
    if (hit) {
      selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      selectionBox.visible = true;
    } else {
      selectionBox.visible = false;
    }

    if (interactCooldown <= 0 && hit) {
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

    const p    = player.position;
    const totalH = timeOfDay * 24;
    const hh   = Math.floor(totalH) % 24;
    const mm   = Math.floor((totalH % 1) * 60);
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}`;
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
