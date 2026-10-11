import { COLS, ROWS, MAZE, TUNNEL_ROW, isWall, EATEN_DIST } from './maze';
import type { AssetMap, AssetName } from './assets';
import type { SoundName } from './sound';

export type Dir = 'up' | 'down' | 'left' | 'right';

const T = 20; // tile size in canvas pixels
export const CANVAS_W = COLS * T;
export const CANVAS_H = ROWS * T;

const VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const ORDER: Dir[] = ['up', 'left', 'down', 'right'];
const ANGLE: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

const PAC_SPEED = 7.5; // tiles per second
const FRIGHT_TIME = 7;
const MODES = [7, 20, 7, 20, 5, 20, 5, Infinity]; // even index = scatter, odd = chase
const DEATH_TIME = 1.6;

type GhostState = 'house' | 'leaving' | 'active' | 'eaten' | 'entering';
interface Ent { x: number; y: number; dx: number; dy: number }
interface Pac extends Ent { next: Dir | null; face: Dir }
interface Ghost extends Ent {
  id: number;
  sprite: 1 | 2 | 3 | 4;
  color: string;
  state: GhostState;
  scared: boolean;
  delay: number; // seconds after (re)start before leaving the house
  releaseAt: number;
  start: { x: number; y: number };
  corner: { x: number; y: number };
}

export interface GameHooks {
  onSound: (name: SoundName) => void;
  onHud: (hud: { score: number; lives: number }) => void;
  onFinish: (result: { score: number; won: boolean }) => void;
}

const GHOST_DEFS = [
  { sprite: 1 as const, color: '#ff2a2a', start: { x: 13, y: 11 }, corner: { x: 25, y: 0 }, delay: 0 },
  { sprite: 2 as const, color: '#ffb8ff', start: { x: 13, y: 14 }, corner: { x: 2, y: 0 }, delay: 1.5 },
  { sprite: 3 as const, color: '#00e5ff', start: { x: 11, y: 14 }, corner: { x: 27, y: 30 }, delay: 4 },
  { sprite: 4 as const, color: '#ffb852', start: { x: 16, y: 14 }, corner: { x: 0, y: 30 }, delay: 7 },
];

export class Game {
  score = 0;
  lives = 3;
  private grid: string[][] = MAZE.map((row) => row.split('').map((c) => (c === '.' || c === 'o' ? c : ' ')));
  private dotsLeft = 0;
  private phase: 'ready' | 'playing' | 'dying' | 'ending' = 'ready';
  private timer = 0;
  private time = 0;
  private playTime = 0;
  private modeIdx = 0;
  private modeTimer = 0;
  private frightLeft = 0;
  private combo = 0;
  private won = false;
  private finished = false;
  private pac!: Pac;
  private ghosts: Ghost[] = [];
  private wallLayer: HTMLCanvasElement | null = null;

  constructor(private hooks: GameHooks, private assets: AssetMap) {
    for (const row of this.grid) for (const c of row) if (c === '.' || c === 'o') this.dotsLeft++;
    this.resetPositions();
  }

  start() {
    this.phase = 'ready';
    this.timer = 2.6;
    this.hooks.onSound('game_start');
    this.hooks.onHud({ score: this.score, lives: this.lives });
  }

  setDir(d: Dir) {
    const p = this.pac;
    const v = VEC[d];
    const moving = p.dx !== 0 || p.dy !== 0;
    if (this.phase === 'playing' && moving && v.dx === -p.dx && v.dy === -p.dy) {
      p.dx = v.dx; // reversing is allowed anywhere, even mid-tile
      p.dy = v.dy;
      p.face = d;
      p.next = null;
    } else {
      p.next = d;
    }
  }

  // ───────────────────────── update ─────────────────────────

