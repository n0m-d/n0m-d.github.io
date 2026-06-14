import type { Section9Scene } from './section9-core';

let aboutInstance: Section9Scene | null = null;
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

export async function bootAboutPage(): Promise<void> {
  const canvas = document.getElementById('section9-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  aboutInstance?.destroy();
  aboutInstance = null;
  await idle();
  const { Section9Scene: Scene } = await import('./section9-core');
  if (!document.getElementById('section9-canvas')) return;
  aboutInstance = new Scene(canvas);
}

declare global {
  interface Window {
    __aboutPageMounted?: boolean;
  }
}

export function mountAboutPage(): void {
  bindTabPause();
  void bootAboutPage();
  if (window.__aboutPageMounted) return;
  window.__aboutPageMounted = true;
  document.addEventListener('astro:page-load', () => void bootAboutPage());
}

mountAboutPage();
