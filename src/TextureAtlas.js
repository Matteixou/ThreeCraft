import * as THREE from 'three';
import { BlockType } from './Voxel.js';

const T    = 16;
const COLS = 16;
export const ATLAS_PX = T * COLS;

export const TileId = {
  GRASS_TOP:       0,
  GRASS_SIDE:      1,
  DIRT:            2,
  STONE:           3,
  SAND:            4,
  WOOD_SIDE:       5,
  WOOD_TOP:        6,
  LEAVES:          7,
  SNOW_TOP:        8,
  SNOW_SIDE:       9,
  CACTUS_SIDE:     10,
  CACTUS_TOP:      11,
  TALL_GRASS_T:    12,
  FLOWER_RED_T:    13,
  FLOWER_YEL_T:    14,
  APPLE_T:         15,
  BREAD_T:         16,
  PLANKS_T:        17,
  COBBLESTONE_T:   18,
  GRAVEL_T:        19,
  GLASS_T:         20,
  BRICK_T:         21,
  BOOKSHELF_SIDE:  22,
  BOOKSHELF_TOP:   23,
  CHEST_FRONT:     24,
  CHEST_SIDE:      25,
  CHEST_TOP:       26,
  CRAFTING_TOP:    27,
  CRAFTING_FRONT:  28,
  FURNACE_FRONT:   29,
  FURNACE_SIDE:    30,
  COAL_ORE_T:      31,
  IRON_ORE_T:      32,
  GOLD_ORE_T:      33,
  DIAMOND_ORE_T:   34,
  OBSIDIAN_T:      35,
  ICE_T:           36,
  PUMPKIN_FACE:    37,
  PUMPKIN_SIDE:    38,
  PUMPKIN_TOP:     39,
  HAY_SIDE:        40,
  HAY_TOP:         41,
  CLAY_T:          42,
  TNT_SIDE:        43,
  TNT_TOP:         44,
  GLOWSTONE_T:     45,
};

export function tileUV(id) {
  const col = id % COLS, row = Math.floor(id / COLS);
  const s   = 1 / COLS;
  return [col * s, 1 - (row + 1) * s, (col + 1) * s, 1 - row * s];
}

