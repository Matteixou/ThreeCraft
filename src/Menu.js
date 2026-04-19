const SPLASHES = [
  'Maintenant en 3D !', 'Pas de creepers !', '100% voxels !',
  'Fait avec Three.js !', 'AZERTY compatible !', 'Survie activée !',
  'Les nuages bougent !', 'Biomes générés !', 'Jour et nuit !',
  'Faim et santé !', 'Craft disponible !', 'Open source !',
];

const DIRT_MAP = [
  [1,1,0,1,2,1,0,1],[0,2,1,1,1,0,1,2],[1,1,2,0,1,1,1,0],[1,0,1,1,3,1,1,1],
  [3,1,1,0,1,2,1,1],[1,1,0,1,1,1,0,2],[0,1,1,2,0,1,1,1],[1,2,1,1,1,0,1,3],
];
const DIRT_CLR = ['#6b4726','#7c5530','#8d643a','#503618'];

export const defaultSettings = {
  shadows: true,
  fog: true,
  renderDistance: 4,
  volume: 70,
};

export class Menu {
  constructor(canvasEl, onPlay) {
    this.canvas   = canvasEl;
    this.ctx      = canvasEl.getContext('2d');
    this.onPlay   = onPlay;
    this.splash   = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.settings = { ...defaultSettings };

    // State
    this._page    = 'main';   // 'main' | 'settings'
    this._tab     = 'graphics'; // 'graphics' | 'sound' | 'controls'
    this._phase   = 0;
    this._hMain   = -1;       // hovered button index on main
    this._hSet    = null;     // hovered element id on settings page
    this._dragging = null;    // currently dragged slider key

    this._tile    = this._makeTile();

    this._onMove    = this._onMove.bind(this);
    this._onClick   = this._onClick.bind(this);
    this._onDown    = this._onDown.bind(this);
    this._onUp      = this._onUp.bind(this);
    canvasEl.addEventListener('mousemove',  this._onMove);
    canvasEl.addEventListener('click',      this._onClick);
    canvasEl.addEventListener('mousedown',  this._onDown);
    canvasEl.addEventListener('mouseup',    this._onUp);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._loop();
  }

