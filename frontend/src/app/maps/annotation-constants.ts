export type Typeface = 'sans' | 'serif' | 'condensed';

export const TYPEFACES: readonly Typeface[] = ['sans', 'serif', 'condensed'];
export const DEFAULT_TEXT_COLOR = '#f5f7fa';
export const DEFAULT_TYPEFACE: Typeface = 'sans';
export const MIN_TEXT_SCALE = 0.01;
export const MAX_TEXT_SCALE = 0.1;
export const DEFAULT_TEXT_SCALE = 0.03;
export const TEXT_SCALE_STEP = 0.005;

export const MIN_REGION_SIZE = 0.04;
export const MAX_REGION_SIZE = 1;
export const DEFAULT_REGION_WIDTH = 0.16;
export const DEFAULT_REGION_HEIGHT = 0.1;
export const MIN_OPACITY = 0;
export const MAX_OPACITY = 1;
export const MIN_BRIGHTNESS = 0.25;
export const MAX_BRIGHTNESS = 2;

export const DEFAULT_REST_APPEARANCE = {
  color: '#4f9dff',
  opacity: 0,
  brightness: 1,
} as const;

export const DEFAULT_HOVER_APPEARANCE = {
  color: '#4f9dff',
  opacity: 0.4,
  brightness: 1,
} as const;
