import {
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_STEP,
  ZoomPan,
  clampOffset,
  clampScale,
} from './zoom-pan';

const FRAME = { width: 400, height: 300 };

function createController(frame = FRAME): ZoomPan {
  const zoom = new ZoomPan();
  zoom.setFrameSize(frame);
  return zoom;
}

/** The map point currently under a frame coordinate, in unscaled frame units. */
function mapPointUnder(zoom: ZoomPan, pointerX: number, pointerY: number) {
  return {
    x: (pointerX - zoom.offsetX()) / zoom.scale(),
    y: (pointerY - zoom.offsetY()) / zoom.scale(),
  };
}

describe('clampScale', () => {
  it('never drops below the fitted scale', () => {
    expect(clampScale(0.25)).toBe(MIN_SCALE);
    expect(clampScale(MIN_SCALE)).toBe(MIN_SCALE);
  });

  it('never exceeds the maximum scale', () => {
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(MAX_SCALE)).toBe(MAX_SCALE);
  });
});

describe('clampOffset', () => {
  it('bounds the offset so scaled content still covers the frame', () => {
    expect(clampOffset(500, 400, 800)).toBe(0);
    expect(clampOffset(-500, 400, 800)).toBe(-400);
    expect(clampOffset(-100, 400, 800)).toBe(-100);
  });

  it('centres content that is not larger than the frame', () => {
    expect(clampOffset(-250, 400, 300)).toBe(50);
    expect(clampOffset(0, 400, 400)).toBe(0);
  });
});

describe('ZoomPan', () => {
  it('starts fitted to the frame with a centred offset', () => {
    const zoom = createController();

    expect(zoom.scale()).toBe(MIN_SCALE);
    expect(zoom.offsetX()).toBe(0);
    expect(zoom.offsetY()).toBe(0);
  });

  it('multiplies the scale by one step per discrete zoom in', () => {
    const zoom = createController();

    zoom.zoomIn();

    expect(zoom.scale()).toBeCloseTo(ZOOM_STEP);
  });

  it('stays at the minimum when zooming out from the fitted view', () => {
    const zoom = createController();

    zoom.zoomOut();
    zoom.zoomOut();

    expect(zoom.scale()).toBe(MIN_SCALE);
    expect(zoom.canZoomOut()).toBe(false);
  });

  it('stops at the maximum however many times it is zoomed in', () => {
    const zoom = createController();

    for (let step = 0; step < 20; step += 1) {
      zoom.zoomIn();
    }

    expect(zoom.scale()).toBe(MAX_SCALE);
    expect(zoom.canZoomIn()).toBe(false);
  });

  it('bounds panning on both axes so the map always covers the frame', () => {
    const zoom = createController();
    zoom.zoomBy(2);

    zoom.panBy(5000, 5000);

    expect(zoom.offsetX()).toBe(0);
    expect(zoom.offsetY()).toBe(0);

    zoom.panBy(-5000, -5000);

    // Scaled content is 800x600 inside a 400x300 frame.
    expect(zoom.offsetX()).toBe(-400);
    expect(zoom.offsetY()).toBe(-300);
  });

  it('pins the offset to the centre while fitted, whatever the drag', () => {
    const zoom = createController();

    zoom.panBy(-250, 180);

    expect(zoom.offsetX()).toBe(0);
    expect(zoom.offsetY()).toBe(0);
  });

  it('keeps the pointed map point stationary while zooming to a pointer', () => {
    const zoom = createController();
    const before = mapPointUnder(zoom, 180, 140);

    zoom.zoomToPointer(2, 180, 140);

    const after = mapPointUnder(zoom, 180, 140);
    expect(zoom.scale()).toBeCloseTo(2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('restores the fitted, centred view on reset', () => {
    const zoom = createController();
    zoom.zoomBy(4);
    zoom.panBy(-300, -200);

    zoom.reset();

    expect(zoom.scale()).toBe(MIN_SCALE);
    expect(zoom.offsetX()).toBe(0);
    expect(zoom.offsetY()).toBe(0);
  });

  it('re-clamps existing offsets when the frame is resized', () => {
    const zoom = createController();
    zoom.zoomBy(2);
    zoom.panBy(-5000, -5000);
    expect(zoom.offsetX()).toBe(-400);

    zoom.setFrameSize({ width: 200, height: 150 });

    // Content is now 400x300 in a 200x150 frame, so the map still covers it.
    expect(zoom.offsetX()).toBe(-200);
    expect(zoom.offsetY()).toBe(-150);
  });

  it('exposes the offset and scale as a single CSS transform', () => {
    const zoom = createController();

    // A discrete zoom is anchored on the frame's centre, so doubling the scale
    // in a 400x300 frame shifts the offset by half the frame on each axis.
    zoom.zoomBy(2);

    expect(zoom.transform()).toBe('translate(-200px, -150px) scale(2)');
  });
});
