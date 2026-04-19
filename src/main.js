import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { BlockType, BlockName, BlockColor, isBlock, isFood, FOOD_DATA } from './Voxel.js';
import { CHUNK_SIZE } from './Chunk.js';
import { getBlockTile } from './TextureAtlas.js';
import { CloudSystem } from './Clouds.js';
import { Inventory, HOTBAR_SIZE, GRID_ROWS } from './Inventory.js';
import { Menu } from './Menu.js';

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

// ── Menu principal ────────────────────────────────────────────────────────────
let gameStarted = false;
const menuOverlay = document.getElementById('menu-overlay');
const menuCanvas  = document.getElementById('menu-canvas');

const menu = new Menu(menuCanvas, (settings) => {
  // Appliquer les paramètres graphiques
  renderer.shadowMap.enabled = settings.shadows;
  if (!settings.fog) scene.fog = null;
  menu.destroy();
  menuOverlay.style.display = 'none';
  renderer.domElement.requestPointerLock();
  gameStarted = true;
});

// ── Pointer lock (reprise après ESC) ─────────────────────────────────────────
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  if (!inventoryOpen) renderer.domElement.requestPointerLock();
});

// ── Personnage 3D (mini-renderer offscreen) ───────────────────────────────────
const charOffscreen = document.createElement('canvas');
charOffscreen.width  = 130;
charOffscreen.height = 190;
const charRenderer = new THREE.WebGLRenderer({ canvas: charOffscreen, alpha: true, antialias: true });
charRenderer.setSize(130, 190);
charRenderer.setClearColor(0x000000, 0);

const charScene = new THREE.Scene();
charScene.add(new THREE.AmbientLight(0xffffff, 0.5));
const charSun = new THREE.DirectionalLight(0xffffff, 1.4);
charSun.position.set(2, 4, 3);
charScene.add(charSun);

const charCam = new THREE.PerspectiveCamera(42, 130 / 190, 0.1, 50);
charCam.position.set(0, 1.6, 5);
charCam.lookAt(0, 1.5, 0);

const charGroup = new THREE.Group();
const _mkM = c => new THREE.MeshLambertMaterial({ color: c });
const _mkP = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _mkM(color));
  m.position.set(x, y, z); return m;
};
charGroup.add(
  _mkP(0.80, 0.80, 0.80, 0xffcc99,  0,     2.70,  0),    // tête
  _mkP(0.85, 0.28, 0.85, 0x3d1f0a,  0,     3.04,  0),    // cheveux
  _mkP(0.15, 0.30, 0.20, 0xffcc99,  0,     2.30, -0.35), // nez
  _mkP(0.90, 1.20, 0.50, 0x2255bb,  0,     1.70,  0),    // corps
  _mkP(0.40, 1.10, 0.40, 0x2255bb, -0.65,  1.75,  0),    // bras gauche
  _mkP(0.40, 1.10, 0.40, 0x2255bb,  0.65,  1.75,  0),    // bras droit
  _mkP(0.42, 1.10, 0.42, 0x334466, -0.23,  0.60,  0),    // jambe gauche
  _mkP(0.42, 1.10, 0.42, 0x334466,  0.23,  0.60,  0),    // jambe droite
  _mkP(0.46, 0.28, 0.52, 0x221100, -0.23,  0.04,  0.04), // pied gauche
  _mkP(0.46, 0.28, 0.52, 0x221100,  0.23,  0.04,  0.04), // pied droit
);
charScene.add(charGroup);

// ── Craft ─────────────────────────────────────────────────────────────────────
const craftSlots = new Array(4).fill(null); // 2×2
let craftOutput  = null;

const RECIPES = [
  { inputs: [5, 5, 5, 5], output: { type: 12, count: 4 } }, // 4 WOOD → 4 PLANKS
  { inputs: [12,12,12,12], output: { type: 5,  count: 1 } }, // 4 PLANKS → 1 WOOD
];

