import * as THREE from 'three';
import { BlockType } from './Voxel.js';

const T    = 16;   // pixels per tile
const COLS = 16;   // tiles per row in the atlas
export const ATLAS_PX = T * COLS; // 256

// ── Tile IDs ──────────────────────────────────────────────────────────────────
export const TileId = {
  GRASS_TOP:    0,
  GRASS_SIDE:   1,
  DIRT:         2,
  STONE:        3,
  SAND:         4,
  WOOD_SIDE:    5,
  WOOD_TOP:     6,
  LEAVES:       7,
  SNOW_TOP:     8,
  SNOW_SIDE:    9,
  CACTUS_SIDE:  10,
  CACTUS_TOP:   11,
  TALL_GRASS_T: 12,
  FLOWER_RED_T: 13,
  FLOWER_YEL_T: 14,
};

// UV rect [u0, v0, u1, v1] for a tile (Three.js: Y=0 at bottom)
export function tileUV(id) {
  const col = id % COLS, row = Math.floor(id / COLS);
  const s   = 1 / COLS;
  return [col * s, 1 - (row + 1) * s, (col + 1) * s, 1 - row * s];
}

// Which tile to use for (blockType, faceIdx)
// faceIdx : 0=+X  1=-X  2=+Y(top)  3=-Y(bottom)  4=+Z  5=-Z
export function getBlockTile(blockType, faceIdx) {
  switch (blockType) {
    case BlockType.GRASS:
      return faceIdx === 2 ? TileId.GRASS_TOP : faceIdx === 3 ? TileId.DIRT : TileId.GRASS_SIDE;
    case BlockType.DIRT:   return TileId.DIRT;
    case BlockType.STONE:  return TileId.STONE;
    case BlockType.SAND:   return TileId.SAND;
    case BlockType.WOOD:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.WOOD_TOP : TileId.WOOD_SIDE;
    case BlockType.LEAVES: return TileId.LEAVES;
    case BlockType.SNOW:
      return faceIdx === 2 ? TileId.SNOW_TOP : faceIdx === 3 ? TileId.DIRT : TileId.SNOW_SIDE;
    case BlockType.CACTUS:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.CACTUS_TOP : TileId.CACTUS_SIDE;
    case BlockType.TALL_GRASS:  return TileId.TALL_GRASS_T;
    case BlockType.FLOWER_RED:  return TileId.FLOWER_RED_T;
    case BlockType.FLOWER_YEL:  return TileId.FLOWER_YEL_T;
    default: return TileId.DIRT;
  }
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────

// Deterministic hash  (x, y, seed) → [0, 1]
function rnd(x, y, s = 0) {
  let n = ((x * 374761393 + y * 1073741789 + s * 2654435761) | 0) >>> 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return n / 0xFFFFFFFF;
}

const K = v => Math.max(0, Math.min(255, v | 0));

function px(d, x, y, r, g, b, a = 255) {
  const i = (y * T + x) * 4;
  d[i] = K(r); d[i + 1] = K(g); d[i + 2] = K(b); d[i + 3] = a;
}

// ── Tile drawing functions ────────────────────────────────────────────────────

// Herbe dessus : vert vif avec variation et brins sombres
function drawGrassTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 0), v2 = rnd(x, y, 1);
    const dark = v2 > 0.80 ? 22 : v2 > 0.90 ? 35 : 0;
    px(d, x, y, 72 + v * 38 - dark, 128 + v * 52 - dark, 34 + v * 24 - dark);
  }
}

// Herbe côté : bande verte en haut, transition, puis terre
function drawGrassSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 2), v2 = rnd(x, y, 3);
    if (y === 0) {
      px(d, x, y, 78 + v * 28, 138 + v * 40, 40 + v * 20);
    } else if (y === 1) {
      px(d, x, y, 82 + v * 25, 130 + v * 35, 42 + v * 18);
    } else if (y === 2) {
      // Transition green → dirt
      px(d, x, y, 100 + v * 28, 110 + v * 25, 50 + v * 15);
    } else {
      // Dirt
      const p2 = v2 < 0.07 ? 18 : 0;
      px(d, x, y, 122 + v2 * 28 - p2, 86 + v2 * 22 - p2, 54 + v2 * 16 - p2);
    }
  }
}

// Terre : brun avec cailloux
function drawDirt(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 4), v2 = rnd(x, y, 5);
    const pebble = v2 < 0.07 ? 20 : 0;
    px(d, x, y, 122 + v * 28 - pebble, 86 + v * 22 - pebble, 54 + v * 16 - pebble);
  }
}

// Pierre : deux tons avec microfissures
function drawStone(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 6), v2 = rnd(x, y, 7);
    const tone   = v > 0.48 ? 18 : 0;      // grande tache claire/sombre
    const crack  = v2 < 0.04 ? -28 : 0;   // fissure
    const fine   = (v2 * 2 - 1) * 10;
    const base   = K(108 + tone + crack + fine);
    px(d, x, y, base, base, base);
  }
}

// Sable : jaune chaud avec variations horizontales (dunes)
function drawSand(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 8), h = rnd(x + 1, y, 8);
    px(d, x, y, 212 + v * 20 + h * 8, 182 + v * 14 + h * 4, 110 + v * 12);
  }
}

