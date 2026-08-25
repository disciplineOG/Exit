(function () {
  const state = {
    curriculum: null,
    topicsFlat: [],
    topicIndex: {},
  };

  const sidebarEl = document.getElementById('sidebar');
  const sidebarScrim = document.getElementById('sidebar-scrim');
  const menuToggle = document.getElementById('menu-toggle');
  const contentEl = document.getElementById('content');
  const searchEl = document.getElementById('search');
  const cmdk = document.getElementById('cmdk');
  const cmdkInput = document.getElementById('cmdk-input');
  const cmdkResults = document.getElementById('cmdk-results');
  const themeToggle = document.getElementById('theme-toggle');

  function openSidebar() {
    sidebarEl.classList.add('open');
    sidebarScrim.classList.add('open');
  }
  function closeSidebar() {
    sidebarEl.classList.remove('open');
    sidebarScrim.classList.remove('open');
  }
  menuToggle.addEventListener('click', () => {
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sidebarScrim.addEventListener('click', closeSidebar);

  const trackClass = (track) => {
    const t = track.toLowerCase();
    if (t.includes('dsa')) return 'track-dsa';
    if (t.includes('spring')) return 'track-spring';
    if (t.includes('java')) return 'track-java';
    if (t.includes('security')) return 'track-security';
    if (t.includes('lld')) return 'track-lld';
    if (t.includes('bonus')) return 'track-bonus';
    if (t.includes('hld') || t.includes('microservices')) return 'track-hld';
    return 'track-dsa';
  };

  function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  async function loadCurriculum() {
    const res = await fetch('data/curriculum.json');
    const data = await res.json();
    state.curriculum = data;
    data.phases.forEach((phase) => {
      phase.dayRanges.forEach((dr) => {
        dr.topics.forEach((topic) => {
          const flat = { ...topic, phaseId: phase.id, phaseTitle: phase.title, range: dr.range };
          state.topicsFlat.push(flat);
          state.topicIndex[topic.id] = flat;
        });
      });
    });
    renderSidebar();
  }

  function renderSidebar() {
    sidebarEl.innerHTML = '';
    state.curriculum.phases.forEach((phase) => {
      const block = document.createElement('div');
      block.className = 'phase-block';

      const titleEl = document.createElement('div');
      titleEl.className = 'phase-title';
      titleEl.innerHTML = `<span>${phase.title}</span><span class="phase-days">${phase.days}</span>`;
      block.appendChild(titleEl);

      const body = document.createElement('div');
      body.className = 'phase-body';

      phase.dayRanges.forEach((dr) => {
        const rangeLabel = document.createElement('div');
        rangeLabel.className = 'day-range-label';
        rangeLabel.textContent = `Days ${dr.range}`;
        body.appendChild(rangeLabel);

        const rangeWrap = document.createElement('div');
        rangeWrap.className = 'day-range';

        dr.topics.forEach((topic) => {
          const link = document.createElement('div');
          link.className = 'topic-link';
          link.dataset.topicId = topic.id;
          link.innerHTML = `<span class="topic-dot ${trackClass(topic.track)}"></span><span>${topic.title}</span>`;
          link.addEventListener('click', () => {
            navigateTo(topic.id);
            closeSidebar();
          });
          rangeWrap.appendChild(link);
        });
        body.appendChild(rangeWrap);
      });

      block.appendChild(body);

      titleEl.addEventListener('click', () => {
        body.style.display = body.style.display === 'none' ? '' : 'none';
      });

      sidebarEl.appendChild(block);
    });
  }

  function slugify(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'section'
    );
  }

  function buildPageToc(articleEl) {
    const headers = Array.from(articleEl.querySelectorAll('h2, h3'));
    if (headers.length < 3) return null;

    const used = new Set();
    const items = headers.map((h) => {
      let id = slugify(h.textContent);
      let n = 2;
      while (used.has(id)) {
        id = `${slugify(h.textContent)}-${n++}`;
      }
      used.add(id);
      h.id = id;
      return { id, text: h.textContent, level: h.tagName.toLowerCase() };
    });

    const toc = document.createElement('details');
    toc.className = 'page-toc';
    toc.open = true;

    const summary = document.createElement('summary');
    summary.textContent = 'On this page';
    toc.appendChild(summary);

    const nav = document.createElement('nav');
    const ul = document.createElement('ul');
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = item.level === 'h3' ? 'toc-sub' : '';
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = item.text;
      a.dataset.tocTarget = item.id;
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    toc.appendChild(nav);

    toc.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-toc-target]');
      if (!link) return;
      e.preventDefault();
      const target = document.getElementById(link.dataset.tocTarget);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return toc;
  }

  function setActiveLink(topicId) {
    document.querySelectorAll('.topic-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.topicId === topicId);
    });
  }

  function findAdjacent(topicId) {
    const idx = state.topicsFlat.findIndex((t) => t.id === topicId);
    return {
      prev: idx > 0 ? state.topicsFlat[idx - 1] : null,
      next: idx < state.topicsFlat.length - 1 ? state.topicsFlat[idx + 1] : null,
    };
  }

  async function renderTopic(topicId) {
    const topic = state.topicIndex[topicId];
    if (!topic) {
      contentEl.innerHTML = `<div class="topic-page"><h1>Topic not found</h1><p>Nothing here yet for <code>${topicId}</code>.</p></div>`;
      return;
    }
    setActiveLink(topicId);
    contentEl.innerHTML = `<div class="topic-page"><p class="topic-breadcrumb">Loading…</p></div>`;

    let html;
    try {
      const res = await fetch(topic.file);
      if (!res.ok) throw new Error('missing');
      html = await res.text();
    } catch (e) {
      html = `<p class="topic-breadcrumb">${topic.phaseTitle} · Days ${topic.range} · ${topic.track}</p>
        <h1>${topic.title}</h1>
        <div class="callout warn"><div class="callout-title">Not written yet</div>
        This deep-dive page hasn't been generated yet. Check back soon.</div>`;
    }

    const { prev, next } = findAdjacent(topicId);
    const footer = `
      <div class="footer-nav">
        <div>${prev ? `<a href="#/${prev.id}">← ${prev.title}</a>` : ''}</div>
        <div>${next ? `<a href="#/${next.id}">${next.title} →</a>` : ''}</div>
      </div>`;

    contentEl.innerHTML = `<article class="topic-page">${html}${footer}</article>`;

    const articleEl = contentEl.querySelector('.topic-page');
    const toc = buildPageToc(articleEl);
    if (toc) {
      const tagsEl = articleEl.querySelector('.topic-tags');
      const anchor = tagsEl || articleEl.querySelector('h1');
      if (anchor) anchor.insertAdjacentElement('afterend', toc);
      else articleEl.insertBefore(toc, articleEl.firstChild);
    }

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function navigateTo(topicId) {
    window.location.hash = `/${topicId}`;
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#/', '').trim();
    if (!hash) {
      contentEl.innerHTML = document.getElementById('hero').outerHTML;
      setActiveLink(null);
      return;
    }
    renderTopic(hash);
  }

  window.addEventListener('hashchange', handleRoute);

  // Simple sidebar filter search
  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase().trim();
    document.querySelectorAll('.topic-link').forEach((el) => {
      const match = el.textContent.toLowerCase().includes(q);
      el.style.display = match ? '' : 'none';
    });
  });

  // Command palette (Cmd/Ctrl+K)
  function openCmdk() {
    cmdk.classList.remove('hidden');
    cmdkInput.value = '';
    cmdkInput.focus();
    renderCmdkResults('');
  }
  function closeCmdk() {
    cmdk.classList.add('hidden');
  }
  function renderCmdkResults(query) {
    const q = query.toLowerCase();
    const matches = state.topicsFlat
      .filter((t) => t.title.toLowerCase().includes(q) || t.track.toLowerCase().includes(q))
      .slice(0, 30);
    cmdkResults.innerHTML = matches
      .map(
        (t, i) => `<div class="cmdk-item ${i === 0 ? 'sel' : ''}" data-id="${t.id}">
          <span>${t.title}</span><span class="cmdk-sub">Days ${t.range}</span>
        </div>`
      )
      .join('');
    cmdkResults.querySelectorAll('.cmdk-item').forEach((el) => {
      el.addEventListener('click', () => {
        navigateTo(el.dataset.id);
        closeCmdk();
      });
    });
  }
  cmdkInput.addEventListener('input', () => renderCmdkResults(cmdkInput.value));
  cmdkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = cmdkResults.querySelector('.cmdk-item');
      if (first) {
        navigateTo(first.dataset.id);
        closeCmdk();
      }
    } else if (e.key === 'Escape') {
      closeCmdk();
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdk();
    }
  });
  cmdk.addEventListener('click', (e) => {
    if (e.target === cmdk) closeCmdk();
  });

  initTheme();
  loadCurriculum().then(handleRoute);
})();
