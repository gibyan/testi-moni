window.Game = window.Game || {};

(function (Game) {
  class ChronoArenaGame {
    constructor() {
      this.saveData = Game.SaveManager.load();
      this.state = 'MENU'; // MENU | PLAYING | PAUSED | LEVELUP | GAMEOVER

      this.isMobile =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 820;
      if (this.isMobile) {
        document.body.classList.add('is-mobile');
      }

      this._initPixi();
      this._buildArenaEnvironment();

      this.particles = new Game.Entities.ParticleSystem(this.fxLayer);
      this.player = null;
      this.enemies = [];
      this.projectiles = [];
      this.pickups = [];
      this.slashes = [];

      // Camera & Juice states
      this.camX = 0;
      this.camY = 0;
      this.shakeTime = 0;
      this.shakeIntensity = 0;
      this.hitStopTimer = 0;

      // Run Progression
      this.wave = 1;
      this.waveEnemiesRemaining = 0;
      this.spawnTimer = 0;
      this.waveClearDelay = 0;
      this.score = 0;
      this.kills = 0;
      this.runShards = 0;
      this.level = 1;
      this.xp = 0;
      this.xpToNext = 50;
      this.combo = 0;
      this.comboTimer = 0;

      // Input state
      this.keys = {};
      this.mouseX = window.innerWidth / 2;
      this.mouseY = window.innerHeight / 2;
      this.joyX = 0;
      this.joyY = 0;
      this.joyTouchId = null;

      this._bindUIEvents();
      this._bindInputEvents();
      this._refreshMainMenuStats();

      this.app.ticker.add((delta) => {
        const dt = Math.min(0.05, delta / 60);
        this._update(dt);
      });
    }

    _initPixi() {
      const container = document.getElementById('canvas-container');
      this.app = new PIXI.Application({
        resizeTo: window,
        backgroundColor: 0x060a12,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true
      });
      container.appendChild(this.app.view);

      Game.Textures.init();

      this.world = new PIXI.Container();
      this.app.stage.addChild(this.world);

      this.bgLayer = new PIXI.Container();
      this.pickupLayer = new PIXI.Container();
      this.entityLayer = new PIXI.Container();
      this.fxLayer = new PIXI.Container();

      this.world.addChild(this.bgLayer);
      this.world.addChild(this.pickupLayer);
      this.world.addChild(this.entityLayer);
      this.world.addChild(this.fxLayer);
    }

    _buildArenaEnvironment() {
      const R = Game.Config.ARENA_RADIUS;
      const floorTile = new PIXI.TilingSprite(
        Game.Textures.get('floor_tile'),
        R * 2.4,
        R * 2.4
      );
      floorTile.anchor.set(0.5);

      const maskGfx = new PIXI.Graphics();
      maskGfx.beginFill(0xffffff);
      maskGfx.drawCircle(0, 0, R);
      maskGfx.endFill();
      floorTile.mask = maskGfx;

      const borderGfx = new PIXI.Graphics();
      // Outer glowing energy barrier
      borderGfx.lineStyle(12, 0x0284c7, 0.25);
      borderGfx.drawCircle(0, 0, R + 4);
      borderGfx.lineStyle(4, 0x38bdf8, 0.85);
      borderGfx.drawCircle(0, 0, R);

      // Decorative Center Chrono Seal
      borderGfx.lineStyle(2, 0x38bdf8, 0.16);
      borderGfx.drawCircle(0, 0, 240);
      borderGfx.drawCircle(0, 0, 560);

      this.bgLayer.addChild(floorTile);
      this.bgLayer.addChild(maskGfx);
      this.bgLayer.addChild(borderGfx);
    }

    _bindUIEvents() {
      document.getElementById('btn-start-game').addEventListener('click', () => {
        Game.Audio.playUI();
        this.startNewRun();
      });

      document.getElementById('btn-open-armory').addEventListener('click', () => {
        Game.Audio.playUI();
        this._renderArmory();
        document.getElementById('menu-main').classList.add('hidden');
        document.getElementById('menu-armory').classList.remove('hidden');
      });

      document.getElementById('btn-close-armory').addEventListener('click', () => {
        Game.Audio.playUI();
        document.getElementById('menu-armory').classList.add('hidden');
        document.getElementById('menu-main').classList.remove('hidden');
        this._refreshMainMenuStats();
      });

      document.getElementById('btn-mute').addEventListener('click', (e) => {
        const muted = Game.Audio.toggleMute();
        e.currentTarget.textContent = muted ? '🔇' : '🔊';
      });

      document.getElementById('btn-pause').addEventListener('click', () => {
        if (this.state === 'PLAYING') {
          Game.Audio.playUI();
          this.state = 'PAUSED';
          document.getElementById('menu-pause').classList.remove('hidden');
        }
      });

      document.getElementById('btn-resume').addEventListener('click', () => {
        Game.Audio.playUI();
        this.state = 'PLAYING';
        document.getElementById('menu-pause').classList.add('hidden');
      });

      document.getElementById('btn-restart-pause').addEventListener('click', () => {
        Game.Audio.playUI();
        document.getElementById('menu-pause').classList.add('hidden');
        this.startNewRun();
      });

      document.getElementById('btn-quit-menu').addEventListener('click', () => {
        Game.Audio.playUI();
        this._returnToMainMenu();
      });

      document.getElementById('btn-play-again').addEventListener('click', () => {
        Game.Audio.playUI();
        document.getElementById('menu-gameover').classList.add('hidden');
        this.startNewRun();
      });

      document.getElementById('btn-go-menu').addEventListener('click', () => {
        Game.Audio.playUI();
        this._returnToMainMenu();
      });
    }

    _bindInputEvents() {
      window.addEventListener('keydown', (e) => {
        const code = e.code;
        this.keys[code] = true;
        if (this.state !== 'PLAYING') return;

        if (code === 'Space' || code === 'ShiftLeft') {
          e.preventDefault();
          this._triggerDash();
        } else if (code === 'KeyE') {
          this._triggerShoot();
        } else if (code === 'KeyQ') {
          this._triggerNova();
        } else if (code === 'Escape') {
          this.state = 'PAUSED';
          document.getElementById('menu-pause').classList.remove('hidden');
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      const canvas = this.app.view;
      canvas.addEventListener('pointermove', (e) => {
        if (!this.isMobile) {
          this.mouseX = e.clientX;
          this.mouseY = e.clientY;
        }
      });

      canvas.addEventListener('pointerdown', (e) => {
        if (this.state !== 'PLAYING' || this.isMobile) return;
        if (e.button === 0) {
          this._triggerSlash();
        } else if (e.button === 2) {
          this._triggerShoot();
        }
      });

      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Mobile Virtual Joystick
      const joyZone = document.getElementById('joystick-zone');
      const joyStick = document.getElementById('joystick-stick');
      const maxDist = 42;

      const updateJoy = (clientX, clientY) => {
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joyX = dx / maxDist;
        this.joyY = dy / maxDist;
      };

      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.joyTouchId = touch.identifier;
        updateJoy(touch.clientX, touch.clientY);
      }, { passive: false });

      joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joyTouchId) {
            updateJoy(t.clientX, t.clientY);
          }
        }
      }, { passive: false });

      const resetJoy = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joyTouchId) {
            this.joyTouchId = null;
            this.joyX = 0;
            this.joyY = 0;
            joyStick.style.transform = 'translate(0px, 0px)';
          }
        }
      };

      joyZone.addEventListener('touchend', resetJoy);
      joyZone.addEventListener('touchcancel', resetJoy);

      // Mobile Action Buttons
      document.getElementById('touch-attack').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') this._triggerSlash();
      }, { passive: false });

      document.getElementById('touch-shoot').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') this._triggerShoot();
      }, { passive: false });

      document.getElementById('touch-dash').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') this._triggerDash();
      }, { passive: false });

      document.getElementById('touch-nova').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') this._triggerNova();
      }, { passive: false });
    }

    _refreshMainMenuStats() {
      document.getElementById('menu-bank-shards').textContent = `◆ ${this.saveData.shards}`;
      document.getElementById('menu-best-wave').textContent = `WAVE ${this.saveData.bestWave}`;
      document.getElementById('menu-high-score').textContent = this.saveData.highScore;
    }

    _renderArmory() {
      document.getElementById('armory-shards').textContent = this.saveData.shards;
      const grid = document.getElementById('armory-grid');
      grid.innerHTML = '';

      Game.ArmoryUpgrades.forEach((upg) => {
        const curLvl = this.saveData.armory[upg.id] || 0;
        const isMax = curLvl >= upg.maxLevel;
        const cost = Game.SaveManager.getUpgradeCost(upg);

        const card = document.createElement('div');
        card.className = 'armory-item';
        card.innerHTML = `
          <div>
            <h4>${upg.name} (Lv.${curLvl}/${upg.maxLevel})</h4>
            <p>${upg.desc}</p>
          </div>
          <button class="armory-buy-btn" ${isMax || this.saveData.shards < cost ? 'disabled' : ''}>
            ${isMax ? 'MAXED' : `UPGRADE (◆ ${cost})`}
          </button>
        `;

        card.querySelector('button').addEventListener('click', () => {
          if (!isMax && this.saveData.shards >= cost) {
            this.saveData.shards -= cost;
            this.saveData.armory[upg.id] = curLvl + 1;
            Game.SaveManager.save();
            Game.Audio.playLevelUp();
            this._renderArmory();
          }
        });

        grid.appendChild(card);
      });
    }

    startNewRun() {
      this._clearWorldEntities();

      this.wave = 1;
      this.score = 0;
      this.kills = 0;
      this.runShards = 0;
      this.level = 1;
      this.xp = 0;
      this.xpToNext = 50;
      this.combo = 0;
      this.comboTimer = 0;
      this.camX = 0;
      this.camY = 0;

      this.player = new Game.Entities.Player(this.entityLayer, this.saveData);

      document.getElementById('menu-main').classList.add('hidden');
      document.getElementById('menu-armory').classList.add('hidden');
      document.getElementById('menu-gameover').classList.add('hidden');
      document.getElementById('menu-pause').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');

      this.state = 'PLAYING';
      Game.Audio.startBGM();
      this._startWave(1);
      this._updateHUD();
    }

    _returnToMainMenu() {
      this._clearWorldEntities();
      Game.Audio.stopBGM();
      this.state = 'MENU';
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('menu-pause').classList.add('hidden');
      document.getElementById('menu-gameover').classList.add('hidden');
      document.getElementById('menu-main').classList.remove('hidden');
      this._refreshMainMenuStats();
    }

    _clearWorldEntities() {
      if (this.player) {
        this.player.destroy();
        this.player = null;
      }
      this.enemies.forEach((e) => e.destroy());
      this.enemies = [];

      this.projectiles.forEach((p) => {
        this.fxLayer.removeChild(p.sprite);
        p.sprite.destroy();
      });
      this.projectiles = [];

      this.pickups.forEach((pk) => {
        this.pickupLayer.removeChild(pk.sprite);
        pk.sprite.destroy();
      });
      this.pickups = [];

      this.slashes.forEach((s) => {
        this.fxLayer.removeChild(s.sprite);
        s.sprite.destroy();
      });
      this.slashes = [];

      this.particles.clear();
    }

    _startWave(waveNum) {
      this.wave = waveNum;
      const banner = document.getElementById('wave-banner');
      banner.textContent = waveNum % 5 === 0 ? `BOSS WAVE ${waveNum}` : `WAVE ${waveNum}`;
      banner.classList.remove('hidden');
      void banner.offsetWidth;
      banner.classList.add('wave-banner');

      if (waveNum % 5 === 0) {
        // Boss Wave
        this.waveEnemiesRemaining = 1 + Math.floor(waveNum / 5);
        const angle = Math.random() * Math.PI * 2;
        const boss = new Game.Entities.Boss(
          this.entityLayer,
          Math.cos(angle) * 650,
          Math.sin(angle) * 650,
          waveNum
        );
        this.enemies.push(boss);
        document.getElementById('boss-hud').classList.remove('hidden');
        document.getElementById('boss-name').textContent = boss.name;
      } else {
        this.waveEnemiesRemaining = 5 + waveNum * 3;
        document.getElementById('boss-hud').classList.add('hidden');
      }
      this.spawnTimer = 0.4;
    }

    _spawnWaveEnemy() {
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = Game.Config.ARENA_RADIUS - 65;
      const x = Math.cos(angle) * spawnDist;
      const y = Math.sin(angle) * spawnDist;

      let type = 'skitter';
      const roll = Math.random();
      if (this.wave >= 3 && roll > 0.72) {
        type = 'brute';
      } else if (this.wave >= 2 && roll > 0.42) {
        type = 'sentinel';
      }

      const scale = 1 + (this.wave - 1) * 0.14;
      const enemy = new Game.Entities.Enemy(this.entityLayer, type, x, y, scale);
      this.enemies.push(enemy);
      this.particles.spawnBurst(x, y, 0xa855f7, 8, 120, 0.3);
    }

    _getMoveVector() {
      let mx = this.joyX;
      let my = this.joyY;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
      return { mx, my };
    }

    _getAimAngle() {
      if (this.isMobile) {
        // Auto-aim to nearest enemy on mobile, or fallback to movement direction
        let nearest = null;
        let minDist = 650;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          return Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
        }
        const { mx, my } = this._getMoveVector();
        if (Math.hypot(mx, my) > 0.1) {
          return Math.atan2(my, mx);
        }
        return this.player.rotation;
      } else {
        const worldMouseX = this.mouseX - this.app.screen.width / 2 + this.camX;
        const worldMouseY = this.mouseY - this.app.screen.height / 2 + this.camY;
        return Math.atan2(worldMouseY - this.player.y, worldMouseX - this.player.x);
      }
    }

    _triggerSlash() {
      if (!this.player || this.player.slashCd > 0) return;
      this.player.slashCd = Game.Config.SLASH_COOLDOWN;
      this.player.comboStep = (this.player.comboStep % 3) + 1;

      const angle = this._getAimAngle();
      this.player.rotation = angle;
      Game.Audio.playSlash(this.player.comboStep);

      // Visual Slash Arc
      const sprite = new PIXI.Sprite(Game.Textures.get('slash_arc'));
      sprite.anchor.set(0.35, 0.5);
      sprite.x = this.player.x + Math.cos(angle) * 28;
      sprite.y = this.player.y + Math.sin(angle) * 28;
      sprite.rotation = angle;
      const scaleMult = (this.player.slashRange / 105) * (this.player.comboStep === 3 ? 1.25 : 1);
      sprite.scale.set(scaleMult, this.player.comboStep % 2 === 0 ? -scaleMult : scaleMult);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      this.fxLayer.addChild(sprite);
      this.slashes.push({ sprite, life: 0.14, maxLife: 0.14 });

      // Lunge forward slightly
      this.player.x += Math.cos(angle) * 14;
      this.player.y += Math.sin(angle) * 14;

      const comboMult = this.player.comboStep === 3 ? 1.45 : 1.0;
      let hitAny = false;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= this.player.slashRange + e.radius) {
          const enemyAngle = Math.atan2(dy, dx);
          let diff = Math.abs(enemyAngle - angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff <= Math.PI * 0.58 || dist < 45) {
            const isCrit = Math.random() < this.player.critChance;
            const dmg = this.player.slashDamage * comboMult * (isCrit ? 2.2 : 1);
            this._hitEnemy(e, dmg, isCrit, Math.cos(angle) * 260, Math.sin(angle) * 260);
            hitAny = true;
          }
        }
      }

      if (hitAny && this.player.comboStep === 3) {
        this.hitStopTimer = 0.035;
        this._addScreenShake(7, 0.14);
      }
    }

    _triggerShoot() {
      if (!this.player || this.player.shootCd > 0) return;
      this.player.shootCd = Game.Config.SHOOT_COOLDOWN;
      const baseAngle = this._getAimAngle();
      Game.Audio.playShoot();

      const count = this.player.boltCount;
      const spread = 0.14;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        this.spawnProjectile(
          this.player.x + Math.cos(baseAngle) * 22,
          this.player.y + Math.sin(baseAngle) * 22,
          baseAngle + offset,
          680,
          this.player.boltDamage,
          true
        );
      }
    }

    _triggerDash() {
      if (!this.player) return;
      const { mx, my } = this._getMoveVector();
      if (this.player.tryDash(mx, my)) {
        this.particles.spawnBurst(this.player.x, this.player.y, 0x38bdf8, 10, 180, 0.28);
        this._addScreenShake(4, 0.1);
      }
    }

    _triggerNova() {
      if (!this.player || this.player.novaCd > 0) return;
      this.player.novaCd = this.player.novaCooldownMax;
      Game.Audio.playExplosion();
      this._addScreenShake(12, 0.25);
      this.hitStopTimer = 0.04;

      this.particles.spawnBurst(this.player.x, this.player.y, 0xa855f7, 28, 420, 0.5);
      this.particles.spawnBurst(this.player.x, this.player.y, 0x38bdf8, 18, 300, 0.4);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= this.player.novaRadius + e.radius) {
          const isCrit = Math.random() < this.player.critChance;
          const dmg = this.player.novaDamage * (isCrit ? 2.0 : 1);
          this._hitEnemy(e, dmg, isCrit, (dx / dist) * 420, (dy / dist) * 420);
        }
      }
    }

    spawnProjectile(x, y, angle, speed, damage, isPlayer) {
      const sprite = new PIXI.Sprite(
        Game.Textures.get(isPlayer ? 'proj_player' : 'proj_enemy')
      );
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      this.fxLayer.addChild(sprite);

      this.projectiles.push({
        sprite,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        isPlayer,
        radius: isPlayer ? 10 : 11,
        life: 1.8
      });
    }

    _hitEnemy(enemy, damage, isCrit, kx, ky) {
      enemy.applyDamage(damage, kx, ky);
      Game.Audio.playHit(isCrit);
      this.particles.spawnBurst(enemy.x, enemy.y, isCrit ? 0xfbbf24 : 0x38bdf8, isCrit ? 9 : 5, 190, 0.28);
      this.particles.spawnDamageText(enemy.x, enemy.y, damage, isCrit);

      this.combo++;
      this.comboTimer = Game.Config.COMBO_RESET_TIME;

      // Chain Lightning Proc
      if (this.player && this.player.chainLightning > 0 && this.enemies.length > 1) {
        let target = null;
        let minD = 240;
        for (const other of this.enemies) {
          if (other === enemy || other.hp <= 0) continue;
          const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
          if (d < minD) {
            minD = d;
            target = other;
          }
        }
        if (target) {
          const arcDmg = damage * 0.55 * this.player.chainLightning;
          target.applyDamage(arcDmg, 0, 0);
          this.particles.spawnDamageText(target.x, target.y, arcDmg, false, '#38bdf8');
          this.particles.spawnBurst(target.x, target.y, 0x38bdf8, 6, 140, 0.22);
        }
      }

      if (enemy.hp <= 0) {
        this._killEnemy(enemy);
      }
    }

    _killEnemy(enemy) {
      const idx = this.enemies.indexOf(enemy);
      if (idx === -1) return;
      this.enemies.splice(idx, 1);

      this.kills++;
      this.score += enemy.score * (1 + Math.floor(this.combo / 10) * 0.1);
      this.xp += enemy.xp;

      const greedMult = 1 + (this.saveData.armory.perm_greed || 0) * 0.15;
      const totalShards = Math.max(1, Math.round(enemy.shards * greedMult));

      this.particles.spawnBurst(enemy.x, enemy.y, enemy.isBoss ? 0xf43f5e : 0xfb923c, enemy.isBoss ? 36 : 14, 280, 0.45);
      if (enemy.isBoss) {
        Game.Audio.playExplosion();
        this._addScreenShake(16, 0.35);
        document.getElementById('boss-hud').classList.add('hidden');
      }

      // Lifesteal on Kill
      if (this.player && this.player.lifestealOnKill > 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.lifestealOnKill);
      }

      // Drop Aether Shards
      const orbCount = Math.min(8, totalShards);
      const valPerOrb = Math.ceil(totalShards / orbCount);
      for (let i = 0; i < orbCount; i++) {
        this._spawnPickup(enemy.x, enemy.y, 'shard', valPerOrb);
      }

      // Chance to drop Health Orb
      if (Math.random() < 0.14 || enemy.isBoss) {
        this._spawnPickup(enemy.x, enemy.y, 'heal', 22);
      }

      enemy.destroy();
      this._checkLevelUp();
    }

    _spawnPickup(x, y, type, value) {
      const sprite = new PIXI.Sprite(
        Game.Textures.get(type === 'shard' ? 'shard_pickup' : 'heal_pickup')
      );
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      this.pickupLayer.addChild(sprite);

      const angle = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 110;
      this.pickups.push({
        sprite,
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        type,
        value,
        life: 25
      });
    }

    _checkLevelUp() {
      if (this.xp >= this.xpToNext) {
        this.xp -= this.xpToNext;
        this.level++;
        this.xpToNext = Math.round(this.xpToNext * 1.32);
        Game.Audio.playLevelUp();
        this._openLevelUpDraft();
      }
    }

    _openLevelUpDraft() {
      this.state = 'LEVELUP';
      const container = document.getElementById('upgrade-cards');
      container.innerHTML = '';

      // Pick 3 unique random upgrades
      const pool = [...Game.RunUpgrades];
      const choices = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const rIdx = Math.floor(Math.random() * pool.length);
        choices.push(pool.splice(rIdx, 1)[0]);
      }

      choices.forEach((upg) => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
          <span class="card-rarity rarity-${upg.rarity}">${upg.rarity}</span>
          <div class="card-icon">${upg.icon}</div>
          <div class="card-title">${upg.title}</div>
          <div class="card-desc">${upg.desc}</div>
        `;
        card.addEventListener('click', () => {
          Game.Audio.playUI();
          upg.apply(this.player);
          document.getElementById('menu-levelup').classList.add('hidden');
          this.state = 'PLAYING';
          this._updateHUD();
        });
        container.appendChild(card);
      });

      document.getElementById('menu-levelup').classList.remove('hidden');
    }

    damagePlayer(amount) {
      if (!this.player) return;
      if (this.player.takeDamage(amount)) {
        this._addScreenShake(10, 0.2);
        const flash = document.getElementById('damage-flash');
        flash.style.opacity = '1';
        setTimeout(() => {
          flash.style.opacity = '0';
        }, 140);

        if (this.player.hp <= 0) {
          this._triggerGameOver();
        }
      }
    }

    _triggerGameOver() {
      this.state = 'GAMEOVER';
      Game.Audio.stopBGM();
      Game.Audio.playExplosion();

      // Save progress
      this.saveData.shards += this.runShards;
      if (this.wave > this.saveData.bestWave) {
        this.saveData.bestWave = this.wave;
      }
      const finalScore = Math.round(this.score);
      if (finalScore > this.saveData.highScore) {
        this.saveData.highScore = finalScore;
      }
      Game.SaveManager.save();

      document.getElementById('go-wave').textContent = this.wave;
      document.getElementById('go-kills').textContent = this.kills;
      document.getElementById('go-score').textContent = finalScore;
      document.getElementById('go-shards').textContent = `+${this.runShards}`;
      document.getElementById('menu-gameover').classList.remove('hidden');
    }

    _addScreenShake(intensity, duration) {
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }

    _update(dt) {
      if (this.state !== 'PLAYING' || !this.player) return;

      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= dt;
        return;
      }

      // Combo decay
      if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
        }
      }

      // Wave Spawner Logic
      if (this.waveEnemiesRemaining > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this._spawnWaveEnemy();
          this.waveEnemiesRemaining--;
          this.spawnTimer = Math.max(0.35, 1.15 - this.wave * 0.04);
        }
      } else if (this.enemies.length === 0) {
        this.waveClearDelay += dt;
        if (this.waveClearDelay >= 1.4) {
          this.waveClearDelay = 0;
          this._startWave(this.wave + 1);
        }
      }

      // Player Update
      const { mx, my } = this._getMoveVector();
      const aimAngle = this._getAimAngle();
      this.player.update(dt, mx, my, aimAngle, this.particles);

      // Update Slash Arcs
      for (let i = this.slashes.length - 1; i >= 0; i--) {
        const s = this.slashes[i];
        s.life -= dt;
        if (s.life <= 0) {
          this.fxLayer.removeChild(s.sprite);
          s.sprite.destroy();
          this.slashes.splice(i, 1);
        } else {
          s.sprite.alpha = s.life / s.maxLife;
        }
      }

      // Update Enemies & Separation
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        e.update(dt, this.player, this);

        // Soft separation between enemies
        for (let j = i + 1; j < this.enemies.length; j++) {
          const other = this.enemies[j];
          const dx = e.x - other.x;
          const dy = e.y - other.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = e.radius + other.radius;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.5;
            e.x += (dx / dist) * push;
            e.y += (dy / dist) * push;
            other.x -= (dx / dist) * push;
            other.y -= (dy / dist) * push;
          }
        }

        if (e.isBoss) {
          const pct = Math.max(0, (e.hp / e.maxHp) * 100);
          document.getElementById('boss-hp-fill').style.width = `${pct}%`;
        }
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.sprite.x = p.x;
        p.sprite.y = p.y;

        let remove = p.life <= 0 || Math.hypot(p.x, p.y) > Game.Config.ARENA_RADIUS;

        if (!remove && p.isPlayer) {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            if (Math.hypot(p.x - e.x, p.y - e.y) <= p.radius + e.radius) {
              const isCrit = Math.random() < this.player.critChance;
              const dmg = p.damage * (isCrit ? 2.0 : 1);
              this._hitEnemy(e, dmg, isCrit, p.vx * 0.25, p.vy * 0.25);
              remove = true;
              break;
            }
          }
        } else if (!remove && !p.isPlayer) {
          if (Math.hypot(p.x - this.player.x, p.y - this.player.y) <= p.radius + this.player.radius) {
            this.damagePlayer(p.damage);
            remove = true;
          }
        }

        if (remove) {
          this.fxLayer.removeChild(p.sprite);
          p.sprite.destroy();
          this.projectiles.splice(i, 1);
        }
      }

      // Update Pickups (Magnet pull)
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.life -= dt;
        pk.vx *= 0.9;
        pk.vy *= 0.9;

        const dx = this.player.x - pk.x;
        const dy = this.player.y - pk.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < this.player.magnetRadius) {
          pk.vx += (dx / dist) * 950 * dt;
          pk.vy += (dy / dist) * 950 * dt;
        }

        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;
        pk.sprite.x = pk.x;
        pk.sprite.y = pk.y;

        if (dist <= this.player.radius + 14) {
          if (pk.type === 'shard') {
            this.runShards += pk.value;
          } else {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + pk.value);
          }
          Game.Audio.playPickup();
          this.pickupLayer.removeChild(pk.sprite);
          pk.sprite.destroy();
          this.pickups.splice(i, 1);
        } else if (pk.life <= 0) {
          this.pickupLayer.removeChild(pk.sprite);
          pk.sprite.destroy();
          this.pickups.splice(i, 1);
        }
      }

      this.particles.update(dt);
      this._updateCamera(dt);
      this._updateHUD();
    }

    _updateCamera(dt) {
      // Smooth camera lerp toward player
      this.camX += (this.player.x - this.camX) * Math.min(1, dt * 8.5);
      this.camY += (this.player.y - this.camY) * Math.min(1, dt * 8.5);

      let shakeX = 0;
      let shakeY = 0;
      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
        shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
        if (this.shakeTime <= 0) this.shakeIntensity = 0;
      }

      this.world.x = this.app.screen.width / 2 - this.camX + shakeX;
      this.world.y = this.app.screen.height / 2 - this.camY + shakeY;
    }

    _updateHUD() {
      if (!this.player) return;
      document.getElementById('hud-hp-text').textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
      document.getElementById('hud-hp-fill').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;

      document.getElementById('hud-level').textContent = this.level;
      document.getElementById('hud-xp-text').textContent = `${this.xp} / ${this.xpToNext}`;
      document.getElementById('hud-xp-fill').style.width = `${Math.min(100, (this.xp / this.xpToNext) * 100)}%`;

      document.getElementById('hud-wave').textContent = this.wave;
      document.getElementById('hud-shards').textContent = this.runShards;
      document.getElementById('hud-score').textContent = Math.round(this.score);

      const comboEl = document.getElementById('combo-display');
      if (this.combo >= 2) {
        comboEl.classList.remove('hidden');
        document.getElementById('combo-count').textContent = this.combo;
      } else {
        comboEl.classList.add('hidden');
      }

      // Mobile skill cooldown overlays
      if (this.isMobile) {
        document.getElementById('cd-shoot').style.height = `${(this.player.shootCd / Game.Config.SHOOT_COOLDOWN) * 100}%`;
        document.getElementById('cd-dash').style.height = `${(this.player.dashCd / this.player.dashCooldownMax) * 100}%`;
        document.getElementById('cd-nova').style.height = `${(this.player.novaCd / this.player.novaCooldownMax) * 100}%`;
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.Game.Instance = new ChronoArenaGame();
  });
})(window.Game);
