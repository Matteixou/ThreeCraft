import { BlockType } from './Voxel.js';
const { AIR, DIRT, STONE, WOOD, PLANKS, LEAVES, COBBLESTONE } = BlockType;

// ── Helpers ───────────────────────────────────────────────────────────────────

function set(chunk, wx, wy, wz, type) {
  const lx = wx - chunk.chunkX * 16;
  const lz = wz - chunk.chunkZ * 16;
  if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || wy < 1 || wy > 46) return;
  chunk.setVoxel(lx, wy, lz, type);
}

function fill(chunk, x0, y0, z0, x1, y1, z1, type) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        set(chunk, x, y, z, type);
}

function clear(chunk, x0, y0, z0, x1, y1, z1) {
  fill(chunk, x0, y0, z0, x1, y1, z1, AIR);
}

function hash(x, z) {
  let n = (x * 374761393 + z * 1073741789) | 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return n / 0xFFFFFFFF;
}

// ── Maison ────────────────────────────────────────────────────────────────────
// surfY = dernier bloc solide du terrain (le sol de la maison ira dessus)
export function placeHouse(chunk, cx, cz, surfY, seed) {
  const W = 8, L = 10, WH = 4; // largeur, longueur, hauteur des murs
  const x0 = cx - (W >> 1), z0 = cz - (L >> 1);

  // Fondation + sol
  fill(chunk, x0, surfY - 2, z0, x0+W-1, surfY, z0+L-1, DIRT);
  fill(chunk, x0, surfY, z0, x0+W-1, surfY, z0+L-1, PLANKS);

  // Dégager l'intérieur + espace pour le toit
  clear(chunk, x0, surfY+1, z0, x0+W-1, surfY+WH+W/2+1, z0+L-1);

  // Murs (poutres WOOD aux coins/arêtes, PLANKS en remplissage)
  for (let y = surfY+1; y <= surfY+WH; y++) {
    const isBase = y === surfY+1, isTop = y === surfY+WH;
    for (let x = x0; x <= x0+W-1; x++) {
      const corner = x === x0 || x === x0+W-1;
      const t = corner || isBase || isTop ? WOOD : PLANKS;
      set(chunk, x, y, z0,     t);
      set(chunk, x, y, z0+L-1, t);
    }
    for (let z = z0+1; z <= z0+L-2; z++) {
      const corner = z === z0+1 || z === z0+L-2;
      const t = corner || isBase || isTop ? WOOD : PLANKS;
      set(chunk, x0,     y, z, t);
      set(chunk, x0+W-1, y, z, t);
    }
  }

  // Porte (2×2 à l'avant)
  const doorX = x0 + (W >> 1) - 1;
  set(chunk, doorX,   surfY+1, z0, AIR); set(chunk, doorX,   surfY+2, z0, AIR);
  set(chunk, doorX+1, surfY+1, z0, AIR); set(chunk, doorX+1, surfY+2, z0, AIR);

  // Fenêtres (côtés gauche/droit + arrière)
  set(chunk, x0,     surfY+2, z0 + Math.floor(L*0.3), AIR);
  set(chunk, x0,     surfY+2, z0 + Math.floor(L*0.7), AIR);
  set(chunk, x0+W-1, surfY+2, z0 + Math.floor(L*0.3), AIR);
  set(chunk, x0+W-1, surfY+2, z0 + Math.floor(L*0.7), AIR);
  set(chunk, x0 + Math.floor(W*0.6), surfY+2, z0+L-1, AIR);

  // Toit à pignon (triangle symétrique)
  for (let step = 0; step < (W >> 1) + 1; step++) {
    const y = surfY + WH + 1 + step;
    const isTip = step === (W >> 1);
    for (let z = z0; z <= z0+L-1; z++) {
      const t = isTip ? WOOD : (step % 2 === 0 ? PLANKS : WOOD);
      set(chunk, x0 + step,     y, z, t);
      set(chunk, x0 + W-1-step, y, z, t);
    }
    if (isTip) break;
    // Vider l'intérieur du toit
    for (let ix = x0+step+1; ix < x0+W-1-step; ix++)
      for (let iz = z0+1; iz < z0+L-1; iz++)
        set(chunk, ix, y, iz, AIR);
  }

  // Chemin de terre depuis la porte
  for (let dz = 1; dz <= 5; dz++) {
    set(chunk, doorX,   surfY, z0 - dz, DIRT);
    set(chunk, doorX+1, surfY, z0 - dz, DIRT);
  }
}

// ── Puits ─────────────────────────────────────────────────────────────────────
export function placeWell(chunk, cx, cz, surfY) {
  for (let x = cx-1; x <= cx+1; x++) {
    for (let z = cz-1; z <= cz+1; z++) {
      if (x === cx && z === cz) { set(chunk, x, surfY, z, AIR); continue; }
      set(chunk, x, surfY,   z, STONE);
      set(chunk, x, surfY+1, z, STONE);
    }
  }
  for (let x = cx-1; x <= cx+1; x++) set(chunk, x, surfY+2, cz, WOOD);
}

