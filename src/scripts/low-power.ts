/** Detect weak GPUs and touch-first devices that jank on heavy scroll composites. */

function isSoftwareGpu(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl' as 'webgl');

    if (!gl) return true;

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (debug) {
      const renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string;
      // ANGLE is Chrome's normal GPU backend — only flag SwiftShader builds.
      if (/swiftshader|llvmpipe|software renderer|basic render|virgl|softpipe/i.test(renderer)) {
        return true;
      }
      if (/angle.*swiftshader/i.test(renderer)) return true;
    }

    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) return true;
  } catch {
    return true;
  }

  return false;
}

/** Phones/tablets: live backdrop filters + per-frame CSS vars flicker while scrolling. */
function isTouchConstrainedDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  try {
    const coarsePrimary = window.matchMedia('(pointer: coarse)').matches;
    const anyCoarse = window.matchMedia('(any-pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const touchPoints = navigator.maxTouchPoints || 0;
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const longSide = Math.max(window.innerWidth, window.innerHeight);
    const tabletSized = shortSide >= 600 && longSide <= 1366;

    if (coarsePrimary && noHover) return true;
    if (anyCoarse && noHover && touchPoints > 1) return true;
    // iPad / Android tablets (incl. some hover:hover + trackpad hybrids)
    if (anyCoarse && touchPoints > 1 && tabletSized) return true;
  } catch {
    return false;
  }

  return false;
}

export function isLowPowerDevice(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('low-power')) {
    return true;
  }

  if (typeof navigator === 'undefined') return false;

  const cores = navigator.hardwareConcurrency || 1;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (cores <= 1) return true;
  if (cores <= 2 && memory <= 2) return true;
  if (isTouchConstrainedDevice()) return true;
  if (isSoftwareGpu()) return true;

  return false;
}

export function prefersSmoothScroll(): boolean {
  return !isLowPowerDevice();
}
