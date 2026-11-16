window.Game = window.Game || {};

(function (Game) {
  class ParticleSystem {
    constructor(container) {
      this.container = container;
      this.particles = [];
      this.texts = [];
    }

    spawnBurst(x, y, color = 0x38bdf8, count = 10, speed = 220, life = 0.4) {
      const tex = Game.Textures.get('particle_glow');
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.tint = color;
        const scale = 0.35 + Math.random() * 0.55;
        sprite.scale.set(scale);
        sprite.blendMode = PIXI.BLEND_MODES.ADD;

        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.35 + Math.random() * 0.85);
        this.container.addChild(sprite);

        this.particles.push({
          sprite,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life,
          maxLife: life,
          drag: 0.92,
          startScale: scale
        });
      }
    }

    spawnAfterimage(x, y, rotation, textureKey = 'player_0', tint = 0x38bdf8) {
      const sprite = new PIXI.Sprite(Game.Textures.get(textureKey));
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      sprite.rotation = rotation;
      sprite.tint = tint;
      sprite.alpha = 0.55;
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      this.container.addChild(sprite);

      this.particles.push({
        sprite,
        vx: 0,
        vy: 0,
        life: 0.22,
        maxLife: 0.22,
        drag: 1,
        startScale: 1
      });
    }

    spawnDamageText(x, y, amount, isCrit = false, customColor = null) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Segoe UI, Arial, sans-serif',
        fontSize: isCrit ? 22 : 16,
        fontWeight: '900',
        fill: customColor || (isCrit ? '#fbbf24' : '#ffffff'),
        stroke: '#020617',
        strokeThickness: 4
      });

      const text = new PIXI.Text(isCrit ? `${Math.round(amount)}!` : `${Math.round(amount)}`, style);
      text.anchor.set(0.5);
      text.x = x + (Math.random() - 0.5) * 18;
      text.y = y - 16;
      this.container.addChild(text);

      this.texts.push({
        text,
        vy: isCrit ? -85 : -60,
        life: 0.65,
        maxLife: 0.65
      });
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.container.removeChild(p.sprite);
          p.sprite.destroy();
          this.particles.splice(i, 1);
          continue;
        }
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        const ratio = p.life / p.maxLife;
        p.sprite.alpha = ratio;
        p.sprite.scale.set(p.startScale * (0.4 + ratio * 0.6));
      }

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        if (t.life <= 0) {
          this.container.removeChild(t.text);
          t.text.destroy();
          this.texts.splice(i, 1);
          continue;
        }
        t.text.y += t.vy * dt;
        t.vy *= 0.94;
        t.text.alpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      }
    }

    clear() {
      this.particles.forEach((p) => {
        this.container.removeChild(p.sprite);
        p.sprite.destroy();
      });
      this.texts.forEach((t) => {
        this.container.removeChild(t.text);
        t.text.destroy();
      });
      this.particles = [];
      this.texts = [];
    }
  }

  class Player {
    constructor(layer, saveMeta) {
      this.layer = layer;
      const atkMult = 1 + (saveMeta.armory.perm_atk || 0) * 0.1;
      const hpBonus = (saveMeta.armory.perm_hp || 0) * 20;
      const spdMult = 1 + (saveMeta.armory.perm_spd || 0) * 0.06;

      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.radius = 18;
      this.rotation = 0;

      this.maxHp = 100 + hpBonus;
      this.hp = this.maxHp;
      this.speed = Game.Config.BASE_PLAYER_SPEED * spdMult;
      this.magnetRadius = 115 * (1 + (saveMeta.armory.perm_spd || 0) * 0.05);

      this.slashDamage = 34 * atkMult;
      this.slashRange = 105;
      this.boltDamage = 24 * atkMult;
      this.boltCount = 1;
      this.novaDamage = 95 * atkMult;
      this.novaRadius = 210;

      this.critChance = 0.1;
      this.lifestealOnKill = 0;
      this.chainLightning = 0;

      this.dashCooldownMax = Game.Config.DASH_COOLDOWN;
      this.novaCooldownMax = Game.Config.NOVA_COOLDOWN;

      this.slashCd = 0;
      this.shootCd = 0;
      this.dashCd = 0;
      this.novaCd = 0;

      this.dashTimer = 0;
      this.dashDirX = 1;
      this.dashDirY = 0;
      this.afterimageTimer = 0;
      this.invulnTimer = 0;
      this.hurtFlashTimer = 0;

      this.comboStep = 0;
      this.animTimer = 0;
      this.animFrame = 0;

      this.container = new PIXI.Container();
      this.shadow = new PIXI.Sprite(Game.Textures.get('shadow'));
      this.shadow.anchor.set(0.5);
      this.shadow.y = 14;

      this.sprite = new PIXI.Sprite(Game.Textures.get('player_0'));
      this.sprite.anchor.set(0.5);

      this.container.addChild(this.shadow);
      this.container.addChild(this.sprite);
      this.layer.addChild(this.container);
    }

    update(dt, moveX, moveY, aimAngle, particles) {
      this.slashCd = Math.max(0, this.slashCd - dt);
      this.shootCd = Math.max(0, this.shootCd - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.novaCd = Math.max(0, this.novaCd - dt);
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);

      if (this.hurtFlashTimer > 0) {
        this.hurtFlashTimer -= dt;
        this.sprite.tint = 0xf43f5e;
      } else if (this.invulnTimer > 0) {
        this.sprite.tint = 0x7dd3fc;
      } else {
        this.sprite.tint = 0xffffff;
      }

      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        this.vx = this.dashDirX * Game.Config.DASH_SPEED;
        this.vy = this.dashDirY * Game.Config.DASH_SPEED;
        this.afterimageTimer -= dt;
        if (this.afterimageTimer <= 0) {
          this.afterimageTimer = 0.035;
          particles.spawnAfterimage(this.x, this.y, this.rotation, `player_${this.animFrame}`, 0x38bdf8);
        }
      } else {
        const len = Math.hypot(moveX, moveY);
        if (len > 0.01) {
          const nx = moveX / len;
          const ny = moveY / len;
          this.vx = nx * this.speed;
          this.vy = ny * this.speed;
          this.animTimer += dt;
          if (this.animTimer >= 0.14) {
            this.animTimer = 0;
            this.animFrame = this.animFrame === 0 ? 1 : 0;
            this.sprite.texture = Game.Textures.get(`player_${this.animFrame}`);
          }
        } else {
          this.vx *= 0.78;
          this.vy *= 0.78;
          this.animFrame = 0;
          this.sprite.texture = Game.Textures.get('player_0');
        }
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Clamp within circular arena boundary
      const maxR = Game.Config.ARENA_RADIUS - this.radius;
      const dist = Math.hypot(this.x, this.y);
      if (dist > maxR) {
        this.x = (this.x / dist) * maxR;
        this.y = (this.y / dist) * maxR;
      }

      this.rotation = aimAngle;
      this.sprite.rotation = this.rotation;
      this.container.x = this.x;
      this.container.y = this.y;
    }

    tryDash(moveX, moveY) {
      if (this.dashCd > 0 || this.dashTimer > 0) return false;
      this.dashCd = this.dashCooldownMax;
      this.dashTimer = Game.Config.DASH_DURATION;
      this.invulnTimer = Game.Config.DASH_DURATION + 0.12;

      const len = Math.hypot(moveX, moveY);
      if (len > 0.05) {
        this.dashDirX = moveX / len;
        this.dashDirY = moveY / len;
      } else {
        this.dashDirX = Math.cos(this.rotation);
        this.dashDirY = Math.sin(this.rotation);
      }
      Game.Audio.playDash();
      return true;
    }

    takeDamage(amount) {
      if (this.invulnTimer > 0 || this.hp <= 0) return false;
      this.hp = Math.max(0, this.hp - amount);
      this.invulnTimer = 0.55;
      this.hurtFlashTimer = 0.16;
      Game.Audio.playPlayerHurt();
      return true;
    }

    destroy() {
      this.layer.removeChild(this.container);
      this.container.destroy({ children: true });
    }
  }

  class Enemy {
    constructor(layer, typeKey, x, y, waveScale = 1) {
      const cfg = Game.EnemyTypes[typeKey];
      this.layer = layer;
      this.typeKey = typeKey;
      this.isBoss = false;
      this.name = cfg.name;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = cfg.radius;

      this.maxHp = Math.round(cfg.hp * waveScale);
      this.hp = this.maxHp;
      this.speed = cfg.speed * (1 + (waveScale - 1) * 0.12);
      this.damage = Math.round(cfg.damage * (1 + (waveScale - 1) * 0.2));
      this.xp = cfg.xp;
      this.shards = cfg.shards;
      this.score = cfg.score;

      this.ai = cfg.ai;
      this.preferredDist = cfg.preferredDist || 0;
      this.attackRange = cfg.attackRange;
      this.windupMax = cfg.windup;
      this.cooldownMax = cfg.cooldown;

      this.state = 'chase'; // chase | windup | cooldown
      this.stateTimer = 0;
      this.hitFlash = 0;
      this.knockX = 0;
      this.knockY = 0;

      this.container = new PIXI.Container();
      this.telegraphGfx = new PIXI.Graphics();
      this.shadow = new PIXI.Sprite(Game.Textures.get('shadow'));
      this.shadow.anchor.set(0.5);
      this.shadow.y = this.radius * 0.75;

      this.sprite = new PIXI.Sprite(Game.Textures.get(cfg.texture));
      this.sprite.anchor.set(0.5);

      // Mini HP bar
      this.hpBg = new PIXI.Graphics();
      this.hpBg.beginFill(0x020617, 0.8);
      this.hpBg.drawRect(-18, -this.radius - 12, 36, 4);
      this.hpBg.endFill();

      this.hpBar = new PIXI.Graphics();

      this.container.addChild(this.telegraphGfx);
      this.container.addChild(this.shadow);
      this.container.addChild(this.sprite);
      this.container.addChild(this.hpBg);
      this.container.addChild(this.hpBar);
      this.layer.addChild(this.container);
      this._redrawHp();
    }

    _redrawHp() {
      this.hpBar.clear();
      const ratio = Math.max(0, this.hp / this.maxHp);
      this.hpBar.beginFill(0xf43f5e);
      this.hpBar.drawRect(-18, -this.radius - 12, 36 * ratio, 4);
      this.hpBar.endFill();
    }

    applyDamage(amount, kx = 0, ky = 0) {
      this.hp -= amount;
      this.hitFlash = 0.1;
      this.knockX += kx;
      this.knockY += ky;
      this._redrawHp();
    }

    update(dt, player, game) {
      if (this.hitFlash > 0) {
        this.hitFlash -= dt;
        this.sprite.tint = 0xffedd5;
      } else if (this.state === 'windup') {
        this.sprite.tint = 0xfef08a;
      } else {
        this.sprite.tint = 0xffffff;
      }

      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);
      this.sprite.rotation = angle;

      this.telegraphGfx.clear();

      if (this.state === 'chase') {
        if (this.ai === 'ranged') {
          if (dist > this.preferredDist + 35) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
          } else if (dist < this.preferredDist - 45) {
            this.vx = -(dx / dist) * this.speed * 0.75;
            this.vy = -(dy / dist) * this.speed * 0.75;
          } else {
            // Strafe sideways
            this.vx = (-dy / dist) * this.speed * 0.65;
            this.vy = (dx / dist) * this.speed * 0.65;
          }
          if (dist <= this.attackRange) {
            this.state = 'windup';
            this.stateTimer = this.windupMax;
          }
        } else {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
          if (dist <= this.attackRange) {
            this.state = 'windup';
            this.stateTimer = this.windupMax;
          }
        }
      } else if (this.state === 'windup') {
        this.vx *= 0.82;
        this.vy *= 0.82;
        this.stateTimer -= dt;

        // Draw telegraph indicator
        const progress = 1 - Math.max(0, this.stateTimer / this.windupMax);
        if (this.ai === 'slam') {
          this.telegraphGfx.lineStyle(2, 0xf43f5e, 0.85);
          this.telegraphGfx.beginFill(0xf43f5e, 0.18);
          this.telegraphGfx.drawCircle(0, 0, this.attackRange * progress);
          this.telegraphGfx.endFill();
        } else if (this.ai === 'ranged') {
          this.telegraphGfx.lineStyle(2, 0xe879f9, 0.65 * progress);
          this.telegraphGfx.moveTo(0, 0);
          this.telegraphGfx.lineTo(Math.cos(angle) * 260, Math.sin(angle) * 260);
        }

        if (this.stateTimer <= 0) {
          this._executeAttack(player, angle, game);
          this.state = 'cooldown';
          this.stateTimer = this.cooldownMax;
        }
      } else if (this.state === 'cooldown') {
        this.vx *= 0.85;
        this.vy *= 0.85;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'chase';
        }
      }

      this.x += (this.vx + this.knockX) * dt;
      this.y += (this.vy + this.knockY) * dt;
      this.knockX *= 0.82;
      this.knockY *= 0.82;

      const maxR = Game.Config.ARENA_RADIUS - this.radius;
      const arenaDist = Math.hypot(this.x, this.y);
      if (arenaDist > maxR) {
        this.x = (this.x / arenaDist) * maxR;
        this.y = (this.y / arenaDist) * maxR;
      }

      this.container.x = this.x;
      this.container.y = this.y;
    }

    _executeAttack(player, angle, game) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (this.ai === 'ranged') {
        game.spawnProjectile(this.x, this.y, angle, 390, this.damage, false);
      } else if (this.ai === 'slam') {
        game.particles.spawnBurst(this.x, this.y, 0xfb923c, 14, 240, 0.35);
        if (dist <= this.attackRange + player.radius) {
          game.damagePlayer(this.damage);
        }
      } else {
        if (dist <= this.attackRange + player.radius + 10) {
          game.damagePlayer(this.damage);
        }
      }
    }

    destroy() {
      this.layer.removeChild(this.container);
      this.container.destroy({ children: true });
    }
  }

  class Boss {
    constructor(layer, x, y, waveNumber) {
      const cfg = Game.BossConfig;
      const tier = Math.max(1, Math.floor(waveNumber / 5));
      this.layer = layer;
      this.isBoss = true;
      this.name = `${cfg.name} MK-${tier}`;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = cfg.radius;

      this.maxHp = Math.round(cfg.baseHp * (1 + (tier - 1) * 0.75));
      this.hp = this.maxHp;
      this.speed = cfg.speed;
      this.damage = Math.round(cfg.damage * (1 + (tier - 1) * 0.25));
      this.xp = cfg.xp * tier;
      this.shards = cfg.shards * tier;
      this.score = cfg.score * tier;

      this.patternIndex = 0;
      this.state = 'chase';
      this.stateTimer = 1.6;
      this.chargeDirX = 0;
      this.chargeDirY = 0;
      this.hitFlash = 0;
      this.knockX = 0;
      this.knockY = 0;

      this.container = new PIXI.Container();
      this.telegraphGfx = new PIXI.Graphics();
      this.shadow = new PIXI.Sprite(Game.Textures.get('shadow'));
      this.shadow.anchor.set(0.5);
      this.shadow.scale.set(2.3);
      this.shadow.y = 42;

      this.sprite = new PIXI.Sprite(Game.Textures.get(cfg.texture));
      this.sprite.anchor.set(0.5);

      this.container.addChild(this.telegraphGfx);
      this.container.addChild(this.shadow);
      this.container.addChild(this.sprite);
      this.layer.addChild(this.container);
    }

    applyDamage(amount, kx = 0, ky = 0) {
      this.hp = Math.max(0, this.hp - amount);
      this.hitFlash = 0.08;
      this.knockX += kx * 0.25;
      this.knockY += ky * 0.25;
    }

    update(dt, player, game) {
      if (this.hitFlash > 0) {
        this.hitFlash -= dt;
        this.sprite.tint = 0xfda4af;
      } else {
        this.sprite.tint = 0xffffff;
      }

      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);

      this.telegraphGfx.clear();

      if (this.state === 'chase') {
        this.sprite.rotation = angle;
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'windup';
          this.stateTimer = 0.85;
          this.chargeDirX = dx / dist;
          this.chargeDirY = dy / dist;
        }
      } else if (this.state === 'windup') {
        this.vx *= 0.85;
        this.vy *= 0.85;
        this.stateTimer -= dt;

        if (this.patternIndex % 2 === 0) {
          // Radial Nova Bullet Ring telegraph
          this.telegraphGfx.lineStyle(3, 0xa855f7, 0.8);
          this.telegraphGfx.drawCircle(0, 0, 85);
        } else {
          // High-speed Charge line telegraph
          this.telegraphGfx.lineStyle(18, 0xf43f5e, 0.28);
          this.telegraphGfx.moveTo(0, 0);
          this.telegraphGfx.lineTo(this.chargeDirX * 420, this.chargeDirY * 420);
        }

        if (this.stateTimer <= 0) {
          if (this.patternIndex % 2 === 0) {
            // Fire 14 projectiles in a circle
            const count = 14;
            for (let i = 0; i < count; i++) {
              const a = (Math.PI * 2 * i) / count + this.sprite.rotation;
              game.spawnProjectile(this.x, this.y, a, 340, this.damage, false);
            }
            Game.Audio.playExplosion();
            this.state = 'chase';
            this.stateTimer = 2.0;
          } else {
            // Execute Dash Charge
            this.state = 'charging';
            this.stateTimer = 0.48;
            Game.Audio.playDash();
          }
          this.patternIndex++;
        }
      } else if (this.state === 'charging') {
        this.vx = this.chargeDirX * 640;
        this.vy = this.chargeDirY * 640;
        this.stateTimer -= dt;
        game.particles.spawnAfterimage(this.x, this.y, this.sprite.rotation, 'boss_warden', 0xf43f5e);

        if (dist <= this.radius + player.radius) {
          game.damagePlayer(this.damage);
        }

        if (this.stateTimer <= 0) {
          this.state = 'chase';
          this.stateTimer = 1.8;
        }
      }

      this.x += (this.vx + this.knockX) * dt;
      this.y += (this.vy + this.knockY) * dt;
      this.knockX *= 0.8;
      this.knockY *= 0.8;

      const maxR = Game.Config.ARENA_RADIUS - this.radius;
      const arenaDist = Math.hypot(this.x, this.y);
      if (arenaDist > maxR) {
        this.x = (this.x / arenaDist) * maxR;
        this.y = (this.y / arenaDist) * maxR;
      }

      this.container.x = this.x;
      this.container.y = this.y;
    }

    destroy() {
      this.layer.removeChild(this.container);
      this.container.destroy({ children: true });
    }
  }

  Game.Entities = {
    ParticleSystem,
    Player,
    Enemy,
    Boss
  };
})(window.Game);
