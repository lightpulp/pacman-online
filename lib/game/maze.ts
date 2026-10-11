export const COLS = 28;
export const ROWS = 31;
export const TUNNEL_ROW = 14;

// # wall   . dot   o power pellet   - ghost-house door   (space) empty
export const MAZE: string[] = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##................##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

const wrapCol = (c: number) => ((c % COLS) + COLS) % COLS;

/** Column -1 and column 28 exist only so entities can slide through the side tunnel. */
export function isWall(c: number, r: number, doorOpen: boolean): boolean {
  if (r < 0 || r >= ROWS || c < -1 || c > COLS) return true;
  const ch = MAZE[r][wrapCol(c)];
  if (ch === '#') return true;
  if (ch === '-') return !doorOpen;
  return false;
}

export const EATEN_TARGET = { x: 13, y: 11 };

/** Walking distance from every tile to the spot just outside the ghost house (used by eaten ghosts). */
export const EATEN_DIST: number[][] = (() => {
  const dist: number[][] = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(1e9));
  const queue: [number, number][] = [[EATEN_TARGET.x, EATEN_TARGET.y]];
  dist[EATEN_TARGET.y][EATEN_TARGET.x] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [c, r] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = wrapCol(c + dx);
      const nr = r + dy;
      if (isWall(c + dx, nr, false) || dist[nr][nc] !== 1e9) continue;
      dist[nr][nc] = dist[r][c] + 1;
      queue.push([nc, nr]);
    }
  }
  return dist;
})();