  // ── Tile terre ───────────────────────────────────────────────────────────────
  _makeTile() {
    const S = 8, off = document.createElement('canvas');
    off.width = off.height = S * 8;
    const c = off.getContext('2d');
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        c.fillStyle = DIRT_CLR[DIRT_MAP[y][x]];
        c.fillRect(x * S, y * S, S, S);
      }
    return off;
  }

  _resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

  // ── Boucle ───────────────────────────────────────────────────────────────────
  _loop() { this._phase += 0.028; this._draw(); this._raf = requestAnimationFrame(() => this._loop()); }

  // ── Rendu principal ──────────────────────────────────────────────────────────
  _draw() {
    const { ctx } = this;
    const W = this.canvas.width, H = this.canvas.height;
    // Fond commun
    ctx.fillStyle = ctx.createPattern(this._tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    const veil = ctx.createRadialGradient(W/2, H/2, H*0.05, W/2, H/2, Math.max(W,H)*0.78);
    veil.addColorStop(0, 'rgba(0,0,0,0.28)'); veil.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);

    if (this._page === 'main')     this._drawMain(W, H);
    else                           this._drawSettings(W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ThreeCraft  •  EFREI Hackathon 2025-2026', W/2, H - 14);
  }

  // ══ PAGE PRINCIPALE ══════════════════════════════════════════════════════════
  _drawMain(W, H) {
    this._drawTitle(W, H);
    this._drawSplash(W, H);
    this._drawMainBtns(W, H);
  }

  _mainBtns(W, H) {
    const BW = Math.min(400, W * 0.48), BH = 54, cx = W / 2, y0 = H * 0.55;
    return [
      { label: 'Jouer',       x: cx-BW/2, y: y0,       w: BW, h: BH },
      { label: 'Paramètres',  x: cx-BW/2, y: y0+70,    w: BW, h: BH },
      { label: 'Quitter',     x: cx-BW/2, y: y0+140,   w: BW, h: BH },
    ];
  }

  _drawTitle(W, H) {
    const { ctx } = this;
    const fs = Math.min(108, W / 7.5), tx = W/2, ty = H * 0.29;
    ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'center';
    const depth = Math.ceil(fs * 0.065);
    for (let i = depth; i >= 1; i--) {
      ctx.fillStyle = `rgba(70,28,0,${0.55 - i*0.035})`;
      ctx.fillText('ThreeCraft', tx+i, ty+i);
    }
    const g = ctx.createLinearGradient(0, ty-fs*0.78, 0, ty+fs*0.08);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.45, '#ffd700'); g.addColorStop(1, '#a85000');
    ctx.fillStyle = g; ctx.fillText('ThreeCraft', tx, ty);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
    ctx.strokeText('ThreeCraft', tx, ty);
  }

  _drawSplash(W, H) {
    const { ctx } = this;
    const sc = 1 + Math.sin(this._phase) * 0.05;
    ctx.save();
    ctx.translate(W * 0.625, H * 0.365); ctx.rotate(-0.38); ctx.scale(sc, sc);
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = '#886600'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffff55';
    ctx.fillText(this.splash, 0, 0);
    ctx.restore();
  }

  _drawMainBtns(W, H) {
    this._mainBtns(W, H).forEach((b, i) => this._drawBtn(b, this._hMain === i));
  }

  // ══ PAGE PARAMÈTRES ══════════════════════════════════════════════════════════
  _drawSettings(W, H) {
    const { ctx } = this;
    // Panel
    const PW = Math.min(560, W * 0.68), PH = Math.min(420, H * 0.65);
    const PX = (W - PW) / 2, PY = (H - PH) / 2;

    ctx.fillStyle = 'rgba(15,10,5,0.88)';
    this._roundRect(PX, PY, PW, PH, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    this._roundRect(PX, PY, PW, PH, 10); ctx.stroke();

    // Titre
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ctx.fillText('PARAMÈTRES', W/2, PY + 34);

    // Onglets
    const tabs = ['Graphismes','Son','Touches'];
    const TW = PW / tabs.length;
    tabs.forEach((t, i) => {
      const tx = PX + i * TW, ty = PY + 50, tw = TW - 2, th = 34;
      const active = (this._tab === ['graphics','sound','controls'][i]);
      ctx.fillStyle = active ? 'rgba(80,120,220,0.7)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(tx+1, ty, tw, th);
      ctx.strokeStyle = active ? '#88aaff' : '#444';
      ctx.lineWidth = 1; ctx.strokeRect(tx+1, ty, tw, th);
      ctx.fillStyle = active ? '#fff' : '#aaa';
      ctx.font = `${active ? 'bold ' : ''}13px monospace`; ctx.textAlign = 'center';
      ctx.fillText(t, tx + TW/2, ty + 22);
    });

    // Ligne séparatrice
    const contentY = PY + 90;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PX+10, contentY); ctx.lineTo(PX+PW-10, contentY); ctx.stroke();

    // Contenu onglet
    if (this._tab === 'graphics') this._drawGraphicsTab(PX, contentY, PW, PH - 90 - 70);
    if (this._tab === 'sound')    this._drawSoundTab(PX, contentY, PW, PH - 90 - 70);
    if (this._tab === 'controls') this._drawControlsTab(PX, contentY, PW, PH - 90 - 70);

    // Bouton Retour
    const bw = 180, bh = 46, bx = W/2 - bw/2, by = PY + PH - 62;
    this._drawBtn({ label: 'Retour', x: bx, y: by, w: bw, h: bh }, this._hSet === 'back');
  }

  _drawGraphicsTab(PX, startY, PW, areaH) {
    const { ctx } = this;
    const rows = [
      { label: 'Ombres',              key: 'shadows',         type: 'toggle' },
      { label: 'Brouillard',          key: 'fog',             type: 'toggle' },
      { label: 'Distance de rendu',   key: 'renderDistance',  type: 'stepper', min:2, max:8 },
    ];
    rows.forEach((row, i) => {
      const ry = startY + 18 + i * 58;
      this._drawSettingRow(PX, ry, PW, row);
    });
  }

  _drawSoundTab(PX, startY, PW, areaH) {
    this._drawSettingRow(PX, startY + 18, PW,
      { label: 'Volume', key: 'volume', type: 'slider', min: 0, max: 100 });
  }

  _drawControlsTab(PX, startY, PW, areaH) {
    const { ctx } = this;
    const binds = [
      ['Avancer',        'Z / W'],
      ['Reculer',        'S'],
      ['Gauche / Droite','Q A / D'],
      ['Sauter',         'Espace'],
      ['Inventaire',     'E'],
      ['Casser',         'Clic gauche'],
      ['Poser / Manger', 'Clic droit'],
      ['Sélection',      '&é"\'(-è_ç'],
    ];
    binds.forEach(([label, key], i) => {
      const ry = startY + 14 + i * 34;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(PX + 16, ry, PW - 32, 28);
      ctx.fillStyle = '#bbb'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(label, PX + 26, ry + 19);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
      ctx.fillText(key, PX + PW - 26, ry + 19);
    });
  }

  _drawSettingRow(PX, ry, PW, row) {
    const { ctx } = this;
    ctx.fillStyle = '#ddd'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(row.label, PX + 26, ry + 16);

    if (row.type === 'toggle') {
      const val = this.settings[row.key];
      const bx = PX + PW - 100, bw = 76, bh = 30;
      ctx.fillStyle = val ? 'rgba(40,180,80,0.8)' : 'rgba(180,40,40,0.7)';
      ctx.fillRect(bx, ry - 2, bw, bh);
      ctx.strokeStyle = val ? '#60ff90' : '#ff6060';
      ctx.lineWidth = 1.5; ctx.strokeRect(bx, ry - 2, bw, bh);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(val ? 'ON' : 'OFF', bx + bw/2, ry + 16);
    }

    if (row.type === 'stepper') {
      const val = this.settings[row.key];
      const cx = PX + PW - 110;
      const bh = 28, bw = 28;
      // Bouton -
      ctx.fillStyle = this._hSet === row.key+'-' ? '#666' : '#444';
      ctx.fillRect(cx, ry - 1, bw, bh);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText('−', cx + bw/2, ry + 18);
      // Valeur
      ctx.fillStyle = '#fff'; ctx.font = '13px monospace';
      ctx.fillText(`${val}`, cx + bw + 22, ry + 18);
      // Bouton +
      ctx.fillStyle = this._hSet === row.key+'+' ? '#666' : '#444';
      ctx.fillRect(cx + bw + 42, ry - 1, bw, bh);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
      ctx.fillText('+', cx + bw + 42 + bw/2, ry + 18);
    }

    if (row.type === 'slider') {
      const val = this.settings[row.key];
      const t = (val - row.min) / (row.max - row.min);
      const sx = PX + 26, sw = PW - 52, sh = 8, sy = ry + 28;
      // Track
      ctx.fillStyle = '#333'; ctx.fillRect(sx, sy, sw, sh);
      // Fill
      ctx.fillStyle = '#5599ff'; ctx.fillRect(sx, sy, sw * t, sh);
      // Handle
      const hx = sx + sw * t;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hx, sy + sh/2, 8, 0, Math.PI*2); ctx.fill();
      // Label %
      ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${val}%`, PX + PW - 26, ry + 16);
    }
  }

  // ── Bouton générique ─────────────────────────────────────────────────────────
  _drawBtn(b, hov) {
    const { ctx } = this;
    ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = hov ? 18 : 9; ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, hov ? '#7fa4f0' : '#5577cc');
    g.addColorStop(1, hov ? '#3a5ecc' : '#1e3a99');
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = hov ? '#a8c8ff' : '#6688dd'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x+1, b.y+1, b.w-2, b.h-2);
    ctx.fillStyle = '#080f28';
    [[b.x,b.y],[b.x+b.w-3,b.y],[b.x,b.y+b.h-3],[b.x+b.w-3,b.y+b.h-3]]
      .forEach(([px,py]) => ctx.fillRect(px, py, 3, 3));
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(b.x+3, b.y+2, b.w-6, 4);
    ctx.fillStyle = hov ? '#ffffff' : '#ccdcff';
    ctx.font = `bold ${Math.min(22, b.h * 0.44)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h * 0.65);
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
    ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
    ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
  }

  // ── Hit-tests ────────────────────────────────────────────────────────────────
  _inRect(mx, my, x, y, w, h) { return mx>=x && mx<=x+w && my>=y && my<=y+h; }

  _getSettingsHit(mx, my) {
    const W = this.canvas.width, H = this.canvas.height;
    const PW = Math.min(560, W * 0.68), PH = Math.min(420, H * 0.65);
    const PX = (W-PW)/2, PY = (H-PH)/2;

    // Bouton retour
    const bw=180, bh=46, bx=W/2-bw/2, by=PY+PH-62;
    if (this._inRect(mx, my, bx, by, bw, bh)) return 'back';

    // Onglets
    const TW = PW / 3;
    const tabKeys = ['graphics','sound','controls'];
    for (let i=0; i<3; i++) {
      if (this._inRect(mx, my, PX+i*TW+1, PY+50, TW-2, 34)) return 'tab-'+tabKeys[i];
    }

    // Widgets du contenu
    const startY = PY + 90;
    if (this._tab === 'graphics') {
      const rows = [
        { key:'shadows',         type:'toggle'  },
        { key:'fog',             type:'toggle'  },
        { key:'renderDistance',  type:'stepper' },
      ];
      for (let i=0; i<rows.length; i++) {
        const row = rows[i], ry = startY + 18 + i * 58;
        if (row.type === 'toggle' && this._inRect(mx, my, PX+PW-100, ry-2, 76, 30))
          return 'toggle-'+row.key;
        if (row.type === 'stepper') {
          const cx = PX+PW-110;
          if (this._inRect(mx, my, cx,    ry-1, 28, 28)) return row.key+'-';
          if (this._inRect(mx, my, cx+70, ry-1, 28, 28)) return row.key+'+';
        }
      }
    }
    if (this._tab === 'sound') {
      const sx=PX+26, sw=PW-52, sy=startY+18+28;
      if (this._inRect(mx, my, sx-10, sy-10, sw+20, 28)) return 'slider-volume';
    }
    return null;
  }

  // ── Événements ───────────────────────────────────────────────────────────────
  _onMove(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    if (this._page === 'main') {
      const old = this._hMain;
      this._hMain = this._mainBtns(this.canvas.width, this.canvas.height)
        .findIndex(b => this._inRect(mx,my,b.x,b.y,b.w,b.h));
      if (this._hMain !== old) this.canvas.style.cursor = this._hMain>=0 ? 'pointer':'default';
    } else {
      const hit = this._getSettingsHit(mx, my);
      this._hSet = hit;
      this.canvas.style.cursor = hit ? 'pointer':'default';
      // Drag slider
      if (this._dragging) {
        const W=this.canvas.width, PW=Math.min(560,W*0.68), PX=(W-PW)/2;
        const sx=PX+26, sw=PW-52;
        const t = Math.max(0, Math.min(1, (mx-sx)/sw));
        const row = { volume:{min:0,max:100} }[this._dragging];
        if (row) this.settings[this._dragging] = Math.round(row.min + t*(row.max-row.min));
      }
    }
  }

  _onDown(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    const hit = this._getSettingsHit(mx, my);
    if (hit === 'slider-volume') this._dragging = 'volume';
  }

  _onUp() { this._dragging = null; }

  _onClick(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    if (this._page === 'main') {
      const i = this._mainBtns(this.canvas.width, this.canvas.height)
        .findIndex(b => this._inRect(mx,my,b.x,b.y,b.w,b.h));
      if (i === 0) this.onPlay(this.settings);
      if (i === 1) { this._page = 'settings'; }
      if (i === 2) window.close();
    } else {
      const hit = this._getSettingsHit(mx, my);
      if (!hit) return;
      if (hit === 'back') { this._page = 'main'; }
      else if (hit.startsWith('tab-'))    { this._tab = hit.slice(4); }
      else if (hit.startsWith('toggle-')) { const k=hit.slice(7); this.settings[k]=!this.settings[k]; }
      else if (hit === 'renderDistance-') { this.settings.renderDistance = Math.max(2, this.settings.renderDistance-1); }
      else if (hit === 'renderDistance+') { this.settings.renderDistance = Math.min(8, this.settings.renderDistance+1); }
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('click',     this._onClick);
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mouseup',   this._onUp);
  }
}
