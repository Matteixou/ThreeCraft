# ThreeCraft

Moteur voxel 3D inspiré de Minecraft, développé avec **Three.js** et **Vite**.

![Three.js](https://img.shields.io/badge/Three.js-0.163-black?logo=threedotjs)
![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?logo=vite)
![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs)

---

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- npm (inclus avec Node.js)

---

## Installation & lancement

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd ThreeCraft

# 2. Installer les dépendances
npm install

# 3. Démarrer le serveur de développement
npm run dev
```

Ouvre ensuite **http://localhost:5173** dans ton navigateur.

---

## Contrôles

| Action | Contrôle |
|---|---|
| Entrer dans le jeu | Clic sur l'écran |
| Se déplacer | `Z` `Q` `S` `D` (ou `W` `A` `S` `D`) |
| Sauter | `Espace` |
| Regarder | Souris |
| Casser un bloc | Clic gauche |
| Poser un bloc | Clic droit |
| Changer de bloc | Molette |
| Quitter le mode jeu | `Échap` |

---

## Architecture

```
src/
├── main.js            # Point d'entrée — boucle de jeu, Three.js, interactions
├── Voxel.js           # Types de blocs, couleurs, noms
├── NoiseGenerator.js  # Bruit simplex FBM pour la génération du terrain
├── Chunk.js           # Chunk 16×16×64, génération de mesh par face culling
├── World.js           # Gestion des chunks, raycast DDA, lecture/écriture
├── InputHandler.js    # Clavier, souris, pointer lock
└── Player.js          # Physique, gravité, collision AABB, caméra FPS
```

---

## Build production

```bash
npm run build    # génère le dossier dist/
npm run preview  # prévisualise le build
```

---

## Blocs disponibles

| Bloc | Description |
|---|---|
| GRASS | Herbe (surface) |
| DIRT | Terre (sous la surface) |
| STONE | Pierre (profondeur) |
| SAND | Sable |
| WOOD | Bois |
| LEAVES | Feuilles |
