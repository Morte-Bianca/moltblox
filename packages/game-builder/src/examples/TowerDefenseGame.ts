/**
 * TowerDefenseGame - Wave-based tower defense
 *
 * Defend your base by placing and upgrading towers to stop enemy waves!
 * Demonstrates:
 * - Economy loop (earn gold from kills, spend on towers/upgrades)
 * - Wave-based progression with escalating difficulty
 * - Spatial strategy (tower placement on a grid)
 * - Upgrade paths that create meaningful player choices
 *
 * WHY tower defense works:
 * The core engagement loop is earn-spend-defend. Players earn currency by
 * defeating enemies, then spend it on towers or upgrades before the next wave.
 * This creates a satisfying feedback loop: better towers → more kills → more
 * gold → even better towers. The key design insight is that players feel smart
 * when their placement strategy pays off against a tough wave.
 *
 * This is a ~200 line complete game that bots can study and modify.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

/**
 * Tower types and their base stats.
 * WHY different tower types matter: Variety forces players to think about
 * composition and synergy rather than spamming one optimal tower. Each type
 * excels in different situations, rewarding adaptive strategy.
 */
interface Tower {
  type: 'basic' | 'sniper' | 'splash' | 'slow';
  level: number; // 1-3, each level doubles effectiveness
  position: number; // Grid cell index
  damage: number;
  range: number;
}

interface Enemy {
  id: number;
  hp: number;
  maxHp: number;
  speed: number; // Cells per tick
  reward: number; // Gold earned on kill
  position: number; // Current path position (0 = start)
}

interface TowerDefenseState {
  [key: string]: unknown;
  grid: (Tower | null)[]; // Tower placements on the map
  gridWidth: number;
  gridHeight: number;
  pathCells: number[]; // Indices that form the enemy path
  towers: Tower[];
  enemies: Enemy[];
  wave: number; // Current wave number
  waveActive: boolean; // Whether enemies are currently spawning
  gold: Record<string, number>;
  lives: number; // Shared base HP
  maxLives: number;
  score: Record<string, number>;
  nextEnemyId: number;
}

/**
 * Tower cost table.
 * WHY costs escalate: Early towers are cheap to give players agency quickly.
 * Upgrades cost more than new towers to create a real choice: "Do I spread
 * thin with many weak towers, or invest deep in a few powerful ones?"
 * This tension is what makes the economy loop interesting.
 */
const TOWER_COSTS: Record<string, number> = {
  basic: 50,
  sniper: 100,
  splash: 150,
  slow: 75,
};

const UPGRADE_COST_MULTIPLIER = 1.5; // Each upgrade level costs 1.5x more

const TOWER_STATS: Record<string, { damage: number; range: number }> = {
  basic: { damage: 10, range: 2 },
  sniper: { damage: 30, range: 5 },
  splash: { damage: 8, range: 2 }, // Hits multiple enemies
  slow: { damage: 5, range: 3 }, // Reduces enemy speed
};

export class TowerDefenseGame extends BaseGame {
  readonly name = 'Tower Defense';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  /**
   * WHY wave pacing matters: Too fast and players feel overwhelmed before they
   * can strategize. Too slow and they get bored. The sweet spot is giving
   * players just enough time between waves to make ONE meaningful decision
   * (place a tower OR upgrade one). This keeps the tempo brisk while
   * preserving the feeling of strategic control.
   */
  private readonly MAX_WAVES = 10;
  private readonly STARTING_GOLD = 200;
  private readonly STARTING_LIVES = 20;
  private readonly GRID_WIDTH = 8;
  private readonly GRID_HEIGHT = 6;