  update(dt: number) {
    this.time += dt;
    switch (this.phase) {
      case 'ready':
        this.timer -= dt;
        if (this.timer <= 0) this.phase = 'playing';
        break;
      case 'playing':
        this.tick(dt);
        break;
      case 'dying':
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.lives <= 0) {
            this.phase = 'ending';
            this.timer = 1.8;
            this.won = false;
            this.hooks.onSound('game_end');
          } else {
            this.resetPositions();
            this.phase = 'ready';
            this.timer = 1.5;
          }
        }
        break;
      case 'ending':
        this.timer -= dt;
        if (this.timer <= 0 && !this.finished) {
          this.finished = true;
          this.hooks.onFinish({ score: this.score, won: this.won });
        }
        break;
    }
  }

  private tick(dt: number) {
    this.playTime += dt;

    if (this.frightLeft > 0) {
      this.frightLeft -= dt;
      if (this.frightLeft <= 0) {
        this.frightLeft = 0;
        this.combo = 0;
        for (const g of this.ghosts) g.scared = false;
      }
    } else {
      this.modeTimer += dt;
      if (this.modeTimer >= MODES[this.modeIdx]) {
        this.modeTimer = 0;
        this.modeIdx++;
        for (const g of this.ghosts) if (g.state === 'active') this.reverse(g);
      }
    }

    this.movePac(dt);
    this.eatDots();
    for (const g of this.ghosts) this.updateGhost(g, dt);
    this.checkCollisions();

    if (this.phase === 'playing' && this.dotsLeft === 0) {
      this.phase = 'ending';
      this.timer = 2.2;
      this.won = true;
      this.hooks.onSound('game_win');
    }
  }

  private resetPositions() {
    this.pac = { x: 13, y: 23, dx: -1, dy: 0, next: null, face: 'left' };
    this.ghosts = GHOST_DEFS.map((d, id) => ({
      id,
      sprite: d.sprite,
      color: d.color,
      x: d.start.x,
      y: d.start.y,
      dx: id === 0 ? -1 : 0,
      dy: 0,
      state: id === 0 ? 'active' : 'house',
      scared: false,
      delay: d.delay,
      releaseAt: this.playTime + d.delay,
      start: d.start,
      corner: d.corner,
    }));
    this.frightLeft = 0;
    this.combo = 0;
    this.modeIdx = 0;
    this.modeTimer = 0;
  }

  // ───────────────────────── movement ─────────────────────────

  private canMove(e: Ent, v: { dx: number; dy: number }, door: boolean) {
    return !isWall(Math.round(e.x) + v.dx, Math.round(e.y) + v.dy, door);
  }

  /** Moves an entity `dist` tiles, calling decide() every time it is exactly on a tile center. */
  private step(e: Ent, dist: number, decide: (e: Ent) => void) {
    for (let i = 0; i < 12 && dist > 1e-9; i++) {
      if (Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6) {
        e.x = Math.round(e.x);
        e.y = Math.round(e.y);
        decide(e);
        if (e.dx === 0 && e.dy === 0) return;
      }
      const horiz = e.dx !== 0;
      const pos = horiz ? e.x : e.y;
      const d = horiz ? e.dx : e.dy;
      const next = d > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1;
      const gap = Math.abs(next - pos);
      if (dist >= gap) {
        dist -= gap;
        if (horiz) e.x = next;
        else e.y = next;
      } else {
        if (horiz) e.x += d * dist;
        else e.y += d * dist;
        dist = 0;
      }
      if (e.dx > 0 && e.x >= COLS) e.x = -1; // side tunnel wrap
      else if (e.dx < 0 && e.x <= -1) e.x = COLS;
    }
  }

  private movePac(dt: number) {
    const p = this.pac;
    this.step(p, PAC_SPEED * dt, (e) => {
      if (p.next && this.canMove(e, VEC[p.next], false)) {
        e.dx = VEC[p.next].dx;
        e.dy = VEC[p.next].dy;
        p.face = p.next;
        p.next = null;
      } else if ((e.dx === 0 && e.dy === 0) || !this.canMove(e, e, false)) {
        e.dx = 0;
        e.dy = 0;
      }
    });
  }

  private eatDots() {
    const p = this.pac;
    const rx = Math.round(p.x);
    const ry = Math.round(p.y);
    if (rx < 0 || rx >= COLS) return;
    const c = this.grid[ry][rx];
    if (c !== '.' && c !== 'o') return;
    this.grid[ry][rx] = ' ';
    this.dotsLeft--;
    if (c === '.') {
      this.score += 10;
      this.hooks.onSound('pacman_eating');
    } else {
      this.score += 50;
      this.hooks.onSound('power_pellet');
      this.frightLeft = FRIGHT_TIME;
      this.combo = 0;
      for (const g of this.ghosts) {
        if (g.state === 'active') {
          g.scared = true;
          this.reverse(g);
        }
      }
    }
    this.hooks.onHud({ score: this.score, lives: this.lives });
  }

  private reverse(g: Ghost) {
    g.dx = -g.dx;
    g.dy = -g.dy;
  }

  private updateGhost(g: Ghost, dt: number) {
    if (g.state === 'house') {
      if (this.playTime >= g.releaseAt) g.state = 'leaving';
      return;
    }
    let speed = 7;
    if (g.state === 'eaten') speed = 13;
    else if (g.state === 'leaving' || g.state === 'entering') speed = 4.5;
    else if (g.scared) speed = 4.2;
    else if (Math.round(g.y) === TUNNEL_ROW && (g.x < 5 || g.x > 22)) speed = 3.8;
    this.step(g, speed * dt, () => this.decideGhost(g));
  }

  private setGhostDir(g: Ghost, dx: number, dy: number) {
    g.dx = dx;
    g.dy = dy;
  }

  private decideGhost(g: Ghost) {
    switch (g.state) {
      case 'leaving':
        if (g.x < 13) this.setGhostDir(g, 1, 0);
        else if (g.x > 13) this.setGhostDir(g, -1, 0);
        else if (g.y > 11) this.setGhostDir(g, 0, -1);
        else {
          g.state = 'active';
          this.setGhostDir(g, -1, 0);
        }
        return;
      case 'entering':
        if (g.y < 14) this.setGhostDir(g, 0, 1);
        else {
          g.state = 'house';
          g.scared = false;
          g.releaseAt = this.playTime + 1;
          this.setGhostDir(g, 0, 0);
        }
        return;
      case 'eaten': {
        if (g.x === 13 && g.y === 11) {
          g.state = 'entering';
          this.setGhostDir(g, 0, 1);
          return;
        }
        let best: Dir | null = null;
        let bestDist = 1e9;
        for (const d of ORDER) {
          const v = VEC[d];
          if (!this.canMove(g, v, false)) continue;
          const col = (((g.x + v.dx) % COLS) + COLS) % COLS;
          const dd = EATEN_DIST[g.y + v.dy][col];
          if (dd < bestDist) {
            bestDist = dd;
            best = d;
          }
        }
        if (best) this.setGhostDir(g, VEC[best].dx, VEC[best].dy);
        return;
      }
      case 'active': {
        const opts: Dir[] = [];
        for (const d of ORDER) {
          const v = VEC[d];
          if ((g.dx !== 0 || g.dy !== 0) && v.dx === -g.dx && v.dy === -g.dy) continue;
          if (this.canMove(g, v, false)) opts.push(d);
        }
        if (opts.length === 0) {
          this.reverse(g);
          return;
        }
        let pick = opts[0];
        if (g.scared) {
          pick = opts[Math.floor(Math.random() * opts.length)];
        } else {
          const t = this.target(g);
          let best = Infinity;
          for (const d of opts) {
            const v = VEC[d];
            const dist = Math.hypot(g.x + v.dx - t.x, g.y + v.dy - t.y);
            if (dist < best) {
              best = dist;
              pick = d;
            }
          }
        }
        this.setGhostDir(g, VEC[pick].dx, VEC[pick].dy);
        return;
      }
      default:
        return;
    }
  }

  private target(g: Ghost) {
    if (this.modeIdx % 2 === 0) return g.corner; // scatter
    const p = this.pac;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const f = VEC[p.face];
    switch (g.id) {
      case 0:
        return { x: px, y: py };
      case 1:
        return { x: px + 4 * f.dx, y: py + 4 * f.dy };
      case 2: {
        const red = this.ghosts[0];
        return { x: 2 * (px + 2 * f.dx) - Math.round(red.x), y: 2 * (py + 2 * f.dy) - Math.round(red.y) };
      }
      default:
        return Math.hypot(g.x - px, g.y - py) > 8 ? { x: px, y: py } : g.corner;
    }
  }

  private checkCollisions() {
    const p = this.pac;
    for (const g of this.ghosts) {
      if (g.state === 'house' || g.state === 'eaten' || g.state === 'entering') continue;
      if (Math.hypot(g.x - p.x, g.y - p.y) >= 0.7) continue;
      if (g.scared) {
        g.state = 'eaten';
        g.scared = false;
        this.score += 200 * 2 ** this.combo;
        this.combo = Math.min(this.combo + 1, 3);
        this.hooks.onSound('ghost_eaten');
        this.hooks.onHud({ score: this.score, lives: this.lives });
      } else {
        this.lives--;
        this.phase = 'dying';
        this.timer = DEATH_TIME;
        this.hooks.onSound('pacman_dying');
        this.hooks.onHud({ score: this.score, lives: this.lives });
        return;
      }
    }
  }

  // ───────────────────────── rendering ─────────────────────────

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!this.wallLayer) this.wallLayer = this.buildWalls();
    ctx.drawImage(this.wallLayer, 0, 0);

    // dots
    ctx.fillStyle = '#ffd9a8';
    const blink = Math.floor(this.time * 4) % 2 === 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.grid[r][c];
        if (ch === '.') {
          ctx.beginPath();
          ctx.arc((c + 0.5) * T, (r + 0.5) * T, T * 0.1, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'o' && blink) {
          ctx.beginPath();
          ctx.arc((c + 0.5) * T, (r + 0.5) * T, T * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (this.phase !== 'dying') for (const g of this.ghosts) this.drawGhost(ctx, g);
    this.drawPac(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${T}px "Courier New", monospace`;
    const cx = CANVAS_W / 2;
    const cy = 17.5 * T;
    if (this.phase === 'ready') {
      ctx.fillStyle = '#ffe600';
      ctx.fillText('READY!', cx, cy);
    } else if (this.phase === 'ending') {
      ctx.fillStyle = this.won ? '#ffe600' : '#ff3030';
      ctx.fillText(this.won ? 'YOU WIN!' : 'GAME OVER', cx, cy);
    }
  }

  private buildWalls(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = CANVAS_W;
    cv.height = CANVAS_H;
    const x = cv.getContext('2d')!;
    x.fillStyle = '#05053a';
    x.strokeStyle = '#2f5bff';
    x.lineWidth = 3;
    x.lineCap = 'round';
    const wall = (c: number, r: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAZE[r][c] === '#';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        if (ch === '-') {
          x.fillStyle = '#ffb8ff';
          x.fillRect(c * T, r * T + T * 0.4, T, T * 0.2);
          x.fillStyle = '#05053a';
          continue;
        }
        if (ch !== '#') continue;
        x.fillRect(c * T, r * T, T, T);
        const l = c * T, t = r * T, rr = l + T, b = t + T;
        const edge = (x1: number, y1: number, x2: number, y2: number) => {
          x.beginPath();
          x.moveTo(x1, y1);
          x.lineTo(x2, y2);
          x.stroke();
        };
        if (r > 0 && !wall(c, r - 1)) edge(l, t + 1.5, rr, t + 1.5);
        if (r < ROWS - 1 && !wall(c, r + 1)) edge(l, b - 1.5, rr, b - 1.5);
        if (c > 0 && !wall(c - 1, r)) edge(l + 1.5, t, l + 1.5, b);
        if (c < COLS - 1 && !wall(c + 1, r)) edge(rr - 1.5, t, rr - 1.5, b);
      }
    }
    return cv;
  }

  private drawPac(ctx: CanvasRenderingContext2D) {
    const p = this.pac;
    const cx = (p.x + 0.5) * T;
    const cy = (p.y + 0.5) * T;
    const r = T * 0.45;
    let mouth: number;
    if (this.phase === 'dying') {
      const prog = 1 - Math.max(this.timer, 0) / DEATH_TIME;
      if (prog > 0.97) return;
      mouth = 0.1 + prog * (Math.PI - 0.1);
    } else if ((p.dx !== 0 || p.dy !== 0) && this.phase === 'playing') {
      mouth = 0.02 + Math.abs(Math.sin(this.time * 14)) * 0.28 * Math.PI;
    } else {
      mouth = 0.2 * Math.PI;
    }
    const a = this.phase === 'dying' ? -Math.PI / 2 : ANGLE[p.face];
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a + mouth, a - mouth + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, g: Ghost) {
    const cx = (g.x + 0.5) * T;
    const cy = (g.y + 0.5) * T;
    const r = T * 0.45;
    const eyesOnly = g.state === 'eaten' || g.state === 'entering';

    if (!eyesOnly) {
      const flashing = g.scared && this.frightLeft < 2 && Math.floor(this.time * 6) % 2 === 0;
      const key = `ghost${g.sprite}${g.scared && !flashing ? '_scared' : ''}` as AssetName;
      const img = this.assets[key];
      if (img) {
        ctx.drawImage(img, cx - T * 0.55, cy - T * 0.55, T * 1.1, T * 1.1);
        return;
      }
      ctx.fillStyle = g.scared ? (flashing ? '#ffffff' : '#2121ff') : g.color;
      ctx.beginPath();
      ctx.arc(cx, cy - T * 0.05, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r);
      const n = 3;
      const w = (2 * r) / n;
      for (let i = 0; i < n; i++) {
        const x0 = cx + r - i * w;
        ctx.lineTo(x0 - w / 2, cy + r - T * 0.18);
        ctx.lineTo(x0 - w, cy + r);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (g.scared && !eyesOnly) {
      ctx.fillStyle = '#ffd0a0';
      for (const s of [-1, 1]) ctx.fillRect(cx + s * r * 0.4 - 2, cy - r * 0.3, 4, 4);
      return;
    }
    const v = { x: g.dx, y: g.dy };
    for (const s of [-1, 1]) {
      const ex = cx + s * r * 0.42;
      const ey = cy - r * 0.2;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2cff';
      ctx.beginPath();
      ctx.arc(ex + v.x * r * 0.12, ey + v.y * r * 0.12, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
