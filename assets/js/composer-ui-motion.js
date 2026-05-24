const SLIDE_OPEN_DUR = 420;
const SLIDE_CLOSE_DUR = 360;

let composerReduceMotionQuery = null;
const composerInlineVisibilityAnimations = new WeakMap();
const composerInlineVisibilityFallbacks = new WeakMap();
const composerListTransitions = new WeakMap();
const composerOrderMainTransitions = new WeakMap();
let composerSiteScrollAnimationId = null;
let composerSiteScrollCleanup = null;
const activeSlideAnimations = new WeakMap();

function createComposerUiMotionRuntime(options = {}) {
  return {
    documentRef: options.documentRef || null,
    windowRef: options.windowRef || null,
    requestAnimationFrameRef: typeof options.requestAnimationFrameRef === 'function'
      ? options.requestAnimationFrameRef
      : null,
    cancelAnimationFrameRef: typeof options.cancelAnimationFrameRef === 'function'
      ? options.cancelAnimationFrameRef
      : null,
    setTimeoutRef: typeof options.setTimeoutRef === 'function'
      ? options.setTimeoutRef
      : null,
    clearTimeoutRef: typeof options.clearTimeoutRef === 'function'
      ? options.clearTimeoutRef
      : null,
    matchesMediaRef: typeof options.matchesMedia === 'function'
      ? options.matchesMedia
      : null,
    getComputedStyleRef: typeof options.getComputedStyleRef === 'function'
      ? options.getComputedStyleRef
      : null,
    performanceRef: options.performanceRef || null,
    ResizeObserverRef: typeof options.ResizeObserverRef === 'function'
      ? options.ResizeObserverRef
      : null
  };
}

let composerUiMotionRuntime = createComposerUiMotionRuntime();

export function configureComposerUiMotionRuntime(options = {}) {
  cancelComposerSiteScrollAnimation();
  composerUiMotionRuntime = createComposerUiMotionRuntime(options);
  composerReduceMotionQuery = null;
  return composerUiMotionRuntime;
}

function getDocumentRef() {
  return composerUiMotionRuntime.documentRef || null;
}

function getWindowRef() {
  return composerUiMotionRuntime.windowRef || null;
}

function requestFrame(fn) {
  const requestAnimationFrameRef = composerUiMotionRuntime.requestAnimationFrameRef;
  if (requestAnimationFrameRef) return requestAnimationFrameRef(fn);
  return setTimer(fn, 0);
}

function cancelFrame(id) {
  if (id == null) return;
  const cancelAnimationFrameRef = composerUiMotionRuntime.cancelAnimationFrameRef;
  if (cancelAnimationFrameRef) {
    try {
      cancelAnimationFrameRef(id);
      return;
    } catch (_) {}
  }
  clearTimer(id);
}

function setTimer(fn, delay = 0) {
  const setTimeoutRef = composerUiMotionRuntime.setTimeoutRef;
  if (setTimeoutRef) return setTimeoutRef(fn, delay);
  if (typeof fn === 'function') {
    try { fn(); } catch (_) {}
  }
  return null;
}

function clearTimer(id) {
  if (id == null) return;
  const clearTimeoutRef = composerUiMotionRuntime.clearTimeoutRef;
  if (clearTimeoutRef) {
    try { clearTimeoutRef(id); } catch (_) {}
  }
}

function getComputedStyleFor(element) {
  const getComputedStyleRef = composerUiMotionRuntime.getComputedStyleRef;
  if (!getComputedStyleRef || !element) return null;
  try {
    return getComputedStyleRef(element);
  } catch (_) {
    return null;
  }
}

function getNow() {
  const performanceRef = composerUiMotionRuntime.performanceRef;
  try {
    if (performanceRef && typeof performanceRef.now === 'function') return performanceRef.now();
  } catch (_) {}
  return Date.now();
}