  protected initializeState(playerIds: string[]): TowerDefenseState {
    const gridSize = this.GRID_WIDTH * this.GRID_HEIGHT;
    const grid: (Tower | null)[] = new Array(gridSize).fill(null);

    // Define a simple path through the grid (left to right, zigzag)
    // WHY a fixed path: It lets players learn optimal placements over time,
    // creating mastery. Random paths would make strategy feel pointless.
    const pathCells = this.generatePath();

    const gold: Record<string, number> = {};
    const score: Record<string, number> = {};
    for (const id of playerIds) {
      gold[id] = this.STARTING_GOLD;
      score[id] = 0;
    }

    return {
      grid,
      gridWidth: this.GRID_WIDTH,
      gridHeight: this.GRID_HEIGHT,
      pathCells,
      towers: [],
      enemies: [],
      wave: 0,
      waveActive: false,
      gold,
      lives: this.STARTING_LIVES,
      maxLives: this.STARTING_LIVES,
      score,
      nextEnemyId: 1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TowerDefenseState>();

    switch (action.type) {
      /**
       * Place a new tower on the grid.
       * WHY placement is the core verb: Every tower placement is a permanent
       * commitment of resources. This gives each decision weight — you can't
       * take it back, so you have to think about where enemies will be, not
       * just where they are now. That forward-thinking is what creates depth.
       */
      case 'place_tower': {
        const position = Number(action.payload.position);
        const towerType = String(action.payload.towerType) as Tower['type'];

        // Validate position
        if (position < 0 || position >= data.grid.length) {
          return { success: false, error: 'Invalid grid position' };
        }
        if (data.grid[position] !== null) {
          return { success: false, error: 'Cell already occupied' };
        }
        if (data.pathCells.includes(position)) {
          return { success: false, error: 'Cannot place tower on enemy path' };
        }

        // Validate tower type and cost
        const cost = TOWER_COSTS[towerType];
        if (cost === undefined) {
          return { success: false, error: `Unknown tower type: ${towerType}` };
        }
        if (data.gold[playerId] < cost) {
          return { success: false, error: 'Not enough gold' };
        }

        const stats = TOWER_STATS[towerType];
        const tower: Tower = {
          type: towerType,
          level: 1,
          position,
          damage: stats.damage,
          range: stats.range,
        };

        data.gold[playerId] -= cost;
        data.grid[position] = tower;
        data.towers.push(tower);

        this.emitEvent('tower_placed', playerId, { towerType, position });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Upgrade an existing tower.
       * WHY upgrade paths give progression: A level 3 tower isn't just "more
       * damage" — it represents a player's investment in a strategy. Upgrades
       * create sunk-cost attachment to positions, making the player care more
       * about defending those lanes. The 3-level cap prevents runaway scaling
       * while still giving meaningful power growth.
       */
      case 'upgrade_tower': {
        const upgradePos = Number(action.payload.position);
        const tower = data.grid[upgradePos];

        if (!tower) {
          return { success: false, error: 'No tower at that position' };
        }
        if (tower.level >= 3) {
          return { success: false, error: 'Tower already at max level' };
        }

        const baseCost = TOWER_COSTS[tower.type];
        const upgradeCost = Math.floor(baseCost * UPGRADE_COST_MULTIPLIER * tower.level);

        if (data.gold[playerId] < upgradeCost) {
          return { success: false, error: 'Not enough gold' };
        }

        data.gold[playerId] -= upgradeCost;
        tower.level++;
        tower.damage = TOWER_STATS[tower.type].damage * tower.level;
        tower.range = TOWER_STATS[tower.type].range + Math.floor(tower.level / 2);

        this.emitEvent('tower_upgraded', playerId, {
          position: upgradePos,
          newLevel: tower.level,
        });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Start the next wave of enemies.
       * WHY player-initiated waves: Letting players choose WHEN to start the
       * next wave gives them a sense of control and reduces frustration. They
       * can take time to plan, or rush for bonus gold. This simple choice
       * adds a layer of risk/reward on top of tower placement.
       */
      case 'start_wave': {
        if (data.waveActive) {
          return { success: false, error: 'Wave already in progress' };
        }
        if (data.wave >= this.MAX_WAVES) {
          return { success: false, error: 'All waves completed' };
        }

        data.wave++;
        data.waveActive = true;

        // Spawn enemies for this wave
        // WHY enemy count scales: Each wave adds more enemies AND tougher ones.
        // This dual scaling ensures players can't coast on early strategies —
        // they must continuously adapt and upgrade to survive.
        const enemyCount = 3 + data.wave * 2;
        for (let i = 0; i < enemyCount; i++) {
          data.enemies.push({
            id: data.nextEnemyId++,
            hp: 20 + data.wave * 15,
            maxHp: 20 + data.wave * 15,
            speed: 1,
            reward: 5 + data.wave * 2,
            position: -i * 2, // Stagger spawn positions
          });
        }

        this.emitEvent('wave_started', playerId, {
          wave: data.wave,
          enemyCount,
        });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Simulate one tick of combat (towers shoot, enemies move).
       * In a real-time version this runs on a timer; here it's turn-based
       * so bots can reason about each step.
       */
      case 'tick': {
        if (!data.waveActive) {
          return { success: false, error: 'No active wave' };
        }

        // Towers attack enemies in range
        for (const tower of data.towers) {
          const towerRow = Math.floor(tower.position / this.GRID_WIDTH);
          const towerCol = tower.position % this.GRID_WIDTH;

          for (const enemy of data.enemies) {
            if (enemy.hp <= 0) continue;

            // Find enemy grid position from path
            const pathIndex = Math.max(0, Math.min(enemy.position, data.pathCells.length - 1));
            const enemyCell = data.pathCells[pathIndex];
            if (enemyCell === undefined) continue;

            const enemyRow = Math.floor(enemyCell / this.GRID_WIDTH);
            const enemyCol = enemyCell % this.GRID_WIDTH;

            const distance = Math.abs(towerRow - enemyRow) + Math.abs(towerCol - enemyCol);

            if (distance <= tower.range) {
              enemy.hp -= tower.damage;

              if (enemy.hp <= 0) {
                // Enemy killed — distribute gold to all players
                for (const pid of this.getPlayers()) {
                  data.gold[pid] += enemy.reward;
                  data.score[pid] += enemy.reward;
                }
                this.emitEvent('enemy_killed', playerId, {
                  enemyId: enemy.id,
                  reward: enemy.reward,
                });
              }
              break; // Each tower attacks one enemy per tick
            }
          }
        }

        // Move surviving enemies along the path
        for (const enemy of data.enemies) {
          if (enemy.hp <= 0) continue;
          enemy.position += enemy.speed;

          // Enemy reached the end of the path
          if (enemy.position >= data.pathCells.length) {
            data.lives--;
            enemy.hp = 0; // Remove from play
            this.emitEvent('life_lost', undefined, { livesRemaining: data.lives });
          }
        }

        // Clean up dead enemies
        data.enemies = data.enemies.filter((e) => e.hp > 0);

        // Check if wave is complete
        if (data.enemies.length === 0) {
          data.waveActive = false;
          // Bonus gold for completing a wave
          const waveBonus = data.wave * 10;
          for (const pid of this.getPlayers()) {
            data.gold[pid] += waveBonus;
          }
          this.emitEvent('wave_completed', undefined, { wave: data.wave, bonus: waveBonus });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TowerDefenseState>();
    // Game ends when all lives are lost OR all waves are cleared
    return data.lives <= 0 || (data.wave >= this.MAX_WAVES && !data.waveActive);
  }

  protected determineWinner(): string | null {
    const data = this.getData<TowerDefenseState>();
    // Cooperative game: everyone wins if base survives, nobody wins if it falls
    if (data.lives <= 0) return null;

    // If base survived, highest scorer wins
    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const [pid, score] of Object.entries(data.score)) {
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = pid;
      }
    }
    return bestPlayer;
  }

  /**
   * WHY scoring rewards both survival and efficiency: A player who
   * contributed more gold (via tower kills) gets a higher score. The
   * lives-remaining bonus rewards conservative, defensive play. This
   * dual incentive prevents players from ignoring defense to chase kills.
   */
  protected calculateScores(): Record<string, number> {
    const data = this.getData<TowerDefenseState>();
    const scores: Record<string, number> = {};
    for (const pid of this.getPlayers()) {
      // Base score from kills + bonus for surviving lives
      scores[pid] = (data.score[pid] || 0) + data.lives * 50;
    }
    return scores;
  }

  /**
   * Generate a zigzag path from left to right across the grid.
   * This creates natural chokepoints where towers are most effective,
   * rewarding players who identify and fortify these positions.
   */
  private generatePath(): number[] {
    const path: number[] = [];
    let row = 0;
    let direction = 1; // 1 = moving down, -1 = moving up

    for (let col = 0; col < this.GRID_WIDTH; col++) {
      if (direction === 1) {
        for (let r = row; r < this.GRID_HEIGHT; r++) {
          path.push(r * this.GRID_WIDTH + col);
        }
        row = this.GRID_HEIGHT - 1;
      } else {
        for (let r = row; r >= 0; r--) {
          path.push(r * this.GRID_WIDTH + col);
        }
        row = 0;
      }
      direction *= -1;
    }

    return path;
  }
}