function computeCraft() {
  for (const r of RECIPES) {
    if (r.inputs.every((t, i) => craftSlots[i]?.type === t)) {
      craftOutput = { ...r.output }; return;
    }
  }
  craftOutput = null;
}

function handleCraftSlotClick(idx) {
  if (inventory.held) {
    if (!craftSlots[idx]) {
      craftSlots[idx] = inventory.held; inventory.held = null;
    } else if (craftSlots[idx].type === inventory.held.type && craftSlots[idx].count < 64) {
      craftSlots[idx].count++; inventory.held.count--;
      if (!inventory.held.count) inventory.held = null;
    } else { [craftSlots[idx], inventory.held] = [inventory.held, craftSlots[idx]]; }
  } else if (craftSlots[idx]) {
    inventory.held = craftSlots[idx]; craftSlots[idx] = null;
  }
}

function takeCraftOutput() {
  if (!craftOutput) return;
  inventory.add(craftOutput.type, craftOutput.count);
  updateHUD();
  for (let i = 0; i < 4; i++) {
    if (craftSlots[i]) { craftSlots[i].count--; if (!craftSlots[i].count) craftSlots[i] = null; }
  }
  computeCraft();
}

// ── Bras première personne ────────────────────────────────────────────────────
const armScene  = new THREE.Scene();
const armCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
// Lumière principale (haut-droite) + fill gauche pour donner du volume
armScene.add(new THREE.AmbientLight(0xffffff, 0.40));
const armKeyLight  = new THREE.DirectionalLight(0xfff5e0, 1.3);
armKeyLight.position.set(2, 4, 3);
armScene.add(armKeyLight);
const armFillLight = new THREE.DirectionalLight(0xaac4ff, 0.35);
armFillLight.position.set(-3, 1, 2);
armScene.add(armFillLight);

const armPivot = new THREE.Group();
armScene.add(armPivot);

// Position de repos : coin bas-droit, incliné comme un vrai bras
const armGroup = new THREE.Group();
armGroup.position.set(0.43, -0.60, -0.80);
// Inclinaison naturelle : avant-bras penché vers l'avant et légèrement vers l'intérieur
armGroup.rotation.set(0.28, 0.0, 0.18);
armPivot.add(armGroup);

const _aM = c => new THREE.MeshLambertMaterial({ color: c });

// ① Haut du bras – manche (chemise bleue)
const seg_sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.30, 0.18), _aM(0x1e4fa8));
seg_sleeve.position.set(0, 0.18, 0);
armGroup.add(seg_sleeve);

// ② Revers de manche (bande plus sombre à la coupure)
const seg_cuff = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.055, 0.185), _aM(0x153880));
seg_cuff.position.set(0, 0.015, 0);
armGroup.add(seg_cuff);

// ③ Avant-bras (peau) – légèrement plus fin
const seg_forearm = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.22, 0.155), _aM(0xffbf80));
seg_forearm.position.set(0, -0.145, 0);
armGroup.add(seg_forearm);

// ④ Poignet – transition légèrement aplatie
const seg_wrist = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.065, 0.135), _aM(0xffbf80));
seg_wrist.position.set(0, -0.29, 0.01);
armGroup.add(seg_wrist);

// ⑤ Paume
const seg_palm = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.175, 0.115), _aM(0xffbf80));
seg_palm.position.set(0, -0.395, 0.015);
armGroup.add(seg_palm);

// ⑥ Phalange des doigts (petite bande sombre sous la paume)
const seg_knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.045, 0.115), _aM(0xe8a860));
seg_knuckle.position.set(0, -0.495, 0.015);
armGroup.add(seg_knuckle);

// ⑦ Pouce (incliné sur le côté)
const seg_thumb = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.120, 0.090), _aM(0xffbf80));
seg_thumb.position.set(-0.148, -0.375, 0.012);
seg_thumb.rotation.z = 0.38;
armGroup.add(seg_thumb);

