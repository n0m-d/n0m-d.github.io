/** Detect software rendering / very weak hardware (no usable GPU). */

export function isLowPowerDevice(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('low-power')) {
    return true;
  }

  if (typeof navigator === 'undefined') return false;

  const cores = navigator.hardwareConcurrency || 1;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (cores <= 1) return true;
  if (cores <= 2 && memory <= 2) return true;

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl' as 'webgl');

    if (!gl) return true;

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (debug) {
      const renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string;
      if (/swiftshader|llvmpipe|software|mesa|basic render|virgl|softpipe|angle/i.test(renderer)) {
        return true;
      }
    }

    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) return true;
  } catch {
    return true;
  }

  return false;
}

export function prefersSmoothScroll(): boolean {
  return !isLowPowerDevice();
}
