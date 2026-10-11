
export const ASSET_NAMES = [
  'ghost1',
  'ghost1_scared',
  'ghost2',
  'ghost2_scared',
  'ghost3',
  'ghost3_scared',
  'ghost4',
  'ghost4_scared',
] as const;

export type AssetName = (typeof ASSET_NAMES)[number];
export type AssetMap = Partial<Record<AssetName, HTMLImageElement>>;

const loaded: AssetMap = {};
let started = false;

export function loadAssets(): AssetMap {
  if (started || typeof window === 'undefined') return loaded;

  started = true;

  for (const name of ASSET_NAMES) {
    const img = new Image();

    img.onload = () => {
      loaded[name] = img;
    };

    img.onerror = () => {
      console.error(`Failed to load ghost sprite: /assets/${name}.png`);
    };

    img.src = `/assets/${name}.png`;
  }

  return loaded;
}