export function getBlockTile(blockType, faceIdx) {
  // faceIdx: 0=+X  1=-X  2=+Y(top)  3=-Y(bottom)  4=+Z  5=-Z
  switch (blockType) {
    case BlockType.GRASS:
      return faceIdx === 2 ? TileId.GRASS_TOP : faceIdx === 3 ? TileId.DIRT : TileId.GRASS_SIDE;
    case BlockType.DIRT:           return TileId.DIRT;
    case BlockType.STONE:          return TileId.STONE;
    case BlockType.SAND:           return TileId.SAND;
    case BlockType.WOOD:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.WOOD_TOP : TileId.WOOD_SIDE;
    case BlockType.LEAVES:         return TileId.LEAVES;
    case BlockType.SNOW:
      return faceIdx === 2 ? TileId.SNOW_TOP : faceIdx === 3 ? TileId.DIRT : TileId.SNOW_SIDE;
    case BlockType.CACTUS:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.CACTUS_TOP : TileId.CACTUS_SIDE;
    case BlockType.TALL_GRASS:     return TileId.TALL_GRASS_T;
    case BlockType.FLOWER_RED:     return TileId.FLOWER_RED_T;
    case BlockType.FLOWER_YEL:     return TileId.FLOWER_YEL_T;
    case BlockType.PLANKS:         return TileId.PLANKS_T;
    case BlockType.COBBLESTONE:    return TileId.COBBLESTONE_T;
    case BlockType.GRAVEL:         return TileId.GRAVEL_T;
    case BlockType.GLASS:          return TileId.GLASS_T;
    case BlockType.BRICK:          return TileId.BRICK_T;
    case BlockType.BOOKSHELF:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.BOOKSHELF_TOP : TileId.BOOKSHELF_SIDE;
    case BlockType.CHEST:
      return faceIdx === 2 ? TileId.CHEST_TOP
           : faceIdx === 5 ? TileId.CHEST_FRONT
           : TileId.CHEST_SIDE;
    case BlockType.CRAFTING_TABLE:
      return faceIdx === 2 ? TileId.CRAFTING_TOP
           : faceIdx === 5 ? TileId.CRAFTING_FRONT
           : TileId.CHEST_SIDE;
    case BlockType.FURNACE:
      return faceIdx === 5 ? TileId.FURNACE_FRONT : TileId.FURNACE_SIDE;
    case BlockType.COAL_ORE:       return TileId.COAL_ORE_T;
    case BlockType.IRON_ORE:       return TileId.IRON_ORE_T;
    case BlockType.GOLD_ORE:       return TileId.GOLD_ORE_T;
    case BlockType.DIAMOND_ORE:    return TileId.DIAMOND_ORE_T;
    case BlockType.OBSIDIAN:       return TileId.OBSIDIAN_T;
    case BlockType.ICE:            return TileId.ICE_T;
    case BlockType.PUMPKIN:
      return faceIdx === 2 ? TileId.PUMPKIN_TOP
           : faceIdx === 3 ? TileId.PUMPKIN_TOP
           : faceIdx === 5 ? TileId.PUMPKIN_FACE
           : TileId.PUMPKIN_SIDE;
    case BlockType.HAY_BALE:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.HAY_TOP : TileId.HAY_SIDE;
    case BlockType.CLAY:           return TileId.CLAY_T;
    case BlockType.TNT:
      return (faceIdx === 2 || faceIdx === 3) ? TileId.TNT_TOP : TileId.TNT_SIDE;
    case BlockType.GLOWSTONE:      return TileId.GLOWSTONE_T;
    case 100: return TileId.APPLE_T;
    case 101: return TileId.BREAD_T;
    default:  return TileId.DIRT;
  }
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
function rnd(x, y, s = 0) {
  let n = ((x * 374761393 + y * 1073741789 + s * 2654435761) | 0) >>> 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return n / 0xFFFFFFFF;
}
const K = v => Math.max(0, Math.min(255, v | 0));
function px(d, x, y, r, g, b, a = 255) {
  const i = (y * T + x) * 4;
  d[i] = K(r); d[i+1] = K(g); d[i+2] = K(b); d[i+3] = a;
}

// ── Original tile drawers ─────────────────────────────────────────────────────
function drawGrassTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x,y,0), v2 = rnd(x,y,1);
    const dark = v2>0.80?22:v2>0.90?35:0;
    px(d,x,y, 72+v*38-dark, 128+v*52-dark, 34+v*24-dark);
  }
}
function drawGrassSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = rnd(x,y,2), v2 = rnd(x,y,3);
    if (y===0)      px(d,x,y, 78+v*28, 138+v*40, 40+v*20);
    else if (y===1) px(d,x,y, 82+v*25, 130+v*35, 42+v*18);
    else if (y===2) px(d,x,y, 100+v*28, 110+v*25, 50+v*15);
    else { const p2=v2<0.07?18:0; px(d,x,y, 122+v2*28-p2, 86+v2*22-p2, 54+v2*16-p2); }
  }
}
function drawDirt(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,4), v2=rnd(x,y,5), pebble=v2<0.07?20:0;
    px(d,x,y, 122+v*28-pebble, 86+v*22-pebble, 54+v*16-pebble);
  }
}
function drawStone(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,6), v2=rnd(x,y,7);
    const tone=v>0.48?18:0, crack=v2<0.04?-28:0, fine=(v2*2-1)*10;
    const base=K(108+tone+crack+fine); px(d,x,y, base, base, base);
  }
}
function drawSand(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,8), h=rnd(x+1,y,8);
    px(d,x,y, 212+v*20+h*8, 182+v*14+h*4, 110+v*12);
  }
}
function drawWoodSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,9), v2=rnd(x,y+1,9);
    const grain=(Math.sin(x*1.5+v*1.2)*0.5+0.5);
    px(d,x,y, 96+grain*20+v2*6, 63+grain*14+v2*5, 30+grain*8+v2*3);
  }
}
function drawWoodTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-7.5, dy=y-7.5, dist=Math.sqrt(dx*dx+dy*dy);
    const ring=Math.sin(dist*1.4)*0.5+0.5, v=rnd(x,y,10);
    px(d,x,y, 93+ring*24+v*8, 60+ring*16+v*6, 28+ring*10+v*4);
  }
}
function drawLeaves(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,11), v2=rnd(x,y,12), light=v>0.55;
    px(d,x,y, 36+v*22+(light?14:0), 100+v*38+(light?18:0), 26+v*16+(light?10:0));
  }
}
function drawSnowTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,13), v2=rnd(x,y,14), spark=v2>0.93?8:0;
    px(d,x,y, K(218+v*32+spark), K(224+v*26+spark), K(238+v*14+spark));
  }
}
function drawSnowSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,15);
    if (y<4) px(d,x,y, K(218+v*32), K(224+v*26), K(238+v*14));
    else { const b=K(138+v*38); px(d,x,y, b, b, K(b+10)); }
  }
}
function drawCactusSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,16), segTop=y%4===0?12:0;
    const spine=(x===0||x===15)&&y%4===2;
    px(d,x,y, 30+v*15+(spine?10:0), 105+v*22+segTop-(spine?6:0), 26+v*10);
  }
}
function drawCactusTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-7.5, dy=y-7.5;
    const ring=Math.sin(Math.sqrt(dx*dx+dy*dy)*1.4)*0.5+0.5, v=rnd(x,y,17);
    px(d,x,y, 30+v*12, 108+ring*20+v*16, 24+v*10);
  }
}
function drawTallGrass(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,18);
    const col=x%3===0||x%5===0||x%7===0, edge=x<2||x>13;
    if ((!col&&v>0.50)||edge) { px(d,x,y,0,0,0,0); continue; }
    const top=y<5?12:0;
    px(d,x,y, 50+v*22+top, 118+v*42+top, 28+v*16);
  }
}
function drawFlowerRed(d) {
  const [cx,cy]=[7,5];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-cx, dy=y-cy, dist=Math.sqrt(dx*dx+dy*dy);
    if (y>=10) { Math.abs(x-7)<=1?px(d,x,y,48,108,24):px(d,x,y,0,0,0,0); }
    else if (dist<4.8) { dist<1.5?px(d,x,y,245,215,15):px(d,x,y,205,32,32); }
    else px(d,x,y,0,0,0,0);
  }
}
function drawFlowerYel(d) {
  const [cx,cy]=[7,5];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-cx, dy=y-cy, dist=Math.sqrt(dx*dx+dy*dy);
    if (y>=10) { Math.abs(x-7)<=1?px(d,x,y,48,108,24):px(d,x,y,0,0,0,0); }
    else if (dist<4.8) { dist<1.5?px(d,x,y,255,138,18):px(d,x,y,240,212,22); }
    else px(d,x,y,0,0,0,0);
  }
}
function drawApple(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-7.5, dy=y-9.5, dist=Math.sqrt(dx*dx+dy*dy), v=rnd(x,y,20);
    if (y<=3&&(x===7||x===8)) { px(d,x,y,90,55,20); continue; }
    if ((y===2||y===3)&&x>=9&&x<=11) { px(d,x,y,40,148,40); continue; }
    if (dist<5.5) px(d,x,y, K(185+v*45), K(22+v*18), K(22+v*12));
    else          px(d,x,y,0,0,0,0);
  }
}
function drawBread(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,21), inBread=y>=3&&y<=13&&x>=1&&x<=14;
    if (!inBread) { px(d,x,y,0,0,0,0); continue; }
    if (y<=5) px(d,x,y, K(185+v*30), K(112+v*20), K(48+v*15));
    else      px(d,x,y, K(218+v*22), K(162+v*16), K(82+v*10));
  }
}
function drawPlanks(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,22), seam=y%8===0?-30:0;
    const grain=(Math.sin(x*0.9+v*0.8)*0.5+0.5)*12, knot=rnd(x+30,y+30,22)>0.96?-22:0;
    px(d,x,y, K(162+v*26+grain+seam+knot), K(102+v*18+grain+seam+knot), K(48+v*12+seam+knot));
  }
}

