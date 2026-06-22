/** Client-side search, filter, and pagination for docs index components */

import { prefersSmoothScroll } from './low-power';

export interface DocsIndexOptions {
  defaultPerPage?: number;
}

const teardowns = new Map<string, () => void>();

export function initDocsIndex(
  rootId: string,
  options: DocsIndexOptions = {}
): (() => void) | void {
  const root = document.getElementById(rootId);
  if (!root) return;

  const list = root.querySelector<HTMLElement>('[data-index-list]');
  if (!list) return;

  const searchInput = root.querySelector<HTMLInputElement>('[data-index-search]');
  const empty = root.querySelector<HTMLElement>('[data-index-empty]');
  const pagination = root.querySelector<HTMLElement>('[data-index-pagination]');
  const counter = root.querySelector<HTMLElement>('[data-index-counter]');
  const perPageSelect = root.querySelector<HTMLSelectElement>('[data-index-per-page]');
  const pageRange = root.querySelector<HTMLElement>('[data-index-page-range]');
  const pageIndicator = root.querySelector<HTMLElement>('[data-index-page-indicator]');
  const prevPage = root.querySelector<HTMLButtonElement>('[data-index-prev-page]');
  const nextPage = root.querySelector<HTMLButtonElement>('[data-index-next-page]');

  const filters = root.querySelector<HTMLElement>('[data-index-filters]');

  const items = [...list.querySelectorAll<HTMLElement>('.index-item')];
  if (items.length === 0) return;

  let activeCategory = 'all';
  let currentPage = 1;
  let perPage = Number(perPageSelect?.value ?? options.defaultPerPage ?? 10);

  const ac = new AbortController();
  const { signal } = ac;

  function getQuery(): string {
    return (searchInput?.value ?? '').trim().toLowerCase();
  }

  function getFilteredItems(): HTMLElement[] {
    const q = getQuery();
    return items.filter((item) => {
      const category = item.dataset.category ?? '';
      const haystack = item.dataset.search ?? '';
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch = !q || haystack.includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  function applyFilters(resetPage = false): void {
    if (resetPage) currentPage = 1;

    const filtered = getFilteredItems();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const visibleSet = new Set(filtered.slice(start, end));

    const update = (): void => {
      items.forEach((item) => {
        const show = visibleSet.has(item);
        item.hidden = !show;
        item.classList.toggle('is-filtered-out', !show);
      });

      const hasResults = total > 0;
      list.hidden = !hasResults;
      if (empty) empty.hidden = hasResults;
      if (pagination) pagination.hidden = !hasResults;
      if (counter) counter.textContent = String(total);

      if (hasResults && pageRange && pageIndicator) {
        const from = start + 1;
        const to = Math.min(end, total);
        pageRange.textContent = `Showing ${from}–${to} of ${total}`;
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
      }

      if (prevPage) prevPage.disabled = currentPage <= 1;
      if (nextPage) nextPage.disabled = currentPage >= totalPages;
    };

    requestAnimationFrame(update);
  }

  searchInput?.addEventListener('input', () => applyFilters(true), { signal });

  perPageSelect?.addEventListener(
    'change',
    () => {
      perPage = Number(perPageSelect.value) || 10;
      applyFilters(true);
    },
    { signal }
  );

  prevPage?.addEventListener(
    'click',
    () => {
      if (currentPage > 1) {
        currentPage -= 1;
        applyFilters();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            list.scrollIntoView({
              behavior: prefersSmoothScroll() ? 'smooth' : 'auto',
              block: 'nearest',
            });
          });
        });
      }
    },
    { signal }
  );

  nextPage?.addEventListener(
    'click',
    () => {
      const totalPages = Math.ceil(getFilteredItems().length / perPage);
      if (currentPage < totalPages) {
        currentPage += 1;
        applyFilters();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            list.scrollIntoView({
              behavior: prefersSmoothScroll() ? 'smooth' : 'auto',
              block: 'nearest',
            });
          });
        });
      }
    },
    { signal }
  );

  root.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-filter]');
      if (!btn || !filters?.contains(btn)) return;

      activeCategory = btn.dataset.filter ?? 'all';
      filters.querySelectorAll('[data-filter]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      applyFilters(true);
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput?.focus();
      }
    },
    { signal }
  );

  applyFilters();

  return () => {
    ac.abort();
    items.forEach((item) => {
      item.hidden = false;
      item.classList.remove('is-filtered-out');
    });
  };
}

export function bootDocsIndex(rootId: string, options: DocsIndexOptions = {}): void {
  teardowns.get(rootId)?.();
  const teardown = initDocsIndex(rootId, options);
  if (teardown) teardowns.set(rootId, teardown);
}
