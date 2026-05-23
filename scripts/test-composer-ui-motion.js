import assert from 'node:assert/strict';
import {
  captureElementRect,
  clearInlineSlideStyles,
  getComposerSlideDurations,
  resolveComposerScrollDuration,
  slideToggle,
  syncSiteEditorSingleLabelWidth
} from '../assets/js/composer-ui-motion.js';

function createStyleRecorder() {
  const values = new Map();
  return {
    values,
    setProperty(name, value) {
      values.set(name, value);
    },
    removeProperty(name) {
      values.delete(name);
    }
  };
}

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalResizeObserver = globalThis.ResizeObserver;

try {
  globalThis.window = {
    requestAnimationFrame(fn) {
      fn(0);
      return 1;
    },
    cancelAnimationFrame() {},
    getComputedStyle(target) {
      return target.__computedStyle || target.style || {};
    },
    matchMedia() {
      return { matches: true };
    }
  };
  globalThis.document = {
    fonts: {
      ready: Promise.resolve()
    }
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      this.targets = [];
    }
  };

  const rootStyle = createStyleRecorder();
  const tooltip = { scrollWidth: 14 };
  const cell = {
    __computedStyle: { gap: '6px', columnGap: '0' },
    querySelector(selector) {
      return selector === '.cs-help-tooltip' ? tooltip : null;
    }
  };
  const label = {
    scrollWidth: 72,
    closest(selector) {
      return selector === '.cs-single-grid-label' ? cell : null;
    }
  };
  const root = {
    style: rootStyle,
    querySelectorAll(selector) {
      return selector === '.cs-single-grid-title' ? [label] : [];
    }
  };

  syncSiteEditorSingleLabelWidth(root);
  assert.equal(
    rootStyle.values.get('--cs-editor-single-label-width'),
    '92px',
    'single-label width should use label width plus visible help icon and grid gap'
  );
  assert.equal(
    typeof root.__pressSiteSingleLabelWidthCleanup,
    'function',
    'single-label measurement should register cleanup for rerenders'
  );

  const emptyRootStyle = createStyleRecorder();
  syncSiteEditorSingleLabelWidth({
    style: emptyRootStyle,
    querySelectorAll() {
      return [];
    }
  });
  assert.equal(
    emptyRootStyle.values.has('--cs-editor-single-label-width'),
    false,
    'single-label measurement should remove the CSS variable when no labels exist'
  );

  assert.deepEqual(
    getComposerSlideDurations(),
    { open: 420, close: 360 },
    'slide durations should remain stable for order diff layout timing'
  );
  assert.equal(resolveComposerScrollDuration(10), 120, 'scroll duration should clamp short durations');
  assert.equal(resolveComposerScrollDuration(5000), 1600, 'scroll duration should clamp long durations');
  assert.equal(resolveComposerScrollDuration('bad'), 720, 'scroll duration should fall back for invalid input');

  const reducedMotionEl = {
    dataset: {},
    scrollHeight: 100,
    offsetWidth: 0,
    offsetHeight: 0,
    style: {
      display: 'none',
      overflow: 'hidden',
      height: '1px',
      opacity: '0.5',
      paddingTop: '2px',
      paddingBottom: '4px'
    }
  };
  slideToggle(reducedMotionEl, true);
  assert.equal(reducedMotionEl.style.display, 'block', 'reduced-motion slide open should show the element');
  assert.equal(reducedMotionEl.dataset.open, '1', 'reduced-motion slide open should mark the element open');
  assert.equal(reducedMotionEl.style.height, '', 'slide open should clear inline height');
  slideToggle(reducedMotionEl, false);
  assert.equal(reducedMotionEl.style.display, 'none', 'reduced-motion slide close should hide the element');
  assert.equal(reducedMotionEl.dataset.open, '0', 'reduced-motion slide close should mark the element closed');

  reducedMotionEl.style.overflow = 'hidden';
  reducedMotionEl.style.height = '10px';
  reducedMotionEl.style.opacity = '0.3';
  reducedMotionEl.style.paddingTop = '1px';
  reducedMotionEl.style.paddingBottom = '2px';
  clearInlineSlideStyles(reducedMotionEl);
  assert.equal(reducedMotionEl.style.overflow, '', 'clearInlineSlideStyles should clear overflow');
  assert.equal(reducedMotionEl.style.height, '', 'clearInlineSlideStyles should clear height');
  assert.equal(reducedMotionEl.style.opacity, '', 'clearInlineSlideStyles should clear opacity');

  assert.deepEqual(
    captureElementRect({
      getBoundingClientRect() {
        return { top: 1, left: 2, width: 3, height: 4, right: 5, bottom: 6 };
      }
    }),
    { top: 1, left: 2, width: 3, height: 4 },
    'captureElementRect should keep only stable transition dimensions'
  );
} finally {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.ResizeObserver = originalResizeObserver;
}
