const SPLASHES = [
  'Maintenant en 3D !',
  'Pas de creepers !',
  '100% voxels !',
  'Fait avec Three.js !',
  'AZERTY compatible !',
  'Survie activée !',
  'Les nuages bougent !',
  'Biomes générés !',
  'Jour et nuit !',
  'Faim et santé !',
  'Craft disponible !',
  'Open source !',
];

// 8×8 tile terre : 0=foncé 1=moyen 2=clair 3=très foncé
const DIRT_MAP = [
  [1,1,0,1,2,1,0,1],
  [0,2,1,1,1,0,1,2],
  [1,1,2,0,1,1,1,0],
  [1,0,1,1,3,1,1,1],
  [3,1,1,0,1,2,1,1],
  [1,1,0,1,1,1,0,2],
  [0,1,1,2,0,1,1,1],
  [1,2,1,1,1,0,1,3],
];
const DIRT_CLR = ['#6b4726','#7c5530','#8d643a','#503618'];

export class Menu {
  constructor(canvasEl, onPlay) {
    this.canvas  = canvasEl;
    this.ctx     = canvasEl.getContext('2d');
    this.onPlay  = onPlay;
    this.splash  = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.hovered = -1;
    this._phase  = 0;
    this._tile   = this._makeTile();

    this._onMove  = this._onMove.bind(this);
    this._onClick = this._onClick.bind(this);
    canvasEl.addEventListener('mousemove', this._onMove);
    canvasEl.addEventListener('click',     this._onClick);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._loop();
  }

  // ── Tile terre 64×64 ────────────────────────────────────────────────────────
  _makeTile() {
    const S = 8;
    const off = document.createElement('canvas');
    off.width = off.height = S * 8;
    const c = off.getContext('2d');
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        c.fillStyle = DIRT_CLR[DIRT_MAP[y][x]];
        c.fillRect(x * S, y * S, S, S);
      }
    return off;
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ── Positions boutons ────────────────────────────────────────────────────────
  _btns() {
    const W = this.canvas.width, H = this.canvas.height;
    const BW = Math.min(400, W * 0.48), BH = 54;
    const cx = W / 2, y0 = H * 0.57;
    return [
      { label: 'Jouer',   x: cx - BW/2, y: y0,      w: BW, h: BH },
      { label: 'Quitter', x: cx - BW/2, y: y0 + 72, w: BW, h: BH },
    ];
  }

  _loop() {
    this._phase += 0.028;
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ── Rendu complet ────────────────────────────────────────────────────────────
  _draw() {
    const { ctx } = this;
    const W = this.canvas.width, H = this.canvas.height;

    // Fond terre
    const pat = ctx.createPattern(this._tile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);

    // Voile radial sombre (vignette)
    const veil = ctx.createRadialGradient(W/2, H/2, H*0.05, W/2, H/2, Math.max(W,H)*0.78);
    veil.addColorStop(0, 'rgba(0,0,0,0.28)');
    veil.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    this._drawTitle(W, H);
    this._drawSplash(W, H);
    this._drawBtns();
    this._drawFooter(W, H);
  }

  _drawTitle(W, H) {
    const { ctx } = this;
    const fs = Math.min(108, W / 7.5);
    const tx = W / 2, ty = H * 0.31;
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = 'center';

    // Ombre 3D multicouche
    const depth = Math.ceil(fs * 0.065);
    for (let i = depth; i >= 1; i--) {
      ctx.fillStyle = `rgba(70,28,0,${0.55 - i * 0.035})`;
      ctx.fillText('ThreeCraft', tx + i, ty + i);
    }

    // Dégradé or
    const g = ctx.createLinearGradient(0, ty - fs * 0.78, 0, ty + fs * 0.08);
    g.addColorStop(0.0, '#fff6b0');
    g.addColorStop(0.45, '#ffd700');
    g.addColorStop(1.0,  '#a85000');
    ctx.fillStyle = g;
    ctx.fillText('ThreeCraft', tx, ty);

    // Reflet léger
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeText('ThreeCraft', tx, ty);
  }

  _drawSplash(W, H) {
    const { ctx } = this;
    const sc = 1 + Math.sin(this._phase) * 0.05;
    ctx.save();
    ctx.translate(W * 0.625, H * 0.375);
    ctx.rotate(-0.38);
    ctx.scale(sc, sc);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#886600';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#ffff55';
    ctx.fillText(this.splash, 0, 0);
    ctx.restore();
  }

  _drawBtns() {
    const { ctx } = this;
    this._btns().forEach((b, i) => {
      const hov = this.hovered === i;

      // Ombre bouton
      ctx.shadowColor   = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur    = hov ? 18 : 9;
      ctx.shadowOffsetY = 4;

      // Fond dégradé Minecraft
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, hov ? '#7fa4f0' : '#5577cc');
      g.addColorStop(1, hov ? '#3a5ecc' : '#1e3a99');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      ctx.shadowColor   = 'transparent';
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetY = 0;

      // Bordure style Minecraft
      ctx.strokeStyle = hov ? '#a8c8ff' : '#6688dd';
      ctx.lineWidth   = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

      // Coins pixelisés sombres
      ctx.fillStyle = '#080f28';
      [[b.x,b.y],[b.x+b.w-3,b.y],[b.x,b.y+b.h-3],[b.x+b.w-3,b.y+b.h-3]]
        .forEach(([px,py]) => ctx.fillRect(px, py, 3, 3));

      // Reflet haut (ligne claire)
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 4);

      // Texte
      const fs = Math.min(22, b.h * 0.44);
      ctx.font      = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = hov ? '#ffffff' : '#ccdcff';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.65);
    });
  }

  _drawFooter(W, H) {
    this.ctx.fillStyle = 'rgba(255,255,255,0.28)';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ThreeCraft  •  EFREI Hackathon 2025-2026', W / 2, H - 14);
  }

  // ── Événements ───────────────────────────────────────────────────────────────
  _onMove(e) {
    const r   = this.canvas.getBoundingClientRect();
    const mx  = e.clientX - r.left, my = e.clientY - r.top;
    const old = this.hovered;
    this.hovered = this._btns().findIndex(
      b => mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h
    );
    if (this.hovered !== old)
      this.canvas.style.cursor = this.hovered >= 0 ? 'pointer' : 'default';
  }

  _onClick(e) {
    const r  = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const i  = this._btns().findIndex(
      b => mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h
    );
    if (i === 0) this.onPlay();
    if (i === 1) { window.close(); } // tente de fermer l'onglet
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('click',     this._onClick);
  }
}
