import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { BlockType, ItemType, BlockName, BlockColor, isBlock, isFood, isWeapon, isArmor, FOOD_DATA, BLOCK_DROPS, WEAPON_DATA, ARMOR_DATA } from './Voxel.js';
import { MobManager } from './Mobs.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { getBlockTile } from './TextureAtlas.js';
import { CloudSystem } from './Clouds.js';
import { Inventory, HOTBAR_SIZE, GRID_ROWS } from './Inventory.js';
import { Menu } from './Menu.js';

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.BasicShadowMap;
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
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.near   = 0.5;
sun.shadow.camera.far    = 80;
sun.shadow.camera.left   = sun.shadow.camera.bottom = -32;
sun.shadow.camera.right  = sun.shadow.camera.top    =  32;
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

// Inventaire de départ (hotbar + grid)
inventory.slots[0] = { type: BlockType.GRASS,             count: 32 };
inventory.slots[1] = { type: BlockType.STONE,             count: 32 };
inventory.slots[2] = { type: BlockType.COBBLESTONE,       count: 32 };
inventory.slots[3] = { type: BlockType.PLANKS,            count: 32 };
inventory.slots[4] = { type: BlockType.GLASS,             count: 16 };
inventory.slots[5] = { type: BlockType.BRICK,             count: 16 };
inventory.slots[6] = { type: BlockType.GLOWSTONE,         count: 8  };
inventory.slots[7] = { type: BlockType.CRAFTING_TABLE,    count: 2  };
inventory.slots[8] = { type: BlockType.TNT,               count: 4  };
// Grid
inventory.slots[9]  = { type: BlockType.CHEST,            count: 4  };
inventory.slots[10] = { type: BlockType.BOOKSHELF,        count: 8  };
inventory.slots[11] = { type: BlockType.FURNACE,          count: 2  };
inventory.slots[12] = { type: BlockType.OBSIDIAN,         count: 8  };
inventory.slots[13] = { type: BlockType.WOOD,             count: 32 };
inventory.slots[14] = { type: BlockType.DIRT,             count: 32 };
inventory.slots[15] = { type: ItemType.APPLE,             count: 10 };
inventory.slots[16] = { type: ItemType.BREAD,             count: 5  };
inventory.slots[17] = { type: ItemType.COAL,              count: 16 };
inventory.slots[18] = { type: ItemType.IRON_INGOT,        count: 8  };
inventory.slots[19] = { type: ItemType.DIAMOND,           count: 3  };
inventory.slots[20] = { type: ItemType.STICK,             count: 16 };
inventory.slots[21] = { type: ItemType.SWORD_IRON,        count: 1  };
inventory.slots[22] = { type: ItemType.PICK_STONE,        count: 1  };
inventory.slots[23] = { type: ItemType.CHEST_IRON,        count: 1  };

// ── Temps de cassage par type de bloc (secondes) ─────────────────────────────
const BREAK_TIME = new Map([
  [BlockType.OBSIDIAN,      15.0],
  [BlockType.DIAMOND_ORE,    5.0],
  [BlockType.IRON_ORE,       4.0],
  [BlockType.GOLD_ORE,       4.0],
  [BlockType.COAL_ORE,       3.0],
  [BlockType.STONE,          3.0],
  [BlockType.COBBLESTONE,    3.0],
  [BlockType.GRAVEL,         1.5],
  [BlockType.SAND,           1.0],
  [BlockType.WOOD,           2.5],
  [BlockType.PLANKS,         2.0],
  [BlockType.BOOKSHELF,      2.5],
  [BlockType.LEAVES,         0.4],
  [BlockType.GLASS,          0.5],
  [BlockType.HAY_BALE,       1.5],
  [BlockType.CLAY,           1.2],
  [BlockType.BRICK,          3.5],
]);
function getBreakTime(type) { return BREAK_TIME.get(type) ?? 0.9; }

// État de cassage en cours
let breakTarget   = null; // { x, y, z }
let breakProgress = 0;
let lmbWasDown    = false;

// ── Aperçu fantôme du bloc à poser ───────────────────────────────────────────
const ghostMat  = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.28,
  depthTest: true, depthWrite: false,
});
const ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), ghostMat);
ghostMesh.visible = false;
scene.add(ghostMesh);

// ── Mobs ──────────────────────────────────────────────────────────────────────
const mobManager = new MobManager(scene, world);

// ── Suivi des modifications monde (pour sauvegarde) ──────────────────────────
const worldChanges        = new Map(); // 'x,y,z' → BlockType
const pendingWorldChanges = [];        // changes to replay when chunk loads

function setWorldVoxel(x, y, z, type) {
  worldChanges.set(`${x},${y},${z}`, type);
  world.setVoxelWorld(x, y, z, type);
}

function applyPendingWorldChanges() {
  if (!pendingWorldChanges.length) return;
  const still = [];
  for (const { x, y, z, type } of pendingWorldChanges) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (world.getChunk(cx, cz)) {
      world.setVoxelWorld(x, y, z, type);
      rebuildAround(x, z);
    } else {
      still.push({ x, y, z, type });
    }
  }
  pendingWorldChanges.length = 0;
  pendingWorldChanges.push(...still);
}

// ── Armure équipée ─────────────────────────────────────────────────────────────
const equipment = { helmet: null, chest: null, legs: null, boots: null };
const ARMOR_SLOT_MAP = {
  [ItemType.HELMET_IRON]: 'helmet', [ItemType.HELMET_DIA]: 'helmet',
  [ItemType.CHEST_IRON]:  'chest',  [ItemType.CHEST_DIA]:  'chest',
  [ItemType.LEGS_IRON]:   'legs',   [ItemType.LEGS_DIA]:   'legs',
  [ItemType.BOOTS_IRON]:  'boots',  [ItemType.BOOTS_DIA]:  'boots',
};
const EQUIP_KEYS   = ['helmet', 'chest', 'legs', 'boots'];
const EQUIP_LABELS = ['Casque', 'Plastron', 'Jambières', 'Bottes'];

function getArmorPoints() {
  return EQUIP_KEYS.reduce((s, k) => s + (equipment[k] ? (ARMOR_DATA[equipment[k].type]?.defense ?? 0) : 0), 0);
}