let armSwingT   = 0;
let armSwinging = false;

function triggerArmSwing() { armSwingT = 0; armSwinging = true; }

function updateArm(dt) {
  if (armSwinging) {
    armSwingT += dt * 7.5;
    if (armSwingT >= 1) { armSwingT = 0; armSwinging = false; }
  }
  const swing = armSwinging ? Math.sin(armSwingT * Math.PI) : 0;
  const moving = input.isKeyDown('KeyW') || input.isKeyDown('KeyS') ||
                 input.isKeyDown('KeyA') || input.isKeyDown('KeyD');
  const t    = Date.now() * 0.007;
  const bob  = moving && player.onGround ? Math.sin(t)       * 0.022 : 0;
  const sway = moving && player.onGround ? Math.sin(t * 0.5) * 0.014 : 0;

  // Position de repos + bob de marche
  armGroup.position.set(0.43 + sway, -0.60 + bob, -0.80);
  // Swing : rotation vers l'avant + légère torsion
  armPivot.rotation.x = -swing * 0.85;
  armPivot.rotation.z =  swing * 0.22;
}

// ── Inventaire UI ─────────────────────────────────────────────────────────────
let inventoryOpen = false;
let invMouseX = 0, invMouseY = 0;

const invOverlay = document.getElementById('inv-overlay');
const invCanvas  = document.getElementById('inv-canvas');
const invCtx     = invCanvas.getContext('2d');

// Layout constants
const INV_PAD  = 16;
const SLOT_PX  = 50;
const SLOT_GAP = 4;
const SLOT_STR = SLOT_PX + SLOT_GAP; // 54
const CHAR_W   = 130;                 // width of character preview
// Y zones
const TITLE_H  = 44;
const TOP_H    = 194;  // character+craft area height
const TOP_Y    = TITLE_H;
const GRID_Y   = TOP_Y + TOP_H + 6;
const SEP_Y    = GRID_Y + GRID_ROWS * SLOT_STR;
const HBAR_Y   = SEP_Y + 14;
// Craft grid position (centered in right zone)
const CRAFT_X  = INV_PAD + CHAR_W + 24;  // left of craft 2×2
const CRAFT_Y  = TOP_Y + 24;
const ARROW_X  = CRAFT_X + 2 * SLOT_STR + 6;
const OUT_X    = ARROW_X + 28;
const OUT_Y    = CRAFT_Y + (SLOT_STR - SLOT_PX) / 2; // vertically centered with craft

invCanvas.width  = INV_PAD * 2 + HOTBAR_SIZE * SLOT_STR - SLOT_GAP; // 514
invCanvas.height = HBAR_Y + SLOT_PX + INV_PAD;

