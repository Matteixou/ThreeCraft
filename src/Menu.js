const SPLASHES = [
  'Maintenant en 3D !', 'Pas de creepers ici !', '100% voxels !',
  'Fait avec Three.js !', 'AZERTY compatible !', 'Survie activée !',
  'Les nuages bougent !', 'Biomes procéduraux !', 'Jour et nuit !',
  'Faim et santé !', 'Craft disponible !', 'Caves à explorer !',
  'Villages et châteaux !', 'Minerais cachés !', 'Chambres secrètes !',
  'Obsidienne introuvable !', 'Diamonds inside !', 'Biomes variés !',
];

export const defaultSettings = {
  shadows: false,
  fog: true,
  renderDistance: 3,
  volume: 70,
};

export class Menu {
  constructor(canvasEl, onPlay) {
    this.canvas   = canvasEl;
    this.ctx      = canvasEl.getContext('2d');
    this.onPlay   = onPlay;
    this.splash   = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.settings = { ...defaultSettings };

    this._page     = 'main';
    this._tab      = 'graphics';
    this._phase    = 0;
    this._hMain    = -1;
    this._hSet     = null;
    this._dragging = null;

    // Particules flottantes
    this._particles = Array.from({ length: 45 }, () => this._mkParticle(true));
    // Nuages (init lazy)
    this._clouds  = null;
    // Cache silhouette horizon
    this._horizon = null;

    this._onMove  = this._onMove.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onDown  = this._onDown.bind(this);
    this._onUp    = this._onUp.bind(this);
    canvasEl.addEventListener('mousemove',  this._onMove);
    canvasEl.addEventListener('click',      this._onClick);
    canvasEl.addEventListener('mousedown',  this._onDown);
    canvasEl.addEventListener('mouseup',    this._onUp);
    window.addEventListener('resize', () => {
      this._resize();
      this._horizon = null;
      this._clouds  = null;
    });
    this._resize();
    this._loop();
  }

  _mkParticle(init = false) {
    const W = this.canvas.width || window.innerWidth;
    const H = this.canvas.height || window.innerHeight;
    return {
      x:       Math.random() * W,
      y:       init ? Math.random() * H : H + 10,
      vy:      -(0.25 + Math.random() * 0.65),
      vx:      (Math.random() - 0.5) * 0.35,
      size:    0.8 + Math.random() * 2.2,
      opacity: 0.25 + Math.random() * 0.55,
      gold:    Math.random() > 0.55,
    };
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _loop() {
    this._phase += 0.016;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const W = this.canvas.width, H = this.canvas.height;

    // Particules
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) this._particles[i] = this._mkParticle(false);
    }