// ── Particules de cassage ─────────────────────────────────────────────────────
const PARTICLE_MAX  = 200;
const _pGeo  = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const _pMat  = new THREE.MeshBasicMaterial();
const particleMesh = new THREE.InstancedMesh(_pGeo, _pMat, PARTICLE_MAX);
particleMesh.frustumCulled = false;
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
{ const tmp = new THREE.Color(1, 1, 1); for (let i = 0; i < PARTICLE_MAX; i++) particleMesh.setColorAt(i, tmp); }
scene.add(particleMesh);
const _pDummy = new THREE.Object3D();
const _pZero  = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < PARTICLE_MAX; i++) particleMesh.setMatrixAt(i, _pZero);
particleMesh.instanceMatrix.needsUpdate = true;
let particles = [];
const _pColor = new THREE.Color();

function spawnParticles(wx, wy, wz, hexColor) {
  const c = new THREE.Color(hexColor ?? 0x888888);
  for (let i = 0; i < 8; i++) {
    if (particles.length >= PARTICLE_MAX) break;
    particles.push({
      x: wx + 0.5 + (Math.random() - 0.5) * 0.7,
      y: wy + 0.5 + (Math.random() - 0.5) * 0.7,
      z: wz + 0.5 + (Math.random() - 0.5) * 0.7,
      vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4 + 1.5, vz: (Math.random() - 0.5) * 6,
      life: 0.5 + Math.random() * 0.4, age: 0,
      r: c.r, g: c.g, b: c.b,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => p.age < p.life);
  const lim = Math.min(particles.length, PARTICLE_MAX);
  for (let i = 0; i < lim; i++) {
    const p = particles[i];
    p.age += dt; p.vy -= 22 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const s = Math.max(0, 1 - p.age / p.life) * 0.12;
    _pDummy.position.set(p.x, p.y, p.z);
    _pDummy.scale.setScalar(s);
    _pDummy.updateMatrix();
    particleMesh.setMatrixAt(i, _pDummy.matrix);
    particleMesh.setColorAt(i, _pColor.setRGB(p.r, p.g, p.b));
  }
  for (let i = lim; i < PARTICLE_MAX; i++) particleMesh.setMatrixAt(i, _pZero);
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}

// ── Système de four ────────────────────────────────────────────────────────────
const furnaces = new Map(); // 'x,y,z' → { fuel, input, output, progress, burnTime, burnMax }

const SMELT_RECIPES = new Map([
  [BlockType.IRON_ORE,    { type: ItemType.IRON_INGOT,  count: 1 }],
  [BlockType.GOLD_ORE,    { type: ItemType.GOLD_INGOT,  count: 1 }],
  [BlockType.COAL_ORE,    { type: ItemType.COAL,         count: 1 }],
  [BlockType.SAND,        { type: BlockType.GLASS,       count: 1 }],
  [BlockType.COBBLESTONE, { type: BlockType.STONE,       count: 1 }],
  [BlockType.CLAY,        { type: BlockType.BRICK,       count: 1 }],
  [ItemType.RAW_BEEF,     { type: ItemType.COOKED_BEEF,  count: 1 }],
  [BlockType.WOOD,        { type: ItemType.CHARCOAL,     count: 1 }],
]);

const FUEL_BURN_TIME = new Map([
  [BlockType.WOOD, 15], [BlockType.PLANKS, 15], [BlockType.BOOKSHELF, 15],
  [ItemType.COAL, 80], [ItemType.CHARCOAL, 80], [ItemType.STICK, 5],
]);

function getFurnaceState(key) {
  if (!furnaces.has(key)) furnaces.set(key, { fuel: null, input: null, output: null, progress: 0, burnTime: 0, burnMax: 1 });
  return furnaces.get(key);
}

function updateFurnaces(dt) {
  for (const [, f] of furnaces) {
    const recipe = f.input ? SMELT_RECIPES.get(f.input.type) : null;
    if (f.burnTime <= 0 && recipe && f.fuel) {
      const bt = FUEL_BURN_TIME.get(f.fuel.type);
      if (bt) { f.burnMax = bt; f.burnTime = bt; f.fuel.count--; if (!f.fuel.count) f.fuel = null; }
    }
    if (f.burnTime > 0) {
      f.burnTime = Math.max(0, f.burnTime - dt);
      if (recipe) {
        f.progress = Math.min(1, f.progress + dt / 10);
        if (f.progress >= 1) {
          f.progress = 0;
          const canOut = !f.output || (f.output.type === recipe.type && f.output.count < 64);
          if (canOut) {
            if (!f.output) f.output = { type: recipe.type, count: 0 };
            f.output.count++;
            f.input.count--;
            if (!f.input.count) f.input = null;
          }
        }
      } else {
        f.progress = Math.max(0, f.progress - dt / 5);
      }
    } else {
      f.progress = Math.max(0, f.progress - dt / 5);
    }
  }
}

// ── Stockage des coffres ───────────────────────────────────────────────────────
const chests = new Map(); // 'x,y,z' → Array(27)

function getChestItems(key) {
  if (!chests.has(key)) chests.set(key, new Array(27).fill(null));
  return chests.get(key);
}

// ── Références HUD supplémentaires ───────────────────────────────────────────
const breakBarEl   = document.getElementById('break-bar');
const breakBarFill = document.getElementById('break-bar-fill');
const waterOverlay = document.getElementById('water-overlay');

// ── Plan d'eau (niveau de mer y=12.9) ────────────────────────────────────────
const waterMat  = new THREE.MeshLambertMaterial({ color: 0x2a6fcf, transparent: true, opacity: 0.72 });
const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1024, 1024), waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.y = 12.9;
waterMesh.renderOrder = 1;
scene.add(waterMesh);

// ── Spawn au sol ──────────────────────────────────────────────────────────────
world.update(player.position);
const SPAWN_X = Math.round(player.position.x);
const SPAWN_Z = Math.round(player.position.z);
for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
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
  renderer.shadowMap.enabled = settings.shadows;
  world.renderDist = settings.renderDistance;
  if (!settings.fog) scene.fog = null;
  menu.destroy();
  menuOverlay.style.display = 'none';
  gameStarted = true;

  // Charger la sauvegarde si elle existe
  if (loadGame()) {
    updateHUD();
    showNotification('Sauvegarde chargée');
  }

  renderer.domElement.requestPointerLock();
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

const W = BlockType.WOOD, P = BlockType.PLANKS, CB = BlockType.COBBLESTONE;
const IT = ItemType;
// null = slot must be empty
const RECIPES = [
  // Basic blocks
  { inputs: [W,  W,  W,  W ], output: { type: P,             count: 4  } }, // 4 WOOD → 4 PLANKS
  { inputs: [P,  P,  P,  P ], output: { type: W,             count: 1  } }, // 4 PLANKS → 1 WOOD
  // Crafting materials
  { inputs: [P,  null, P,  null], output: { type: IT.STICK,      count: 4  } }, // planks col → sticks
  { inputs: [CB, null, CB, null], output: { type: IT.STICK,      count: 2  } }, // cobble col → sticks (bonus)
  // Swords (top material x2 + bottom stick)
  { inputs: [P,  null, IT.STICK, null], output: { type: IT.SWORD_WOOD,  count: 1 } },
  { inputs: [CB, null, IT.STICK, null], output: { type: IT.SWORD_STONE, count: 1 } },
  { inputs: [IT.IRON_INGOT, null, IT.STICK, null], output: { type: IT.SWORD_IRON, count: 1 } },
  { inputs: [IT.DIAMOND,    null, IT.STICK, null], output: { type: IT.SWORD_DIA,  count: 1 } },
  // Pickaxes (top row 2 material + bottom 2 sticks)
  { inputs: [P,  P,  IT.STICK, IT.STICK], output: { type: IT.PICK_WOOD,  count: 1 } },
  { inputs: [CB, CB, IT.STICK, IT.STICK], output: { type: IT.PICK_STONE, count: 1 } },
  { inputs: [IT.IRON_INGOT, IT.IRON_INGOT, IT.STICK, IT.STICK], output: { type: IT.PICK_IRON, count: 1 } },
  { inputs: [IT.DIAMOND,    IT.DIAMOND,    IT.STICK, IT.STICK], output: { type: IT.PICK_DIA,  count: 1 } },
  // Armor (4 material → piece)
  { inputs: [IT.IRON_INGOT, IT.IRON_INGOT, IT.IRON_INGOT, IT.IRON_INGOT], output: { type: IT.CHEST_IRON, count: 1 } },
  { inputs: [IT.DIAMOND,    IT.DIAMOND,    IT.DIAMOND,    IT.DIAMOND   ], output: { type: IT.CHEST_DIA,  count: 1 } },
  { inputs: [IT.IRON_INGOT, null, IT.IRON_INGOT, null], output: { type: IT.HELMET_IRON, count: 1 } },
  { inputs: [IT.DIAMOND,    null, IT.DIAMOND,    null], output: { type: IT.HELMET_DIA,  count: 1 } },
  { inputs: [null, IT.IRON_INGOT, null, IT.IRON_INGOT], output: { type: IT.BOOTS_IRON, count: 1 } },
  { inputs: [null, IT.DIAMOND,    null, IT.DIAMOND   ], output: { type: IT.BOOTS_DIA,  count: 1 } },
];

function computeCraft() {
  for (const r of RECIPES) {
    if (r.inputs.every((t, i) => t === null ? !craftSlots[i] : craftSlots[i]?.type === t)) {
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

function handleEquipSlotClick(slotName) {
  const current = equipment[slotName];
  if (inventory.held) {
    if (ARMOR_SLOT_MAP[inventory.held.type] === slotName) {
      if (current) { [equipment[slotName], inventory.held] = [inventory.held, current]; }
      else          { equipment[slotName] = inventory.held; inventory.held = null; }
    }
  } else if (current) {
    inventory.held = current; equipment[slotName] = null;
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

  armGroup.position.set(0.43, -0.60, -0.80);
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
// Equipment slots column (between char and craft)
const EQ_SLOT_PX  = 44;
const EQ_SLOT_STR = 48;
const EQ_X        = INV_PAD + CHAR_W + 8;  // 154
// Y zones
const TITLE_H  = 44;
const TOP_H    = 194;  // character+craft area height
const TOP_Y    = TITLE_H;
const EQ_Y     = [TOP_Y + 4, TOP_Y + 52, TOP_Y + 100, TOP_Y + 148]; // helmet,chest,legs,boots
const GRID_Y   = TOP_Y + TOP_H + 6;
const SEP_Y    = GRID_Y + GRID_ROWS * SLOT_STR;
const HBAR_Y   = SEP_Y + 14;
// Craft grid position (shifted right to make room for equipment column)
const CRAFT_X  = EQ_X + EQ_SLOT_PX + 10;  // 208
const CRAFT_Y  = TOP_Y + 24;
const ARROW_X  = CRAFT_X + 2 * SLOT_STR + 6;
const OUT_X    = ARROW_X + 28;
const OUT_Y    = CRAFT_Y + (SLOT_STR - SLOT_PX) / 2; // vertically centered with craft

invCanvas.width  = INV_PAD * 2 + HOTBAR_SIZE * SLOT_STR - SLOT_GAP; // 514
invCanvas.height = HBAR_Y + SLOT_PX + INV_PAD;

// Returns { kind, ... } for the element under (mx, my)
function getClickTarget(mx, my) {
  // Equipment slots
  for (let ei = 0; ei < 4; ei++) {
    const ey = EQ_Y[ei];
    if (mx >= EQ_X && mx < EQ_X + EQ_SLOT_PX && my >= ey && my < ey + EQ_SLOT_PX)
      return { kind: 'equip', slot: EQUIP_KEYS[ei] };
  }
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

  // ── Equipment slots ────────────────────────────────────────────────────────
  const armorPts = getArmorPoints();
  for (let ei = 0; ei < 4; ei++) {
    const ex = EQ_X, ey = EQ_Y[ei];
    const item      = equipment[EQUIP_KEYS[ei]];
    const hovered   = invMouseX >= ex && invMouseX < ex + EQ_SLOT_PX && invMouseY >= ey && invMouseY < ey + EQ_SLOT_PX;
    invCtx.fillStyle = hovered ? 'rgba(255,200,80,0.28)' : 'rgba(0,0,0,0.55)';
    invCtx.fillRect(ex, ey, EQ_SLOT_PX, EQ_SLOT_PX);
    invCtx.strokeStyle = '#aa8800'; invCtx.lineWidth = 1;
    invCtx.strokeRect(ex + 0.5, ey + 0.5, EQ_SLOT_PX - 1, EQ_SLOT_PX - 1);
    if (item) {
      const tileId = getBlockTile(item.type, 2);
      const tc = tileId % 16, tr = Math.floor(tileId / 16);
      invCtx.imageSmoothingEnabled = false;
      invCtx.drawImage(world.atlas.image, tc * 16, tr * 16, 16, 16, ex + 4, ey + 4, EQ_SLOT_PX - 8, EQ_SLOT_PX - 8);
    } else {
      invCtx.fillStyle = 'rgba(180,140,0,0.4)'; invCtx.font = '8px monospace'; invCtx.textAlign = 'center';
      invCtx.fillText(EQUIP_LABELS[ei], ex + EQ_SLOT_PX / 2, ey + EQ_SLOT_PX / 2 + 3);
    }
  }
  // Armor points total
  if (armorPts > 0) {
    invCtx.fillStyle = '#ffd700'; invCtx.font = 'bold 10px monospace'; invCtx.textAlign = 'center';
    invCtx.fillText(`⚔ ${armorPts}`, EQ_X + EQ_SLOT_PX / 2, TOP_Y + TOP_H - 2);
  }

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
  else if (t.kind === 'equip')    { handleEquipSlotClick(t.slot); }
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
  else if (t.kind === 'equip')    { handleEquipSlotClick(t.slot); }
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

// ── Four UI ────────────────────────────────────────────────────────────────────
let furnaceOpen = false;
let currentFurnaceKey = null;
let fMouseX = 0, fMouseY = 0;

const furnaceOverlay = document.createElement('div');
furnaceOverlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;';
document.body.appendChild(furnaceOverlay);
const furnaceCanvas = document.createElement('canvas');
furnaceOverlay.appendChild(furnaceCanvas);
const fCtx = furnaceCanvas.getContext('2d');

// Furnace canvas layout
const F_W     = INV_PAD * 2 + HOTBAR_SIZE * SLOT_STR - SLOT_GAP; // 514
const F_TITLE = 44;
const F_IN_X  = Math.floor(F_W / 2) - SLOT_STR - 28;  // input slot x
const F_IN_Y  = F_TITLE + 28;
const F_FL_X  = F_IN_X;                                 // fuel slot x (same col as input)
const F_FL_Y  = F_IN_Y + SLOT_STR + 8;
const F_OUT_X = F_IN_X + SLOT_STR * 3 + 10;            // output slot x
const F_OUT_Y = F_IN_Y;
const F_SEP_Y = F_FL_Y + SLOT_PX + 24;
const F_GRID_Y= F_SEP_Y + 14;
const F_SEP2_Y= F_GRID_Y + GRID_ROWS * SLOT_STR;
const F_HBAR_Y= F_SEP2_Y + 14;
furnaceCanvas.width  = F_W;
furnaceCanvas.height = F_HBAR_Y + SLOT_PX + INV_PAD;

function getFurnaceHitTarget(mx, my) {
  if (mx >= F_IN_X  && mx < F_IN_X  + SLOT_PX && my >= F_IN_Y  && my < F_IN_Y  + SLOT_PX) return 'finput';
  if (mx >= F_FL_X  && mx < F_FL_X  + SLOT_PX && my >= F_FL_Y  && my < F_FL_Y  + SLOT_PX) return 'ffuel';
  if (mx >= F_OUT_X && mx < F_OUT_X + SLOT_PX && my >= F_OUT_Y && my < F_OUT_Y + SLOT_PX) return 'foutput';
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR, y = F_GRID_Y + row * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= y && my < y + SLOT_PX) return { kind: 'inv', uiIdx: row * HOTBAR_SIZE + col };
  }
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= F_HBAR_Y && my < F_HBAR_Y + SLOT_PX) return { kind: 'inv', uiIdx: GRID_ROWS * HOTBAR_SIZE + col };
  }
  return null;
}

function handleFurnaceClick(target) {
  const f = getFurnaceState(currentFurnaceKey);
  if (target === 'finput') {
    if (inventory.held) {
      if (!f.input || f.input.type === inventory.held.type) {
        if (!f.input) f.input = { type: inventory.held.type, count: 0 };
        const n = Math.min(inventory.held.count, 64 - f.input.count);
        f.input.count += n; inventory.held.count -= n; if (!inventory.held.count) inventory.held = null;
      } else { [f.input, inventory.held] = [inventory.held, f.input]; }
    } else if (f.input) { inventory.held = f.input; f.input = null; }
  } else if (target === 'ffuel') {
    if (inventory.held) {
      if (FUEL_BURN_TIME.has(inventory.held.type)) {
        if (!f.fuel || f.fuel.type === inventory.held.type) {
          if (!f.fuel) f.fuel = { type: inventory.held.type, count: 0 };
          const n = Math.min(inventory.held.count, 64 - f.fuel.count);
          f.fuel.count += n; inventory.held.count -= n; if (!inventory.held.count) inventory.held = null;
        } else { [f.fuel, inventory.held] = [inventory.held, f.fuel]; }
      }
    } else if (f.fuel) { inventory.held = f.fuel; f.fuel = null; }
  } else if (target === 'foutput') {
    if (!inventory.held && f.output) { inventory.held = f.output; f.output = null; }
    else if (inventory.held && f.output && inventory.held.type === f.output.type && inventory.held.count + f.output.count <= 64) {
      inventory.held.count += f.output.count; f.output = null;
    }
  } else if (target?.kind === 'inv') {
    inventory.clickSlot(target.uiIdx);
  }
}

function drawFurnaceUI() {
  const W = furnaceCanvas.width, H = furnaceCanvas.height;
  fCtx.clearRect(0, 0, W, H);
  fCtx.fillStyle = 'rgba(28,28,28,0.95)'; fCtx.fillRect(0, 0, W, H);

  // Title
  fCtx.fillStyle = '#ff9933'; fCtx.font = 'bold 16px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('FOUR', W / 2, INV_PAD + 20);

  const f = getFurnaceState(currentFurnaceKey);
  const atlas = world.atlas.image;

  // Draw a slot helper
  const drawSlot = (x, y, item, special) => {
    const hov = fMouseX >= x && fMouseX < x + SLOT_PX && fMouseY >= y && fMouseY < y + SLOT_PX;
    fCtx.fillStyle = hov ? 'rgba(255,255,255,0.18)' : special ? 'rgba(200,120,0,0.25)' : 'rgba(0,0,0,0.65)';
    fCtx.fillRect(x, y, SLOT_PX, SLOT_PX);
    fCtx.strokeStyle = special ? '#cc6600' : (hov ? '#fff' : '#555'); fCtx.lineWidth = 1;
    fCtx.strokeRect(x + 0.5, y + 0.5, SLOT_PX - 1, SLOT_PX - 1);
    if (item) {
      const tid = getBlockTile(item.type, 2), tc = tid % 16, tr = Math.floor(tid / 16);
      fCtx.imageSmoothingEnabled = false;
      fCtx.drawImage(atlas, tc * 16, tr * 16, 16, 16, x + 5, y + 5, SLOT_PX - 10, SLOT_PX - 10);
      if (item.count > 1) {
        fCtx.fillStyle = '#fff'; fCtx.font = 'bold 11px monospace'; fCtx.textAlign = 'right';
        fCtx.fillText(item.count, x + SLOT_PX - 3, y + SLOT_PX - 3);
      }
    }
  };

  // Input slot
  fCtx.fillStyle = '#aaa'; fCtx.font = '10px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('Entrée', F_IN_X + SLOT_PX / 2, F_IN_Y - 4);
  drawSlot(F_IN_X, F_IN_Y, f.input, false);

  // Fuel slot
  fCtx.fillStyle = '#e06020'; fCtx.font = '10px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('Carburant', F_FL_X + SLOT_PX / 2, F_FL_Y - 4);
  drawSlot(F_FL_X, F_FL_Y, f.fuel, true);
  // Flame icon
  const flamePct = f.burnTime > 0 ? f.burnTime / f.burnMax : 0;
  fCtx.fillStyle = `rgba(255,${80 + flamePct * 120 | 0},0,${0.3 + flamePct * 0.7})`;
  fCtx.fillRect(F_FL_X + 14, F_FL_Y + SLOT_PX + 2, 22, 8);
  fCtx.fillStyle = '#ff4400'; fCtx.font = '14px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('🔥', F_FL_X + SLOT_PX / 2, F_FL_Y + SLOT_PX + 18);

  // Progress arrow
  const midX = F_IN_X + SLOT_STR + 4, midY = F_IN_Y + SLOT_PX / 2;
  fCtx.strokeStyle = '#555'; fCtx.lineWidth = 2;
  fCtx.strokeRect(midX, midY - 7, SLOT_STR * 1.5, 14);
  if (f.progress > 0) {
    fCtx.fillStyle = '#44bb44';
    fCtx.fillRect(midX + 1, midY - 6, Math.floor((SLOT_STR * 1.5 - 2) * f.progress), 12);
  }
  fCtx.fillStyle = '#fff'; fCtx.font = 'bold 14px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('→', midX + SLOT_STR * 0.75, midY + 5);

  // Output slot
  fCtx.fillStyle = '#aaa'; fCtx.font = '10px monospace'; fCtx.textAlign = 'center';
  fCtx.fillText('Sortie', F_OUT_X + SLOT_PX / 2, F_OUT_Y - 4);
  drawSlot(F_OUT_X, F_OUT_Y, f.output, false);

  // Separator
  fCtx.strokeStyle = '#444'; fCtx.lineWidth = 1;
  fCtx.beginPath(); fCtx.moveTo(INV_PAD, F_SEP_Y + 7); fCtx.lineTo(W - INV_PAD, F_SEP_Y + 7); fCtx.stroke();

  // Player inventory
  fCtx.fillStyle = '#ccc'; fCtx.font = '11px monospace'; fCtx.textAlign = 'left';
  fCtx.fillText('Inventaire', INV_PAD, F_GRID_Y - 4);
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR, y = F_GRID_Y + row * SLOT_STR;
    const item = inventory.slots[HOTBAR_SIZE + row * HOTBAR_SIZE + col];
    drawInvSlot(fCtx, x, y, item, false, false);
  }
  fCtx.strokeStyle = '#444'; fCtx.lineWidth = 1;
  fCtx.beginPath(); fCtx.moveTo(INV_PAD, F_SEP2_Y + 7); fCtx.lineTo(W - INV_PAD, F_SEP2_Y + 7); fCtx.stroke();
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR;
    drawInvSlot(fCtx, x, F_HBAR_Y, inventory.slots[col], col === inventory.selected, false);
  }
  // Held item
  if (inventory.held) drawInvSlot(fCtx, fMouseX - SLOT_PX / 2, fMouseY - SLOT_PX / 2, inventory.held, false, true);
}

furnaceCanvas.addEventListener('mousemove', e => {
  const r = furnaceCanvas.getBoundingClientRect(); fMouseX = e.clientX - r.left; fMouseY = e.clientY - r.top;
  if (furnaceOpen) drawFurnaceUI();
});
furnaceCanvas.addEventListener('click', e => {
  const r = furnaceCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  handleFurnaceClick(getFurnaceHitTarget(mx, my)); updateHUD(); drawFurnaceUI();
});
furnaceCanvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r = furnaceCanvas.getBoundingClientRect();
  const t = getFurnaceHitTarget(e.clientX - r.left, e.clientY - r.top);
  if (t?.kind === 'inv') inventory.rightClickSlot(t.uiIdx);
  updateHUD(); drawFurnaceUI();
});
furnaceOverlay.addEventListener('click', e => { if (e.target === furnaceOverlay) closeFurnace(); });