function getResizeObserverRef() {
  return composerUiMotionRuntime.ResizeObserverRef || null;
}

function matchesMediaQuery(query) {
  const matchesMediaRef = composerUiMotionRuntime.matchesMediaRef;
  if (!matchesMediaRef) return false;
  try {
    const result = matchesMediaRef(query);
    return typeof result === 'boolean' ? result : !!(result && result.matches);
  } catch (_) {
    return false;
  }
}

export function syncSiteEditorSingleLabelWidth(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  try {
    if (typeof root.__pressSiteSingleLabelWidthCleanup === 'function') root.__pressSiteSingleLabelWidthCleanup();
  } catch (_) {}
  try { root.__pressSiteSingleLabelWidthCleanup = null; } catch (_) {}

  const labels = Array.from(root.querySelectorAll('.cs-single-grid-title'));
  if (!labels.length) {
    try { root.style.removeProperty('--cs-editor-single-label-width'); } catch (_) {}
    return;
  }

  let frame = 0;
  let observer = null;
  const measure = () => {
    frame = 0;
    let width = 88;
    labels.forEach((label) => {
      const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
      const target = cell || label;
      let measured = 0;
      try {
        const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
        const tooltipWidth = tooltip ? tooltip.scrollWidth || 0 : 0;
        const labelWidth = label.scrollWidth || 0;
        const targetStyle = getComputedStyleFor(target);
        const gap = targetStyle ? parseFloat(targetStyle.gap || targetStyle.columnGap || '0') || 0 : 0;
        measured = labelWidth + tooltipWidth + gap;
      } catch (_) {
        try {
          const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
          measured = (label.scrollWidth || 0) + (tooltip ? tooltip.scrollWidth || 0 : 0);
        } catch (_) {}
      }
      width = Math.max(width, measured);
    });
    try { root.style.setProperty('--cs-editor-single-label-width', `${Math.ceil(width)}px`); } catch (_) {}
  };
  const schedule = () => {
    if (frame) return;
    frame = requestFrame(measure);
  };

  const ResizeObserverRef = getResizeObserverRef();
  if (ResizeObserverRef) {
    try {
      observer = new ResizeObserverRef(schedule);
      observer.observe(root);
      labels.forEach((label) => {
        const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
        observer.observe(cell || label);
      });
    } catch (_) {
      observer = null;
    }
  }

  const documentRef = getDocumentRef();
  try {
    if (documentRef && documentRef.fonts && typeof documentRef.fonts.ready?.then === 'function') documentRef.fonts.ready.then(schedule).catch(() => {});
  } catch (_) {}
  schedule();

  root.__pressSiteSingleLabelWidthCleanup = () => {
    cancelFrame(frame);
    frame = 0;
    try { if (observer) observer.disconnect(); } catch (_) {}
    observer = null;
  };
}

export function composerPrefersReducedMotion() {
  try {
    if (!composerReduceMotionQuery) {
      const matchesMediaRef = composerUiMotionRuntime.matchesMediaRef;
      if (!matchesMediaRef) return false;
      composerReduceMotionQuery = matchesMediaRef('(prefers-reduced-motion: reduce)');
    }
    if (typeof composerReduceMotionQuery === 'boolean') return composerReduceMotionQuery;
    return !!composerReduceMotionQuery.matches;
  } catch (_) {
    return false;
  }
}

export function cancelComposerSiteScrollAnimation() {
  try {
    cancelFrame(composerSiteScrollAnimationId);
  } catch (_) {}
  composerSiteScrollAnimationId = null;
  if (typeof composerSiteScrollCleanup === 'function') {
    try { composerSiteScrollCleanup(); }
    catch (_) {}
  }
  composerSiteScrollCleanup = null;
}

