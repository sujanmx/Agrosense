// ────────────────────────────────────────────────────────────────
// throttle.ts — frame-budget-aware throttle for AI inference
// ────────────────────────────────────────────────────────────────
//
// Why not lodash? Zero-dependency keeps the bundle slim for a
// hackathon. This implementation guarantees:
//   • Leading call fires immediately
//   • Trailing call fires after the cooldown
//   • At most 1 call per `intervalMs` window
//
// Usage:
//   const update = throttle((label, conf) => store.set(...), 500);
//   // AI loop @ 30fps calls update() → React re-renders ≤ 2/s

/**
 * Creates a throttled version of `fn` that fires at most once
 * every `intervalMs` milliseconds. Guarantees both leading and
 * trailing edge calls.
 */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number
): (...args: Args) => void {
  let lastCallTime = 0;
  let trailingTimeout: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Args | null = null;

  return (...args: Args) => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    latestArgs = args;

    if (elapsed >= intervalMs) {
      // ── Leading edge: fire immediately ───────────────────
      if (trailingTimeout) {
        clearTimeout(trailingTimeout);
        trailingTimeout = null;
      }
      lastCallTime = now;
      fn(...args);
    } else if (!trailingTimeout) {
      // ── Schedule trailing edge ───────────────────────────
      const remaining = intervalMs - elapsed;
      trailingTimeout = setTimeout(() => {
        lastCallTime = Date.now();
        trailingTimeout = null;
        if (latestArgs) fn(...latestArgs);
      }, remaining);
    }
    // If trailing is already scheduled, latestArgs is updated
    // so the trailing call uses the most recent arguments.
  };
}

/**
 * Convenience: creates a throttle that fires at most `maxPerSecond`
 * times per second.
 */
export function throttlePerSecond<Args extends unknown[]>(
  fn: (...args: Args) => void,
  maxPerSecond: number
): (...args: Args) => void {
  return throttle(fn, Math.floor(1000 / maxPerSecond));
}
