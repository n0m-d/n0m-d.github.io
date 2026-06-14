/** Client-side filter + pagination for /tools/ */

export interface ToolsPageOptions {
  defaultPerPage?: number;
}

let teardown: (() => void) | undefined;

export function initToolsPage(options: ToolsPageOptions = {}): (() => void) | void {
  const root = document.getElementById('tools-root');
  const list = document.getElementById('repos-list');
  if (!root || !list) return;

  const repoSearch = document.getElementById('repo-search') as HTMLInputElement | null;
  const headerSearch = document.getElementById('header-search') as HTMLInputElement | null;
  const empty = document.getElementById('repo-empty');
  const pagination = document.getElementById('repos-pagination');
  const counter = document.getElementById('repo-counter');
  const langMenu = document.getElementById('lang-menu') as HTMLDetailsElement | null;
  const perPageSelect = document.getElementById('per-page') as HTMLSelectElement | null;
  const pageRange = document.getElementById('page-range');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPage = document.getElementById('prev-page') as HTMLButtonElement | null;
  const nextPage = document.getElementById('next-page') as HTMLButtonElement | null;

  const items = [...list.querySelectorAll<HTMLElement>('.repo-item')];
  if (items.length === 0) return;

  let activeTopicFilter = 'all';
  let activeLangFilter = 'all';
  let currentPage = 1;
  let perPage = Number(perPageSelect?.value ?? options.defaultPerPage ?? 5);

  const ac = new AbortController();
  const { signal } = ac;

  function getQuery(): string {
    return (repoSearch?.value || headerSearch?.value || '').trim().toLowerCase();
  }

  function syncSearchInputs(source: EventTarget | null | undefined): void {
    const input = source as HTMLInputElement | null;
    const q = input?.value ?? '';
    if (repoSearch && source !== repoSearch) repoSearch.value = q;
    if (headerSearch && source !== headerSearch) headerSearch.value = q;
  }

  function getFilteredItems(): HTMLElement[] {
    const q = getQuery();
    return items.filter((item) => {
      const topics = item.dataset.topics ?? '';
      const lang = item.dataset.lang ?? '';
      const haystack = item.dataset.search ?? '';
      const topicList = topics.split(/\s+/).filter(Boolean);
      const matchesTopic =
        activeTopicFilter === 'all' || topicList.includes(activeTopicFilter);
      const matchesLang = activeLangFilter === 'all' || lang === activeLangFilter;
      const matchesSearch = !q || haystack.includes(q);
      return matchesTopic && matchesLang && matchesSearch;
    });
  }

  function setLangMenuLabel(): void {
    const labelEl = document.getElementById('lang-menu-label');
    if (labelEl) {
      labelEl.textContent = activeLangFilter === 'all' ? 'Language' : activeLangFilter;
    }
    langMenu?.classList.toggle('has-filter', activeLangFilter !== 'all');
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
    if (list) list.hidden = !hasResults;
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

    setLangMenuLabel();
  }

  root.addEventListener(
    'input',
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === 'repo-search' || t.id === 'header-search') {
        syncSearchInputs(t);
        applyFilters(true);
      }
    },
    { signal }
  );

  perPageSelect?.addEventListener(
    'change',
    () => {
      perPage = Number(perPageSelect.value) || 5;
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
      const target = e.target as HTMLElement;

      const topicBtn = target.closest<HTMLButtonElement>(
        '#topic-filters .SelectMenu-button[data-filter]'
      );
      if (topicBtn) {
        activeTopicFilter = topicBtn.dataset.filter ?? 'all';
        root.querySelectorAll('#topic-filters .SelectMenu-button[data-filter]').forEach((b) => {
          b.classList.toggle('is-active', b === topicBtn);
        });
        applyFilters(true);
        return;
      }

      const langBtn = target.closest<HTMLButtonElement>('#lang-list .SelectMenu-item[data-lang]');
      if (langBtn) {
        e.preventDefault();
        activeLangFilter = langBtn.dataset.lang ?? 'all';
        root.querySelectorAll('#lang-list .SelectMenu-item[data-lang]').forEach((b) => {
          b.classList.toggle('is-selected', b === langBtn);
        });
        langMenu?.removeAttribute('open');
        applyFilters(true);
        return;
      }

      const topicTag = target.closest<HTMLElement>('.topic-tag[data-topic]');
      if (topicTag) {
        e.preventDefault();
        const topic = topicTag.dataset.topic;
        if (!topic) return;
        activeTopicFilter = topic;
        root.querySelectorAll('#topic-filters .SelectMenu-button[data-filter]').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.filter === topic);
        });
        applyFilters(true);
      }
    },
    { signal }
  );

  document.addEventListener(
    'click',
    (e) => {
      if (langMenu?.open && !langMenu.contains(e.target as Node)) {
        langMenu.removeAttribute('open');
      }
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (
        e.key === '/' &&
        document.activeElement !== headerSearch &&
        document.activeElement !== repoSearch
      ) {
        e.preventDefault();
        headerSearch?.focus();
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

export function bootToolsPage(options: ToolsPageOptions = {}): void {
  teardown?.();
  teardown = initToolsPage(options) ?? undefined;
}