// Returns { kind, ... } for the element under (mx, my)
function getClickTarget(mx, my) {
  // Craft 2×2
  for (let ci = 0; ci < 4; ci++) {
    const cx = CRAFT_X + (ci % 2) * SLOT_STR;
    const cy = CRAFT_Y + Math.floor(ci / 2) * SLOT_STR;
    if (mx >= cx && mx < cx + SLOT_PX && my >= cy && my < cy + SLOT_PX)
      return { kind: 'craft', idx: ci };
  }
  // Craft output
  if (mx >= OUT_X && mx < OUT_X + SLOT_PX && my >= OUT_Y && my < OUT_Y + SLOT_PX)
    return { kind: 'craftout' };
  // Grid rows (inventory slots 9-35, uiIdx 0-26)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < HOTBAR_SIZE; col++) {
      const x = INV_PAD + col * SLOT_STR;
      const y = GRID_Y + row * SLOT_STR;
      if (mx >= x && mx < x + SLOT_PX && my >= y && my < y + SLOT_PX)
        return { kind: 'inv', uiIdx: row * HOTBAR_SIZE + col };
    }
  }
  // Hotbar (uiIdx 27-35)
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= HBAR_Y && my < HBAR_Y + SLOT_PX)
      return { kind: 'inv', uiIdx: GRID_ROWS * HOTBAR_SIZE + col };
  }
  return null;
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

  // ── Character preview (left of top zone) ──────────────────────────────────
  const charFrameX = INV_PAD;
  const charFrameY = TOP_Y + 4;
  invCtx.strokeStyle = '#555';
  invCtx.lineWidth = 1;
  invCtx.strokeRect(charFrameX, charFrameY, CHAR_W, TOP_H - 8);
  invCtx.imageSmoothingEnabled = false;
  invCtx.drawImage(charOffscreen, charFrameX + 1, charFrameY + 1, CHAR_W - 2, TOP_H - 10);

  // ── Craft grid label ───────────────────────────────────────────────────────
  invCtx.fillStyle = '#ccc';
  invCtx.font = '11px monospace';
  invCtx.textAlign = 'left';
  invCtx.fillText('CRAFT', CRAFT_X, TOP_Y + 14);

  // ── Craft 2×2 slots ────────────────────────────────────────────────────────
  for (let ci = 0; ci < 4; ci++) {
    const cx = CRAFT_X + (ci % 2) * SLOT_STR;
    const cy = CRAFT_Y + Math.floor(ci / 2) * SLOT_STR;
    drawInvSlot(invCtx, cx, cy, craftSlots[ci], false, false);
  }

  // ── Arrow → ───────────────────────────────────────────────────────────────
  invCtx.fillStyle = '#aaa';
  invCtx.font = 'bold 20px monospace';
  invCtx.textAlign = 'center';
  invCtx.fillText('→', ARROW_X + 14, CRAFT_Y + SLOT_STR - 4);

  // ── Craft output slot ──────────────────────────────────────────────────────
  drawInvSlot(invCtx, OUT_X, OUT_Y, craftOutput, false, false);

  // ── Separator ──────────────────────────────────────────────────────────────
  invCtx.strokeStyle = '#666';
  invCtx.lineWidth = 1;
  invCtx.beginPath();
  invCtx.moveTo(INV_PAD, SEP_Y + 7);
  invCtx.lineTo(W - INV_PAD, SEP_Y + 7);
  invCtx.stroke();

  // ── Grid rows (slots 9-35, uiIdx 0-26) ────────────────────────────────────
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < HOTBAR_SIZE; col++) {
      const x = INV_PAD + col * SLOT_STR;
      const y = GRID_Y + row * SLOT_STR;
      const invIdx = HOTBAR_SIZE + row * HOTBAR_SIZE + col;
      drawInvSlot(invCtx, x, y, inventory.slots[invIdx], false, false);
    }
  }

  // ── Hotbar (slots 0-8) ────────────────────────────────────────────────────
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR;
    drawInvSlot(invCtx, x, HBAR_Y, inventory.slots[col], col === inventory.selected, false);
  }

  // ── Held item follows cursor ───────────────────────────────────────────────
  if (inventory.held) {
    drawInvSlot(invCtx, invMouseX - SLOT_PX / 2, invMouseY - SLOT_PX / 2, inventory.held, false, true);
  }
}

invCanvas.addEventListener('mousemove', e => {
  const r = invCanvas.getBoundingClientRect();
  invMouseX = e.clientX - r.left;
  invMouseY = e.clientY - r.top;
  if (inventoryOpen) drawInventoryUI();
});

invCanvas.addEventListener('click', e => {
  const r  = invCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const t  = getClickTarget(mx, my);
  if (!t) return;
  if      (t.kind === 'craft')    { handleCraftSlotClick(t.idx); computeCraft(); }
  else if (t.kind === 'craftout') { takeCraftOutput(); }
  else if (t.kind === 'inv')      { inventory.clickSlot(t.uiIdx); }
  drawInventoryUI();
});

invCanvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r  = invCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const t  = getClickTarget(mx, my);
  if (!t) return;
  if      (t.kind === 'craft')    { handleCraftSlotClick(t.idx); computeCraft(); }
  else if (t.kind === 'craftout') { takeCraftOutput(); }
  else if (t.kind === 'inv')      { inventory.rightClickSlot(t.uiIdx); }
  drawInventoryUI();
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
  // Return craft items to inventory
  for (let i = 0; i < 4; i++) {
    if (craftSlots[i]) { inventory.add(craftSlots[i].type, craftSlots[i].count); craftSlots[i] = null; }
  }
  craftOutput = null;
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

  // Touches &é"'(-è_ç → slots hotbar 1-9 (Digit1..Digit9)
  const digitMatch = e.code.match(/^Digit([1-9])$/);
  if (digitMatch && !inventoryOpen) {
    inventory.selected = parseInt(digitMatch[1]) - 1;
    updateHUD();
  }
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

// ── Minimap ───────────────────────────────────────────────────────────────────
const minimapCanvas = document.getElementById('minimap');
const minimapCtx    = minimapCanvas.getContext('2d');
const MM_SIZE   = 160;
const MM_RADIUS = 40; // blocs de chaque côté
minimapCanvas.width = minimapCanvas.height = MM_SIZE;

// Offscreen pour les tuiles monde (ne se rebuilde que quand le joueur bouge d'un bloc)
const mmOff    = document.createElement('canvas');
mmOff.width    = mmOff.height = MM_SIZE;
const mmOffCtx = mmOff.getContext('2d');
let _mmPX = null, _mmPZ = null;

function _rebuildMinimapTiles() {
  const px = Math.floor(player.position.x);
  const pz = Math.floor(player.position.z);
  if (px === _mmPX && pz === _mmPZ) return;
  _mmPX = px; _mmPZ = pz;

  const img  = mmOffCtx.createImageData(MM_SIZE, MM_SIZE);
  const d    = img.data;
  const sc   = MM_SIZE / (MM_RADIUS * 2); // px par bloc = 2

  // Blocs ignorés sur la minimap (arbres, déco) — on veut voir le sol
  const MM_SKIP = new Set([
    BlockType.LEAVES, BlockType.WOOD, BlockType.TALL_GRASS,
    BlockType.FLOWER_RED, BlockType.FLOWER_YEL, BlockType.CACTUS,
  ]);

  for (let dz = -MM_RADIUS; dz < MM_RADIUS; dz++) {
    for (let dx = -MM_RADIUS; dx < MM_RADIUS; dx++) {
      let type = BlockType.AIR, topY = 0;
      for (let y = 63; y >= 0; y--) {
        const t = world.getVoxelWorld(px + dx, y, pz + dz);
        if (t !== BlockType.AIR && !MM_SKIP.has(t)) { type = t; topY = y; break; }
      }
      const col   = BlockColor[type] ?? 0x111111;
      const shade = type === BlockType.AIR ? 0.08 : 0.52 + (topY / 63) * 0.48;
      const r = ((col >> 16) & 0xff) * shade;
      const g = ((col >>  8) & 0xff) * shade;
      const b = ( col        & 0xff) * shade;

      const cx = Math.floor((dx + MM_RADIUS) * sc);
      const cz = Math.floor((dz + MM_RADIUS) * sc);
      const sp = Math.ceil(sc);
      for (let sy = 0; sy < sp; sy++)
        for (let sx = 0; sx < sp; sx++) {
          const i = ((cz + sy) * MM_SIZE + cx + sx) * 4;
          d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
        }
    }
  }
  mmOffCtx.putImageData(img, 0, 0);
}

// ── Flash de dégâts ───────────────────────────────────────────────────────────
const damageFlashEl = document.getElementById('damage-flash');