function openFurnace(x, y, z) {
  currentFurnaceKey = `${x},${y},${z}`;
  inventory.dropHeld();
  furnaceOpen = true;
  furnaceOverlay.style.display = 'flex';
  drawFurnaceUI();
  document.exitPointerLock();
}
function closeFurnace() {
  inventory.dropHeld();
  furnaceOpen = false;
  furnaceOverlay.style.display = 'none';
  renderer.domElement.requestPointerLock();
}

// ── Coffre UI ──────────────────────────────────────────────────────────────────
let chestOpen = false;
let currentChestKey = null;
let cMouseX = 0, cMouseY = 0;

const chestOverlay = document.createElement('div');
chestOverlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;';
document.body.appendChild(chestOverlay);
const chestCanvas = document.createElement('canvas');
chestOverlay.appendChild(chestCanvas);
const cCtx = chestCanvas.getContext('2d');

const C_TITLE  = 44;
const C_CHEST_Y = C_TITLE + 8;
const C_SEP_Y  = C_CHEST_Y + GRID_ROWS * SLOT_STR;
const C_GRID_Y = C_SEP_Y + 14;
const C_SEP2_Y = C_GRID_Y + GRID_ROWS * SLOT_STR;
const C_HBAR_Y = C_SEP2_Y + 14;
const C_W      = INV_PAD * 2 + HOTBAR_SIZE * SLOT_STR - SLOT_GAP;
chestCanvas.width  = C_W;
chestCanvas.height = C_HBAR_Y + SLOT_PX + INV_PAD;

