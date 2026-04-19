import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { BlockType, BlockName, isBlock, isFood, FOOD_DATA } from './Voxel.js';
import { CHUNK_SIZE } from './Chunk.js';
import { getBlockTile } from './TextureAtlas.js';
import { CloudSystem } from './Clouds.js';
import { Inventory, HOTBAR_SIZE, GRID_ROWS } from './Inventory.js';

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
const input     = new InputHandler();
const world     = new World(scene, 42);
const player    = new Player(camera, world, input);
const clouds    = new CloudSystem(scene);
const inventory = new Inventory();

// Inventaire de départ
inventory.slots[0] = { type: BlockType.GRASS,  count: 32 };
inventory.slots[1] = { type: BlockType.DIRT,   count: 32 };
inventory.slots[2] = { type: BlockType.STONE,  count: 32 };
inventory.slots[3] = { type: BlockType.SAND,   count: 16 };
inventory.slots[4] = { type: BlockType.WOOD,   count: 16 };
inventory.slots[5] = { type: BlockType.LEAVES, count: 16 };
inventory.slots[6] = { type: 100, count: 5 }; // APPLE
inventory.slots[7] = { type: 101, count: 3 }; // BREAD

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
overlay.addEventListener('click', () => {
  if (!inventoryOpen) renderer.domElement.requestPointerLock();
});

// ── Inventaire UI ─────────────────────────────────────────────────────────────
let inventoryOpen = false;
let invMouseX = 0, invMouseY = 0;

const invOverlay  = document.getElementById('inv-overlay');
const invCanvas   = document.getElementById('inv-canvas');
const invCtx      = invCanvas.getContext('2d');

const SLOT_PX   = 50;
const SLOT_GAP  = 4;
const SLOT_STR  = SLOT_PX + SLOT_GAP;
const INV_PAD   = 16;
const TITLE_H   = 36;
const SEP_H     = 20;
const GRID_H    = GRID_ROWS * SLOT_STR;   // 3 * 54 = 162
const HOTBAR_H  = SLOT_PX;

invCanvas.width  = INV_PAD * 2 + HOTBAR_SIZE * SLOT_STR - SLOT_GAP;
invCanvas.height = INV_PAD * 2 + TITLE_H + GRID_H + SEP_H + HOTBAR_H;

function slotXY(col, rowType) {
  // rowType: 0-2 = grid row, 'h' = hotbar
  const x = INV_PAD + col * SLOT_STR;
  const y = rowType === 'h'
    ? INV_PAD + TITLE_H + GRID_H + SEP_H
    : INV_PAD + TITLE_H + rowType * SLOT_STR;
  return [x, y];
}

function getUiSlotAt(mx, my) {
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const [x, y] = slotXY(col, row);
      if (mx >= x && mx < x + SLOT_PX && my >= y && my < y + SLOT_PX)
        return row * HOTBAR_SIZE + col; // 0-26
    }
    const [hx, hy] = slotXY(col, 'h');
    if (mx >= hx && mx < hx + SLOT_PX && my >= hy && my < hy + SLOT_PX)
      return GRID_ROWS * HOTBAR_SIZE + col; // 27-35
  }
  return -1;
}

function drawInvSlot(ctx, x, y, item, highlighted, held) {
  ctx.fillStyle = highlighted ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.65)';
  ctx.fillRect(x, y, SLOT_PX, SLOT_PX);
  ctx.strokeStyle = highlighted ? '#fff' : '#555';
  ctx.lineWidth   = highlighted ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, SLOT_PX - 1, SLOT_PX - 1);

  if (item) {
    const atlas = world.atlas.image;
    const T = 16, COLS = 16;
    const tileId = getBlockTile(item.type, 2);
    const tc = tileId % COLS, tr = Math.floor(tileId / COLS);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, tc*T, tr*T, T, T, x+5, y+5, SLOT_PX-10, SLOT_PX-10);

    if (item.count > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(item.count, x + SLOT_PX - 3, y + SLOT_PX - 3);
    }
  }
}

function drawInventoryUI() {
  const W = invCanvas.width, H = invCanvas.height;
  invCtx.clearRect(0, 0, W, H);

  // Panel background
  invCtx.fillStyle = 'rgba(30,30,30,0.92)';
  invCtx.fillRect(0, 0, W, H);

  // Title
  invCtx.fillStyle = '#fff';
  invCtx.font = 'bold 16px monospace';
  invCtx.textAlign = 'center';
  invCtx.fillText('INVENTAIRE', W / 2, INV_PAD + 20);

  // Grid rows (slots 9-35 in inventory, displayed as rows 0-2)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < HOTBAR_SIZE; col++) {
      const [x, y] = slotXY(col, row);
      const invIdx = HOTBAR_SIZE + row * HOTBAR_SIZE + col; // slots[9..35]
      drawInvSlot(invCtx, x, y, inventory.slots[invIdx], false, false);
    }
  }

  // Separator
  invCtx.strokeStyle = '#888';
  invCtx.lineWidth = 1;
  const sepY = INV_PAD + TITLE_H + GRID_H + SEP_H / 2;
  invCtx.beginPath();
  invCtx.moveTo(INV_PAD, sepY);
  invCtx.lineTo(W - INV_PAD, sepY);
  invCtx.stroke();

  // Hotbar (slots 0-8)
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const [x, y] = slotXY(col, 'h');
    drawInvSlot(invCtx, x, y, inventory.slots[col], col === inventory.selected, false);
  }

  // Held item follows cursor
  if (inventory.held) {
    drawInvSlot(invCtx, invMouseX - SLOT_PX/2, invMouseY - SLOT_PX/2, inventory.held, false, true);
  }
}