export function createCubicBezierEasing(mX1, mY1, mX2, mY2) {
  const NEWTON_ITERATIONS = 8;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 1e-7;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const SPLINE_TABLE_SIZE = 11;
  const SAMPLE_STEP_SIZE = 1 / (SPLINE_TABLE_SIZE - 1);

  const sampleValues = new Float32Array(SPLINE_TABLE_SIZE);

  const calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + (3 * a1)) * t;
  const getSlope = (t, a1, a2) => (3 * (1 - 3 * a2 + 3 * a1) * t + 2 * (3 * a2 - 6 * a1)) * t + (3 * a1);

  for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
    sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, mX1, mX2);
  }

  const binarySubdivide = (x, lowerBound, upperBound) => {
    let currentX = 0;
    let currentT = 0;
    let i = 0;
    do {
      currentT = lowerBound + (upperBound - lowerBound) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0) {
        upperBound = currentT;
      } else {
        lowerBound = currentT;
      }
      i += 1;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  };

  const newtonRaphsonIterate = (x, guessT) => {
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = getSlope(guessT, mX1, mX2);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  };

  return (x) => {
    if (mX1 === mY1 && mX2 === mY2) return x;
    let currentSample = 0;
    const lastSample = SPLINE_TABLE_SIZE - 1;
    for (; currentSample !== lastSample && sampleValues[currentSample] <= x; currentSample += 1);
    currentSample -= 1;

    const segmentStart = sampleValues[currentSample];
    const segmentEnd = sampleValues[currentSample + 1];
    const segmentInterval = segmentEnd - segmentStart;
    const dist = segmentInterval > 0 ? (x - segmentStart) / segmentInterval : 0;
    const guessForT = currentSample * SAMPLE_STEP_SIZE + dist * SAMPLE_STEP_SIZE;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    const tCandidate = initialSlope >= NEWTON_MIN_SLOPE
      ? newtonRaphsonIterate(x, guessForT)
      : initialSlope === 0
        ? guessForT
        : binarySubdivide(x, currentSample * SAMPLE_STEP_SIZE, (currentSample + 1) * SAMPLE_STEP_SIZE);

    return calcBezier(tCandidate, mY1, mY2);
  };
}

const easeOutComposerScroll = (t) => Math.min(1, Math.max(0, t));

export function resolveComposerScrollDuration(duration) {
  const maxDuration = 1600;
  const minDuration = 120;
  const fallbackDuration = 720;
  const numeric = Number(duration);
  if (Number.isFinite(numeric)) return Math.min(maxDuration, Math.max(minDuration, numeric));
  return fallbackDuration;
}

