import {
  DEFAULT_REGION_HEIGHT,
  DEFAULT_REGION_WIDTH,
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
} from './annotation-constants';

export interface RegionGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampRegionGeometry(geometry: RegionGeometry): RegionGeometry {
  const width = clamp(geometry.width, MIN_REGION_SIZE, MAX_REGION_SIZE);
  const height = clamp(geometry.height, MIN_REGION_SIZE, MAX_REGION_SIZE);
  return {
    x: clamp(geometry.x, 0, 1 - width),
    y: clamp(geometry.y, 0, 1 - height),
    width,
    height,
  };
}

export function defaultRegionAt(x: number, y: number): RegionGeometry {
  return clampRegionGeometry({
    x: x - DEFAULT_REGION_WIDTH / 2,
    y: y - DEFAULT_REGION_HEIGHT / 2,
    width: DEFAULT_REGION_WIDTH,
    height: DEFAULT_REGION_HEIGHT,
  });
}

function clamp(value: number, low: number, high: number): number {
  const finite = Number.isFinite(value) ? value : low;
  return Math.min(Math.max(finite, low), high);
}
