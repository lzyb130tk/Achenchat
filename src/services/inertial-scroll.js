/**
 * Inertial, rubber-banded scrolling for an overflow container.
 *
 * Wheel/trackpad input is accumulated into a target position and the view
 * follows it with frame-rate independent damping, which gives the scroll a
 * little weight instead of moving 1:1 with the fingers. Pulling past either
 * edge stretches the content with resistance and springs back once the
 * gesture ends. Touch scrolling keeps the browser's native momentum; only the
 * edge pull is taken over so it can bounce the same way.
 *
 * The container keeps its native scrollTop (so anchors, sticky positions and
 * programmatic scrolls keep working). Overscroll is visual only: the content
 * child is translated while scrollTop stays clamped at the edge.
 */

const FRAME_MS = 1000 / 60;
const WHEEL_DAMPING = 0.14;
const EDGE_DAMPING = 0.17;
const WHEEL_MULTIPLIER = 1;
const PULL_LIMIT = 68;
const PULL_RESISTANCE = 0.34;
const WHEEL_IDLE_MS = 130;
const SNAP_EPSILON = 0.3;

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function createInertialScroll(scroller, options = {}) {
  const content = options.content || scroller?.firstElementChild;
  const wheelMultiplier = options.wheelMultiplier ?? WHEEL_MULTIPLIER;

  if (!scroller || !content || prefersReducedMotion()) {
    // Reduced motion keeps the browser's instant scrolling; callers can still
    // move the view (new messages, loading older history).
    return {
      scrollTo(position) {
        if (scroller) scroller.scrollTop = position;
      },
      scrollBy(delta) {
        if (scroller) scroller.scrollTop += delta;
      },
      sync() {},
      destroy() {},
    };
  }

  const maxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  let target = clamp(scroller.scrollTop, 0, maxScroll());
  let current = target;
  let pull = 0;
  let frame = 0;
  let lastFrame = 0;
  let idleTimer = 0;
  let destroyed = false;

  /**
   * Reflect an animated position into scrollTop, and move the content child
   * by whatever part of the position falls outside the scrollable range.
   * A positive scrollTop moves content up, so the visual offset is the
   * opposite of the overshoot.
   */
  const paint = (position) => {
    const max = maxScroll();
    if (target > max) target = max;
    if (target < 0) target = 0;
    const clamped = clamp(position, 0, max);
    if (Math.abs(scroller.scrollTop - clamped) > 0.5) {
      scroller.scrollTop = clamped;
    }
    const offset = clamped - position;
    if (Math.abs(offset) > 0.05) {
      content.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    } else if (content.style.transform) {
      content.style.transform = '';
    }
  };

  const animate = (time) => {
    frame = 0;
    if (destroyed) return;
    const dt = lastFrame ? Math.min(64, time - lastFrame) : FRAME_MS;
    lastFrame = time;
    const desired = target + pull;
    const damping = pull ? EDGE_DAMPING : WHEEL_DAMPING;
    const factor = 1 - Math.pow(1 - damping, dt / FRAME_MS);
    current += (desired - current) * factor;
    if (Math.abs(desired - current) < SNAP_EPSILON) current = desired;
    paint(current);
    if (current !== desired) {
      frame = requestAnimationFrame(animate);
    } else {
      lastFrame = 0;
    }
  };

  const start = () => {
    if (destroyed || frame) return;
    lastFrame = 0;
    frame = requestAnimationFrame(animate);
  };

  /** Fold a wheel delta into the target, converting travel past an edge
   *  into a resisted pull instead of more scroll. */
  const applyDelta = (delta) => {
    // A pull in the opposite direction absorbs the input first, so reversing
    // direction feels like unsticking the rubber band before scrolling away.
    if (pull < 0 && delta > 0) {
      const used = Math.min(-pull, delta);
      pull += used;
      delta -= used;
    } else if (pull > 0 && delta < 0) {
      const used = Math.min(pull, -delta);
      pull -= used;
      delta += used;
    }
    if (!delta) return;

    const max = maxScroll();
    const next = target + delta;
    if (next < 0) {
      const over = -next;
      target = 0;
      pull = -Math.min(
        PULL_LIMIT,
        -Math.min(pull, 0) + over * PULL_RESISTANCE,
      );
    } else if (next > max) {
      const over = next - max;
      target = max;
      pull = Math.min(
        PULL_LIMIT,
        Math.max(pull, 0) + over * PULL_RESISTANCE,
      );
    } else {
      target = next;
    }
  };

  const onWheel = (event) => {
    if (event.ctrlKey || event.metaKey) return;
    let delta = event.deltaY;
    if (!delta) return;
    if (Math.abs(event.deltaX) > Math.abs(delta)) return;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= scroller.clientHeight;
    delta *= wheelMultiplier;
    if (maxScroll() <= 0) return;

    event.preventDefault();
    applyDelta(delta);
    start();
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      idleTimer = 0;
      if (!pull) return;
      pull = 0;
      start();
    }, WHEEL_IDLE_MS);
  };

  /* Touch: native scrolling does the inertia; we only intercept a drag that
     starts at an edge, where the browser has nothing left to scroll. */
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEdge = 0;

  const stopInertia = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (idleTimer) {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
    }
    target = clamp(scroller.scrollTop, 0, maxScroll());
    current = target;
    pull = 0;
    paint(current);
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchEdge = 0;
    if (frame) stopInertia();
  };

  const onTouchMove = (event) => {
    if (event.touches.length !== 1) {
      touchEdge = 0;
      return;
    }
    const touch = event.touches[0];
    const dy = touch.clientY - touchStartY;
    const dx = touch.clientX - touchStartX;
    if (!touchEdge) {
      if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx)) return;
      const max = maxScroll();
      if (scroller.scrollTop <= 0 && dy > 0) touchEdge = -1;
      else if (scroller.scrollTop >= max - 2 && dy < 0) touchEdge = 1;
      else return;
    }
    const distance = touchEdge === -1 ? Math.max(0, dy) : Math.max(0, -dy);
    if (distance <= 0) {
      pull = 0;
      current = target;
      paint(current);
      return;
    }
    event.preventDefault();
    const resisted =
      PULL_LIMIT * (1 - Math.exp(-distance / (PULL_LIMIT * 1.4)));
    pull = touchEdge === -1 ? -resisted : resisted;
    current = target + pull;
    paint(current);
  };

  const onTouchEnd = () => {
    if (!touchEdge) return;
    touchEdge = 0;
    pull = 0;
    start();
  };

  /* Programmatic scrolls (new message, loading older history, focus jumps)
     still assign scrollTop directly. Adopt them so the next wheel gesture
     continues from where the app moved the view. */
  const onScroll = () => {
    const max = maxScroll();
    const expected = clamp(current, 0, max);
    if (Math.abs(scroller.scrollTop - expected) <= 1.5) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    target = clamp(scroller.scrollTop, 0, max);
    current = target;
    pull = 0;
    if (content.style.transform) content.style.transform = '';
  };

  const scrollTo = (position, { immediate = false } = {}) => {
    const next = clamp(position, 0, maxScroll());
    pull = 0;
    if (immediate) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      target = next;
      current = next;
      paint(current);
    } else {
      target = next;
      start();
    }
  };

  const scrollBy = (delta, opts = {}) => {
    scrollTo((opts.immediate ? current : target + pull) + delta, opts);
  };

  const sync = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    target = clamp(scroller.scrollTop, 0, maxScroll());
    current = target;
    pull = 0;
    paint(current);
  };

  let resizeObserver = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
      const max = maxScroll();
      if (target > max) {
        target = max;
        if (current > max || pull) start();
      }
    });
    resizeObserver.observe(scroller);
    resizeObserver.observe(content);
  }

  const destroy = () => {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = 0;
    resizeObserver?.disconnect();
    scroller.removeEventListener('wheel', onWheel);
    scroller.removeEventListener('touchstart', onTouchStart);
    scroller.removeEventListener('touchmove', onTouchMove);
    scroller.removeEventListener('touchend', onTouchEnd);
    scroller.removeEventListener('touchcancel', onTouchEnd);
    scroller.removeEventListener('scroll', onScroll);
    if (content.style.transform) content.style.transform = '';
  };

  scroller.addEventListener('wheel', onWheel, { passive: false });
  scroller.addEventListener('touchstart', onTouchStart, { passive: true });
  scroller.addEventListener('touchmove', onTouchMove, { passive: false });
  scroller.addEventListener('touchend', onTouchEnd);
  scroller.addEventListener('touchcancel', onTouchEnd);
  scroller.addEventListener('scroll', onScroll, { passive: true });

  return { scrollTo, scrollBy, sync, destroy };
}
