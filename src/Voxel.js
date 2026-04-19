export const BlockType = {
  AIR:    0,
  GRASS:  1,
  DIRT:   2,
  STONE:  3,
  SAND:   4,
  WOOD:   5,
  LEAVES: 6,
};

// Couleur RGB hex par type de bloc
export const BlockColor = {
  [BlockType.GRASS]:  0x5a8f3c,
  [BlockType.DIRT]:   0x8b6340,
  [BlockType.STONE]:  0x808080,
  [BlockType.SAND]:   0xe2c47a,
  [BlockType.WOOD]:   0x6b4226,
  [BlockType.LEAVES]: 0x2d7a2d,
};

export const BlockName = {
  [BlockType.AIR]:    'AIR',
  [BlockType.GRASS]:  'GRASS',
  [BlockType.DIRT]:   'DIRT',
  [BlockType.STONE]:  'STONE',
  [BlockType.SAND]:   'SAND',
  [BlockType.WOOD]:   'WOOD',
  [BlockType.LEAVES]: 'LEAVES',
};

// Blocs que le joueur peut poser (sans AIR)
export const PLACEABLE_BLOCKS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.WOOD,
  BlockType.LEAVES,
];