invCanvas.addEventListener('mousemove', e => {
  const r = invCanvas.getBoundingClientRect();
  invMouseX = e.clientX - r.left;
  invMouseY = e.clientY - r.top;
  if (inventoryOpen) drawInventoryUI();
});

invCanvas.addEventListener('click', e => {
  const r    = invCanvas.getBoundingClientRect();
  const mx   = e.clientX - r.left;
  const my   = e.clientY - r.top;
  const ui   = getUiSlotAt(mx, my);
  if (ui !== -1) { inventory.clickSlot(ui); drawInventoryUI(); }
});

invCanvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r  = invCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const ui = getUiSlotAt(mx, my);
  if (ui !== -1) { inventory.rightClickSlot(ui); drawInventoryUI(); }
});

invOverlay.addEventListener('click', e => {
  if (e.target === invOverlay) closeInventory();
});

function openInventory() {
  inventoryOpen = true;
  inventory.dropHeld();
  invOverlay.style.display = 'flex';
  drawInventoryUI();
  document.exitPointerLock();
}

function closeInventory() {
  inventory.dropHeld();
  inventoryOpen = false;
  invOverlay.style.display = 'none';
  renderer.domElement.requestPointerLock();
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyE') {
    if (inventoryOpen) closeInventory();
    else if (input.isLocked) openInventory();
  }
  if (e.code === 'Escape' && inventoryOpen) closeInventory();
});

// ── Hotbar canvas ─────────────────────────────────────────────────────────────
const hotbarCanvas = document.getElementById('hotbar');
const hCtx         = hotbarCanvas.getContext('2d');
const HSLOT  = 52;
hotbarCanvas.width  = HSLOT * HOTBAR_SIZE + 4;
hotbarCanvas.height = HSLOT + 4;

function drawHotbar() {
  const atlas = world.atlas.image;
  const T = 16, COLS = 16;
  hCtx.imageSmoothingEnabled = false;
  hCtx.clearRect(0, 0, hotbarCanvas.width, hotbarCanvas.height);

  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const bx   = i * HSLOT + 2;
    const by   = 2;
    const item = inventory.slots[i];
    const sel  = i === inventory.selected;

    hCtx.fillStyle = sel ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.60)';
    hCtx.fillRect(bx, by, HSLOT, HSLOT);

    if (item) {
      const tileId = getBlockTile(item.type, 2);
      const tc = tileId % COLS, tr = Math.floor(tileId / COLS);
      hCtx.drawImage(atlas, tc*T, tr*T, T, T, bx+6, by+6, HSLOT-12, HSLOT-12);
      if (item.count > 1) {
        hCtx.fillStyle = '#fff';
        hCtx.font = 'bold 10px monospace';
        hCtx.textAlign = 'right';
        hCtx.fillText(item.count, bx + HSLOT - 4, by + HSLOT - 4);
      }
    }

    hCtx.strokeStyle = sel ? '#ffffff' : '#555555';
    hCtx.lineWidth   = sel ? 2.5 : 1;
    hCtx.strokeRect(bx + 0.5, by + 0.5, HSLOT - 1, HSLOT - 1);
  }
}

// ── Barres santé / faim ───────────────────────────────────────────────────────
const barsCanvas = document.getElementById('bars');
const bCtx       = barsCanvas.getContext('2d');
const ICONS      = 10;
const ICON_PX    = 3;  // scale of pixel grid
const ICON_W     = 5 * ICON_PX;
const ICON_GAP   = 3;
const ICON_STR   = ICON_W + ICON_GAP;
barsCanvas.width  = ICONS * ICON_STR - ICON_GAP + 2;
barsCanvas.height = ICON_W * 2 + 6;

const HEART_GRID = [
  [0,1,0,1,0],
  [1,1,1,1,1],
  [1,1,1,1,1],
  [0,1,1,1,0],
  [0,0,1,0,0],
];
const FOOD_GRID = [
  [0,0,1,1,0],
  [0,1,1,1,1],
  [1,1,1,1,0],
  [0,1,1,0,0],
  [0,0,1,0,0],
];