export function animateComposerViewportScroll(targetY, duration, onComplete) {
  const windowRef = getWindowRef();
  const documentRef = getDocumentRef();
  if (!windowRef || !documentRef || typeof windowRef.scrollTo !== 'function') return false;
  if (!composerUiMotionRuntime.requestAnimationFrameRef) return false;

  const rootEl = documentRef.documentElement || null;
  const startY = windowRef.pageYOffset || (rootEl ? rootEl.scrollTop || 0 : 0);
  const distance = targetY - startY;
  if (Math.abs(distance) < 0.5) {
    try { windowRef.scrollTo(0, targetY); } catch (_) {}
    if (typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
    return true;
  }

  const resolvedDuration = resolveComposerScrollDuration(duration);

  const startTime = getNow();

  cancelComposerSiteScrollAnimation();

  let restoreScrollBehavior = null;
  if (rootEl && rootEl.style) {
    try {
      const previousBehavior = rootEl.style.scrollBehavior || '';
      const hadInlineBehavior = previousBehavior !== '';
      rootEl.style.scrollBehavior = 'auto';
      restoreScrollBehavior = () => {
        if (!rootEl || !rootEl.style) return;
        if (hadInlineBehavior) rootEl.style.scrollBehavior = previousBehavior;
        else rootEl.style.removeProperty('scroll-behavior');
      };
    } catch (_) {
      restoreScrollBehavior = null;
    }
  }

  if (typeof restoreScrollBehavior === 'function') {
    composerSiteScrollCleanup = () => {
      if (typeof restoreScrollBehavior === 'function') {
        try { restoreScrollBehavior(); }
        catch (_) {}
      }
      restoreScrollBehavior = null;
    };
  } else {
    composerSiteScrollCleanup = null;
  }

  const finalize = (shouldInvokeCallback) => {
    composerSiteScrollAnimationId = null;
    if (typeof composerSiteScrollCleanup === 'function') {
      try { composerSiteScrollCleanup(); }
      catch (_) {}
    }
    composerSiteScrollCleanup = null;
    if (shouldInvokeCallback && typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
  };

  const step = (timestamp) => {
    const now = typeof timestamp === 'number' ? timestamp : getNow();

    const progress = Math.min(1, (now - startTime) / resolvedDuration);
    const eased = easeOutComposerScroll(progress);
    const nextY = startY + (distance * eased);
    try { windowRef.scrollTo(0, nextY); } catch (_) {}

    if (progress < 1) {
      try {
        composerSiteScrollAnimationId = requestFrame(step);
        return;
      } catch (_) {}
    }

    finalize(true);
  };

  try {
    composerSiteScrollAnimationId = requestFrame(step);
    return true;
  } catch (_) {
    finalize(false);
    return false;
  }
}

export function parseCssDuration(value, fallback) {
  const defaultValue = typeof fallback === 'number' ? fallback : 0;
  if (value == null) return defaultValue;
  const trimmed = String(value).trim();
  if (!trimmed) return defaultValue;
  const unit = trimmed.endsWith('ms') ? 'ms' : (trimmed.endsWith('s') ? 's' : '');
  const numeric = parseFloat(trimmed);
  if (Number.isNaN(numeric)) return defaultValue;
  if (unit === 's') return numeric * 1000;
  return numeric;
}

function getComposerInlineAnimConfig() {
  const defaults = { durationIn: 480, durationOut: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
  const documentRef = getDocumentRef();
  if (!documentRef || !documentRef.documentElement) return defaults;
  try {
    const styles = getComputedStyleFor(documentRef.documentElement);
    if (!styles) return defaults;
    const durationIn = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-in'), defaults.durationIn);
    const durationOut = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-out'), defaults.durationOut);
    const easing = (styles.getPropertyValue('--composer-inline-ease') || '').trim() || defaults.easing;
    return { durationIn, durationOut, easing };
  } catch (_) {
    return defaults;
  }
}

function cancelInlineVisibilityAnimation(element) {
  if (!element) return;
  const active = composerInlineVisibilityAnimations.get(element);
  if (active && typeof active.cancel === 'function') {
    try { active.cancel(); } catch (_) {}
  }
  if (active) composerInlineVisibilityAnimations.delete(element);
  const fallback = composerInlineVisibilityFallbacks.get(element);
  if (fallback != null) {
    clearTimer(fallback);
    composerInlineVisibilityFallbacks.delete(element);
  }
  if (element.dataset && element.dataset.animState && !element.hidden) delete element.dataset.animState;
}

export function animateComposerInlineVisibility(element, show, options = {}) {
  if (!element) return;
  const reduceMotion = composerPrefersReducedMotion();
  const config = getComposerInlineAnimConfig();
  const duration = show ? config.durationIn : config.durationOut;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  const force = !!options.force;
  const onFinish = typeof options.onFinish === 'function' ? options.onFinish : null;
  const finish = () => { if (onFinish) { try { onFinish(); } catch (_) {} } };

  if (!force) {
    if (show && !element.hidden) {
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
    if (!show && element.hidden) {
      element.setAttribute('aria-hidden', 'true');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
  }

  cancelInlineVisibilityAnimation(element);

  if (immediate) {
    element.hidden = !show;
    element.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (element.dataset && element.dataset.animState) delete element.dataset.animState;
    finish();
    return;
  }

  const keyframesIn = [
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ];
  const keyframesOut = [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' }
  ];

  const runFallback = () => {
    if (show) {
      element.hidden = false;
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset) element.dataset.animState = 'enter';
    } else if (element.dataset) {
      element.dataset.animState = 'exit';
    }
    const timer = setTimer(() => {
      if (!show) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.setAttribute('aria-hidden', 'false');
      }
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      composerInlineVisibilityFallbacks.delete(element);
      finish();
    }, duration);
    composerInlineVisibilityFallbacks.set(element, timer);
  };

  if (typeof element.animate === 'function') {
    try {
      if (show) {
        element.hidden = false;
        element.setAttribute('aria-hidden', 'false');
        if (element.dataset) element.dataset.animState = 'enter';
        const animation = element.animate(keyframesIn, { duration, easing: config.easing, fill: 'both' });
        composerInlineVisibilityAnimations.set(element, animation);
        const finalize = () => {
          const active = composerInlineVisibilityAnimations.get(element);
          if (active !== animation) return;
          composerInlineVisibilityAnimations.delete(element);
          if (element.dataset && element.dataset.animState === 'enter') delete element.dataset.animState;
          finish();
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
      if (element.dataset) element.dataset.animState = 'exit';
      const animation = element.animate(keyframesOut, { duration, easing: config.easing, fill: 'both' });
      composerInlineVisibilityAnimations.set(element, animation);
      const finalize = () => {
        const active = composerInlineVisibilityAnimations.get(element);
        if (active !== animation) return;
        composerInlineVisibilityAnimations.delete(element);
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        if (element.dataset && element.dataset.animState === 'exit') delete element.dataset.animState;
        finish();
      };
      animation.finished.then(finalize).catch(finalize);
      animation.addEventListener('cancel', finalize, { once: true });
      return;
    } catch (_) {
      cancelInlineVisibilityAnimation(element);
    }
  }

  runFallback();
}

export function captureElementRect(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;
  try {
    const rect = element.getBoundingClientRect();
    return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
  } catch (_) {
    return null;
  }
}

export function cancelListTransition(list) {
  if (!list) return;
  const active = composerListTransitions.get(list);
  if (!active) return;
  composerListTransitions.delete(list);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimer(active.timer);
  if (active.restoreTransition != null) list.style.transition = active.restoreTransition;
  list.style.transform = 'none';
  list.style.filter = 'none';
  if (list.style.opacity && list.style.opacity !== '1') list.style.opacity = '';
  delete list.dataset.animating;
}

export function animateComposerListTransition(list, previousRect, options = {}) {
  if (!list || !previousRect || composerPrefersReducedMotion()) return;
  const immediate = !!options.immediate;
  const forceFallback = immediate || !!options.forceFallback;
  const onMeasured = typeof options.onMeasured === 'function' ? options.onMeasured : null;
  cancelListTransition(list);
  const run = () => {
    if (!list.isConnected) return;
    let nextRect = captureElementRect(list);
    if (!nextRect) return;
    if (onMeasured) {
      try {
        const override = onMeasured(nextRect);
        if (override && typeof override === 'object') nextRect = override;
      }
      catch (_) {}
    }
    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;
    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;
    const { durationIn, easing } = getComposerInlineAnimConfig();
    if (durationIn <= 0) return;
    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.96)', opacity: 0.98 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];
    list.dataset.animating = 'true';
    if (!forceFallback && typeof list.animate === 'function') {
      let animation = null;
      try {
        animation = list.animate(keyframes, { duration: durationIn, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerListTransitions.set(list, { animation });
        const finalize = () => {
          const active = composerListTransitions.get(list);
          if (!active || active.animation !== animation) return;
          composerListTransitions.delete(list);
          delete list.dataset.animating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }
    const previousTransition = list.style.transition;
    const transformsValue = transforms.join(' ');
    list.style.transition = 'none';
    list.style.transform = transformsValue;
    list.style.filter = 'brightness(0.96)';
    list.style.opacity = '0.98';
    requestFrame(() => {
      list.style.transition = `transform ${durationIn}ms ${easing}, filter ${durationIn}ms ${easing}, opacity ${durationIn}ms ${easing}`;
      list.style.transform = 'none';
      list.style.filter = 'none';
      list.style.opacity = '';
    });
    const timer = setTimer(() => {
      const active = composerListTransitions.get(list);
      if (!active || active.timer !== timer) return;
      list.style.transition = previousTransition;
      composerListTransitions.delete(list);
      delete list.dataset.animating;
    }, durationIn + 40);
    composerListTransitions.set(list, { timer, restoreTransition: previousTransition });
  };

  if (immediate) run();
  else requestFrame(run);
}

export function cancelComposerOrderMainTransition(main) {
  if (!main) return;
  const active = composerOrderMainTransitions.get(main);
  if (!active) return;
  composerOrderMainTransitions.delete(main);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimer(active.timer);
  if (active.restoreTransition != null) main.style.transition = active.restoreTransition;
  main.style.transform = 'none';
  main.style.filter = 'none';
  if (main.style.opacity && main.style.opacity !== '1') main.style.opacity = '';
  delete main.dataset.orderMainAnimating;
}

export function animateComposerOrderMainReset(host, previousRect, options = {}) {
  if (!host || !previousRect) return;
  const main = host.querySelector('.composer-order-main');
  if (!main || !main.isConnected) return;
  cancelComposerOrderMainTransition(main);

  const reduceMotion = composerPrefersReducedMotion();
  const { durationOut, easing } = getComposerInlineAnimConfig();
  const duration = typeof durationOut === 'number' ? durationOut : 0;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  if (immediate) return;

  const run = () => {
    if (!main.isConnected) return;
    const nextRect = captureElementRect(main);
    if (!nextRect) return;

    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;

    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;

    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.97)', opacity: 0.99 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];

    main.dataset.orderMainAnimating = 'true';

    if (typeof main.animate === 'function') {
      let animation = null;
      try {
        animation = main.animate(keyframes, { duration, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerOrderMainTransitions.set(main, { animation });
        const finalize = () => {
          const active = composerOrderMainTransitions.get(main);
          if (!active || active.animation !== animation) return;
          composerOrderMainTransitions.delete(main);
          delete main.dataset.orderMainAnimating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }

    const previousTransition = main.style.transition;
    const transformsValue = transforms.join(' ');
    main.style.transition = 'none';
    main.style.transform = transformsValue;
    main.style.filter = 'brightness(0.97)';
    main.style.opacity = '0.99';
    requestFrame(() => {
      if (!main.isConnected) return;
      main.style.transition = `transform ${duration}ms ${easing}, filter ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
      main.style.transform = 'none';
      main.style.filter = 'none';
      main.style.opacity = '';
    });
    const timer = setTimer(() => {
      const active = composerOrderMainTransitions.get(main);
      if (!active || active.timer !== timer) return;
      main.style.transition = previousTransition;
      composerOrderMainTransitions.delete(main);
      delete main.dataset.orderMainAnimating;
    }, duration + 40);
    composerOrderMainTransitions.set(main, { timer, restoreTransition: previousTransition });
  };

  requestFrame(run);
}

export function clearInlineSlideStyles(el) {
  el.style.overflow = '';
  el.style.height = '';
  el.style.opacity = '';
  el.style.paddingTop = '';
  el.style.paddingBottom = '';
}

function parsePx(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function getSlidePadding(el) {
  const cs = getComputedStyleFor(el) || {};
  return {
    top: parsePx(cs.paddingTop),
    bottom: parsePx(cs.paddingBottom)
  };
}

function forgetActiveSlideAnimation(el, anim) {
  const stored = activeSlideAnimations.get(el);
  if (stored && stored.anim === anim) activeSlideAnimations.delete(el);
}

function finalizeSlideAnimation(el, anim) {
  if (!anim) return;
  try { anim.onfinish = null; } catch (_) {}
  try { anim.oncancel = null; } catch (_) {}
  try { anim.commitStyles(); } catch (_) {}
  try { anim.cancel(); } catch (_) {}
  forgetActiveSlideAnimation(el, anim);
}

export function slideToggle(el, toOpen) {
  if (!el) return;
  const isReduced = matchesMediaQuery('(prefers-reduced-motion: reduce)');
  let computedDisplay = '';
  try {
    const computedStyle = getComputedStyleFor(el);
    computedDisplay = computedStyle ? computedStyle.display : el.style.display;
  } catch (_) {
    computedDisplay = el.style.display;
  }
  const running = activeSlideAnimations.get(el);
  const runningTarget = running && typeof running.target === 'boolean' ? running.target : null;
  const currentState = (runningTarget !== null)
    ? runningTarget
    : (el.dataset.open === '1' ? true : el.dataset.open === '0' ? false : (computedDisplay !== 'none'));
  const open = (typeof toOpen === 'boolean') ? toOpen : !currentState;

  if (runningTarget !== null) {
    if (open === runningTarget) return;
    try { running.anim?.cancel(); } catch (_) {}
    activeSlideAnimations.delete(el);
  } else if (open === currentState) {
    return;
  }

  if (isReduced) {
    el.style.display = open ? 'block' : 'none';
    el.dataset.open = open ? '1' : '0';
    clearInlineSlideStyles(el);
    return;
  }

  if (open) {
    el.dataset.open = '1';
    el.style.display = 'block';
    const pad = getSlidePadding(el);
    const totalEnd = el.scrollHeight;
    const contentTarget = Math.max(0, totalEnd - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.paddingTop = '0px';
      el.style.paddingBottom = '0px';
      el.style.height = '0px';
      el.style.opacity = '0';
      void el.offsetWidth;
      const anim = el.animate([
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
        { height: `${contentTarget}px`, opacity: 1, paddingTop: `${pad.top}px`, paddingBottom: `${pad.bottom}px` }
      ], { duration: SLIDE_OPEN_DUR, easing: 'ease', fill: 'forwards' });
      activeSlideAnimations.set(el, { target: true, anim });
      anim.onfinish = () => {
        finalizeSlideAnimation(el, anim);
        el.dataset.open = '1';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveSlideAnimation(el, anim);
      };
    } catch (_) {
      clearInlineSlideStyles(el);
      el.dataset.open = '1';
    }
  } else {
    el.dataset.open = '0';
    const pad = getSlidePadding(el);
    const totalStart = el.scrollHeight;
    const contentStart = Math.max(0, totalStart - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.display = 'block';
      el.style.paddingTop = `${pad.top}px`;
      el.style.paddingBottom = `${pad.bottom}px`;
      el.style.height = `${contentStart}px`;
      el.style.opacity = '1';
      void el.offsetHeight;
      const anim = el.animate([
        { height: `${contentStart}px`, opacity: 1, paddingTop: `${pad.top}px`, paddingBottom: `${pad.bottom}px` },
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }
      ], { duration: SLIDE_CLOSE_DUR, easing: 'ease', fill: 'forwards' });
      activeSlideAnimations.set(el, { target: false, anim });
      anim.onfinish = () => {
        finalizeSlideAnimation(el, anim);
        el.style.display = 'none';
        el.dataset.open = '0';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveSlideAnimation(el, anim);
      };
    } catch (_) {
      el.style.display = 'none';
      clearInlineSlideStyles(el);
      el.dataset.open = '0';
    }
  }
}

export function getComposerSlideDurations() {
  return { open: SLIDE_OPEN_DUR, close: SLIDE_CLOSE_DUR };
}