// ── New tile drawers ──────────────────────────────────────────────────────────

function drawCobblestone(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,30), v2=rnd(x,y,31);
    // Rock patches
    const rock=(Math.sin(x*1.1+v*2)*Math.sin(y*1.3+v2*2)>0.1)?12:0;
    const outline=v2<0.06?-35:0;
    const base=K(90+rock+v*18+outline);
    px(d,x,y, base, base, K(base+2));
  }
}

function drawGravel(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,32), v2=rnd(x,y,33);
    const pebble=v2<0.12?-25:v2>0.88?15:0;
    const base=K(108+v*20+pebble);
    px(d,x,y, base, base-2, base-4);
  }
}

function drawGlass(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // Border frame
    const border=x===0||x===15||y===0||y===15;
    // Inner cross lines
    const line=(x===7||x===8||y===7||y===8)&&!border;
    const corner=(x<=2&&y<=2)||(x>=13&&y<=2)||(x<=2&&y>=13)||(x>=13&&y>=13);
    if (border||corner) px(d,x,y, 180,210,240);
    else if (line)      px(d,x,y, 160,200,235);
    else {
      const v=rnd(x,y,34);
      px(d,x,y, K(195+v*20), K(225+v*15), K(248+v*7));
    }
  }
}

function drawBrick(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row=Math.floor(y/4);
    // Mortar lines (horizontal every 4px, vertical staggered)
    const hMortar=y%4===0;
    const offset=row%2===0?0:8;
    const vMortar=(x+offset)%8===0;
    if (hMortar||vMortar) { px(d,x,y, 148,110,100); continue; }
    const v=rnd(x,y,35);
    px(d,x,y, K(158+v*28), K(70+v*18), K(58+v*12));
  }
}

function drawBookshelfSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // Wood border left/right
    if (x<=1||x>=14) {
      const v=rnd(x,y,36); px(d,x,y, K(150+v*20), K(96+v*14), K(44+v*10)); continue;
    }
    // Book rows: each row 5px tall
    const bookRow=Math.floor(y/5);
    const divider=y%5===0;
    if (divider) { px(d,x,y, 120,80,40); continue; }
    // Different book colors per x position
    const bookIdx=Math.floor((x-2)/3);
    const colors=[[180,40,30],[40,80,160],[30,120,50],[200,160,20],[120,30,120],[40,40,180]];
    const [r,g,b]=colors[(bookIdx+bookRow*2)%colors.length];
    const v=rnd(x,y,37);
    px(d,x,y, K(r+v*20-10), K(g+v*15-8), K(b+v*15-8));
  }
}

function drawBookshelfTop(d) { drawPlanks(d); }

function drawChestFront(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,38);
    // Wood base
    const wood=K(150+v*24); const woodG=K(96+v*16); const woodB=K(44+v*10);
    // Latch (center metal)
    const latch=x>=6&&x<=9&&y>=6&&y<=10;
    const latchBorder=x===6||x===9||y===6||y===10;
    // Top trim
    const topTrim=y<=2;
    if (latch&&latchBorder) px(d,x,y, 80,70,60);
    else if (latch) px(d,x,y, 180,155,80);
    else if (topTrim) px(d,x,y, K(wood-20), K(woodG-14), K(woodB-8));
    else px(d,x,y, wood, woodG, woodB);
  }
}

function drawChestSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,39);
    const topTrim=y<=2;
    const base=K(150+v*24); const baseG=K(96+v*16); const baseB=K(44+v*10);
    if (topTrim) px(d,x,y, K(base-20), K(baseG-14), K(baseB-8));
    else px(d,x,y, base, baseG, baseB);
  }
}

function drawChestTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,40);
    // Metal hinge strip at back
    const hinge=y<=1;
    if (hinge) px(d,x,y, 150,130,70);
    else px(d,x,y, K(155+v*24), K(100+v*16), K(46+v*10));
  }
}

function drawCraftingTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,41);
    // 3x3 grid lines
    const gridX=x%5===0, gridY=y%5===0;
    if (gridX||gridY) { px(d,x,y, 80,50,25); continue; }
    px(d,x,y, K(162+v*26), K(102+v*18), K(48+v*12));
  }
}