function updateDamageFlash() {
  const age   = (performance.now() - player._damagedAt) / 1000;
  const alpha = Math.max(0, 0.45 - age * 1.8);
  damageFlashEl.style.background = `rgba(200,0,0,${alpha})`;
}

function drawMinimap() {
  _rebuildMinimapTiles();
  minimapCtx.clearRect(0, 0, MM_SIZE, MM_SIZE);

  // ── Contenu clipé en cercle ──────────────────────────────────────────────
  minimapCtx.save();
  minimapCtx.beginPath();
  minimapCtx.arc(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE / 2, 0, Math.PI * 2);
  minimapCtx.clip();
  minimapCtx.drawImage(mmOff, 0, 0);

  // Flèche joueur
  const cx = MM_SIZE / 2, cy = MM_SIZE / 2;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  minimapCtx.beginPath();
  minimapCtx.moveTo(cx + fx * 11,    cy + fz * 11);
  minimapCtx.lineTo(cx + (-fz) * 5,  cy + fx * 5);
  minimapCtx.lineTo(cx - (-fz) * 5,  cy - fx * 5);
  minimapCtx.closePath();
  minimapCtx.fillStyle = '#fff'; minimapCtx.fill();
  minimapCtx.strokeStyle = '#000'; minimapCtx.lineWidth = 1; minimapCtx.stroke();
  minimapCtx.restore();

  // ── Bordure ───────────────────────────────────────────────────────────────
  minimapCtx.beginPath();
  minimapCtx.arc(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE / 2 - 1, 0, Math.PI * 2);
  minimapCtx.strokeStyle = 'rgba(255,255,255,0.45)';
  minimapCtx.lineWidth = 2; minimapCtx.stroke();

  // ── Boussole N/S/E/W ──────────────────────────────────────────────────────
  const R = MM_SIZE / 2 + 11;
  const dirs = [
    { label: 'N', ax: 0,  az: -1 },
    { label: 'S', ax: 0,  az:  1 },
    { label: 'E', ax: 1,  az:  0 },
    { label: 'O', ax: -1, az:  0 },
  ];
  minimapCtx.font = 'bold 10px monospace';
  minimapCtx.textAlign = 'center';
  minimapCtx.textBaseline = 'middle';
  for (const { label, ax, az } of dirs) {
    const lx = MM_SIZE / 2 + ax * R, ly = MM_SIZE / 2 + az * R;
    minimapCtx.fillStyle = label === 'N' ? '#ff4444' : '#ffffff';
    minimapCtx.fillText(label, lx, ly);
  }
  minimapCtx.textBaseline = 'alphabetic';
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

  if (input.isLocked && !inventoryOpen && gameStarted) {
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
        triggerArmSwing();
        updateHUD();
      } else if (input.consumeMouseButton(2)) {
        if (sel && isFood(sel.type)) {
          // Manger la nourriture
          player.eat(FOOD_DATA[sel.type].restore);
          inventory.consume(inventory.selected, 1);
          interactCooldown = 0.15;
          triggerArmSwing();
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
            triggerArmSwing();
            updateHUD();
          }
        }
      }
    }

    updateArm(dt);
    drawMinimap();
    updateDamageFlash();
    // Update bars chaque frame (santé/faim peuvent changer)
    drawBars();

    const p = player.position;
    const totalH = timeOfDay * 24;
    const hh = Math.floor(totalH) % 24;
    const mm = Math.floor((totalH % 1) * 60);
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}`;
  } else if (!inventoryOpen && gameStarted) {
    overlay.style.display = 'flex';
  }

  if (inventoryOpen) {
    charGroup.rotation.y += dt * 0.8;
    charRenderer.render(charScene, charCam);
    drawInventoryUI();
  }

  renderer.render(scene, camera);

  if (!inventoryOpen && input.isLocked) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(armScene, armCamera);
    renderer.autoClear = true;
  }
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
  armCamera.aspect = window.innerWidth / window.innerHeight;
  armCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
