import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REGION_HEIGHT,
  DEFAULT_REGION_WIDTH,
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
} from './annotation-constants';
import { clampRegionGeometry, defaultRegionAt } from './region-geometry';

describe('clampRegionGeometry', () => {
  it('clamps size to the configured bounds', () => {
    expect(clampRegionGeometry({ x: 0, y: 0, width: -1, height: 2 })).toMatchObject({
      width: MIN_REGION_SIZE,
      height: MAX_REGION_SIZE,
    });
  });

  it('shifts a region at the edge fully onto the image', () => {
    const result = clampRegionGeometry({ x: 0.99, y: 0.99, width: 0.2, height: 0.3 });
    expect(result.x + result.width).toBe(1);
    expect(result.y + result.height).toBe(1);
  });

  it('plants the default rectangle centred on a click', () => {
    expect(defaultRegionAt(0.5, 0.5)).toEqual({
      x: 0.5 - DEFAULT_REGION_WIDTH / 2,
      y: 0.5 - DEFAULT_REGION_HEIGHT / 2,
      width: DEFAULT_REGION_WIDTH,
      height: DEFAULT_REGION_HEIGHT,
    });
  });
});
