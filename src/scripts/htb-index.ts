/** Client-side search, filter, and pagination for HTBIndex */

export interface HTBIndexOptions {
  defaultPerPage?: number;
}

let teardown: (() => void) | undefined;

export function initHTBIndex(options: HTBIndexOptions = {}): (() => void) | void {
  const root = document.getElementById('htb-index-root');
  const list = document.getElementById('htb-list');
  if (!root || !list) return;

  const searchInput = document.getElementById('htb-search') as HTMLInputElement | null;
  const empty = document.getElementById('htb-empty');
  const pagination = document.getElementById('htb-pagination');
  const counter = document.getElementById('htb-counter');
  const perPageSelect = document.getElementById('htb-per-page') as HTMLSelectElement | null;
  const pageRange = document.getElementById('htb-page-range');
  const pageIndicator = document.getElementById('htb-page-indicator');
  const prevPage = document.getElementById('htb-prev-page') as HTMLButtonElement | null;
  const nextPage = document.getElementById('htb-next-page') as HTMLButtonElement | null;

  const items = [...list.querySelectorAll<HTMLElement>('.htb-item')];
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
  }

  searchInput?.addEventListener(
    'input',
    () => applyFilters(true),
    { signal }
  );

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
        list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
    { signal }
  );

  root.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        '#htb-category-filters [data-filter]'
      );
      if (!btn) return;

      activeCategory = btn.dataset.filter ?? 'all';
      root.querySelectorAll('#htb-category-filters [data-filter]').forEach((b) => {
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

export function bootHTBIndex(options: HTBIndexOptions = {}): void {
  teardown?.();
  teardown = initHTBIndex(options) ?? undefined;
}