function getChestHitTarget(mx, my) {
  // Chest slots (3×9)
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR, y = C_CHEST_Y + row * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= y && my < y + SLOT_PX) return { kind: 'chest', idx: row * HOTBAR_SIZE + col };
  }
  // Player inventory
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR, y = C_GRID_Y + row * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= y && my < y + SLOT_PX) return { kind: 'inv', uiIdx: row * HOTBAR_SIZE + col };
  }
  for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR;
    if (mx >= x && mx < x + SLOT_PX && my >= C_HBAR_Y && my < C_HBAR_Y + SLOT_PX) return { kind: 'inv', uiIdx: GRID_ROWS * HOTBAR_SIZE + col };
  }
  return null;
}

function handleChestClick(t, rightClick) {
  if (!t) return;
  const items = getChestItems(currentChestKey);
  if (t.kind === 'chest') {
    const ci = t.idx;
    if (rightClick) {
      if (!inventory.held && items[ci]) {
        const half = Math.ceil(items[ci].count / 2);
        inventory.held = { type: items[ci].type, count: half };
        items[ci].count -= half; if (!items[ci].count) items[ci] = null;
      } else if (inventory.held) {
        if (!items[ci]) { items[ci] = { type: inventory.held.type, count: 1 }; inventory.held.count--; if (!inventory.held.count) inventory.held = null; }
        else if (items[ci].type === inventory.held.type && items[ci].count < 64) { items[ci].count++; inventory.held.count--; if (!inventory.held.count) inventory.held = null; }
      }
    } else {
      if (inventory.held) {
        if (!items[ci]) { items[ci] = inventory.held; inventory.held = null; }
        else if (items[ci].type === inventory.held.type && items[ci].count < 64) {
          const n = Math.min(inventory.held.count, 64 - items[ci].count);
          items[ci].count += n; inventory.held.count -= n; if (!inventory.held.count) inventory.held = null;
        } else { [items[ci], inventory.held] = [inventory.held, items[ci]]; }
      } else if (items[ci]) { inventory.held = items[ci]; items[ci] = null; }
    }
  } else if (t.kind === 'inv') {
    if (rightClick) inventory.rightClickSlot(t.uiIdx); else inventory.clickSlot(t.uiIdx);
  }
}