function drawPixelIcon(ctx, grid, x, y, color, dimColor) {
  for (let py = 0; py < grid.length; py++) {
    for (let px = 0; px < grid[py].length; px++) {
      if (grid[py][px]) {
        ctx.fillStyle = color;
        ctx.fillRect(x + px * ICON_PX, y + py * ICON_PX, ICON_PX, ICON_PX);
      }
    }
  }
}

function drawBars() {
  bCtx.clearRect(0, 0, barsCanvas.width, barsCanvas.height);
  const hp = player.health, mhp = player.maxHealth;
  const hu = player.hunger, mhu = player.maxHunger;

  for (let i = 0; i < ICONS; i++) {
    const x = i * ICON_STR;
    // Heart: each icon = 2 HP
    const hpFull = hp >= (i + 1) * 2;
    const hpHalf = !hpFull && hp >= i * 2 + 1;
    const hColor = hpFull ? '#e0342f' : hpHalf ? '#e07070' : '#3a0a0a';
    drawPixelIcon(bCtx, HEART_GRID, x, 0, hColor, '#3a0a0a');

    // Food: each icon = 2 hunger
    const huFull = hu >= (i + 1) * 2;
    const huHalf = !huFull && hu >= i * 2 + 1;
    const fColor = huFull ? '#d4831a' : huHalf ? '#d4a870' : '#2a1a00';
    drawPixelIcon(bCtx, FOOD_GRID, x, ICON_W + 6, fColor, '#2a1a00');
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
const hudEl   = document.getElementById('hud');
const debugEl = document.getElementById('debug');

function updateHUD() {
  const item = inventory.getSelected();
  hudEl.textContent = item ? (BlockName[item.type] ?? '?') : '—';
  drawHotbar();
  drawBars();
}
updateHUD();

document.addEventListener('wheel', e => {
  inventory.scroll(e.deltaY > 0 ? 1 : -1);
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
    skyColor.copy(C_SKY_DAY); ambient.color.copy(C_AMB_DAY);
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
    skyColor.copy(C_SKY_NIGHT); ambient.color.copy(C_AMB_NIGHT);
  }
  scene.fog.color.copy(skyColor);

  sun.target.position.copy(player.position); sun.target.updateMatrixWorld();
  moon.target.position.copy(player.position); moon.target.updateMatrixWorld();

  _sunDir.set(sx, sy, 60).normalize();
  sunDisc.position.copy(camera.position).addScaledVector(_sunDir, 180);
  sunDisc.lookAt(camera.position);
  sunDisc.visible = sunH > -0.15;
  sunDisc.material.color.setHSL(sunH > 0.2 ? 0.14 : 0.07, 1.0, 0.68 + dayF * 0.25);

  _moonDir.set(-sx, -sy, 60).normalize();
  moonDisc.position.copy(camera.position).addScaledVector(_moonDir, 180);
  moonDisc.lookAt(camera.position);
  moonDisc.visible = sunH < 0.15;

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

  if (input.isLocked && !inventoryOpen) {
    overlay.style.display = 'none';

    player.update(dt);
    world.update(player.position);
    clouds.update(player.position.x, player.position.z, dt);
    updateDayNight(dt);

    interactCooldown -= dt;
    const hit = world.raycast(camera.position, player.getCameraDirection());

    if (hit) {
      selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      selectionBox.visible = true;
    } else {
      selectionBox.visible = false;
    }

    if (interactCooldown <= 0 && hit) {
      const sel = inventory.getSelected();

      if (input.consumeMouseButton(0)) {
        // Casser bloc → ajouter à l'inventaire
        const broken = world.getVoxelWorld(hit.x, hit.y, hit.z);
        world.setVoxelWorld(hit.x, hit.y, hit.z, BlockType.AIR);
        if (broken !== BlockType.AIR) inventory.add(broken);
        rebuildAround(hit.x, hit.z);
        interactCooldown = 0.15;
        updateHUD();
      } else if (input.consumeMouseButton(2)) {
        if (sel && isFood(sel.type)) {
          // Manger la nourriture
          player.eat(FOOD_DATA[sel.type].restore);
          inventory.consume(inventory.selected, 1);
          interactCooldown = 0.15;
          updateHUD();
        } else if (sel && isBlock(sel.type)) {
          // Poser un bloc
          const px = hit.x + hit.face[0];
          const py = hit.y + hit.face[1];
          const pz = hit.z + hit.face[2];
          if (!collidesWithPlayer(px, py, pz)) {
            world.setVoxelWorld(px, py, pz, sel.type);
            inventory.consume(inventory.selected, 1);
            rebuildAround(px, pz);
            interactCooldown = 0.15;
            updateHUD();
          }
        }
      }
    }

    // Update bars chaque frame (santé/faim peuvent changer)
    drawBars();

    const p = player.position;
    const totalH = timeOfDay * 24;
    const hh = Math.floor(totalH) % 24;
    const mm = Math.floor((totalH % 1) * 60);
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}`;
  } else if (!inventoryOpen) {
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