function drawCraftingFront(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,42);
    // Axe icon top-left, saw bottom-right
    const axe=(x>=2&&x<=6&&y>=2&&y<=6);
    const saw=(x>=9&&x<=13&&y>=9&&y<=13);
    const base=K(162+v*26); const baseG=K(102+v*18); const baseB=K(48+v*12);
    if (axe) {
      const tool=(x===3&&y>=2&&y<=5)||(x>=2&&x<=5&&y===5);
      px(d,x,y, tool?130:base, tool?100:baseG, tool?60:baseB);
    } else if (saw) {
      const teeth=y===9&&x%2===0;
      px(d,x,y, teeth?160:base, teeth?150:baseG, teeth?140:baseB);
    } else {
      px(d,x,y, base, baseG, baseB);
    }
  }
}

function drawFurnaceFront(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,43);
    // Stone base
    const stone=K(100+v*16);
    // Opening (glow)
    const openX=x>=4&&x<=11, openY=y>=3&&y<=10;
    const open=openX&&openY;
    const glow=(openX&&(openY||(y===11||y===2)));
    if (open) {
      const inner=x>=5&&x<=10&&y>=4&&y<=9;
      if (inner) px(d,x,y, K(220+v*30), K(100+v*40), 20);
      else        px(d,x,y, 60,40,30);
    } else if (glow&&!open) {
      px(d,x,y, K(180+v*20), K(80+v*20), 20);
    } else {
      px(d,x,y, stone, stone, stone);
    }
  }
}

function drawFurnaceSide(d) { drawStone(d); }

function drawOre(d, seed, rR, rG, rB) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,seed), v2=rnd(x,y,seed+1);
    const tone=v>0.48?18:0, crack=v2<0.04?-28:0, fine=(v2*2-1)*10;
    const stone=K(108+tone+crack+fine);
    // Ore blobs using noise-like pattern
    const blob=Math.sin(x*1.8+seed)*Math.sin(y*2.1+seed*0.7)>0.25&&rnd(x*3,y*3,seed+2)>0.3;
    if (blob) px(d,x,y, K(rR+v*20), K(rG+v*15), K(rB+v*12));
    else      px(d,x,y, stone, stone, stone);
  }
}
function drawCoalOre(d)    { drawOre(d, 50,  35, 30, 30); }
function drawIronOre(d)    { drawOre(d, 55, 185,125, 85); }
function drawGoldOre(d)    { drawOre(d, 60, 220,185, 20); }
function drawDiamondOre(d) { drawOre(d, 65,  30,210,225); }

function drawObsidian(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,70), v2=rnd(x,y,71);
    const shimmer=v2>0.92?18:v2>0.96?30:0;
    const vein=Math.sin(x*0.8+v*1.5)*Math.sin(y*0.6+v2*1.2)>0.5?8:0;
    px(d,x,y, K(22+v*8+shimmer+vein), K(12+v*5+shimmer), K(30+v*12+shimmer+vein));
  }
}

function drawIce(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,72), v2=rnd(x,y,73);
    // Crack lines
    const crack=v2>0.88&&(Math.abs(x-8)<2||Math.abs(y-8)<2);
    const spark=v2>0.96?12:0;
    px(d,x,y, K(165+v*18+spark), K(200+v*14+spark), K(230+v*12+spark-(crack?30:0)));
  }
}

function drawPumpkinFace(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,74);
    // Orange ridged surface
    const ridge=Math.sin(x*1.2)*4;
    const eyeL=x>=2&&x<=5&&y>=4&&y<=7;
    const eyeR=x>=10&&x<=13&&y>=4&&y<=7;
    const mouth=y>=10&&y<=13&&(x>=2&&x<=4||x>=6&&x<=9||x>=11&&x<=13);
    if (eyeL||eyeR||mouth) px(d,x,y, 15,8,0);
    else px(d,x,y, K(200+v*20+ridge), K(80+v*12), 10);
  }
}

function drawPumpkinSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,75);
    const ridge=Math.floor(x/3)%2===0?10:-5;
    px(d,x,y, K(205+v*18+ridge), K(82+v*10), 12);
  }
}

function drawPumpkinTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx=x-7.5, dy=y-7.5, dist=Math.sqrt(dx*dx+dy*dy), v=rnd(x,y,76);
    const stem=dx*dx+dy*dy<4&&y<9;
    if (stem) px(d,x,y, 60,100,20);
    else if (dist<7) {
      const ridge=Math.sin(Math.atan2(dy,dx)*5)*0.5+0.5;
      px(d,x,y, K(190+ridge*20+v*12), K(75+v*8), 10);
    } else px(d,x,y,0,0,0,0);
  }
}

function drawHaySide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,77);
    // Horizontal straw lines
    const strand=y%3===0?-15:y%3===1?5:0;
    // Binding bands
    const bind=(y>=5&&y<=6)||(y>=9&&y<=10);
    if (bind) px(d,x,y, K(150+v*14), K(108+v*10), K(20+v*6));
    else px(d,x,y, K(200+v*20+strand), K(158+v*14+strand), K(40+v*8));
  }
}

function drawHayTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,78);
    const wave=Math.sin(x*0.8+y*0.4+v)*3;
    px(d,x,y, K(205+v*18+wave), K(162+v*12+wave), K(38+v*8));
  }
}

function drawClay(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,79), v2=rnd(x,y,80);
    const speck=v2>0.88?-14:0;
    px(d,x,y, K(138+v*18+speck), K(148+v*16+speck), K(158+v*20+speck));
  }
}

function drawTntSide(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,81);
    // Red/white stripes
    const band=Math.floor(y/4)%2===0;
    if (band) px(d,x,y, K(190+v*20), K(25+v*10), K(20+v*8));
    else      px(d,x,y, K(235+v*15), K(228+v*12), K(220+v*10));
  }
}

function drawTntTop(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,82);
    // Green top with T-N-T letters style
    const inT=(x>=1&&x<=14&&y>=1&&y<=14);
    if (!inT) { px(d,x,y, 20,80,20); continue; }
    const letterT=((y>=2&&y<=4&&x>=2&&x<=12)||(y>=5&&y<=11&&x>=6&&x<=8));
    px(d,x,y, letterT?K(200+v*20):K(20+v*10), letterT?K(15+v*8):K(90+v*15), K(15+v*6));
  }
}

function drawGlowstone(d) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v=rnd(x,y,83), v2=rnd(x,y,84);
    const bright=v2>0.70?40:v2>0.85?70:0;
    const crack=v<0.06?-30:0;
    px(d,x,y, K(205+v*18+bright+crack), K(155+v*14+bright*0.6+crack), K(40+v*10+crack));
  }
}

// DRAWERS array: index = TileId
const DRAWERS = [
  drawGrassTop, drawGrassSide, drawDirt, drawStone, drawSand,     // 0-4
  drawWoodSide, drawWoodTop, drawLeaves,                           // 5-7
  drawSnowTop, drawSnowSide,                                       // 8-9
  drawCactusSide, drawCactusTop,                                   // 10-11
  drawTallGrass, drawFlowerRed, drawFlowerYel,                     // 12-14
  drawApple, drawBread, drawPlanks,                                // 15-17
  drawCobblestone, drawGravel, drawGlass, drawBrick,               // 18-21
  drawBookshelfSide, drawBookshelfTop,                             // 22-23
  drawChestFront, drawChestSide, drawChestTop,                     // 24-26
  drawCraftingTop, drawCraftingFront,                              // 27-28
  drawFurnaceFront, drawFurnaceSide,                               // 29-30
  drawCoalOre, drawIronOre, drawGoldOre, drawDiamondOre,           // 31-34
  drawObsidian, drawIce,                                           // 35-36
  drawPumpkinFace, drawPumpkinSide, drawPumpkinTop,                // 37-39
  drawHaySide, drawHayTop,                                         // 40-41
  drawClay, drawTntSide, drawTntTop, drawGlowstone,                // 42-45
];

export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d');
  DRAWERS.forEach((draw, id) => {
    const col=id%COLS, row=Math.floor(id/COLS);
    const img=ctx.createImageData(T,T);
    draw(img.data);
    ctx.putImageData(img, col*T, row*T);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