function drawChestUI() {
  const W = chestCanvas.width;
  cCtx.clearRect(0, 0, W, chestCanvas.height);
  cCtx.fillStyle = 'rgba(28,28,28,0.95)'; cCtx.fillRect(0, 0, W, chestCanvas.height);

  cCtx.fillStyle = '#d4a020'; cCtx.font = 'bold 16px monospace'; cCtx.textAlign = 'center';
  cCtx.fillText('COFFRE', W / 2, INV_PAD + 20);

  const items = getChestItems(currentChestKey);
  const atlas = world.atlas.image;
  const drawSlot = (x, y, item, sel) => {
    const hov = cMouseX >= x && cMouseX < x + SLOT_PX && cMouseY >= y && cMouseY < y + SLOT_PX;
    cCtx.fillStyle = hov ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.65)';
    cCtx.fillRect(x, y, SLOT_PX, SLOT_PX);
    cCtx.strokeStyle = sel ? '#fff' : (hov ? '#ccc' : '#555'); cCtx.lineWidth = sel ? 2 : 1;
    cCtx.strokeRect(x + 0.5, y + 0.5, SLOT_PX - 1, SLOT_PX - 1);
    if (item) {
      const tid = getBlockTile(item.type, 2), tc = tid % 16, tr = Math.floor(tid / 16);
      cCtx.imageSmoothingEnabled = false;
      cCtx.drawImage(atlas, tc * 16, tr * 16, 16, 16, x + 5, y + 5, SLOT_PX - 10, SLOT_PX - 10);
      if (item.count > 1) {
        cCtx.fillStyle = '#fff'; cCtx.font = 'bold 11px monospace'; cCtx.textAlign = 'right';
        cCtx.fillText(item.count, x + SLOT_PX - 3, y + SLOT_PX - 3);
      }
    }
  };

  // Chest storage (3×9)
  cCtx.fillStyle = '#ccc'; cCtx.font = '11px monospace'; cCtx.textAlign = 'left';
  cCtx.fillText('Coffre', INV_PAD, C_CHEST_Y - 4);
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    drawSlot(INV_PAD + col * SLOT_STR, C_CHEST_Y + row * SLOT_STR, items[row * HOTBAR_SIZE + col], false);
  }

  cCtx.strokeStyle = '#444'; cCtx.lineWidth = 1;
  cCtx.beginPath(); cCtx.moveTo(INV_PAD, C_SEP_Y + 7); cCtx.lineTo(W - INV_PAD, C_SEP_Y + 7); cCtx.stroke();

  // Player inventory
  cCtx.fillStyle = '#ccc'; cCtx.font = '11px monospace'; cCtx.textAlign = 'left';
  cCtx.fillText('Inventaire', INV_PAD, C_GRID_Y - 4);
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < HOTBAR_SIZE; col++) {
    const x = INV_PAD + col * SLOT_STR, y = C_GRID_Y + row * SLOT_STR;
    drawSlot(x, y, inventory.slots[HOTBAR_SIZE + row * HOTBAR_SIZE + col], false);
  }

  cCtx.strokeStyle = '#444'; cCtx.lineWidth = 1;
  cCtx.beginPath(); cCtx.moveTo(INV_PAD, C_SEP2_Y + 7); cCtx.lineTo(W - INV_PAD, C_SEP2_Y + 7); cCtx.stroke();
  for (let col = 0; col < HOTBAR_SIZE; col++) drawSlot(INV_PAD + col * SLOT_STR, C_HBAR_Y, inventory.slots[col], col === inventory.selected);

  if (inventory.held) drawInvSlot(cCtx, cMouseX - SLOT_PX / 2, cMouseY - SLOT_PX / 2, inventory.held, false, true);
}

