window.Game = window.Game || {};

(function (Game) {
  class TextureAtlas {
    constructor() {
      this.cache = {};
    }

    _makeCanvasTexture(key, width, height, drawFn) {
      if (this.cache[key]) return this.cache[key];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      drawFn(ctx, width, height);
      const tex = PIXI.Texture.from(canvas);
      this.cache[key] = tex;
      return tex;
    }

    init() {
      // 1. Arena Floor Tile (128x128)
      this._makeCanvasTexture('floor_tile', 128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, w, h);

        // Subtle stone grid & bevel
        ctx.strokeStyle = '#162238';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);

        // Inner rune lines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();

        // Corner rivets
        ctx.fillStyle = '#1e293b';
        const pts = [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]];
        pts.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Subtle surface grain
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
      });

      // 2. Drop Shadow
      this._makeCanvasTexture('shadow', 64, 32, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      // 3. Player Frames (Idle / Run 0 & Run 1)
      [0, 1].forEach((frame) => {
        this._makeCanvasTexture(`player_${frame}`, 72, 72, (ctx, w, h) => {
          const cx = w / 2;
          const cy = h / 2;
          const offset = frame === 0 ? -2 : 2;

          // Arcane Cape
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(cx - 16, cy - 10);
          ctx.lineTo(cx - 26 - offset, cy);
          ctx.lineTo(cx - 16, cy + 12);
          ctx.closePath();
          ctx.fill();

          // Armored Shoulders
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 12 + offset * 0.5, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy + 12 - offset * 0.5, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Core Torso
          const bodyGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
          bodyGrad.addColorStop(0, '#e0f2fe');
          bodyGrad.addColorStop(0.5, '#0ea5e9');
          bodyGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = bodyGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();

          // Visor / Helm Crest pointing right (+X)
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(cx + 16, cy);
          ctx.lineTo(cx + 3, cy - 7);
          ctx.lineTo(cx + 3, cy + 7);
          ctx.closePath();
          ctx.fill();

          // Glowing Eye Slit
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(cx + 7, cy - 4, 4, 8);
        });
      });

      // 4. Energy Blade Slash Arc (140x140)
      this._makeCanvasTexture('slash_arc', 140, 140, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.save();
        ctx.translate(cx, cy);

        const grad = ctx.createRadialGradient(0, 0, 22, 0, 0, 66);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.45)');
        grad.addColorStop(0.92, 'rgba(224, 242, 254, 0.95)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 66, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.arc(0, 0, 26, Math.PI * 0.42, -Math.PI * 0.42, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // 5. Enemy: Skitterling (Fast Swarmer)
      this._makeCanvasTexture('enemy_skitter', 56, 56, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = '#be123c';
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 2;

        // Spiky diamond body
        ctx.beginPath();
        ctx.moveTo(cx + 20, cy);
        ctx.lineTo(cx - 4, cy - 15);
        ctx.lineTo(cx - 16, cy);
        ctx.lineTo(cx - 4, cy + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing core eye
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(cx + 5, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Enemy: Sentinel (Ranged Mage/Turret)
      this._makeCanvasTexture('enemy_sentinel', 64, 64, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = '#4c1d95';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;

        // Hexagonal frame
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = cx + Math.cos(a) * 20;
          const py = cy + Math.sin(a) * 20;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Arcane Orb Eye
        const orb = ctx.createRadialGradient(cx + 4, cy, 1, cx + 4, cy, 9);
        orb.addColorStop(0, '#ffffff');
        orb.addColorStop(0.5, '#e879f9');
        orb.addColorStop(1, '#701a75');
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(cx + 4, cy, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // 7. Enemy: Brute (Heavy Juggernaut)
      this._makeCanvasTexture('enemy_brute', 84, 84, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;

        // Heavy armor plating
        ctx.fillStyle = '#7c2d12';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(cx - 26, cy - 26, 52, 52, 10);
        ctx.fill();
        ctx.stroke();

        // Horn spikes
        ctx.fillStyle = '#fdba74';
        ctx.beginPath();
        ctx.moveTo(cx + 24, cy - 16);
        ctx.lineTo(cx + 36, cy - 10);
        ctx.lineTo(cx + 24, cy - 4);
        ctx.moveTo(cx + 24, cy + 16);
        ctx.lineTo(cx + 36, cy + 10);
        ctx.lineTo(cx + 24, cy + 4);
        ctx.fill();

        // Furnace Core
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      });

      // 8. Boss: Warden of the Core (140x140)
      this._makeCanvasTexture('boss_warden', 140, 140, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;

        // Outer Rotating Ring aesthetic
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 56, 0, Math.PI * 2);
        ctx.stroke();

        // Octagon Citadel Chassis
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i + Math.PI / 8;
          const px = cx + Math.cos(a) * 46;
          const py = cy + Math.sin(a) * 46;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Twin Front Cannons
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx + 28, cy - 26, 26, 12);
        ctx.fillRect(cx + 28, cy + 14, 26, 12);

        // Singularity Core
        const core = ctx.createRadialGradient(cx, cy, 3, cx, cy, 24);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.35, '#fb7185');
        core.addColorStop(0.75, '#9333ea');
        core.addColorStop(1, 'rgba(147, 51, 234, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();
      });

      // 9. Projectiles & Pickups
      this._makeCanvasTexture('proj_player', 32, 32, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#38bdf8');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      this._makeCanvasTexture('proj_enemy', 32, 32, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.45, '#f43f5e');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      this._makeCanvasTexture('shard_pickup', 28, 28, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 7, cy);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx - 7, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      this._makeCanvasTexture('heal_pickup', 28, 28, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ecfdf5';
        ctx.fillRect(cx - 5, cy - 1.8, 10, 3.6);
        ctx.fillRect(cx - 1.8, cy - 5, 3.6, 10);
      });

      this._makeCanvasTexture('particle_glow', 24, 24, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(12, 12, 1, 12, 12, 11);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });
    }

    get(key) {
      return this.cache[key];
    }
  }

  Game.Textures = new TextureAtlas();
})(window.Game);
