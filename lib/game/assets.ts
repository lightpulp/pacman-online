export const ASSET_NAMES = ['ghost1', 'ghost1_scared', 'ghost2', 'ghost2_scared'] as const;
export type AssetName = (typeof ASSET_NAMES)[number];
export type AssetMap = Partial<Record<AssetName, HTMLImageElement>>;

const loaded: AssetMap = {};
let started = false;

/**
 * Tries to load /public/assets/<name>.png for every name. Files that are missing are
 * simply skipped; the engine draws a colored shape for those instead.
 * The returned object is filled in as images arrive.
 */
export function loadAssets(): AssetMap {
  if (started || typeof window === 'undefined') return loaded;
  started = true;
  for (const name of ASSET_NAMES) {
    const img = new Image();
    img.onload = () => {
      loaded[name] = img;
    };
    img.src = `/assets/${name}.png`;
  }
  return loaded;
}