// Bois côté : écorce avec veines verticales
function drawWoodSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v  = rnd(x, y, 9);
    const v2 = rnd(x, y + 1, 9);
    // Veines verticales sinusoïdales
    const grain = (Math.sin(x * 1.5 + v * 1.2) * 0.5 + 0.5);
    px(d, x, y, 96 + grain * 20 + v2 * 6, 63 + grain * 14 + v2 * 5, 30 + grain * 8 + v2 * 3);
  }
}

// Bois dessus/dessous : cernes concentriques
function drawWoodTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx = x - 7.5, dy = y - 7.5;
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const ring  = Math.sin(dist * 1.4) * 0.5 + 0.5;
    const v     = rnd(x, y, 10);
    px(d, x, y, 93 + ring * 24 + v * 8, 60 + ring * 16 + v * 6, 28 + ring * 10 + v * 4);
  }
}

// Feuilles : deux tons de vert, texturé
function drawLeaves(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 11), v2 = rnd(x, y, 12);
    const light = v > 0.55;
    px(d, x, y,
      36 + v * 22 + (light ? 14 : 0),
      100 + v * 38 + (light ? 18 : 0),
      26 + v * 16 + (light ? 10 : 0));
  }
}

// Neige dessus : blanc avec reflets bleutés et scintillements
function drawSnowTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v  = rnd(x, y, 13);
    const v2 = rnd(x, y, 14);
    const spark = v2 > 0.93 ? 8 : 0;
    px(d, x, y, K(218 + v * 32 + spark), K(224 + v * 26 + spark), K(238 + v * 14 + spark));
  }
}

// Neige côté : bande blanche en haut, pierre compacte en dessous
function drawSnowSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 15);
    if (y < 4) {
      px(d, x, y, K(218 + v * 32), K(224 + v * 26), K(238 + v * 14));
    } else {
      const b = K(138 + v * 38);
      px(d, x, y, b, b, K(b + 10));
    }
  }
}

// Cactus côté : vert avec épines et segments
function drawCactusSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v      = rnd(x, y, 16);
    const segTop = y % 4 === 0 ? 12 : 0;
    const spine  = (x === 0 || x === 15) && y % 4 === 2;
    px(d, x, y,
      30 + v * 15 + (spine ? 10 : 0),
      105 + v * 22 + segTop - (spine ? 6 : 0),
      26 + v * 10);
  }
}

// Cactus dessus : cercles concentriques verts
function drawCactusTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx   = x - 7.5, dy = y - 7.5;
    const ring = Math.sin(Math.sqrt(dx * dx + dy * dy) * 1.4) * 0.5 + 0.5;
    const v    = rnd(x, y, 17);
    px(d, x, y, 30 + v * 12, 108 + ring * 20 + v * 16, 24 + v * 10);
  }
}

// Herbe haute : brins verticaux avec transparence sur les bords
function drawTallGrass(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x, y, 18);
    // Brins sur certaines colonnes
    const col  = x % 3 === 0 || x % 5 === 0 || x % 7 === 0;
    const edge = x < 2 || x > 13;
    if ((!col && v > 0.50) || edge) { px(d, x, y, 0, 0, 0, 0); continue; }
    const top = y < 5 ? 12 : 0;
    px(d, x, y, 50 + v * 22 + top, 118 + v * 42 + top, 28 + v * 16);
  }
}

// Fleur rouge : tige verte + pétales rouges + centre jaune
function drawFlowerRed(d) {
  const [cx, cy] = [7, 5];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (y >= 10) {
      // Tige
      Math.abs(x - 7) <= 1 ? px(d, x, y, 48, 108, 24) : px(d, x, y, 0, 0, 0, 0);
    } else if (dist < 4.8) {
      dist < 1.5 ? px(d, x, y, 245, 215, 15) : px(d, x, y, 205, 32, 32);
    } else {
      px(d, x, y, 0, 0, 0, 0);
    }
  }
}

// Fleur jaune : tige verte + pétales jaunes + centre orange
function drawFlowerYel(d) {
  const [cx, cy] = [7, 5];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (y >= 10) {
      Math.abs(x - 7) <= 1 ? px(d, x, y, 48, 108, 24) : px(d, x, y, 0, 0, 0, 0);
    } else if (dist < 4.8) {
      dist < 1.5 ? px(d, x, y, 255, 138, 18) : px(d, x, y, 240, 212, 22);
    } else {
      px(d, x, y, 0, 0, 0, 0);
    }
  }
}

// Ordre exact correspondant à TileId (0 → 14)
const DRAWERS = [
  drawGrassTop, drawGrassSide, drawDirt, drawStone, drawSand,
  drawWoodSide, drawWoodTop, drawLeaves,
  drawSnowTop, drawSnowSide,
  drawCactusSide, drawCactusTop,
  drawTallGrass, drawFlowerRed, drawFlowerYel,
];

// ── Export : création de l'atlas ──────────────────────────────────────────────
export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d');

  DRAWERS.forEach((draw, id) => {
    const col = id % COLS, row = Math.floor(id / COLS);
    const img = ctx.createImageData(T, T);
    draw(img.data);
    ctx.putImageData(img, col * T, row * T);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; // pixel-perfect, style Minecraft
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