chestCanvas.addEventListener('mousemove', e => {
  const r = chestCanvas.getBoundingClientRect(); cMouseX = e.clientX - r.left; cMouseY = e.clientY - r.top;
  if (chestOpen) drawChestUI();
});
chestCanvas.addEventListener('click', e => {
  const r = chestCanvas.getBoundingClientRect();
  handleChestClick(getChestHitTarget(e.clientX - r.left, e.clientY - r.top), false); updateHUD(); drawChestUI();
});
chestCanvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r = chestCanvas.getBoundingClientRect();
  handleChestClick(getChestHitTarget(e.clientX - r.left, e.clientY - r.top), true); updateHUD(); drawChestUI();
});
chestOverlay.addEventListener('click', e => { if (e.target === chestOverlay) closeChest(); });

function openChest(x, y, z) {
  currentChestKey = `${x},${y},${z}`;
  inventory.dropHeld();
  chestOpen = true;
  chestOverlay.style.display = 'flex';
  drawChestUI();
  document.exitPointerLock();
}
function closeChest() {
  inventory.dropHeld();
  chestOpen = false;
  chestOverlay.style.display = 'none';
  renderer.domElement.requestPointerLock();
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyE') {
    if (inventoryOpen) closeInventory();
    else if (input.isLocked) openInventory();
  }
  if (e.code === 'KeyE' || e.code === 'Escape') {
    if (furnaceOpen) { closeFurnace(); return; }
    if (chestOpen)   { closeChest();   return; }
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
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const t = world.getVoxelWorld(px + dx, y, pz + dz);
        if (t !== BlockType.AIR && !MM_SKIP.has(t)) { type = t; topY = y; break; }
      }
      const col   = BlockColor[type] ?? 0x111111;
      const shade = type === BlockType.AIR ? 0.08 : 0.52 + (topY / (CHUNK_HEIGHT - 1)) * 0.48;
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
let autoSaveTimer = 60;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (input.isLocked && !inventoryOpen && !furnaceOpen && !chestOpen && gameStarted) {
    overlay.style.display = 'none';

    player.update(dt);
    world.update(player.position);
    clouds.update(player.position.x, player.position.z, dt);
    waterMesh.position.x = player.position.x;
    waterMesh.position.z = player.position.z;
    updateDayNight(dt);

    const hit = world.raycast(camera.position, player.getCameraDirection());
    const sel = inventory.getSelected();
    const camDir = player.getCameraDirection();

    if (hit) {
      selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      selectionBox.visible = true;
    } else {
      selectionBox.visible = false;
    }

    // ── Aperçu du bloc à poser (fantôme transparent) ─────────────────────────
    ghostMesh.visible = false;
    if (hit && sel && isBlock(sel.type)) {
      const gx = hit.x + hit.face[0];
      const gy = hit.y + hit.face[1];
      const gz = hit.z + hit.face[2];
      if (gy >= 0 && !collidesWithPlayer(gx, gy, gz)) {
        ghostMesh.position.set(gx + 0.5, gy + 0.5, gz + 0.5);
        ghostMat.color.setHex(BlockColor[sel.type] ?? 0xffffff);
        ghostMesh.visible = true;
      }
    }

    // ── Clic gauche unique : attaque mob ─────────────────────────────────────
    const lmbDown     = input.isMouseButtonDown(0);
    const lmbJustDown = lmbDown && !lmbWasDown;
    lmbWasDown        = lmbDown;

    if (lmbJustDown) {
      const hitMob = mobManager.findHitMob(camera.position, camDir, hit);
      if (hitMob) {
        const dmg = sel && isWeapon(sel.type) ? WEAPON_DATA[sel.type].damage : 2;
        hitMob.takeDamage(dmg);
        triggerArmSwing();
      }
    }

    // ── Maintien clic gauche : casser un bloc ─────────────────────────────────
    if (lmbDown && hit) {
      const sameTarget = breakTarget
        && breakTarget.x === hit.x && breakTarget.y === hit.y && breakTarget.z === hit.z;
      if (!sameTarget) { breakTarget = { x: hit.x, y: hit.y, z: hit.z }; breakProgress = 0; }

      const blockType = world.getVoxelWorld(hit.x, hit.y, hit.z);
      breakProgress += dt / getBreakTime(blockType);
      breakBarEl.style.display = 'block';
      breakBarFill.style.width = Math.min(100, breakProgress * 100) + '%';

      if (breakProgress >= 1) {
        setWorldVoxel(hit.x, hit.y, hit.z, BlockType.AIR);
        spawnParticles(hit.x, hit.y, hit.z, BlockColor[blockType]);
        if (blockType === BlockType.TNT) {
          explodeTNT(hit.x, hit.y, hit.z);
        } else if (blockType !== BlockType.AIR) {
          const drop = BLOCK_DROPS[blockType];
          if (drop) inventory.add(drop.type, drop.count);
          else      inventory.add(blockType);
        }
        rebuildAround(hit.x, hit.z);
        triggerArmSwing();
        updateHUD();
        breakTarget = null; breakProgress = 0;
        breakBarEl.style.display = 'none';
        breakBarFill.style.width = '0%';
      }
    } else {
      if (breakTarget) {
        breakTarget = null; breakProgress = 0;
        breakBarEl.style.display = 'none';
        breakBarFill.style.width = '0%';
      }
    }

    // ── Clic droit : interagir / manger / poser ───────────────────────────────
    interactCooldown -= dt;
    if (interactCooldown <= 0 && hit && input.consumeMouseButton(2)) {
      const hitBlockType = world.getVoxelWorld(hit.x, hit.y, hit.z);
      if (hitBlockType === BlockType.FURNACE) {
        openFurnace(hit.x, hit.y, hit.z);
        interactCooldown = 0.3;
      } else if (hitBlockType === BlockType.CHEST) {
        openChest(hit.x, hit.y, hit.z);
        interactCooldown = 0.3;
      } else if (sel && isFood(sel.type)) {
        player.eat(FOOD_DATA[sel.type].restore);
        inventory.consume(inventory.selected, 1);
        interactCooldown = 0.25;
        triggerArmSwing();
        updateHUD();
      } else if (sel && isBlock(sel.type)) {
        const nx = hit.x + hit.face[0];
        const ny = hit.y + hit.face[1];
        const nz = hit.z + hit.face[2];
        if (!collidesWithPlayer(nx, ny, nz)) {
          setWorldVoxel(nx, ny, nz, sel.type);
          inventory.consume(inventory.selected, 1);
          rebuildAround(nx, nz);
          interactCooldown = 0.25;
          triggerArmSwing();
          updateHUD();
        }
      }
    }

    // ── Mobs : mise à jour, drops, attaques ───────────────────────────────────
    const mobDrops = mobManager.update(dt, player.position, timeOfDay);
    for (const drop of mobDrops) inventory.add(drop, 1);
    if (mobDrops.length > 0) updateHUD();

    const mobDmg = mobManager.getMobAttackDamage(player.position);
    if (mobDmg > 0) {
      const armor   = getArmorPoints();
      const reduced = Math.max(1, Math.round(mobDmg * (1 - armor * 0.04)));
      player.takeDamage(reduced);
      updateHUD();
    }

    // ── Overlay eau ───────────────────────────────────────────────────────────
    waterOverlay.style.display = player.inWater ? 'block' : 'none';

    updateParticles(dt);
    updateFurnaces(dt);
    applyPendingWorldChanges();

    updateArm(dt);
    drawMinimap();
    updateDamageFlash();
    // Update bars chaque frame (santé/faim peuvent changer)
    drawBars();

    const p = player.position;
    const totalH = timeOfDay * 24;
    const hh = Math.floor(totalH) % 24;
    const mm = Math.floor((totalH % 1) * 60);
    const mobCount = mobManager.mobs.length;
    debugEl.textContent = `pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}${mobCount > 0 ? `  |  mobs: ${mobCount}` : ''}`;
  } else if (!inventoryOpen && !furnaceOpen && !chestOpen && gameStarted) {
    overlay.style.display = 'flex';
  }

  if (inventoryOpen) {
    charGroup.rotation.y += dt * 0.8;
    charRenderer.render(charScene, charCam);
    drawInventoryUI();
  }

  // ── Sauvegarde automatique (toutes les 60 s) ──────────────────────────────
  if (gameStarted) {
    autoSaveTimer -= dt;
    if (autoSaveTimer <= 0) { autoSaveTimer = 60; saveGame(); }
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

function explodeTNT(cx, cy, cz) {
  const R = 4;
  const toRebuild = new Set();
  for (let dy = -R; dy <= R; dy++) {
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx*dx + dy*dy + dz*dz > R * R + 2) continue;
        const wx = cx + dx, wy = cy + dy, wz = cz + dz;
        if (wy < 1 || wy >= CHUNK_HEIGHT) continue;
        if (world.getVoxelWorld(wx, wy, wz) !== BlockType.AIR) {
          setWorldVoxel(wx, wy, wz, BlockType.AIR);
          const chX = Math.floor(wx / CHUNK_SIZE);
          const chZ = Math.floor(wz / CHUNK_SIZE);
          for (const [ox, oz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])
            toRebuild.add(`${chX+ox},${chZ+oz}`);
        }
      }
    }
  }
  for (const key of toRebuild) {
    const [kx, kz] = key.split(',').map(Number);
    const c = world.getChunk(kx, kz);
    if (c) c.buildMesh(scene);
  }
  // Dégâts au joueur selon la distance
  const pd = player.position.distanceTo(new THREE.Vector3(cx + 0.5, cy + 0.5, cz + 0.5));
  if (pd < R + 2) {
    player.takeDamage(Math.max(1, Math.floor((R + 2 - pd) * 2.5)));
    updateHUD();
  }
  // Flash orange d'explosion
  damageFlashEl.style.background = 'rgba(255,140,0,0.75)';
  player._damagedAt = performance.now() - 100;
}