// ── Village ───────────────────────────────────────────────────────────────────
export function placeVillage(chunk, cx, cz, surfY, seed) {
  const count = hash(seed, seed+7) > 0.45 ? 4 : 3;
  const offsets = [[-17,-13],[17,-11],[-6,20],[19,14]].slice(0, count);

  for (let i = 0; i < offsets.length; i++) {
    const [dx, dz] = offsets[i];
    placeHouse(chunk, cx+dx, cz+dz, surfY, seed ^ (i * 997 + 1));
    // Chemin vers le puits
    const steps = 22;
    for (let t = 0; t <= steps; t++) {
      const px = Math.round(cx+dx + (cx - (cx+dx)) * t / steps);
      const pz = Math.round(cz+dz + (cz - (cz+dz)) * t / steps);
      set(chunk, px,   surfY, pz,   DIRT);
      set(chunk, px+1, surfY, pz,   DIRT);
      set(chunk, px,   surfY, pz+1, DIRT);
    }
  }

  placeWell(chunk, cx, cz, surfY);

  // Lampadaire central (poteau en WOOD + feuilles au sommet comme lumière)
  set(chunk, cx+3, surfY+1, cz, WOOD);
  set(chunk, cx+3, surfY+2, cz, WOOD);
  set(chunk, cx+3, surfY+3, cz, WOOD);
  set(chunk, cx+3, surfY+4, cz, LEAVES);
}

// ── Ruine ─────────────────────────────────────────────────────────────────────
export function placeRuin(chunk, cx, cz, surfY, seed) {
  const W = 10, L = 8;
  const x0 = cx - (W >> 1), z0 = cz - (L >> 1);

  // Dégager le dessus
  clear(chunk, x0, surfY+1, z0, x0+W-1, surfY+7, z0+L-1);

  // Sol partiellement présent
  for (let x = x0; x <= x0+W-1; x++)
    for (let z = z0; z <= z0+L-1; z++)
      if (hash(seed+x*3, z*7) > 0.35) set(chunk, x, surfY, z, COBBLESTONE);

  // Murs abîmés (hauteur aléatoire, trous aléatoires)
  for (let x = x0; x <= x0+W-1; x++) {
    for (let z = z0; z <= z0+L-1; z++) {
      const onEdge = x===x0 || x===x0+W-1 || z===z0 || z===z0+L-1;
      if (!onEdge) continue;
      const maxH = Math.floor(1 + hash(seed + x*11, z*17) * 5);
      for (let y = surfY+1; y <= surfY+maxH; y++) {
        if (hash(x*5+y*3, z*9+seed*2) > 0.22) set(chunk, x, y, z, COBBLESTONE);
      }
    }
  }

  // Quelques poutres effondrées
  for (let x = x0+1; x <= x0+W-2; x++)
    for (let z = z0+1; z <= z0+L-2; z++)
      if (hash(x*7+seed, z*3) > 0.88) set(chunk, x, surfY+3, z, WOOD);
}

