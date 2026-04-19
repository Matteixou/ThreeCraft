export const BlockType = {
  AIR:         0,
  GRASS:       1,
  DIRT:        2,
  STONE:       3,
  SAND:        4,
  WOOD:        5,
  LEAVES:      6,
  TALL_GRASS:  7,
  FLOWER_RED:  8,
  FLOWER_YEL:  9,
};

// Couleur RGB hex par type de bloc
export const BlockColor = {
  [BlockType.GRASS]:      0x5a8f3c,
  [BlockType.DIRT]:       0x8b6340,
  [BlockType.STONE]:      0x808080,
  [BlockType.SAND]:       0xe2c47a,
  [BlockType.WOOD]:       0x6b4226,
  [BlockType.LEAVES]:     0x2d7a2d,
  [BlockType.TALL_GRASS]: 0x4ec840,
  [BlockType.FLOWER_RED]: 0xcc2222,
  [BlockType.FLOWER_YEL]: 0xf0d020,
};

export const BlockName = {
  [BlockType.AIR]:         'AIR',
  [BlockType.GRASS]:       'GRASS',
  [BlockType.DIRT]:        'DIRT',
  [BlockType.STONE]:       'STONE',
  [BlockType.SAND]:        'SAND',
  [BlockType.WOOD]:        'WOOD',
  [BlockType.LEAVES]:      'LEAVES',
  [BlockType.TALL_GRASS]:  'TALL GRASS',
  [BlockType.FLOWER_RED]:  'FLOWER',
  [BlockType.FLOWER_YEL]:  'FLOWER',
};

// Blocs que le joueur peut poser (sans AIR ni décors)
export const PLACEABLE_BLOCKS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.WOOD,
  BlockType.LEAVES,
];