// ── Sauvegarde / Chargement ────────────────────────────────────────────────────
function saveGame() {
  try {
    const state = {
      v: 2,
      p: {
        x: player.position.x, y: player.position.y, z: player.position.z,
        yaw: player.yaw, pitch: player.pitch,
        hp: player.health, hunger: player.hunger,
      },
      inv:  inventory.slots,
      eq:   equipment,
      tod:  timeOfDay,
      wc:   [...worldChanges.entries()],
      fn:   [...furnaces.entries()],
      ch:   [...chests.entries()],
    };
    localStorage.setItem('threecraft_save', JSON.stringify(state));
  } catch { /* quota exceeded or private mode */ }
}

function loadGame() {
  const raw = localStorage.getItem('threecraft_save');
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v < 2) return false;

    player.position.set(s.p.x, s.p.y, s.p.z);
    player.yaw   = s.p.yaw   ?? 0;
    player.pitch = s.p.pitch ?? 0;
    player.health = Math.max(1, s.p.hp   ?? 20);
    player.hunger = Math.max(0, s.p.hunger ?? 20);

    for (let i = 0; i < 36; i++) inventory.slots[i] = s.inv?.[i] ?? null;
    Object.assign(equipment, s.eq ?? {});
    timeOfDay = s.tod ?? 0.3;

    // Queue world changes to apply as chunks load
    worldChanges.clear();
    for (const [key, type] of (s.wc ?? [])) {
      worldChanges.set(key, type);
      const [x, y, z] = key.split(',').map(Number);
      pendingWorldChanges.push({ x, y, z, type });
    }

    furnaces.clear();
    for (const [k, v] of (s.fn ?? [])) furnaces.set(k, v);

    chests.clear();
    for (const [k, v] of (s.ch ?? [])) chests.set(k, v.map(slot => slot || null));

    return true;
  } catch (e) {
    console.warn('Échec du chargement :', e);
    return false;
  }
}

function collidesWithPlayer(bx, by, bz) {
  const p = player.position;
  const r = 0.3, h = 1.8;
  return bx + 1 > p.x - r && bx < p.x + r &&
         by + 1 > p.y      && by < p.y + h &&
         bz + 1 > p.z - r  && bz < p.z + r;
}

// ── Notification HUD temporaire ───────────────────────────────────────────────
let _notifEl = null;
function showNotification(msg) {
  if (!_notifEl) {
    _notifEl = document.createElement('div');
    _notifEl.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;font:bold 14px monospace;padding:8px 18px;border-radius:4px;pointer-events:none;z-index:300;transition:opacity 0.5s;';
    document.body.appendChild(_notifEl);
  }
  _notifEl.textContent = msg;
  _notifEl.style.opacity = '1';
  clearTimeout(_notifEl._t);
  _notifEl._t = setTimeout(() => { _notifEl.style.opacity = '0'; }, 2500);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  armCamera.aspect = window.innerWidth / window.innerHeight;
  armCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