// ── Château ───────────────────────────────────────────────────────────────────
export function placeCastle(chunk, cx, cz, surfY, seed) {
  const OUTER = 26, KW = 10;
  const x0 = cx - (OUTER >> 1), z0 = cz - (OUTER >> 1);
  const WH = 7, TH = 12, KH = 15;

  // Aplatir et vider l'intérieur
  fill(chunk, x0+1, surfY-2, z0+1, x0+OUTER-2, surfY,   z0+OUTER-2, DIRT);
  clear(chunk, x0+1, surfY+1, z0+1, x0+OUTER-2, surfY+TH+2, z0+OUTER-2);

  // Murs périmètre
  for (let y = surfY+1; y <= surfY+WH; y++) {
    for (let i = 0; i < OUTER; i++) {
      set(chunk, x0+i,        y, z0,           COBBLESTONE);
      set(chunk, x0+i,        y, z0+OUTER-1,   COBBLESTONE);
      set(chunk, x0,          y, z0+i,          COBBLESTONE);
      set(chunk, x0+OUTER-1,  y, z0+i,          COBBLESTONE);
    }
  }

  // Créneaux murs (alternés)
  for (let i = 1; i < OUTER-1; i += 2) {
    set(chunk, x0+i, surfY+WH+1, z0,           STONE);
    set(chunk, x0+i, surfY+WH+1, z0+OUTER-1,   STONE);
    set(chunk, x0,   surfY+WH+1, z0+i,          STONE);
    set(chunk, x0+OUTER-1, surfY+WH+1, z0+i,   STONE);
  }

  // Portail d'entrée (mur avant, milieu)
  const gx = x0 + (OUTER >> 1) - 1;
  for (let y = surfY+1; y <= surfY+5; y++) {
    set(chunk, gx,   y, z0, AIR);
    set(chunk, gx+1, y, z0, AIR);
  }
  // Arc de porte (WOOD)
  set(chunk, gx-1, surfY+5, z0, WOOD);
  set(chunk, gx,   surfY+6, z0, WOOD);
  set(chunk, gx+1, surfY+6, z0, WOOD);
  set(chunk, gx+2, surfY+5, z0, WOOD);

  // Tours aux 4 coins
  const T = 5;
  const corners = [
    [x0-1,   z0-1],
    [x0+OUTER-T+1, z0-1],
    [x0-1,   z0+OUTER-T+1],
    [x0+OUTER-T+1, z0+OUTER-T+1],
  ];
  for (const [tx, tz] of corners) {
    fill(chunk, tx, surfY+1, tz, tx+T-1, surfY+TH, tz+T-1, STONE);
    clear(chunk, tx+1, surfY+2, tz+1, tx+T-2, surfY+TH-1, tz+T-2);
    // Plancher mi-hauteur
    fill(chunk, tx+1, surfY+6, tz+1, tx+T-2, surfY+6, tz+T-2, WOOD);
    // Créneaux tour
    for (let i = 0; i < T; i++) {
      if (i % 2 === 0) {
        set(chunk, tx+i,   surfY+TH+1, tz,     STONE);
        set(chunk, tx+i,   surfY+TH+1, tz+T-1, STONE);
        set(chunk, tx,     surfY+TH+1, tz+i,   STONE);
        set(chunk, tx+T-1, surfY+TH+1, tz+i,   STONE);
      }
    }
  }

  // Donjon central
  const kx = cx - (KW >> 1), kz = cz - (KW >> 1);
  fill(chunk, kx, surfY+1, kz, kx+KW-1, surfY+KH, kz+KW-1, STONE);
  clear(chunk, kx+1, surfY+2, kz+1, kx+KW-2, surfY+KH-1, kz+KW-2);
  fill(chunk, kx+1, surfY+8, kz+1, kx+KW-2, surfY+8, kz+KW-2, WOOD); // plancher 2e étage
  // Entrée du donjon
  set(chunk, cx, surfY+1, kz,     AIR);
  set(chunk, cx, surfY+2, kz,     AIR);
  set(chunk, cx, surfY+3, kz,     AIR);
  // Créneaux donjon
  for (let i = 0; i < KW; i++) {
    if (i % 2 === 0) {
      set(chunk, kx+i,   surfY+KH+1, kz,     STONE);
      set(chunk, kx+i,   surfY+KH+1, kz+KW-1,STONE);
      set(chunk, kx,     surfY+KH+1, kz+i,   STONE);
      set(chunk, kx+KW-1,surfY+KH+1, kz+i,   STONE);
    }
  }
}

// ── Chambre secrète souterraine ───────────────────────────────────────────────
export function placeChamber(chunk, cx, cz, surfY, seed) {
  const W = 11, H = 5, DEPTH = 16;
  const x0 = cx - (W >> 1), z0 = cz - (W >> 1);
  const roomY = Math.max(4, surfY - DEPTH);

  // Enveloppe en pierre
  fill(chunk, x0-1, roomY-1, z0-1, x0+W, roomY+H, z0+W, STONE);
  // Creuser l'intérieur
  fill(chunk, x0, roomY, z0, x0+W-1, roomY+H-1, z0+W-1, AIR);
  // Sol en planches
  fill(chunk, x0, roomY, z0, x0+W-1, roomY, z0+W-1, PLANKS);

  // Piliers en WOOD aux 4 coins intérieurs
  for (const [px, pz] of [[x0+2,z0+2],[x0+W-3,z0+2],[x0+2,z0+W-3],[x0+W-3,z0+W-3]]) {
    set(chunk, px, roomY+1, pz, WOOD);
    set(chunk, px, roomY+2, pz, WOOD);
    set(chunk, px, roomY+3, pz, WOOD);
  }

  // Coffres symboliques (blocs de PLANKS dans les angles)
  set(chunk, x0+1, roomY+1, z0+1,     PLANKS);
  set(chunk, x0+W-2, roomY+1, z0+1,   PLANKS);
  set(chunk, x0+1, roomY+1, z0+W-2,   PLANKS);
  set(chunk, x0+W-2, roomY+1, z0+W-2, PLANKS);

  // Tunnel d'accès vertical (trou dans le sol visible depuis la surface)
  for (let y = roomY + H; y <= surfY; y++) {
    set(chunk, cx, y,   cz, AIR);
    set(chunk, cx, y+1, cz, AIR);
  }
  // Barreaux de descente (WOOD tous les 3 blocs dans le tunnel)
  for (let y = roomY + H; y <= surfY; y += 3) {
    set(chunk, cx-1, y, cz, WOOD);
  }
}
