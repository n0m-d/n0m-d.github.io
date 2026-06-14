import type { VoidDimension } from './void-dimension-core';

let voidInstance: VoidDimension | null = null;
let tabPauseBound = false;

function bindTabPause(): void {
  if (tabPauseBound) return;
  tabPauseBound = true;
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('hidden-tab', document.hidden);
  });
}

function idle(maxMs = 600): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: maxMs });
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}

export async function bootVoidPage(): Promise<void> {
  const canvas = document.getElementById('void-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  voidInstance?.destroy();
  voidInstance = null;
  await idle();
  const { VoidDimension: Scene } = await import('./void-dimension-core');
  if (!document.getElementById('void-canvas')) return;
  voidInstance = new Scene(canvas);
}

declare global {
  interface Window {
    __voidPageMounted?: boolean;
  }
}

export function mountVoidPage(): void {
  bindTabPause();
  void bootVoidPage();
  if (window.__voidPageMounted) return;
  window.__voidPageMounted = true;
  document.addEventListener('astro:page-load', () => void bootVoidPage());
}

mountVoidPage();