    // Init nuages
    if (!this._clouds) {
      this._clouds = Array.from({ length: 8 }, (_, i) => ({
        x:     (i / 8) * W * 1.5,
        y:     H * 0.06 + (i % 4) * H * 0.055,
        cols:  5 + (i * 3) % 5,
        rows:  2 + i % 2,
        bs:    16 + (i * 5) % 14,
        speed: 0.18 + (i * 0.06),
      }));
    }
    for (const c of this._clouds) {
      c.x += c.speed;
      if (c.x > W + c.cols * c.bs + 40) c.x = -c.cols * c.bs - 40;
    }
  }

  // ── Rendu principal ──────────────────────────────────────────────────────────
  _draw() {
    const W = this.canvas.width, H = this.canvas.height;
    this._drawBackground(W, H);
    if (this._page === 'main') this._drawMain(W, H);
    else                       this._drawSettings(W, H);
    // Footer
    this.ctx.globalAlpha = 0.28;
    this.ctx.fillStyle   = '#fff';
    this.ctx.font        = '11px monospace';
    this.ctx.textAlign   = 'center';
    this.ctx.fillText('ThreeCraft  •  EFREI Project 2025-2026', W / 2, H - 11);
    this.ctx.globalAlpha = 1;
  }

  // ── Fond animé ───────────────────────────────────────────────────────────────
  _drawBackground(W, H) {
    const ctx = this.ctx;

    // Ciel dégradé nuit/crépuscule
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0,    '#050c1e');
    sky.addColorStop(0.25, '#0e1f44');
    sky.addColorStop(0.60, '#1a4278');
    sky.addColorStop(1,    '#2a6aaa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    this._drawStars(W, H);
    this._drawMoon(W, H);
    this._drawClouds(W, H);
    this._drawHorizon(W, H);
    this._drawGround(W, H);
    this._drawParticles();

    // Vignette
    const vig = ctx.createRadialGradient(W/2, H*0.42, H*0.04, W/2, H*0.42, Math.max(W,H)*0.76);
    vig.addColorStop(0, 'rgba(0,0,0,0.04)');
    vig.addColorStop(1, 'rgba(0,0,0,0.76)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  _drawStars(W, H) {
    const ctx = this.ctx, t = this._phase;
    for (let i = 0; i < 160; i++) {
      const sx  = ((i * 1234567 + 89)  % W);
      const sy  = ((i * 987654  + 123) % (H * 0.58));
      const twk = 0.35 + Math.sin(t * 2.1 + i * 0.83) * 0.28;
      const sz  = i % 4 === 0 ? 1.8 : i % 7 === 0 ? 1.4 : 0.9;
      ctx.fillStyle = i % 9 === 0 ? `rgba(200,220,255,${twk})` : `rgba(255,255,255,${twk})`;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  _drawMoon(W, H) {
    const ctx = this.ctx;
    const mx = W * 0.82, my = H * 0.14, mr = 28;
    // Halo
    const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 2.8);
    halo.addColorStop(0, 'rgba(180,200,255,0.18)');
    halo.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(mx, my, mr * 2.8, 0, Math.PI * 2); ctx.fill();
    // Disque
    ctx.fillStyle = '#d0dfff';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    // Cratère
    ctx.fillStyle = 'rgba(160,180,220,0.5)';
    [[mx-8, my-6, 5],[mx+8, my+4, 3],[mx-2, my+9, 4]].forEach(([cx,cy,r]) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    });
  }

  _drawClouds(W, H) {
    if (!this._clouds) return;
    const ctx = this.ctx;
    for (const c of this._clouds) {
      // Nuage pixel-art style Minecraft
      ctx.fillStyle = 'rgba(210,225,245,0.16)';
      for (let ry = 0; ry < c.rows; ry++) {
        for (let rx = 0; rx < c.cols; rx++) {
          // Forme arrondie sur les bords
          const edge = rx === 0 || rx === c.cols - 1;
          const top  = ry === 0 && edge;
          if (top) continue;
          ctx.fillRect(
            c.x + rx * c.bs,
            c.y + ry * (c.bs * 0.55),
            c.bs - 1,
            c.bs * 0.55 - 1,
          );
        }
      }
    }
  }

  _drawHorizon(W, H) {
    const ctx = this.ctx;
    const hy  = H * 0.64;

    // Générer le cache de hauteur une seule fois
    if (!this._horizon || this._horizon.length !== W) {
      this._horizon = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const h = Math.sin(x * 0.009) * 0.44
                + Math.sin(x * 0.024 + 1.4) * 0.28
                + Math.sin(x * 0.058 + 0.8) * 0.16
                + Math.sin(x * 0.14  + 2.2) * 0.08
                + Math.sin(x * 0.28  + 0.5) * 0.04;
        this._horizon[x] = (h + 1) / 2;
      }
    }

    // Montagne arrière (très sombre)
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) ctx.lineTo(x, hy - this._horizon[x] * H * 0.20);
    ctx.lineTo(W, H); ctx.closePath();
    const mg = ctx.createLinearGradient(0, hy - H*0.20, 0, hy);
    mg.addColorStop(0, 'rgba(14,22,42,0.9)');
    mg.addColorStop(1, 'rgba(20,40,20,0.7)');
    ctx.fillStyle = mg; ctx.fill();

    // Montagne avant (plus claire)
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) {
      const hv = this._horizon[(x + Math.floor(W * 0.3)) % W];
      ctx.lineTo(x, hy + H*0.04 - hv * H * 0.13);
    }
    ctx.lineTo(W, H); ctx.closePath();
    const mg2 = ctx.createLinearGradient(0, hy, 0, hy + H*0.04);
    mg2.addColorStop(0, 'rgba(20,50,20,0.85)');
    mg2.addColorStop(1, 'rgba(30,60,15,0.6)');
    ctx.fillStyle = mg2; ctx.fill();

    // Silhouette d'arbres pixelisés sur la crête
    ctx.fillStyle = 'rgba(12,30,12,0.95)';
    for (let x = 12; x < W - 12; x += 14 + (x * 7) % 18) {
      const hv  = this._horizon[x] || 0.5;
      const ty  = hy - hv * H * 0.20 - 2;
      const th  = 22 + (x * 13) % 28;
      const tw  = 10 + (x * 7)  % 10;
      ctx.fillRect(x + tw/2 - 2, ty - th * 0.38, 4, th * 0.38);
      [[0.0, 0.38, 1.0],[0.15, 0.60, 0.82],[0.28, 0.80, 0.64]].forEach(([yo, ws]) => {
        ctx.fillRect(x + tw*(1-ws)/2, ty - th*(yo+0.22), tw*ws, th*0.20);
      });
    }
  }

  _drawGround(W, H) {
    const ctx = this.ctx;
    const gy  = H * 0.80;
    const gg  = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0,    '#2e5e18');
    gg.addColorStop(0.08, '#3d5520');
    gg.addColorStop(0.22, '#4a3818');
    gg.addColorStop(1,    '#2c200e');
    ctx.fillStyle = gg;
    ctx.fillRect(0, gy, W, H - gy);

    // Ligne herbe pixelisée
    ctx.fillStyle = '#4a8a1e';
    for (let x = 0; x < W; x += 4) {
      const bump = ((x * 7 + 13) % 5) - 2;
      ctx.fillRect(x, gy + bump, 4, 4);
    }
    ctx.fillStyle = '#5aaa28';
    for (let x = 2; x < W; x += 6) {
      const bump = ((x * 11 + 7) % 4) - 2;
      ctx.fillRect(x, gy + bump - 2, 2, 4);
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this._particles) {
      ctx.globalAlpha = p.opacity * 0.65;
      ctx.fillStyle   = p.gold ? '#ffdd44' : '#aaccff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ══ PAGE PRINCIPALE ══════════════════════════════════════════════════════════
  _drawMain(W, H) {
    this._drawTitle(W, H);
    this._drawSplash(W, H);
    this._drawMainBtns(W, H);
  }

  _mainBtns(W, H) {
    const BW = Math.min(420, W * 0.46), BH = 56, cx = W / 2, y0 = H * 0.555;
    return [
      { label: '▶  Jouer',      x: cx - BW/2, y: y0,       w: BW, h: BH, accent: false },
      { label: '⚙  Paramètres', x: cx - BW/2, y: y0 + 76,  w: BW, h: BH, accent: false },
      { label: '✕  Quitter',    x: cx - BW/2, y: y0 + 152, w: BW, h: BH, accent: true  },
    ];
  }

  _drawTitle(W, H) {
    const ctx = this.ctx;
    const fs  = Math.min(98, W / 8.2);
    const tx  = W / 2, ty = H * 0.275;
    const pul = 1 + Math.sin(this._phase * 1.1) * 0.025;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(pul, pul);
    ctx.font      = `900 ${fs}px monospace`;
    ctx.textAlign = 'center';

    // Ombre noire profonde (multicouche)
    for (let i = 10; i >= 1; i--) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + i * 0.022})`;
      ctx.fillText('ThreeCraft', i * 1.4, i * 1.4);
    }
    // Ombre brune Minecraft
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = `rgba(90,35,0,${0.75 - i * 0.06})`;
      ctx.fillText('ThreeCraft', i * 0.8, i * 0.8);
    }

    // Gradient principal or-blanc
    const g = ctx.createLinearGradient(0, -fs * 0.82, 0, fs * 0.18);
    g.addColorStop(0,    '#ffffff');
    g.addColorStop(0.12, '#fff5a0');
    g.addColorStop(0.38, '#ffd700');
    g.addColorStop(0.72, '#e07800');
    g.addColorStop(1,    '#7a3800');
    ctx.fillStyle = g;
    ctx.fillText('ThreeCraft', 0, 0);

    // Contour blanc léger
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth   = 1.2;
    ctx.strokeText('ThreeCraft', 0, 0);

    // Halo pulsant
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 32 + Math.sin(this._phase) * 12;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle   = '#ffee88';
    ctx.fillText('ThreeCraft', 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    ctx.restore();

    // Sous-titre édition
    ctx.font      = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200,220,255,0.50)';
    ctx.fillText('ÉDITION EFREI  •  2025-2026', tx, ty + fs * 0.55);
  }

  _drawSplash(W, H) {
    const ctx = this.ctx;
    const sc  = 1 + Math.sin(this._phase * 1.9) * 0.065;
    ctx.save();
    ctx.translate(W * 0.625, H * 0.375);
    ctx.rotate(-0.30);
    ctx.scale(sc, sc);
    ctx.font      = 'bold 15px monospace';
    ctx.textAlign = 'center';
    // Ombre
    ctx.fillStyle = 'rgba(110,75,0,0.85)';
    ctx.fillText(this.splash, 2, 2);
    // Texte jaune brillant
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#ffff44';
    ctx.fillText(this.splash, 0, 0);
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  _drawMainBtns(W, H) {
    this._mainBtns(W, H).forEach((b, i) => this._drawBtn(b, this._hMain === i));
  }

  // ══ PAGE PARAMÈTRES ══════════════════════════════════════════════════════════
  _drawSettings(W, H) {
    const ctx = this.ctx;
    const PW  = Math.min(590, W * 0.70), PH = Math.min(445, H * 0.68);
    const PX  = (W - PW) / 2, PY = (H - PH) / 2;

    // Fond panel verre sombre
    ctx.fillStyle = 'rgba(6,12,26,0.93)';
    this._rr(PX, PY, PW, PH, 12); ctx.fill();

    // Bordure luisante
    const bg = ctx.createLinearGradient(PX, PY, PX, PY + PH);
    bg.addColorStop(0, 'rgba(70,130,220,0.65)');
    bg.addColorStop(1, 'rgba(30,60,110,0.30)');
    ctx.strokeStyle = bg; ctx.lineWidth = 2;
    this._rr(PX, PY, PW, PH, 12); ctx.stroke();

    // Bande titre
    const hg = ctx.createLinearGradient(PX, PY, PX, PY + 50);
    hg.addColorStop(0, 'rgba(40,80,180,0.40)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    this._rr(PX, PY, PW, 50, 12); ctx.fill();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 10;
    ctx.fillText('⚙  PARAMÈTRES', W / 2, PY + 32);
    ctx.shadowBlur = 0;

    // Onglets
    const tabLabels = ['🖥  Graphismes', '🔊  Son', '🎮  Touches'];
    const tabKeys   = ['graphics', 'sound', 'controls'];
    const TW = PW / 3;
    tabLabels.forEach((tl, i) => {
      const tx2 = PX + i * TW, ty = PY + 52, tw = TW - 2, th = 36;
      const active = this._tab === tabKeys[i];
      if (active) {
        const tg = ctx.createLinearGradient(tx2+1, ty, tx2+1, ty+th);
        tg.addColorStop(0, 'rgba(60,115,235,0.90)');
        tg.addColorStop(1, 'rgba(30,70,170,0.75)');
        ctx.fillStyle = tg;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.055)';
      }
      ctx.fillRect(tx2+1, ty, tw, th);
      ctx.strokeStyle = active ? 'rgba(110,165,255,0.75)' : 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1; ctx.strokeRect(tx2+1, ty, tw, th);
      ctx.fillStyle = active ? '#ffffff' : '#667788';
      ctx.font = `${active ? 'bold ' : ''}12px monospace`; ctx.textAlign = 'center';
      ctx.fillText(tl, tx2 + TW/2, ty + 24);
    });

    // Séparateur
    const cY = PY + 94;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PX+14, cY); ctx.lineTo(PX+PW-14, cY); ctx.stroke();

    if (this._tab === 'graphics') this._drawGraphicsTab(PX, cY, PW);
    if (this._tab === 'sound')    this._drawSoundTab(PX, cY, PW);
    if (this._tab === 'controls') this._drawControlsTab(PX, cY, PW);

    // Bouton Retour
    const bw = 200, bh = 46, bx = W/2 - bw/2, by = PY + PH - 64;
    this._drawBtn({ label: '←  Retour', x: bx, y: by, w: bw, h: bh }, this._hSet === 'back');
  }

  _drawGraphicsTab(PX, startY, PW) {
    const rows = [
      { label: 'Ombres',            key: 'shadows',        type: 'toggle'  },
      { label: 'Brouillard',        key: 'fog',            type: 'toggle'  },
      { label: 'Distance de rendu', key: 'renderDistance', type: 'stepper', min:2, max:8 },
    ];
    rows.forEach((row, i) => this._drawSettingRow(PX, startY + 22 + i * 64, PW, row));
  }

  _drawSoundTab(PX, startY, PW) {
    this._drawSettingRow(PX, startY + 22, PW,
      { label: '🔊  Volume maître', key: 'volume', type: 'slider', min: 0, max: 100 });
  }

  _drawControlsTab(PX, startY, PW) {
    const ctx = this.ctx;
    const binds = [
      ['Avancer',          'Z / W'],
      ['Reculer',          'S'],
      ['Gauche / Droite',  'Q A / D'],
      ['Sauter',           'Espace'],
      ['Inventaire',       'E'],
      ['Casser un bloc',   'Clic gauche'],
      ['Poser / Manger',   'Clic droit'],
      ['Sélection rapide', '&é"\'(-è_ç'],
    ];
    binds.forEach(([label, key], i) => {
      const ry = startY + 12 + i * 34;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(PX + 14, ry, PW - 28, 28);
      ctx.fillStyle = '#8899bb'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(label, PX + 26, ry + 19);
      ctx.fillStyle = '#ddeeff'; ctx.textAlign = 'right';
      ctx.fillText(key, PX + PW - 26, ry + 19);
    });
  }

  _drawSettingRow(PX, ry, PW, row) {
    const ctx = this.ctx;
    ctx.fillStyle = '#b8d0f0'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(row.label, PX + 26, ry + 20);

    if (row.type === 'toggle') {
      const val = this.settings[row.key];
      const bx = PX + PW - 110, bw = 86, bh = 34;
      const tg = ctx.createLinearGradient(bx, ry, bx, ry + bh);
      tg.addColorStop(0, val ? '#28b858' : '#b83030');
      tg.addColorStop(1, val ? '#145c2c' : '#5c1414');
      ctx.fillStyle = tg;
      this._rr(bx, ry, bw, bh, 6); ctx.fill();
      ctx.strokeStyle = val ? 'rgba(60,240,100,0.45)' : 'rgba(240,60,60,0.45)';
      ctx.lineWidth = 1.5; this._rr(bx, ry, bw, bh, 6); ctx.stroke();
      // Highlight interne
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      this._rr(bx+2, ry+2, bw-4, bh*0.42, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(val ? '✔  ON' : '✗  OFF', bx + bw/2, ry + 22);
    }

    if (row.type === 'stepper') {
      const val = this.settings[row.key];
      const cx  = PX + PW - 126;
      [[0, '-'], [68, '+']].forEach(([ox, sym]) => {
        const bx2 = cx + ox, bh = 32, bw = 32;
        const hov  = this._hSet === row.key + sym;
        const sg = ctx.createLinearGradient(bx2, ry, bx2, ry+bh);
        sg.addColorStop(0, hov ? '#5a6aaa' : '#344060');
        sg.addColorStop(1, hov ? '#303a6e' : '#1c2240');
        ctx.fillStyle = sg;
        this._rr(bx2, ry, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = hov ? 'rgba(120,160,255,0.7)' : 'rgba(80,100,180,0.4)';
        ctx.lineWidth = 1; this._rr(bx2, ry, bw, bh, 5); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
        ctx.fillText(sym, bx2 + bw/2, ry + 22);
      });
      ctx.fillStyle = '#cce0ff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${val}`, cx + 34, ry + 22);
    }

    if (row.type === 'slider') {
      const val = this.settings[row.key];
      const t   = (val - row.min) / (row.max - row.min);
      const sx  = PX + 26, sw = PW - 52, sh = 8, sy = ry + 38;
      // Track
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      this._rr(sx, sy, sw, sh, 4); ctx.fill();
      // Remplissage
      const fg = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      fg.addColorStop(0, '#2255dd');
      fg.addColorStop(1, '#55aaff');
      ctx.fillStyle = fg;
      if (t > 0) { this._rr(sx, sy, sw * t, sh, 4); ctx.fill(); }
      // Handle
      const hx = sx + sw * t;
      ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 10;
      ctx.fillStyle   = '#fff';
      ctx.beginPath(); ctx.arc(hx, sy + sh/2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#99bbee'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${val}%`, PX + PW - 26, ry + 20);
    }
  }

  // ── Bouton générique ─────────────────────────────────────────────────────────
  _drawBtn(b, hov) {
    const ctx = this.ctx;

    // Ombre portée
    ctx.shadowColor   = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur    = hov ? 22 : 10;
    ctx.shadowOffsetY = hov ? 2  : 5;

    // Fond dégradé
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    if (hov) {
      g.addColorStop(0, '#90baff');
      g.addColorStop(0.5, '#4a7ee8');
      g.addColorStop(1, '#1a3aaa');
    } else {
      g.addColorStop(0, '#4060bb');
      g.addColorStop(0.5, '#2a449e');
      g.addColorStop(1, '#0c1c62');
    }
    ctx.fillStyle = g;
    this._rr(b.x, b.y, b.w, b.h, 5); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Highlight haut
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    this._rr(b.x + 2, b.y + 2, b.w - 4, b.h * 0.38, 4); ctx.fill();

    // Bordure
    ctx.strokeStyle = hov ? 'rgba(150,200,255,0.90)' : 'rgba(75,115,200,0.65)';
    ctx.lineWidth   = 1.5;
    this._rr(b.x, b.y, b.w, b.h, 5); ctx.stroke();

    // Coins pixels style Minecraft
    ctx.fillStyle = '#04091e';
    [[b.x, b.y],[b.x+b.w-3, b.y],[b.x, b.y+b.h-3],[b.x+b.w-3, b.y+b.h-3]]
      .forEach(([px, py]) => ctx.fillRect(px, py, 3, 3));

    // Texte (avec ombre)
    const fs = Math.min(20, b.h * 0.40);
    ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,15,70,0.55)';
    ctx.fillText(b.label, b.x + b.w/2 + 1, b.y + b.h * 0.64 + 1);
    ctx.fillStyle = hov ? '#ffffff' : '#c8dcff';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h * 0.64);
  }

  _rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  // ── Hit-tests ────────────────────────────────────────────────────────────────
  _inRect(mx, my, x, y, w, h) { return mx>=x && mx<=x+w && my>=y && my<=y+h; }

  _getSettingsHit(mx, my) {
    const W=this.canvas.width, H=this.canvas.height;
    const PW=Math.min(590,W*0.70), PH=Math.min(445,H*0.68);
    const PX=(W-PW)/2, PY=(H-PH)/2;

    const bw=200, bh=46, bx=W/2-bw/2, by=PY+PH-64;
    if (this._inRect(mx,my,bx,by,bw,bh)) return 'back';

    const TW=PW/3, tabKeys=['graphics','sound','controls'];
    for (let i=0;i<3;i++)
      if (this._inRect(mx,my,PX+i*TW+1,PY+52,TW-2,36)) return 'tab-'+tabKeys[i];

    const cY=PY+94;
    if (this._tab==='graphics') {
      const rows=[{key:'shadows',type:'toggle'},{key:'fog',type:'toggle'},{key:'renderDistance',type:'stepper'}];
      for (let i=0;i<rows.length;i++) {
        const row=rows[i], ry=cY+22+i*64;
        if (row.type==='toggle'  && this._inRect(mx,my,PX+PW-110,ry,86,34))  return 'toggle-'+row.key;
        if (row.type==='stepper') {
          const cx=PX+PW-126;
          if (this._inRect(mx,my,cx,ry,32,32))   return row.key+'-';
          if (this._inRect(mx,my,cx+68,ry,32,32)) return row.key+'+';
        }
      }
    }
    if (this._tab==='sound') {
      const sx=PX+26, sw=PW-52, sy=cY+22+38;
      if (this._inRect(mx,my,sx-10,sy-10,sw+20,28)) return 'slider-volume';
    }
    return null;
  }

  // ── Événements ───────────────────────────────────────────────────────────────
  _onMove(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    if (this._page==='main') {
      const old=this._hMain;
      this._hMain=this._mainBtns(this.canvas.width,this.canvas.height)
        .findIndex(b=>this._inRect(mx,my,b.x,b.y,b.w,b.h));
      if (this._hMain!==old) this.canvas.style.cursor=this._hMain>=0?'pointer':'default';
    } else {
      const hit=this._getSettingsHit(mx,my);
      this._hSet=hit;
      this.canvas.style.cursor=hit?'pointer':'default';
      if (this._dragging) {
        const W=this.canvas.width, PW=Math.min(590,W*0.70), PX=(W-PW)/2;
        const sx=PX+26, sw=PW-52;
        const t=Math.max(0,Math.min(1,(mx-sx)/sw));
        this.settings[this._dragging]=Math.round(t*100);
      }
    }
  }

  _onDown(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    if (this._getSettingsHit(mx,my)==='slider-volume') this._dragging='volume';
  }

  _onUp() { this._dragging=null; }

  _onClick(e) {
    const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    if (this._page==='main') {
      const i=this._mainBtns(this.canvas.width,this.canvas.height)
        .findIndex(b=>this._inRect(mx,my,b.x,b.y,b.w,b.h));
      if (i===0) this.onPlay(this.settings);
      if (i===1) this._page='settings';
      if (i===2) window.close();
    } else {
      const hit=this._getSettingsHit(mx,my);
      if (!hit) return;
      if (hit==='back')                   this._page='main';
      else if (hit.startsWith('tab-'))    this._tab=hit.slice(4);
      else if (hit.startsWith('toggle-')) { const k=hit.slice(7); this.settings[k]=!this.settings[k]; }
      else if (hit==='renderDistance-')   this.settings.renderDistance=Math.max(2,this.settings.renderDistance-1);
      else if (hit==='renderDistance+')   this.settings.renderDistance=Math.min(8,this.settings.renderDistance+1);
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener('mousemove',  this._onMove);
    this.canvas.removeEventListener('click',      this._onClick);
    this.canvas.removeEventListener('mousedown',  this._onDown);
    this.canvas.removeEventListener('mouseup',    this._onUp);
  }
}
