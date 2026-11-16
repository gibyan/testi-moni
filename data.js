window.Game = window.Game || {};

(function (Game) {
  Game.Config = {
    ARENA_RADIUS: 1150,
    BASE_PLAYER_SPEED: 290,
    DASH_SPEED: 820,
    DASH_DURATION: 0.17,
    DASH_COOLDOWN: 1.35,
    SLASH_COOLDOWN: 0.26,
    SHOOT_COOLDOWN: 0.42,
    NOVA_COOLDOWN: 6.5,
    COMBO_RESET_TIME: 2.4
  };

  Game.EnemyTypes = {
    skitter: {
      id: 'skitter',
      name: 'Skitterling',
      texture: 'enemy_skitter',
      radius: 18,
      hp: 36,
      speed: 225,
      damage: 12,
      xp: 12,
      shards: 2,
      score: 100,
      ai: 'chase',
      attackRange: 34,
      windup: 0.22,
      cooldown: 0.85
    },
    sentinel: {
      id: 'sentinel',
      name: 'Arcane Sentinel',
      texture: 'enemy_sentinel',
      radius: 22,
      hp: 58,
      speed: 135,
      damage: 15,
      xp: 20,
      shards: 4,
      score: 180,
      ai: 'ranged',
      preferredDist: 340,
      attackRange: 540,
      windup: 0.55,
      cooldown: 1.85
    },
    brute: {
      id: 'brute',
      name: 'Iron Brute',
      texture: 'enemy_brute',
      radius: 30,
      hp: 145,
      speed: 112,
      damage: 26,
      xp: 38,
      shards: 7,
      score: 320,
      ai: 'slam',
      attackRange: 95,
      windup: 0.72,
      cooldown: 2.1
    }
  };

  Game.BossConfig = {
    id: 'warden',
    name: 'WARDEN OF THE CORE',
    texture: 'boss_warden',
    radius: 52,
    baseHp: 950,
    speed: 128,
    damage: 24,
    xp: 180,
    shards: 35,
    score: 2500
  };

  // In-run Roguelike Level Up Upgrades
  Game.RunUpgrades = [
    {
      id: 'sharp_edge',
      title: 'Chrono Edge',
      rarity: 'common',
      icon: '⚔️',
      desc: '+22% Damage tebasan pedang & area tebasan lebih luas.',
      apply(player) {
        player.slashDamage *= 1.22;
        player.slashRange *= 1.1;
      }
    },
    {
      id: 'arcane_barrage',
      title: 'Split Bolt',
      rarity: 'rare',
      icon: '💠',
      desc: 'Tembakan Arcane Bolt menambah +1 proyektil menyebar.',
      apply(player) {
        player.boltCount += 1;
        player.boltDamage *= 1.1;
      }
    },
    {
      id: 'vampiric_siphon',
      title: 'Vampiric Siphon',
      rarity: 'rare',
      icon: '🩸',
      desc: 'Memulihkan +3 HP setiap kali mengalahkan musuh.',
      apply(player) {
        player.lifestealOnKill += 3;
      }
    },
    {
      id: 'haste_module',
      title: 'Temporal Haste',
      rarity: 'common',
      icon: '⚡',
      desc: '+14% Kecepatan gerak & -18% Cooldown Dash.',
      apply(player) {
        player.speed *= 1.14;
        player.dashCooldownMax *= 0.82;
      }
    },
    {
      id: 'crit_protocol',
      title: 'Overdrive Crit',
      rarity: 'rare',
      icon: '🎯',
      desc: '+15% Peluang Critical Hit (2.2x Damage).',
      apply(player) {
        player.critChance = Math.min(0.85, player.critChance + 0.15);
      }
    },
    {
      id: 'titan_plating',
      title: 'Aegis Core',
      rarity: 'common',
      icon: '🛡️',
      desc: '+35 Max HP & langsung memulihkan 40 HP.',
      apply(player) {
        player.maxHp += 35;
        player.hp = Math.min(player.maxHp, player.hp + 40);
      }
    },
    {
      id: 'chain_arc',
      title: 'Storm Conductor',
      rarity: 'epic',
      icon: '🌩️',
      desc: 'Serangan memicu petir berantai ke musuh terdekat (55% DMG).',
      apply(player) {
        player.chainLightning += 1;
      }
    },
    {
      id: 'nova_reactor',
      title: 'Supernova Core',
      rarity: 'epic',
      icon: '💥',
      desc: '+45% Damage & Radius skill Nova, serta -25% Cooldown.',
      apply(player) {
        player.novaDamage *= 1.45;
        player.novaRadius *= 1.25;
        player.novaCooldownMax *= 0.75;
      }
    }
  ];

  // Permanent Meta-Progression Armory Upgrades (Saved to localStorage)
  Game.ArmoryUpgrades = [
    {
      id: 'perm_atk',
      name: 'Blade Resonance',
      maxLevel: 8,
      baseCost: 25,
      costScale: 1.65,
      desc: '+10% Base Melee & Bolt Damage per level.'
    },
    {
      id: 'perm_hp',
      name: 'Chrono Armor',
      maxLevel: 8,
      baseCost: 20,
      costScale: 1.6,
      desc: '+20 Max HP awal per level.'
    },
    {
      id: 'perm_spd',
      name: 'Phase Thrusters',
      maxLevel: 6,
      baseCost: 30,
      costScale: 1.75,
      desc: '+6% Movement Speed & +5% Magnet Radius per level.'
    },
    {
      id: 'perm_greed',
      name: 'Shard Extractor',
      maxLevel: 6,
      baseCost: 35,
      costScale: 1.8,
      desc: '+15% Bonus Aether Shards dari setiap musuh.'
    }
  ];

  const SAVE_KEY = 'aether_shard_chrono_save_v1';

  Game.SaveManager = {
    data: {
      shards: 0,
      bestWave: 1,
      highScore: 0,
      armory: {
        perm_atk: 0,
        perm_hp: 0,
        perm_spd: 0,
        perm_greed: 0
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = Object.assign({}, this.data, parsed);
          this.data.armory = Object.assign(
            { perm_atk: 0, perm_hp: 0, perm_spd: 0, perm_greed: 0 },
            parsed.armory || {}
          );
        }
      } catch (e) {
        console.warn('Save load fallback:', e);
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.warn('Save write error:', e);
      }
    },

    getUpgradeCost(upg) {
      const lvl = this.data.armory[upg.id] || 0;
      return Math.round(upg.baseCost * Math.pow(upg.costScale, lvl));
    }
  };
})(window.Game);
