'use strict';

/*
 * 优耐特施 · 部门知识问答
 * 前端：原生 JavaScript，无构建步骤、无第三方依赖。
 */
(() => {
  /* ------------------------------------------------------------------ */
  /*  常量与全局状态                                                     */
  /* ------------------------------------------------------------------ */
  const app = document.getElementById('app');
  const toastRegion = document.getElementById('toast-region');
  const modalRoot = document.getElementById('modal-root');
  const topbar = document.getElementById('topbar');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const headerSearch = document.getElementById('header-search');
  const mobileSearch = document.getElementById('mobile-search');
  const footerYear = document.getElementById('footer-year');

  const DEFAULT_CATEGORIES = [
    { id: 'product', name: '产品技术', icon: 'cube', description: '选型、方案、技术资料' },
    { id: 'service', name: '售后服务', icon: 'wrench', description: '安装、调试、故障处理' },
    { id: 'production', name: '生产制造', icon: 'factory', description: '工艺、设备、现场管理' },
    { id: 'quality', name: '质量管理', icon: 'shield', description: '来料、过程、体系与改进' },
    { id: 'sales', name: '销售支持', icon: 'chart', description: '询价、投标、客户沟通' },
    { id: 'supply', name: '采购物流', icon: 'truck', description: '采购流程、交期、仓储' },
    { id: 'hr', name: '人事行政', icon: 'users', description: '入离职、报销、日常行政' },
    { id: 'it', name: 'IT 办公', icon: 'monitor', description: '账号、软件、办公设备' },
  ];
  const STATUS_VALUES = ['all', 'open', 'resolved'];
  const SORT_VALUES = ['active', 'newest', 'popular'];

  const state = {
    meta: null,
    metaAt: 0,
    isAdmin: false,
    adminCheckedAt: 0,
    adminItems: null,
    routeSeq: 0,
    currentRoute: null,
    modalOnClose: null,
    modalLastFocus: null,
  };

  /* ------------------------------------------------------------------ */
  /*  基础工具                                                           */
  /* ------------------------------------------------------------------ */
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return character;
      }
    });
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function icon(name, extraClass = '') {
    return `<svg class="icon${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0';
  }

  function padNumber(value) {
    return String(value).padStart(3, '0');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
  }

  function timeAgo(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diff = Date.now() - date.getTime();
    if (diff < 0) return '刚刚';
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
    return formatDate(value);
  }

  function avatarOf(name) {
    const text = String(name || '匿名同事').trim();
    const initial = Array.from(text)[0] || '?';
    let sum = 0;
    for (let index = 0; index < text.length; index += 1) sum += text.charCodeAt(index);
    return { initial: initial.toUpperCase(), color: `av-${sum % 6}` };
  }

  function avatarHTML(name, size = '') {
    const avatar = avatarOf(name);
    return `<span class="avatar${size ? ` ${size}` : ''} ${avatar.color}" aria-hidden="true">${escapeHtml(avatar.initial)}</span>`;
  }

  function highlight(value, query) {
    const text = String(value ?? '');
    const needle = String(query || '').trim();
    if (!needle) return escapeHtml(text);
    const safeNeedle = escapeHtml(needle);
    if (!safeNeedle) return escapeHtml(text);
    const pattern = new RegExp(`(${escapeRegExp(safeNeedle)})`, 'gi');
    return escapeHtml(text).replace(pattern, '<mark>$1</mark>');
  }

  function formatRichText(value) {
    const text = String(value || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return '';

    const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split('\n');

      const listKind = (() => {
        const bullets = lines.map((line) => line.match(/^\s*[-•]\s+(.*)$/));
        if (bullets.filter(Boolean).length >= 2) {
          return { type: 'ul', matches: bullets };
        }
        const numbered = lines.map((line) => line.match(/^\s*\d+[.、)]\s+(.*)$/));
        if (numbered.filter(Boolean).length >= 2) {
          return { type: 'ol', matches: numbered };
        }
        return null;
      })();

      if (!listKind) {
        return `<p>${lines.map((line) => escapeHtml(line)).join('<br>')}</p>`;
      }

      const firstItem = listKind.matches.findIndex(Boolean);
      const intro = lines.slice(0, firstItem).filter((line) => line.trim());
      const items = [];
      for (let index = firstItem; index < lines.length; index += 1) {
        const match = listKind.matches[index];
        if (match) {
          items.push(match[1]);
        } else if (items.length && lines[index].trim()) {
          items[items.length - 1] += `\n${lines[index]}`;
        }
      }

      const introHTML = intro.length
        ? `<p>${intro.map((line) => escapeHtml(line)).join('<br>')}</p>`
        : '';
      const itemsHTML = items
        .map((item) => `<li>${item.split('\n').map((line) => escapeHtml(line)).join('<br>')}</li>`)
        .join('');
      return `${introHTML}<${listKind.type}>${itemsHTML}</${listKind.type}>`;
    }).join('');
  }

  function categoryClass(category) {
    return `cat-${String(category || '').replace(/[^a-z0-9-]/gi, '')}`;
  }

  function categoryNameOf(question) {
    if (question.categoryName) return question.categoryName;
    const found = DEFAULT_CATEGORIES.find((category) => category.id === question.category);
    return found ? found.name : '未分类';
  }

  function statusBadge(status) {
    return status === 'resolved'
      ? `<span class="status-badge is-resolved">${icon('check', 'icon-sm')}已解决</span>`
      : `<span class="status-badge is-open">${icon('clock', 'icon-sm')}待解决</span>`;
  }

  function reviewBadge(status, label = '待审核') {
    return status === 'pending'
      ? `<span class="status-badge is-pending">${icon('clock', 'icon-sm')}${label}</span>`
      : '';
  }

  function tagsHTML(tags, query = '') {
    if (!Array.isArray(tags) || tags.length === 0) return '';
    return `<div class="tag-row">${tags.map((tag) => (
      `<a class="tag" href="${escapeHtml(browseLink({ q: tag }))}"><span class="hash">#</span>${highlight(tag, query)}</a>`
    )).join('')}</div>`;
  }

  function browseLink(overrides = {}) {
    const params = new URLSearchParams();
    const value = {
      q: '',
      category: '',
      status: 'all',
      sort: 'active',
      page: 1,
      ...overrides,
    };
    if (value.q) params.set('q', String(value.q).trim());
    if (value.category) params.set('category', value.category);
    if (value.status && value.status !== 'all') params.set('status', value.status);
    if (value.sort && value.sort !== 'active') params.set('sort', value.sort);
    if (Number(value.page) > 1) params.set('page', String(value.page));
    const query = params.toString();
    return query ? `#/browse?${query}` : '#/browse';
  }

  function questionURL(number) {
    return `#/q/${Number(number)}`;
  }

  /* ------------------------------------------------------------------ */
  /*  API                                                                */
  /* ------------------------------------------------------------------ */
  class ApiError extends Error {
    constructor(message, status = 0, code = '') {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, options = {}) {
    const { method = 'GET', body, timeout = 15000 } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const headers = { Accept: 'application/json' };
    const request = { method, headers, credentials: 'same-origin', signal: controller.signal };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(path, request);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new ApiError('请求超时，请稍后再试', 0, 'TIMEOUT');
      }
      throw new ApiError('无法连接知识库服务，请确认服务已启动', 0, 'NETWORK');
    } finally {
      clearTimeout(timer);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok !== true) {
      const message = payload && payload.error && payload.error.message
        ? payload.error.message
        : `请求失败（HTTP ${response.status}）`;
      const code = payload && payload.error ? payload.error.code : '';
      if (response.status === 401 && path.startsWith('/api/admin/')) {
        state.isAdmin = false;
        state.adminCheckedAt = Date.now();
      }
      throw new ApiError(message, response.status, code);
    }

    return payload.data;
  }

  async function getMeta({ fresh = false } = {}) {
    if (!fresh && state.meta && Date.now() - state.metaAt < 20000) return state.meta;
    const data = await api('/api/meta');
    state.meta = data;
    state.metaAt = Date.now();
    return data;
  }

  function invalidateMeta() {
    state.meta = null;
    state.metaAt = 0;
  }

  async function checkAdmin(force = false) {
    if (!force && state.adminCheckedAt && Date.now() - state.adminCheckedAt < 30000) {
      return state.isAdmin;
    }
    const data = await api('/api/admin/session');
    state.isAdmin = Boolean(data.authenticated);
    state.adminCheckedAt = Date.now();
    return state.isAdmin;
  }

  /* ------------------------------------------------------------------ */
  /*  Toast                                                              */
  /* ------------------------------------------------------------------ */
  function showToast(message, type = 'success') {
    if (!toastRegion) return;
    const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
    const toast = document.createElement('div');
    toast.className = `toast is-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><span>${escapeHtml(message)}</span>`;
    toastRegion.appendChild(toast);

    while (toastRegion.children.length > 3) {
      toastRegion.removeChild(toastRegion.firstElementChild);
    }

    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  /* ------------------------------------------------------------------ */
  /*  Modal                                                              */
  /* ------------------------------------------------------------------ */
  function openModal({ title, subtitle = '', body, footer = '', size = '', onClose = null }) {
    if (!modalRoot) return null;
    if (modalRoot.firstElementChild) closeModal();

    state.modalLastFocus = document.activeElement;
    state.modalOnClose = typeof onClose === 'function' ? onClose : null;

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal${size ? ` ${size}` : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head">
            <div>
              <h2 id="modal-title">${escapeHtml(title)}</h2>
              ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
            </div>
            <button class="icon-btn modal-close" type="button" data-close-modal aria-label="关闭">${icon('x')}</button>
          </div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>
    `;

    document.body.classList.add('modal-open');
    const modal = modalRoot.querySelector('.modal');
    if (modal) {
      const focusable = modal.querySelector('button, input, textarea, select, a[href]');
      requestAnimationFrame(() => {
        if (focusable && focusable.isConnected) focusable.focus();
      });
    }
    return modal;
  }

  function closeModal() {
    if (!modalRoot || !modalRoot.firstElementChild) {
      if (document.body) document.body.classList.remove('modal-open');
      return;
    }
    const callback = state.modalOnClose;
    state.modalOnClose = null;
    modalRoot.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (state.modalLastFocus && state.modalLastFocus.isConnected && typeof state.modalLastFocus.focus === 'function') {
      state.modalLastFocus.focus();
    }
    state.modalLastFocus = null;
    if (callback) callback();
  }

  function confirmDialog({ title, message, confirmText = '确认', cancelText = '取消', danger = true }) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        closeModal();
        resolve(value);
      };

      openModal({
        title,
        size: 'modal-sm',
        body: `
          <span class="confirm-icon">${icon(danger ? 'alert' : 'info')}</span>
          <p class="confirm-copy">${escapeHtml(message)}</p>
        `,
        footer: `
          <button class="btn btn-ghost btn-sm" type="button" data-confirm-cancel>${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" type="button" data-confirm-ok>${escapeHtml(confirmText)}</button>
        `,
        onClose: () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        },
      });

      const cancel = modalRoot.querySelector('[data-confirm-cancel]');
      const confirm = modalRoot.querySelector('[data-confirm-ok]');
      if (cancel) {
        cancel.addEventListener('click', () => {
          if (settled) return;
          settled = true;
          closeModal();
          resolve(false);
        });
      }
      if (confirm) {
        confirm.addEventListener('click', () => finish(true));
      }
      if (confirm) {
        requestAnimationFrame(() => confirm.focus());
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  表单工具                                                           */
  /* ------------------------------------------------------------------ */
  function setButtonLoading(button, loading, label = '处理中…') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-loading');
      button.innerHTML = `<span class="spinner"></span>${escapeHtml(label)}`;
    } else {
      button.disabled = false;
      button.classList.remove('is-loading');
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function showFormError(form, message) {
    const box = form.querySelector('[data-form-error]');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `${icon('alert')}<span>${escapeHtml(message)}</span>`;
  }

  function clearFormError(form) {
    const box = form.querySelector('[data-form-error]');
    if (!box) return;
    box.hidden = true;
    box.innerHTML = '';
  }

  function markInvalid(form, field, message) {
    if (!field) return;
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    const box = form.querySelector('[data-form-error]');
    if (box) {
      box.hidden = false;
      box.innerHTML = `${icon('alert')}<span>${escapeHtml(message)}</span>`;
    }
    field.focus();
  }

  function clearInvalid(form) {
    form.querySelectorAll('.is-invalid').forEach((field) => {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    });
  }

  function bindFormReset(form) {
    form.addEventListener('input', (event) => {
      const field = event.target;
      if (field && field.classList && field.classList.contains('is-invalid')) {
        field.classList.remove('is-invalid');
        field.removeAttribute('aria-invalid');
      }
      clearFormError(form);
    });
  }

  function bindCounters(scope = document) {
    scope.querySelectorAll('[data-count-for]').forEach((counter) => {
      const id = counter.getAttribute('data-count-for');
      const input = scope.querySelector(`#${id}`);
      if (!input) return;
      const max = Number(input.getAttribute('maxlength')) || 0;
      const update = () => {
        counter.textContent = max ? `${input.value.length} / ${max}` : String(input.value.length);
      };
      input.addEventListener('input', update);
      update();
    });
  }

  function getProfile() {
    try {
      const stored = JSON.parse(localStorage.getItem('qa_profile') || '{}');
      return {
        author: typeof stored.author === 'string' ? stored.author : '',
        department: typeof stored.department === 'string' ? stored.department : '',
      };
    } catch {
      return { author: '', department: '' };
    }
  }

  function saveProfile(author, department) {
    try {
      localStorage.setItem('qa_profile', JSON.stringify({
        author: String(author || '').slice(0, 30),
        department: String(department || '').slice(0, 40),
      }));
    } catch {
      /* 本地存储不可用时不影响提交 */
    }
  }

  function profileFieldsHTML(prefix) {
    const profile = getProfile();
    return `
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="${prefix}-author">姓名 / 昵称 <span class="label-hint">选填</span></label>
          <input class="form-input" id="${prefix}-author" name="author" type="text" maxlength="30"
                 value="${escapeHtml(profile.author)}" placeholder="匿名同事" autocomplete="name">
        </div>
        <div class="form-group">
          <label class="form-label" for="${prefix}-department">部门 <span class="label-hint">选填</span></label>
          <input class="form-input" id="${prefix}-department" name="department" type="text" maxlength="40"
                 value="${escapeHtml(profile.department)}" placeholder="例如：售后服务部" autocomplete="organization">
        </div>
      </div>
    `;
  }

  function readProfile(form) {
    return {
      author: String(form.elements.author ? form.elements.author.value : '').trim(),
      department: String(form.elements.department ? form.elements.department.value : '').trim(),
    };
  }

  function isAdminError(error) {
    return error instanceof ApiError && error.status === 401;
  }

  function handleAdminError(error) {
    if (isAdminError(error)) {
      showToast('登录已过期，请重新登录', 'error');
      renderRoute();
      return;
    }
    showToast(error && error.message ? error.message : '操作失败，请稍后再试', 'error');
  }

  /* ------------------------------------------------------------------ */
  /*  通用页面片段                                                       */
  /* ------------------------------------------------------------------ */
  function pageLoading(label = '正在整理知识库…') {
    return `
      <div class="container">
        <div class="page-loading" role="status" aria-live="polite">
          <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>
          <span>${escapeHtml(label)}</span>
        </div>
      </div>
    `;
  }

  function emptyStateHTML({ title, text, action = '', iconName = 'search' }) {
    return `
      <div class="panel empty-state">
        <span class="empty-icon">${icon(iconName)}</span>
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        ${action}
      </div>
    `;
  }

  function errorPageHTML(error) {
    const notFound = error instanceof ApiError && error.status === 404;
    const title = notFound ? '没有找到这个页面' : '页面暂时无法加载';
    const description = notFound
      ? '链接可能已经失效，或者对应的内容已被删除。可以回到问答库重新查找。'
      : (error && error.message ? error.message : '请稍后重试，或联系管理员检查服务状态。');
    return `
      <div class="container">
        <div class="panel error-state">
          <span class="empty-icon">${icon(notFound ? 'search' : 'alert')}</span>
          <h2>${title}</h2>
          <p>${escapeHtml(description)}</p>
          <div>
            <button class="btn btn-ghost" type="button" data-retry>${icon('refresh')}重新加载</button>
            <a class="btn btn-primary" href="#/">${icon('home')}回到首页</a>
          </div>
        </div>
      </div>
    `;
  }

  function questionCardHTML(question, query = '') {
    const resolvedClass = question.status === 'resolved' ? ' is-resolved' : '';
    return `
      <article class="question-card${resolvedClass}">
        <div class="qcard-badges">
          ${statusBadge(question.status)}
          ${question.isSample ? '<span class="sample-badge">示例</span>' : ''}
          <span class="q-number">Q-${padNumber(question.number)}</span>
        </div>
        <h3><a href="${questionURL(question.number)}">${highlight(question.title, query)}</a></h3>
        ${question.excerpt ? `<p class="q-excerpt">${highlight(question.excerpt, query)}</p>` : ''}
        ${tagsHTML(question.tags, query)}
        <div class="qcard-foot">
          <span class="author">
            ${avatarHTML(question.author)}
            <span class="author-copy">
              <strong>${escapeHtml(question.author || '匿名同事')}</strong>
              ${question.department ? `<span class="author-dept"> · ${escapeHtml(question.department)}</span>` : ''}
            </span>
          </span>
          <div class="qcard-meta">
            <span class="meta-answer" title="${question.answerCount || 0} 条回答">${icon('message')}${question.answerCount || 0} 回答</span>
            <span title="${formatNumber(question.views)} 次浏览">${icon('eye')}${formatNumber(question.views)}</span>
            <span title="${escapeHtml(formatDateTime(question.lastActivityAt))}">${icon('clock')}${timeAgo(question.lastActivityAt)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function asideHTML(meta) {
    const stats = (meta && meta.stats) || {};
    const hotTags = Array.isArray(stats.hotTags) ? stats.hotTags.slice(0, 9) : [];
    const contributors = Array.isArray(stats.topContributors) ? stats.topContributors : [];

    return `
      <aside class="home-aside">
        <div class="aside-stack">
          <section class="panel side-panel">
            <div class="side-panel-head">
              <h3>热门标签</h3>
              ${icon('tag')}
            </div>
            ${hotTags.length ? `
              <div class="hot-tags">
                ${hotTags.map((item) => (
                  `<a class="tag" href="${escapeHtml(browseLink({ q: item.tag }))}"><span class="hash">#</span>${escapeHtml(item.tag)}<span class="tag-count">${formatNumber(item.count)}</span></a>`
                )).join('')}
              </div>
            ` : '<p class="related-empty">还没有标签。发布第一条问题时，可以顺手加上几个关键词。</p>'}
          </section>

          <section class="panel side-panel">
            <div class="side-panel-head">
              <h3>活跃贡献同事</h3>
              ${icon('users')}
            </div>
            ${contributors.length ? `
              <div class="contributor-list">
                ${contributors.map((person) => `
                  <div class="contributor">
                    ${avatarHTML(person.name)}
                    <div class="contributor-copy">
                      <strong>${escapeHtml(person.name)}</strong>
                      <span>${escapeHtml(person.department || '部门未填写')}</span>
                    </div>
                    <span class="contributor-count">${formatNumber(person.count)} 次</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="related-empty">还没有贡献记录，期待你的第一条分享。</p>'}
          </section>

          <div class="aside-cta">
            <span class="cta-icon">${icon('sparkles')}</span>
            <h3>还有问题没被记录？</h3>
            <p>把它留在这里，下一次遇到的人就不用重新摸索。公开提问，无需登录。</p>
            <a class="btn btn-sm" href="#/ask">${icon('plus')}发起提问</a>
          </div>
        </div>
      </aside>
    `;
  }

  function paginationHTML(data, hrefFor) {
    if (!data || data.pages <= 1) return '';
    const current = Number(data.page) || 1;
    const pages = Number(data.pages) || 1;
    const numbers = new Set([1, pages, current - 1, current, current + 1]);
    if (pages <= 7) {
      for (let index = 1; index <= pages; index += 1) numbers.add(index);
    }
    const ordered = Array.from(numbers).filter((page) => page >= 1 && page <= pages).sort((a, b) => a - b);

    const parts = [];
    const prev = current > 1
      ? `<a class="page-btn" href="${hrefFor({ page: current - 1 })}" aria-label="上一页">${icon('chevron-left')}</a>`
      : `<span class="page-btn is-disabled" aria-hidden="true">${icon('chevron-left')}</span>`;
    parts.push(prev);

    let lastPage = 0;
    for (const page of ordered) {
      if (lastPage && page - lastPage > 1) parts.push('<span class="page-ellipsis">…</span>');
      if (page === current) {
        parts.push(`<span class="page-btn is-current" aria-current="page">${page}</span>`);
      } else {
        parts.push(`<a class="page-btn" href="${hrefFor({ page })}" aria-label="第 ${page} 页">${page}</a>`);
      }
      lastPage = page;
    }

    const next = current < pages
      ? `<a class="page-btn" href="${hrefFor({ page: current + 1 })}" aria-label="下一页">${icon('chevron-right')}</a>`
      : `<span class="page-btn is-disabled" aria-hidden="true">${icon('chevron-right')}</span>`;
    parts.push(next);

    return `<nav class="pagination" aria-label="问题列表分页">${parts.join('')}</nav>`;
  }

  /* ------------------------------------------------------------------ */
  /*  路由与页面切换                                                     */
  /* ------------------------------------------------------------------ */
  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#/, '') || '/';
    const queryIndex = raw.indexOf('?');
    let path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
    const queryString = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);
    if (!path) path = '/';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return { path, query: new URLSearchParams(queryString) };
  }

  function navigate(href) {
    if (!href) return;
    if (location.hash === href) {
      renderRoute();
      return;
    }
    location.hash = href.slice(1);
  }

  function updateChrome(route) {
    const path = route.path;
    const navKey = path === '/browse' || path.startsWith('/q/') ? 'browse'
      : path === '/' ? 'home'
        : path === '/about' ? 'about'
          : path === '/ask' ? 'ask' : '';

    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.getAttribute('data-nav') === navKey;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.querySelectorAll('[data-mobile-nav]').forEach((link) => {
      const active = link.getAttribute('data-mobile-nav') === navKey
        || (path === '/admin' && link.getAttribute('data-mobile-nav') === 'admin');
      link.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-ask-link]').forEach((link) => {
      link.classList.toggle('is-active', path === '/ask');
    });

    const searchValue = path === '/browse' ? (route.query.get('q') || '') : '';
    if (headerSearch) headerSearch.querySelector('input').value = searchValue;
    if (mobileSearch) mobileSearch.querySelector('input').value = searchValue;
    setMobileMenu(false);

    const titles = {
      '/': '优耐特施 · 部门知识问答',
      '/browse': '全部问题 · 部门知识问答',
      '/ask': '我要提问 · 部门知识问答',
      '/about': '使用说明 · 部门知识问答',
      '/admin': '管理后台 · 部门知识问答',
    };
    document.title = titles[path] || '部门知识问答';
  }

  async function renderRoute() {
    const sequence = ++state.routeSeq;
    closeModal();
    const route = parseRoute();
    state.currentRoute = route;
    updateChrome(route);
    window.scrollTo({ top: 0, behavior: 'auto' });
    app.innerHTML = pageLoading();

    try {
      if (route.path === '/') {
        await renderHome(sequence);
      } else if (route.path === '/browse') {
        await renderBrowse(route, sequence);
      } else if (route.path === '/ask') {
        await renderAsk(sequence);
      } else if (route.path === '/about') {
        renderAbout(sequence);
      } else if (route.path === '/admin') {
        await renderAdmin(sequence);
      } else {
        const match = route.path.match(/^\/q\/(\d+)$/);
        if (match) {
          await renderDetail(Number(match[1]), sequence);
        } else {
          throw new ApiError('没有找到这个页面', 404, 'NOT_FOUND');
        }
      }
    } catch (error) {
      if (sequence !== state.routeSeq) return;
      console.error(error);
      app.innerHTML = errorPageHTML(error);
      const retry = app.querySelector('[data-retry]');
      if (retry) retry.addEventListener('click', renderRoute);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  首页                                                               */
  /* ------------------------------------------------------------------ */
  async function renderHome(sequence) {
    const [meta, list] = await Promise.all([
      getMeta({ fresh: true }),
      api('/api/questions?pageSize=5&sort=active'),
    ]);
    if (sequence !== state.routeSeq) return;

    const stats = meta.stats || {};
    const categories = Array.isArray(meta.categories) ? meta.categories : DEFAULT_CATEGORIES;
    const hotTags = Array.isArray(stats.hotTags) ? stats.hotTags.slice(0, 4) : [];
    const totalQuestions = Number(stats.totalQuestions) || 0;
    const resolvedRate = Number(stats.resolvedRate) || 0;
    const sampleCount = Number(stats.sampleCount) || 0;
    const recent = Array.isArray(list.items) ? list.items : [];

    const categoriesHTML = categories.map((category) => `
      <a class="category-card ${categoryClass(category.id)}" href="${escapeHtml(browseLink({ category: category.id }))}">
        <span class="category-icon">${icon(category.icon || 'book')}</span>
        <span class="category-body">
          <strong>${escapeHtml(category.name)}</strong>
          <small>${escapeHtml(category.description || '')}</small>
        </span>
        <span class="category-count">${formatNumber(category.count)}<em>条</em></span>
      </a>
    `).join('');

    const recentHTML = recent.length
      ? `<div class="question-list">${recent.map((question) => questionCardHTML(question)).join('')}</div>`
      : emptyStateHTML({
        iconName: 'book',
        title: '知识库还没有内容',
        text: '发布第一个问题，或者把最近解决过的一个小问题记录下来。',
        action: '<a class="btn btn-primary" href="#/ask">发起第一个提问</a>',
      });

    app.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-eyebrow"><span class="status-dot"></span>优耐特施 · 内部知识共享</span>
          <h1>把每次解答，<br><span class="accent-line">变成团队的答案。</span></h1>
          <p>汇集产品、售后、生产、质量等场景里的通用问题与处理经验。提问、检索、复用——让好经验不再只停留在个人手里。</p>
          <form class="hero-search" data-search-form role="search">
            <span class="search-icon">${icon('search')}</span>
            <input type="search" name="q" placeholder="输入关键词，例如：高温报警、询价、来料检验" aria-label="搜索问题" autocomplete="off">
            <button type="submit">搜索</button>
          </form>
          <div class="hero-hot">
            <span>热门搜索</span>
            ${hotTags.length
              ? hotTags.map((item) => `<a href="${escapeHtml(browseLink({ q: item.tag }))}">${escapeHtml(item.tag)}</a>`).join('')
              : '<span>暂无标签</span>'}
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="hero-gauge">
            <div class="gauge-ring"></div>
            <div class="gauge-dashed"></div>
            <div class="gauge-center">
              <span>知识条目</span>
              <strong>${formatNumber(totalQuestions)}</strong>
              <small>已解决 ${resolvedRate}%</small>
            </div>
            <div class="float-card card-light">
              <span class="float-icon">${icon('check')}</span>
              <div>
                <span class="float-label">解决率</span>
                <strong>${resolvedRate}%</strong>
                <small>持续沉淀中</small>
              </div>
            </div>
            <div class="float-card card-glass">
              <span class="float-icon">${icon('message')}</span>
              <div>
                <span class="float-label">同事回答</span>
                <strong>${formatNumber(stats.totalAnswers)} 条</strong>
                <small>来自 ${formatNumber(stats.contributors)} 位同事</small>
              </div>
            </div>
          </div>
          <span class="hero-side-note">KNOWLEDGE · SHARED</span>
        </div>
      </section>

      <section class="stats-band" aria-label="知识库数据">
        <div class="stat">
          <span class="stat-icon">${icon('book')}</span>
          <div><strong>${formatNumber(stats.totalQuestions)}</strong><span>累计问题</span></div>
        </div>
        <div class="stat">
          <span class="stat-icon">${icon('message')}</span>
          <div><strong>${formatNumber(stats.totalAnswers)}</strong><span>同事回答</span></div>
        </div>
        <div class="stat">
          <span class="stat-icon">${icon('check-circle')}</span>
          <div><strong>${resolvedRate}%</strong><span>问题解决率</span></div>
        </div>
        <div class="stat">
          <span class="stat-icon">${icon('users')}</span>
          <div><strong>${formatNumber(stats.contributors)}</strong><span>贡献同事</span></div>
        </div>
      </section>

      ${sampleCount ? `
        <div class="sample-banner">
          ${icon('info')}
          <span>当前包含 <strong>${sampleCount}</strong> 条示例数据，仅用于体验和演示。管理员可在后台一键清除，换成部门的真实内容。</span>
          <a href="#/admin">进入后台</a>
        </div>
      ` : ''}

      <section class="section">
        <div class="section-head">
          <div>
            <span class="kicker">Browse by topic</span>
            <h2>按主题查找</h2>
            <p>先从熟悉的业务场景入手，再快速定位到具体问题。</p>
          </div>
          <a class="section-link" href="#/browse">浏览全部问题 ${icon('arrow-right')}</a>
        </div>
        <div class="category-grid">${categoriesHTML}</div>
      </section>

      <section class="section">
        <div class="home-layout">
          <div>
            <div class="home-main-head">
              <h3>最近更新</h3>
              <div class="mini-tabs">
                <a href="${escapeHtml(browseLink({ sort: 'active' }))}">最近活跃</a>
                <a href="${escapeHtml(browseLink({ sort: 'newest' }))}">最新提问</a>
              </div>
            </div>
            ${recentHTML}
            ${recent.length ? `
              <div class="home-more">
                <a class="text-link" href="#/browse">查看全部 ${formatNumber(stats.totalQuestions)} 个问题 ${icon('arrow-right')}</a>
              </div>
            ` : ''}
          </div>
          ${asideHTML(meta)}
        </div>
      </section>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  全部问题                                                           */
  /* ------------------------------------------------------------------ */
  async function renderBrowse(route, sequence) {
    const q = (route.query.get('q') || '').trim();
    const category = route.query.get('category') || '';
    const status = STATUS_VALUES.includes(route.query.get('status')) ? route.query.get('status') : 'all';
    const sort = SORT_VALUES.includes(route.query.get('sort')) ? route.query.get('sort') : 'active';
    const page = Math.max(1, Number.parseInt(route.query.get('page') || '1', 10) || 1);
    const filter = { q, category, status, sort, page };

    const params = new URLSearchParams({ pageSize: '8', page: String(page), status, sort });
    if (q) params.set('q', q);
    if (category) params.set('category', category);

    const [meta, data] = await Promise.all([
      getMeta(),
      api(`/api/questions?${params.toString()}`),
    ]);
    if (sequence !== state.routeSeq) return;

    filter.page = data.page;

    const categories = Array.isArray(meta.categories) ? meta.categories : DEFAULT_CATEGORIES;
    const stats = meta.stats || {};
    const hrefFor = (overrides = {}) => browseLink({ ...filter, ...overrides });
    const activeFilters = q || category || status !== 'all' || sort !== 'active';

    const categoryChips = categories.map((item) => `
      <a class="chip${item.id === category ? ' is-active' : ''}"
         href="${escapeHtml(hrefFor({ category: item.id === category ? '' : item.id, page: 1 }))}">
        ${escapeHtml(item.name)}
      </a>
    `).join('');

    const statusTabs = [
      { id: 'all', label: '全部', count: stats.totalQuestions },
      { id: 'open', label: '待解决', count: stats.open },
      { id: 'resolved', label: '已解决', count: stats.resolved },
    ].map((item) => `
      <a class="status-tab${status === item.id ? ' is-active' : ''}"
         href="${escapeHtml(hrefFor({ status: item.id, page: 1 }))}">
        ${item.label}<span class="tab-count">${formatNumber(item.count)}</span>
      </a>
    `).join('');

    const items = Array.isArray(data.items) ? data.items : [];
    const resultsHTML = items.length
      ? `<div class="question-list">${items.map((question) => questionCardHTML(question, q)).join('')}</div>`
      : emptyStateHTML({
        iconName: q ? 'search' : 'book',
        title: q ? '没有找到匹配的问题' : '这个筛选下还没有问题',
        text: q
          ? `没有找到与“${q}”相关的内容。可以换一个关键词，或直接发起提问。`
          : '换一个分类或状态看看，也可以把问题留在这里。',
        action: `
          <a class="btn btn-ghost" href="#/browse">清除筛选</a>
          <a class="btn btn-primary" href="#/ask">发起提问</a>
        `,
      });

    const filterDescription = [
      q ? `关键词“${q}”` : '',
      category ? (categories.find((item) => item.id === category) || {}).name : '',
      status === 'open' ? '待解决' : status === 'resolved' ? '已解决' : '',
    ].filter(Boolean).join(' · ');

    app.innerHTML = `
      <section class="page-head">
        <nav class="breadcrumb" aria-label="面包屑">
          <a href="#/">问答库</a><span class="sep">/</span><span class="current">全部问题</span>
        </nav>
        <div class="page-title-row">
          <div>
            <span class="kicker">Knowledge index</span>
            <h1>全部问题</h1>
            <p class="page-subtitle">用关键词或分类筛选历史问题。答案来自同事的真实处理经验，使用前请结合具体设备和现场条件判断。</p>
          </div>
          <div class="head-cta">
            <a class="btn btn-primary" href="#/ask">${icon('plus')}提个问题</a>
          </div>
        </div>
      </section>

      <div class="container">
        <div class="filter-panel">
          <form class="browse-search" id="browse-search-form" role="search">
            <div class="search-input-wrap">
              ${icon('search')}
              <input type="search" id="browse-q" name="q" value="${escapeHtml(q)}"
                     placeholder="搜索标题、描述、标签或回答内容…" aria-label="搜索问题" autocomplete="off">
            </div>
            <button class="btn btn-primary" type="submit">${icon('search')}搜索</button>
          </form>

          <div class="filter-section">
            <span class="filter-label">分类</span>
            <div class="category-chips">
              <a class="chip${!category ? ' is-active' : ''}" href="${escapeHtml(hrefFor({ category: '', page: 1 }))}">全部</a>
              ${categoryChips}
            </div>
          </div>

          <div class="filter-bottom">
            <div class="status-tabs" aria-label="按状态筛选">${statusTabs}</div>
            <div class="filter-controls">
              <div class="select-box">
                <select id="browse-sort" aria-label="排序方式">
                  <option value="active"${sort === 'active' ? ' selected' : ''}>最近活跃</option>
                  <option value="newest"${sort === 'newest' ? ' selected' : ''}>最新提问</option>
                  <option value="popular"${sort === 'popular' ? ' selected' : ''}>浏览最多</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="browse-layout">
        <div class="browse-main">
          <div class="results-top">
            <span>${filterDescription ? `筛选：${escapeHtml(filterDescription)} · ` : ''}共 <strong>${formatNumber(data.total)}</strong> 个问题</span>
            ${activeFilters ? `<a class="clear-filters" href="#/browse">${icon('x', 'icon-sm')}清除筛选</a>` : ''}
          </div>
          ${resultsHTML}
          ${paginationHTML(data, hrefFor)}
        </div>
        ${asideHTML(meta)}
      </div>
    `;

    const searchForm = document.getElementById('browse-search-form');
    const searchInput = document.getElementById('browse-q');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = searchInput ? searchInput.value.trim() : '';
        navigate(hrefFor({ q: value, page: 1 }));
      });
    }
    const sortSelect = document.getElementById('browse-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        navigate(hrefFor({ sort: sortSelect.value, page: 1 }));
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  问题详情                                                           */
  /* ------------------------------------------------------------------ */
  async function renderDetail(number, sequence) {
    const question = await api(`/api/questions/${number}`);
    if (sequence !== state.routeSeq) return;

    let isAdmin = false;
    try {
      isAdmin = await checkAdmin();
    } catch (error) {
      if (isAdminError(error)) {
        isAdmin = false;
      } else {
        throw error;
      }
    }
    if (sequence !== state.routeSeq) return;

    const profile = getProfile();
    const answerCount = Array.isArray(question.answers) ? question.answers.length : 0;
    const pendingAnswerCount = isAdmin ? Number(question.pendingAnswerCount) || 0 : 0;
    const answersHTML = answerCount
      ? question.answers.map((answer) => answerCardHTML(question, answer, isAdmin)).join('')
      : emptyStateHTML({
        iconName: 'message',
        title: '还没有人回答',
        text: '如果你处理过类似问题，欢迎在下面补充一条经验。',
      });

    const adminBarHTML = isAdmin ? `
      <div class="admin-bar">
        <span class="admin-bar-label">${icon('lock')}管理操作</span>
        ${question.reviewStatus === 'pending' ? `
          <button class="btn btn-primary" type="button" data-detail-action="approve">${icon('check')}通过审核</button>
          <button class="btn btn-ghost" type="button" data-detail-action="reject">${icon('x')}拒绝并删除</button>
        ` : ''}
        <button class="btn btn-ghost" type="button" data-detail-action="edit">${icon('edit')}编辑</button>
        <button class="btn btn-ghost" type="button" data-detail-action="toggle">
          ${question.status === 'resolved' ? `${icon('refresh')}重新打开` : `${icon('check')}标记已解决`}
        </button>
        <a class="btn btn-ghost" href="#/admin">${icon('book')}管理后台</a>
        <button class="btn btn-ghost" type="button" data-detail-action="delete">${icon('trash')}删除</button>
      </div>
    ` : '';

    app.innerHTML = `
      <div class="detail-wrap">
        <nav class="breadcrumb" aria-label="面包屑">
          <a href="#/">问答库</a><span class="sep">/</span>
          <a href="${escapeHtml(browseLink({ category: question.category }))}">${escapeHtml(categoryNameOf(question))}</a>
          <span class="sep">/</span>
          <span class="current">Q-${padNumber(question.number)}</span>
        </nav>

        <div class="detail-layout">
          <div class="detail-main">
            <article class="panel question-detail">
              <div class="detail-head">
                ${statusBadge(question.status)}
                ${reviewBadge(question.reviewStatus)}
                ${question.isSample ? '<span class="sample-badge">示例数据</span>' : ''}
                <span class="q-number">Q-${padNumber(question.number)}</span>
              </div>
              <h1>${escapeHtml(question.title)}</h1>
              <div class="detail-body rich-text">${formatRichText(question.body)}</div>
              ${tagsHTML(question.tags)}

              <div class="detail-foot">
                <div class="detail-author">
                  ${avatarHTML(question.author, 'avatar-lg')}
                  <div class="author-copy">
                    <strong>${escapeHtml(question.author || '匿名同事')}</strong>
                    <span>${escapeHtml(question.department || '部门未填写')} · 提问于 ${escapeHtml(formatDateTime(question.createdAt))}</span>
                  </div>
                </div>
                <div class="detail-meta">
                  <span>${icon('eye')}<span data-view-count>${formatNumber(question.views)}</span> 次浏览</span>
                  <span title="${escapeHtml(formatDateTime(question.lastActivityAt))}">${icon('clock')}${timeAgo(question.lastActivityAt)}</span>
                  <button class="icon-btn copy-btn" type="button" data-copy-link title="复制问题链接" aria-label="复制问题链接">${icon('link')}</button>
                </div>
              </div>

              ${adminBarHTML}
            </article>

            <section class="answers-section">
              <div class="answers-head">
                <h2>同事回答 <span>${answerCount} 条${pendingAnswerCount ? ` · ${pendingAnswerCount} 条待审` : ''}</span></h2>
                ${question.hasAccepted ? '<span class="status-badge is-resolved">' + icon('check') + '已采纳最佳回答</span>' : ''}
              </div>
              <div class="answer-list">
                ${answersHTML}
              </div>

              <div class="panel answer-form-panel">
                <h3>补充你的经验</h3>
                <p class="form-hint">不用登录。写清楚适用条件、操作步骤和注意事项，会更容易被同事理解和复用。</p>
                <form id="answer-form" novalidate>
                  <div class="form-group">
                    <label class="form-label" for="answer-body">回答内容 <span class="required">*</span></label>
                    <textarea class="form-textarea" id="answer-body" name="body" maxlength="3000" rows="6"
                              placeholder="例如：先确认设备已安全停机，然后按“环境 → 冷却 → 油路 → 传感”的顺序排查……" required></textarea>
                    <div class="form-hint">
                      <span>至少 2 个字符，最多 3000 字。</span>
                      <span class="char-count" data-count-for="answer-body">0 / 3000</span>
                    </div>
                  </div>
                  ${profileFieldsHTML('answer')}
                  <div class="form-alert" data-form-error hidden></div>
                  <div class="form-actions">
                    <span class="form-note">回答经管理员审核后展示给同事，请勿包含客户隐私或涉密信息。</span>
                    <button class="btn btn-primary" type="submit">${icon('message')}提交回答</button>
                  </div>
                </form>
              </div>
            </section>
          </div>

          <aside class="detail-aside">
            <section class="panel side-panel">
              <h3>问题信息</h3>
              <dl class="meta-list">
                <div><dt>编号</dt><dd>Q-${padNumber(question.number)}</dd></div>
                <div><dt>分类</dt><dd>${escapeHtml(categoryNameOf(question))}</dd></div>
                <div><dt>状态</dt><dd>${question.status === 'resolved' ? '已解决' : '待解决'}</dd></div>
                <div><dt>提问人</dt><dd>${escapeHtml(question.author || '匿名同事')}</dd></div>
                <div><dt>部门</dt><dd>${escapeHtml(question.department || '未填写')}</dd></div>
                <div><dt>提问时间</dt><dd>${escapeHtml(formatDate(question.createdAt))}</dd></div>
                <div><dt>最后活动</dt><dd>${escapeHtml(formatDate(question.lastActivityAt))}</dd></div>
                <div><dt>回答数量</dt><dd>${answerCount} 条</dd></div>
              </dl>
            </section>

            <section class="panel side-panel">
              <h3>同类问题</h3>
              <div class="related-list" id="related-list">
                <p class="related-empty">正在查找……</p>
              </div>
            </section>

            <div class="safety-note">
              ${icon('shield')}
              <span>以上内容来自同事经验分享，具体操作请以现行作业文件、设备手册和安全规范为准。涉及安全、电气或压力容器时，请先确认资质与停机条件。</span>
            </div>
          </aside>
        </div>
      </div>
    `;

    document.title = `${question.title} · 部门知识问答`;
    bindCounters(app);
    bindFormReset(document.getElementById('answer-form'));
    recordView(question.number);
    bindDetailActions(question, isAdmin);
    loadRelated(question, sequence);
  }

  function answerCardHTML(question, answer, isAdmin) {
    const pending = answer.reviewStatus === 'pending';
    return `
      <article class="answer-card${answer.accepted ? ' is-accepted' : ''}${pending ? ' is-pending' : ''}">
        <div class="answer-head">
          <div class="detail-author">
            ${avatarHTML(answer.author, 'avatar-lg')}
            <div class="author-copy">
              <strong>${escapeHtml(answer.author || '匿名同事')}</strong>
              <span>${escapeHtml(answer.department || '部门未填写')}</span>
            </div>
          </div>
          <div class="answer-badges">
            ${pending ? reviewBadge('pending') : ''}
            ${answer.accepted ? `<span class="accepted-badge">${icon('check')}最佳回答</span>` : ''}
            <span class="answer-time" title="${escapeHtml(formatDateTime(answer.createdAt))}">${timeAgo(answer.createdAt)}</span>
          </div>
        </div>
        <div class="answer-body rich-text">${formatRichText(answer.body)}</div>
        <div class="answer-foot">
          <span>回答于 ${escapeHtml(formatDateTime(answer.createdAt))}</span>
          ${isAdmin ? `
            <span class="answer-admin">
              ${pending ? `
                <button class="btn btn-primary" type="button" data-answer-action="approve" data-answer-id="${escapeHtml(answer.id)}">${icon('check')}通过</button>
                <button class="btn btn-ghost" type="button" data-answer-action="reject" data-answer-id="${escapeHtml(answer.id)}">${icon('x')}拒绝并删除</button>
              ` : `
                ${answer.accepted ? '' : `<button class="btn btn-ghost" type="button" data-answer-action="accept" data-answer-id="${escapeHtml(answer.id)}">${icon('check')}设为最佳</button>`}
                <button class="btn btn-ghost" type="button" data-answer-action="delete" data-answer-id="${escapeHtml(answer.id)}">${icon('trash')}删除回答</button>
              `}
            </span>
          ` : ''}
        </div>
      </article>
    `;
  }

  function bindDetailActions(question, isAdmin) {
    const copyButton = app.querySelector('[data-copy-link]');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const url = `${location.origin}${location.pathname}#/q/${question.number}`;
        try {
          await copyText(url);
          showToast('问题链接已复制');
        } catch {
          showToast('复制失败，请手动复制地址栏链接', 'error');
        }
      });
    }

    const form = document.getElementById('answer-form');
    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormError(form);
        clearInvalid(form);
        const textarea = document.getElementById('answer-body');
        const body = textarea ? textarea.value.trim() : '';
        if (body.length < 2) {
          markInvalid(form, textarea, '回答内容至少需要 2 个字符');
          return;
        }
        if (body.length > 3000) {
          markInvalid(form, textarea, '回答内容不能超过 3000 个字符');
          return;
        }
        const profile = readProfile(form);
        const button = form.querySelector('button[type="submit"]');
        setButtonLoading(button, true, '提交中…');
        try {
          const data = await api(`/api/questions/${question.number}/answers`, {
            method: 'POST',
            body: { body, author: profile.author, department: profile.department },
          });
          saveProfile(profile.author, profile.department);
          invalidateMeta();
          if (data && data.pending) {
            showToast('回答已提交，管理员审核通过后展示', 'info');
          } else {
            showToast('回答已提交，感谢分享');
          }
          renderRoute();
        } catch (error) {
          showFormError(form, error.message || '提交失败，请稍后再试');
          setButtonLoading(button, false);
        }
      });
    }

    if (!isAdmin) return;

    const adminBar = app.querySelector('.admin-bar');
    if (adminBar) {
      adminBar.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-detail-action]');
        if (!button) return;
        const action = button.getAttribute('data-detail-action');
        if (action === 'edit') {
          openEditModal(question.number);
        } else if (action === 'toggle') {
          await toggleQuestionStatus(question.number, question.status === 'resolved' ? 'open' : 'resolved');
        } else if (action === 'delete') {
          await deleteQuestion(question.number, { returnToBrowse: true });
        } else if (action === 'approve' || action === 'reject') {
          if (action === 'reject') {
            const ok = await confirmDialog({
              title: '拒绝这条问题？',
              message: '拒绝后会永久删除该问题及其回答，提交人不会收到单独通知。',
              confirmText: '拒绝并删除',
            });
            if (!ok) return;
          }
          try {
            await api(`/api/admin/questions/${question.number}/review`, {
              method: 'POST',
              body: { action },
            });
            invalidateMeta();
            showToast(action === 'approve' ? '问题已通过审核，现已公开' : '问题已拒绝并删除');
            if (action === 'approve') renderRoute();
            else navigate('#/admin');
          } catch (error) {
            handleAdminError(error);
          }
        }
      });
    }

    app.querySelectorAll('[data-answer-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.getAttribute('data-answer-action');
        const answerId = button.getAttribute('data-answer-id');
        if (action === 'approve' || action === 'reject') {
          if (action === 'reject') {
            const ok = await confirmDialog({
              title: '拒绝这条回答？',
              message: '拒绝后会永久删除这条回答，且无法恢复。',
              confirmText: '拒绝并删除',
            });
            if (!ok) return;
          }
          try {
            await api(`/api/admin/questions/${question.number}/answers/${answerId}/review`, {
              method: 'POST',
              body: { action },
            });
            invalidateMeta();
            showToast(action === 'approve' ? '回答已通过审核' : '回答已拒绝并删除');
            renderRoute();
          } catch (error) {
            handleAdminError(error);
          }
          return;
        }
        if (action === 'accept') {
          try {
            await api(`/api/admin/questions/${question.number}/answers/${answerId}/accept`, { method: 'POST' });
            invalidateMeta();
            showToast('已设为最佳回答');
            renderRoute();
          } catch (error) {
            handleAdminError(error);
          }
        } else if (action === 'delete') {
          const ok = await confirmDialog({
            title: '删除这条回答？',
            message: '删除后无法恢复。如果只是不再适用，也可以保留它作为背景信息。',
            confirmText: '删除回答',
          });
          if (!ok) return;
          try {
            await api(`/api/admin/questions/${question.number}/answers/${answerId}`, { method: 'DELETE' });
            invalidateMeta();
            showToast('回答已删除');
            renderRoute();
          } catch (error) {
            handleAdminError(error);
          }
        }
      });
    });
  }

  function recordView(number) {
    try {
      const key = `qa_view_${number}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (last && Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* 忽略存储异常，继续计数 */
    }
    api(`/api/questions/${number}/views`, { method: 'POST' }).then((data) => {
      const target = app.querySelector('[data-view-count]');
      if (target && data && data.views) target.textContent = formatNumber(data.views);
    }).catch(() => {
      /* 浏览量失败不影响阅读 */
    });
  }

  async function loadRelated(question, sequence) {
    try {
      const data = await api(`/api/questions?category=${encodeURIComponent(question.category)}&pageSize=5&sort=active`);
      if (sequence !== state.routeSeq) return;
      const container = document.getElementById('related-list');
      if (!container) return;
      const items = (data.items || []).filter((item) => Number(item.number) !== Number(question.number)).slice(0, 4);
      container.innerHTML = items.length
        ? items.map((item) => `
          <div class="related-item">
            <span class="related-dot"></span>
            <a href="${questionURL(item.number)}">${escapeHtml(item.title)}</a>
          </div>
        `).join('')
        : '<p class="related-empty">这个分类下暂时没有其他问题。</p>';
    } catch {
      const container = document.getElementById('related-list');
      if (container && sequence === state.routeSeq) {
        container.innerHTML = '<p class="related-empty">同类问题暂时无法加载。</p>';
      }
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy failed');
  }

  /* ------------------------------------------------------------------ */
  /*  提问                                                               */
  /* ------------------------------------------------------------------ */
  async function renderAsk(sequence) {
    const meta = await getMeta();
    if (sequence !== state.routeSeq) return;
    const categories = Array.isArray(meta.categories) ? meta.categories : DEFAULT_CATEGORIES;
    const profile = getProfile();

    app.innerHTML = `
      <section class="page-head">
        <nav class="breadcrumb" aria-label="面包屑">
          <a href="#/">问答库</a><span class="sep">/</span><span class="current">我要提问</span>
        </nav>
        <div class="page-title-row">
          <div>
            <span class="kicker">Ask the team</span>
            <h1>把问题说清楚，答案会更快出现。</h1>
            <p class="page-subtitle">不需要登录。描述越具体，越容易得到可执行的回答；如果已经查到答案，也欢迎直接补充到问答库。</p>
          </div>
        </div>
      </section>

      <div class="ask-layout">
        <div class="panel form-card">
          <div class="form-head">
            <h2>问题信息</h2>
            <p>带 <span class="required">*</span> 的项目为必填。提交后需管理员审核，通过后会公开在问答库中。</p>
          </div>

          <form id="ask-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="ask-title">问题标题 <span class="required">*</span></label>
              <input class="form-input" id="ask-title" name="title" type="text" maxlength="120"
                     placeholder="一句话说明问题，例如：设备高温报警时应该按什么顺序排查？" autocomplete="off">
              <div class="form-hint">
                <span>建议包含设备/场景 + 具体现象，4–120 字。</span>
                <span class="char-count" data-count-for="ask-title">0 / 120</span>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="ask-category">问题分类 <span class="required">*</span></label>
                <select class="form-select" id="ask-category" name="category">
                  <option value="">请选择分类</option>
                  ${categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="ask-tags">关键词标签 <span class="label-hint">最多 5 个</span></label>
                <input class="form-input" id="ask-tags" name="tags" type="text" maxlength="100"
                       placeholder="用逗号分隔，例如：高温报警, 故障排查" autocomplete="off">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="ask-body">问题描述 <span class="required">*</span></label>
              <textarea class="form-textarea" id="ask-body" name="body" maxlength="5000" rows="8"
                        placeholder="请补充：&#10;1. 设备型号 / 业务场景&#10;2. 已经尝试过什么、结果如何&#10;3. 希望得到哪方面的建议"></textarea>
              <div class="form-hint">
                <span>至少 8 个字符。请勿填写客户名称、联系方式等隐私信息。</span>
                <span class="char-count" data-count-for="ask-body">0 / 5000</span>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="ask-author">姓名 / 昵称 <span class="label-hint">选填</span></label>
                <input class="form-input" id="ask-author" name="author" type="text" maxlength="30"
                       value="${escapeHtml(profile.author)}" placeholder="匿名同事" autocomplete="name">
              </div>
              <div class="form-group">
                <label class="form-label" for="ask-department">部门 <span class="label-hint">选填</span></label>
                <input class="form-input" id="ask-department" name="department" type="text" maxlength="40"
                       value="${escapeHtml(profile.department)}" placeholder="例如：销售支持部" autocomplete="organization">
              </div>
            </div>

            <div class="form-alert" data-form-error hidden></div>

            <div class="form-actions">
              <span class="form-note">提交即表示同意内容经审核后展示在部门问答库中。</span>
              <a class="btn btn-ghost" href="#/browse">取消</a>
              <button class="btn btn-primary" type="submit">${icon('arrow-up-right')}提交问题</button>
            </div>
          </form>
        </div>

        <aside class="ask-aside">
          <section class="panel tips-panel">
            <h3>怎么问更容易得到答案？</h3>
            <p class="tips-sub">来自同事们的经验</p>
            <ol class="tip-list">
              <li>
                <strong>先搜一下，避免重复</strong>
                <p>用设备名、报警现象或业务动作搜索，可能已经有人整理过。<a href="#/browse">去搜索</a></p>
              </li>
              <li>
                <strong>把背景说完整</strong>
                <p>型号、工况、已尝试的方法、期望结果，比一句“怎么解决”更有用。</p>
              </li>
              <li>
                <strong>涉及安全时先停下</strong>
                <p>电气、压力容器、高处作业等问题，请先按现场安全流程处理，再补充提问。</p>
              </li>
            </ol>
          </section>

          <div class="mini-note">
            ${icon('shield')}
            <div>
              <strong>内容边界</strong>
              请勿上传涉密图纸、客户隐私、报价明细或未经授权的技术文件。拿不准时，先问部门负责人。
            </div>
          </div>
        </aside>
      </div>
    `;

    bindCounters(app);
    const form = document.getElementById('ask-form');
    bindFormReset(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormError(form);
      clearInvalid(form);

      const titleField = document.getElementById('ask-title');
      const categoryField = document.getElementById('ask-category');
      const tagsField = document.getElementById('ask-tags');
      const bodyField = document.getElementById('ask-body');
      const authorField = document.getElementById('ask-author');
      const departmentField = document.getElementById('ask-department');

      const title = titleField.value.trim();
      const body = bodyField.value.trim();
      if (title.length < 4) return markInvalid(form, titleField, '标题至少需要 4 个字符');
      if (title.length > 120) return markInvalid(form, titleField, '标题不能超过 120 个字符');
      if (!categoryField.value) return markInvalid(form, categoryField, '请选择一个问题分类');
      if (body.length < 8) return markInvalid(form, bodyField, '问题描述至少需要 8 个字符');
      if (body.length > 5000) return markInvalid(form, bodyField, '问题描述不能超过 5000 个字符');

      const tags = tagsField.value.trim();
      if (tags) {
        const tagList = tags.split(/[,，、;；\s]+/).filter(Boolean);
        if (tagList.length > 5) return markInvalid(form, tagsField, '最多填写 5 个标签');
        if (tagList.some((tag) => tag.replace(/^#+/, '').length > 16)) {
          return markInvalid(form, tagsField, '单个标签不能超过 16 个字符');
        }
      }

      const button = form.querySelector('button[type="submit"]');
      setButtonLoading(button, true, '提交中…');
      try {
        const data = await api('/api/questions', {
          method: 'POST',
          body: {
            title,
            body,
            category: categoryField.value,
            tags,
            author: authorField.value.trim(),
            department: departmentField.value.trim(),
          },
        });
        saveProfile(authorField.value.trim(), departmentField.value.trim());
        invalidateMeta();
        if (data && data.pending) {
          const card = form.closest('.form-card');
          if (card) {
            card.innerHTML = `
              <div class="submit-success">
                <span class="submit-success-icon">${icon('clock')}</span>
                <span class="kicker">Submitted for review</span>
                <h2>问题已提交，等待审核</h2>
                <p>管理员审核通过后，问题会出现在问答库中。你的提问编号是 <strong>Q-${padNumber(data.number)}</strong>。</p>
                <p class="submit-success-note">审核通常由部门管理员在工作日处理。请勿重复提交相同问题。</p>
                <div class="submit-success-actions">
                  <a class="btn btn-primary" href="#/">${icon('home')}返回首页</a>
                  <a class="btn btn-ghost" href="#/browse">浏览已有问题</a>
                </div>
              </div>
            `;
          }
          showToast('问题已提交，等待管理员审核', 'info');
          app.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          showToast('问题已提交，已为你打开详情');
          navigate(questionURL(data.number));
        }
      } catch (error) {
        showFormError(form, error.message || '提交失败，请稍后再试');
        setButtonLoading(button, false);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  使用说明                                                           */
  /* ------------------------------------------------------------------ */
  function renderAbout(sequence) {
    if (sequence !== state.routeSeq) return;
    app.innerHTML = `
      <section class="page-head">
        <nav class="breadcrumb" aria-label="面包屑">
          <a href="#/">问答库</a><span class="sep">/</span><span class="current">使用说明</span>
        </nav>
        <div class="page-title-row">
          <div>
            <span class="kicker">About this space</span>
            <h1>让经验留下，让查找变简单。</h1>
            <p class="page-subtitle">这里是部门的知识问答空间，面向同事和业务伙伴开放，用来记录日常工作中反复出现、值得复用的问题和处理方法。</p>
          </div>
        </div>
      </section>

      <div class="about-layout">
        <section class="about-intro">
          <span class="kicker">为什么做这个问答库</span>
          <h2>很多答案其实已经存在，只是散落在聊天记录、邮件和个人的记忆里。</h2>
          <p>我们把通用性强、会反复遇到的问题集中在这里：新人可以自己查，业务同事能快速确认，处理过的人也不用一遍遍重复解释。内容不求大而全，但求准确、可执行、能被人找到。</p>
        </section>

        <div class="about-steps">
          <section class="about-step">
            <span class="step-number">01</span>
            <h3>先搜索，再提问</h3>
            <p>用设备名、报警现象、业务动作等关键词搜索。找不到时，再把背景和已尝试的方法写进提问。</p>
          </section>
          <section class="about-step">
            <span class="step-number">02</span>
            <h3>把经验写下来</h3>
            <p>处理完一个问题后，顺手补充一条回答。写清适用条件、步骤和注意事项，比只给结论更有价值。</p>
          </section>
          <section class="about-step">
            <span class="step-number">03</span>
            <h3>标记与维护</h3>
            <p>管理员会整理分类和标签、采纳最佳回答，并清除不再适用的内容，保持知识库可信。</p>
          </section>
        </div>

        <div class="about-grid">
          <section class="about-card">
            <h3>${icon('book')}内容范围</h3>
            <ul>
              <li><strong>产品技术：</strong>选型、方案、参数解释、技术资料查找</li>
              <li><strong>售后服务：</strong>安装调试、报警处理、备件与维保</li>
              <li><strong>生产与质量：</strong>工艺、设备、来料、过程与体系问题</li>
              <li><strong>销售、采购、人事、IT：</strong>跨部门协作中的通用流程问题</li>
            </ul>
          </section>
          <section class="about-card">
            <h3>${icon('shield')}提问与回答规范</h3>
            <ul>
              <li><strong>具体：</strong>带上型号、场景、现象和已尝试的方法</li>
              <li><strong>可执行：</strong>给出步骤、判断依据和注意事项</li>
              <li><strong>不涉密：</strong>不上传客户隐私、报价明细、图纸或未授权文件</li>
              <li><strong>守边界：</strong>安全、电气、压力容器等操作以现行规范为准</li>
            </ul>
          </section>
        </div>

        <div class="about-admin-card">
          <span class="icon-wrap">${icon('lock')}</span>
          <div>
            <h3>管理员维护入口</h3>
            <p>审核公开投稿、编辑或删除问题、标记解决状态、采纳最佳回答、导出数据和清理示例内容。</p>
          </div>
          <a class="btn btn-light btn-sm" href="#/admin">${icon('lock')}进入后台</a>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  管理后台                                                           */
  /* ------------------------------------------------------------------ */
  async function renderAdmin(sequence) {
    let isAdmin = false;
    try {
      isAdmin = await checkAdmin();
    } catch (error) {
      if (isAdminError(error)) isAdmin = false;
      else throw error;
    }
    if (sequence !== state.routeSeq) return;
    if (!isAdmin) {
      renderAdminLogin();
      return;
    }

    let data;
    let meta = null;
    let pendingData = { questions: [], answers: [], counts: { questions: 0, answers: 0 } };
    try {
      [data, meta, pendingData] = await Promise.all([
        api('/api/admin/questions'),
        getMeta().catch(() => null),
        api('/api/admin/pending'),
      ]);
    } catch (error) {
      if (isAdminError(error)) {
        state.isAdmin = false;
        showToast('登录已过期，请重新登录', 'error');
        renderAdminLogin();
        return;
      }
      throw error;
    }
    if (sequence !== state.routeSeq) return;

    state.adminItems = Array.isArray(data.items) ? data.items : [];
    const categories = meta && Array.isArray(meta.categories) ? meta.categories : DEFAULT_CATEGORIES;
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const items = state.adminItems;
    const pendingCounts = (pendingData && pendingData.counts) || { questions: 0, answers: 0 };
    const pendingTotal = Number(pendingCounts.questions || 0) + Number(pendingCounts.answers || 0);
    const stats = {
      total: items.length,
      open: items.filter((item) => item.status !== 'resolved').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
      answers: items.reduce((sum, item) => sum + (Number(item.answerCount) || 0), 0),
      sample: items.filter((item) => item.isSample).length,
      pendingQuestions: Number(pendingCounts.questions || 0),
      pendingAnswers: Number(pendingCounts.answers || 0),
      pendingTotal,
    };

    app.innerHTML = `
      <div class="admin-wrap">
        <nav class="breadcrumb" aria-label="面包屑">
          <a href="#/">问答库</a><span class="sep">/</span><span class="current">管理后台</span>
        </nav>

        <div class="admin-head">
          <div>
            <span class="kicker">Admin console</span>
            <h1>知识库管理</h1>
            <p>共 ${formatNumber(stats.total)} 个问题${stats.pendingTotal ? `，其中 ${stats.pendingTotal} 条内容待审核` : ''}${stats.sample ? `；${stats.sample} 条示例数据` : ''}。修改会立即生效。</p>
          </div>
          <div class="admin-head-actions">
            <a class="btn btn-ghost btn-sm" href="#/">${icon('home')}返回站点</a>
            <button class="btn btn-ghost btn-sm" type="button" data-admin-tool="refresh">${icon('refresh')}刷新</button>
            <button class="btn btn-ghost btn-sm" type="button" data-admin-tool="logout">${icon('logout')}退出</button>
          </div>
        </div>

        <div class="admin-stats">
          <div class="admin-stat"><span>全部问题</span><strong>${formatNumber(stats.total)}</strong></div>
          <div class="admin-stat"><span>待解决</span><strong>${formatNumber(stats.open)}</strong></div>
          <div class="admin-stat"><span>已解决</span><strong>${formatNumber(stats.resolved)}</strong></div>
          <div class="admin-stat"><span>回答总数</span><strong>${formatNumber(stats.answers)}</strong></div>
          <div class="admin-stat admin-stat-review"><span>待审核</span><strong>${formatNumber(stats.pendingTotal)}</strong></div>
        </div>

        <section class="review-banner${stats.pendingTotal ? ' has-items' : ''}">
          <span class="review-banner-icon">${icon(stats.pendingTotal ? 'clock' : 'check-circle')}</span>
          <div class="review-banner-copy">
            <strong>${stats.pendingTotal ? '有内容等待审核' : '审核队列已清空'}</strong>
            <p>${stats.pendingTotal
              ? `${stats.pendingQuestions} 个问题、${stats.pendingAnswers} 条回答待处理。通过后立即公开，拒绝会删除。`
              : '公开提交的问题和回答会先进入这里，审核通过后才会展示。'}</p>
          </div>
          <button class="btn ${stats.pendingTotal ? 'btn-primary' : 'btn-ghost'}" type="button" data-review-open>
            ${icon('book')}${stats.pendingTotal ? '进入审核队列' : '查看审核队列'}
          </button>
        </section>

        <section class="panel admin-panel">
          <div class="admin-toolbar">
            <div class="search-input-wrap">
              ${icon('search')}
              <input type="search" id="admin-search" placeholder="搜索标题、作者、标签…" aria-label="搜索管理列表" autocomplete="off">
            </div>
            <div class="select-box">
              <select id="admin-status-filter" aria-label="按状态筛选">
                <option value="all">全部状态</option>
                <option value="pending">待审核</option>
                <option value="open">待解决</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
            <div class="select-box">
              <select id="admin-category-filter" aria-label="按分类筛选">
                <option value="all">全部分类</option>
                ${categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('')}
              </select>
            </div>
            <span class="spacer"></span>
            <a class="btn btn-primary" href="#/ask">${icon('plus')}新建问题</a>
            <button class="btn btn-ghost" type="button" data-admin-tool="export" data-format="json">${icon('download')}JSON</button>
            <button class="btn btn-ghost" type="button" data-admin-tool="export" data-format="csv">${icon('download')}CSV</button>
            ${stats.sample ? `<button class="btn btn-ghost" type="button" data-admin-tool="clear-samples">${icon('trash')}清除示例</button>` : ''}
          </div>

          <div id="admin-table-body"></div>
          <p class="admin-note">提示：公开提交的内容需审核通过后展示；拒绝会永久删除。导出文件包含问题描述与所有回答，适合定期备份或迁移。</p>
        </section>
      </div>
    `;

    const tableBody = document.getElementById('admin-table-body');
    const searchInput = document.getElementById('admin-search');
    const statusFilter = document.getElementById('admin-status-filter');
    const categoryFilter = document.getElementById('admin-category-filter');

    const renderRows = () => {
      if (!tableBody) return;
      const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();
      const selectedStatus = statusFilter ? statusFilter.value : 'all';
      const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
      const filtered = items.filter((item) => {
        if (selectedStatus === 'pending' && item.reviewStatus !== 'pending') return false;
        if (selectedStatus !== 'all' && selectedStatus !== 'pending' && item.status !== selectedStatus) return false;
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (!keyword) return true;
        return [
          `Q-${padNumber(item.number)}`,
          item.title,
          item.author,
          item.department,
          item.categoryName,
          ...(item.tags || []),
        ].join(' ').toLowerCase().includes(keyword);
      });

      if (!filtered.length) {
        tableBody.innerHTML = `
          <div class="admin-empty">
            ${icon('search')}
            <div>${items.length ? '没有符合筛选条件的问题。' : '知识库还是空的，先发布一个问题吧。'}</div>
          </div>
        `;
        return;
      }

      tableBody.innerHTML = `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>标题</th>
                <th>分类</th>
                <th>状态</th>
                <th>提问人</th>
                <th>提问时间</th>
                <th>浏览 / 回答</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((item) => `
                <tr>
                  <td class="cell-muted">Q-${padNumber(item.number)}</td>
                  <td class="cell-title">
                    <a href="${questionURL(item.number)}" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</a>
                    ${item.isSample ? '<span class="sample-badge">示例</span>' : ''}
                    ${reviewBadge(item.reviewStatus)}
                  </td>
                  <td class="cell-category">${escapeHtml(item.categoryName || categoryMap.get(item.category) || '未分类')}</td>
                  <td>${statusBadge(item.status)}</td>
                  <td>${escapeHtml(item.author || '匿名同事')}</td>
                  <td class="cell-muted">${escapeHtml(formatDate(item.createdAt))}</td>
                  <td class="cell-muted">
                    ${formatNumber(item.views)} / ${formatNumber(item.answerCount)}${item.pendingAnswerCount ? `<span class="pending-answer-note">+${item.pendingAnswerCount} 待审</span>` : ''}
                  </td>
                  <td>
                    <div class="row-actions">
                      <a class="icon-btn" href="${questionURL(item.number)}" title="查看" aria-label="查看 Q-${padNumber(item.number)}">${icon('eye')}</a>
                      ${item.reviewStatus === 'pending' ? `<button class="icon-btn" type="button" title="审核" aria-label="审核 Q-${padNumber(item.number)}"
                              data-row-action="review" data-number="${item.number}">${icon('check')}</button>` : ''}
                      <button class="icon-btn" type="button" title="编辑" aria-label="编辑 Q-${padNumber(item.number)}"
                              data-row-action="edit" data-number="${item.number}">${icon('edit')}</button>
                      <button class="icon-btn" type="button"
                              title="${item.status === 'resolved' ? '重新打开' : '标记已解决'}"
                              aria-label="${item.status === 'resolved' ? '重新打开' : '标记已解决'} Q-${padNumber(item.number)}"
                              data-row-action="toggle" data-number="${item.number}">
                        ${icon(item.status === 'resolved' ? 'refresh' : 'check')}
                      </button>
                      <button class="icon-btn is-danger" type="button" title="删除" aria-label="删除 Q-${padNumber(item.number)}"
                              data-row-action="delete" data-number="${item.number}">${icon('trash')}</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    renderRows();

    if (searchInput) searchInput.addEventListener('input', renderRows);
    if (statusFilter) statusFilter.addEventListener('change', renderRows);
    if (categoryFilter) categoryFilter.addEventListener('change', renderRows);

    const panel = app.querySelector('.admin-panel');
    if (panel) {
      panel.addEventListener('click', async (event) => {
        const exportButton = event.target.closest('[data-admin-tool="export"]');
        if (exportButton) {
          await downloadExport(exportButton.getAttribute('data-format'));
          return;
        }
        const clearButton = event.target.closest('[data-admin-tool="clear-samples"]');
        if (clearButton) {
          await clearSamples();
          return;
        }
        const rowButton = event.target.closest('[data-row-action]');
        if (!rowButton) return;
        const number = Number(rowButton.getAttribute('data-number'));
        const action = rowButton.getAttribute('data-row-action');
        const item = items.find((question) => Number(question.number) === number);
        if (!item) return;
        if (action === 'edit') {
          openEditModal(number);
        } else if (action === 'toggle') {
          await toggleQuestionStatus(number, item.status === 'resolved' ? 'open' : 'resolved');
        } else if (action === 'delete') {
          await deleteQuestion(number);
        } else if (action === 'review') {
          openReviewModal();
        }
      });
    }

    const headActions = app.querySelector('.admin-head-actions');
    if (headActions) {
      headActions.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-admin-tool]');
        if (!button) return;
        const tool = button.getAttribute('data-admin-tool');
        if (tool === 'refresh') renderRoute();
        else if (tool === 'logout') await logoutAdmin();
      });
    }

    app.querySelectorAll('[data-review-open]').forEach((button) => {
      button.addEventListener('click', openReviewModal);
    });
  }

  async function openReviewModal() {
    let data;
    try {
      data = await api('/api/admin/pending');
    } catch (error) {
      handleAdminError(error);
      return;
    }
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const answers = Array.isArray(data.answers) ? data.answers : [];
    const total = questions.length + answers.length;

    const questionHTML = questions.length
      ? questions.map((question) => `
        <article class="review-item">
          <div class="review-item-head">
            <span class="review-kind">问题</span>
            <span class="q-number">Q-${padNumber(question.number)}</span>
            <span class="review-time">${escapeHtml(timeAgo(question.createdAt))}</span>
          </div>
          <h4>${escapeHtml(question.title)}</h4>
          <div class="review-body rich-text">${formatRichText(question.body)}</div>
          <div class="review-meta">
            ${escapeHtml(question.author || '匿名同事')}${question.department ? ` · ${escapeHtml(question.department)}` : ''}
            · ${escapeHtml(categoryNameOf(question))}
          </div>
          <div class="review-actions">
            <button class="btn btn-primary btn-sm" type="button" data-review-action="approve"
                    data-review-kind="question" data-number="${question.number}">${icon('check')}通过并公开</button>
            <button class="btn btn-ghost btn-sm" type="button" data-review-action="reject"
                    data-review-kind="question" data-number="${question.number}">${icon('trash')}拒绝并删除</button>
          </div>
        </article>
      `).join('')
      : '<div class="review-empty">暂无待审核问题。</div>';

    const answerHTML = answers.length
      ? answers.map((answer) => `
        <article class="review-item">
          <div class="review-item-head">
            <span class="review-kind is-answer">回答</span>
            <span class="q-number">Q-${padNumber(answer.questionNumber)}</span>
            <span class="review-time">${escapeHtml(timeAgo(answer.createdAt))}</span>
          </div>
          <p class="review-question-title">${escapeHtml(answer.questionTitle)}</p>
          <div class="review-body rich-text">${formatRichText(answer.body)}</div>
          <div class="review-meta">
            ${escapeHtml(answer.author || '匿名同事')}${answer.department ? ` · ${escapeHtml(answer.department)}` : ''}
          </div>
          <div class="review-actions">
            <button class="btn btn-primary btn-sm" type="button" data-review-action="approve"
                    data-review-kind="answer" data-number="${answer.questionNumber}" data-answer-id="${escapeHtml(answer.id)}">${icon('check')}通过并公开</button>
            <button class="btn btn-ghost btn-sm" type="button" data-review-action="reject"
                    data-review-kind="answer" data-number="${answer.questionNumber}" data-answer-id="${escapeHtml(answer.id)}">${icon('trash')}拒绝并删除</button>
          </div>
        </article>
      `).join('')
      : '<div class="review-empty">暂无待审核回答。</div>';

    const modal = openModal({
      title: '审核队列',
      subtitle: total ? `共 ${questions.length} 个问题、${answers.length} 条回答待处理` : '所有公开投稿都已处理',
      size: 'modal-lg',
      body: `
        <div class="review-intro">
          ${icon('shield')}
          <p>公开提交的内容默认不展示。通过后立即公开；拒绝会永久删除，提交人不会收到单独通知。</p>
        </div>
        <section class="review-section">
          <h3>待审核问题 <span>${questions.length}</span></h3>
          ${questionHTML}
        </section>
        <section class="review-section">
          <h3>待审核回答 <span>${answers.length}</span></h3>
          ${answerHTML}
        </section>
      `,
      footer: `<button class="btn btn-ghost" type="button" data-close-modal>关闭</button>`,
    });
    if (!modal) return;

    modal.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-review-action]');
      if (!button) return;
      const action = button.getAttribute('data-review-action');
      const kind = button.getAttribute('data-review-kind');
      const number = button.getAttribute('data-number');
      const answerId = button.getAttribute('data-answer-id');
      if (action === 'reject') {
        const ok = await confirmDialog({
          title: '拒绝这条内容？',
          message: '拒绝后会永久删除该内容，且无法恢复。',
          confirmText: '拒绝并删除',
        });
        if (!ok) {
          openReviewModal();
          return;
        }
      }
      const path = kind === 'question'
        ? `/api/admin/questions/${number}/review`
        : `/api/admin/questions/${number}/answers/${answerId}/review`;
      button.disabled = true;
      try {
        await api(path, { method: 'POST', body: { action } });
        invalidateMeta();
        showToast(action === 'approve' ? '已通过审核，内容现已公开' : '已拒绝并删除');
        closeModal();
        renderRoute();
      } catch (error) {
        button.disabled = false;
        handleAdminError(error);
      }
    });
  }

  function renderAdminLogin() {
    app.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-login-shell">
          <div class="panel admin-login">
            <span class="login-icon">${icon('lock')}</span>
            <span class="kicker">Admin access</span>
            <h1>维护问答库</h1>
            <p>请输入管理员密码。登录后可以审核公开投稿、编辑、删除、标记解决状态、采纳最佳回答及导出数据。</p>
            <form id="admin-login-form" novalidate>
              <div class="form-group">
                <label class="form-label" for="admin-password">管理员密码</label>
                <div class="password-wrap">
                  <input class="form-input" id="admin-password" name="password" type="password"
                         placeholder="请输入密码" autocomplete="current-password" maxlength="200">
                  <button class="password-toggle" type="button" id="password-toggle" aria-label="显示密码">${icon('eye')}</button>
                </div>
              </div>
              <div class="form-alert" data-form-error hidden></div>
              <button class="btn btn-primary btn-block" type="submit">${icon('lock')}登录管理后台</button>
            </form>
            <p class="login-note">仅限内部使用。登录状态保持 8 小时；服务重启后需要重新登录。密码由部署时的环境变量 QA_ADMIN_PASSWORD 决定。</p>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('admin-login-form');
    const password = document.getElementById('admin-password');
    const toggle = document.getElementById('password-toggle');
    if (toggle && password) {
      toggle.addEventListener('click', () => {
        const visible = password.type === 'text';
        password.type = visible ? 'password' : 'text';
        toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
        password.focus();
      });
    }
    if (!form) return;
    bindFormReset(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormError(form);
      clearInvalid(form);
      const value = password ? password.value : '';
      if (!value) {
        markInvalid(form, password, '请输入管理员密码');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      setButtonLoading(button, true, '登录中…');
      try {
        await api('/api/admin/login', { method: 'POST', body: { password: value } });
        state.isAdmin = true;
        state.adminCheckedAt = Date.now();
        showToast('登录成功');
        renderRoute();
      } catch (error) {
        showFormError(form, error.message || '登录失败，请稍后再试');
        setButtonLoading(button, false);
        if (password) password.select();
      }
    });
  }

  async function logoutAdmin() {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      handleAdminError(error);
      return;
    }
    state.isAdmin = false;
    state.adminCheckedAt = Date.now();
    state.adminItems = null;
    showToast('已退出管理后台', 'info');
    renderRoute();
  }

  async function downloadExport(format) {
    try {
      const response = await fetch(`/api/admin/export?format=${encodeURIComponent(format)}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        let message = '导出失败，请稍后再试';
        try {
          const payload = await response.json();
          if (payload && payload.error && payload.error.message) message = payload.error.message;
        } catch {
          /* 使用默认提示 */
        }
        if (response.status === 401) {
          state.isAdmin = false;
          state.adminCheckedAt = Date.now();
          showToast('登录已过期，请重新登录', 'error');
          renderRoute();
          return;
        }
        throw new ApiError(message, response.status);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = utf8Match ? decodeURIComponent(utf8Match[1]) : asciiMatch ? asciiMatch[1] : `qa-export.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`已导出 ${format.toUpperCase()} 文件`);
    } catch (error) {
      showToast(error && error.message ? error.message : '导出失败，请稍后再试', 'error');
    }
  }

  async function clearSamples() {
    const count = (state.adminItems || []).filter((item) => item.isSample).length;
    const ok = await confirmDialog({
      title: '清除全部示例数据？',
      message: `将删除 ${count} 条标记为“示例”的问题及其回答。你发布的内容不会受影响，操作无法撤销。`,
      confirmText: '清除示例数据',
    });
    if (!ok) return;
    try {
      const data = await api('/api/admin/samples/clear', { method: 'POST' });
      invalidateMeta();
      state.adminItems = null;
      showToast(`已清除 ${data.removed} 条示例数据`);
      renderRoute();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function toggleQuestionStatus(number, status) {
    try {
      await api(`/api/admin/questions/${number}/status`, { method: 'POST', body: { status } });
      invalidateMeta();
      showToast(status === 'resolved' ? '已标记为已解决' : '已重新打开');
      renderRoute();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function deleteQuestion(number, { returnToBrowse = false } = {}) {
    const ok = await confirmDialog({
      title: '删除这个问题？',
      message: `Q-${padNumber(number)} 及其全部回答将被永久删除，无法恢复。`,
      confirmText: '删除问题',
    });
    if (!ok) return;
    try {
      await api(`/api/admin/questions/${number}`, { method: 'DELETE' });
      invalidateMeta();
      state.adminItems = null;
      showToast('问题已删除');
      if (returnToBrowse) navigate('#/browse');
      else renderRoute();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function openEditModal(number) {
    let question;
    let meta;
    try {
      [question, meta] = await Promise.all([
        api(`/api/questions/${number}`),
        getMeta().catch(() => null),
      ]);
    } catch (error) {
      handleAdminError(error);
      return;
    }
    const categories = meta && Array.isArray(meta.categories) ? meta.categories : DEFAULT_CATEGORIES;

    const body = `
      <form id="edit-question-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="edit-title">标题 <span class="required">*</span></label>
          <input class="form-input" id="edit-title" name="title" type="text" maxlength="120" value="${escapeHtml(question.title)}">
          <div class="form-hint"><span>4–120 字。</span><span class="char-count" data-count-for="edit-title">0 / 120</span></div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit-category">分类</label>
            <select class="form-select" id="edit-category" name="category">
              ${categories.map((category) => `<option value="${escapeHtml(category.id)}"${category.id === question.category ? ' selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-status">状态</label>
            <select class="form-select" id="edit-status" name="status">
              <option value="open"${question.status === 'open' ? ' selected' : ''}>待解决</option>
              <option value="resolved"${question.status === 'resolved' ? ' selected' : ''}>已解决</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-tags">标签 <span class="label-hint">逗号分隔，最多 5 个</span></label>
          <input class="form-input" id="edit-tags" name="tags" type="text" maxlength="100" value="${escapeHtml((question.tags || []).join(', '))}">
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-body">问题描述 <span class="required">*</span></label>
          <textarea class="form-textarea" id="edit-body" name="body" maxlength="5000" rows="7">${escapeHtml(question.body)}</textarea>
          <div class="form-hint"><span>8–5000 字。</span><span class="char-count" data-count-for="edit-body">0 / 5000</span></div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit-author">提问人</label>
            <input class="form-input" id="edit-author" name="author" type="text" maxlength="30" value="${escapeHtml(question.author)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-department">部门</label>
            <input class="form-input" id="edit-department" name="department" type="text" maxlength="40" value="${escapeHtml(question.department)}">
          </div>
        </div>
        <div class="form-alert" data-form-error hidden></div>
      </form>
    `;

    openModal({
      title: `编辑 Q-${padNumber(question.number)}`,
      subtitle: '修改后会立即同步到问答库。回答内容需在详情页单独管理。',
      size: 'modal-lg',
      body,
      footer: `
        <span class="modal-note">共 ${question.answerCount || 0} 条回答</span>
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>取消</button>
        <button class="btn btn-primary btn-sm" type="submit" form="edit-question-form">保存修改</button>
      `,
    });

    const form = document.getElementById('edit-question-form');
    if (!form) return;
    bindCounters(modalRoot);
    bindFormReset(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormError(form);
      clearInvalid(form);
      const titleField = document.getElementById('edit-title');
      const bodyField = document.getElementById('edit-body');
      const title = titleField.value.trim();
      const text = bodyField.value.trim();
      if (title.length < 4) return markInvalid(form, titleField, '标题至少需要 4 个字符');
      if (text.length < 8) return markInvalid(form, bodyField, '问题描述至少需要 8 个字符');
      const button = modalRoot.querySelector('button[form="edit-question-form"]');
      setButtonLoading(button, true, '保存中…');
      try {
        await api(`/api/admin/questions/${question.number}`, {
          method: 'PUT',
          body: {
            title,
            body: text,
            category: document.getElementById('edit-category').value,
            tags: document.getElementById('edit-tags').value,
            author: document.getElementById('edit-author').value.trim(),
            department: document.getElementById('edit-department').value.trim(),
            status: document.getElementById('edit-status').value,
          },
        });
        closeModal();
        invalidateMeta();
        state.adminItems = null;
        showToast('修改已保存');
        renderRoute();
      } catch (error) {
        if (isAdminError(error)) {
          closeModal();
          handleAdminError(error);
          return;
        }
        showFormError(form, error.message || '保存失败，请稍后再试');
        setButtonLoading(button, false);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  顶栏、快捷键与全局事件                                             */
  /* ------------------------------------------------------------------ */
  function setMobileMenu(open) {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  }

  function isMobileMenuOpen() {
    return Boolean(mobileMenu && !mobileMenu.hidden);
  }

  function isEditableTarget(target) {
    if (!target || !target.tagName) return false;
    if (target.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }

  function setupInteractions() {
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());

    window.addEventListener('scroll', () => {
      if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });

    if (menuToggle) {
      menuToggle.addEventListener('click', () => setMobileMenu(!isMobileMenuOpen()));
    }

    if (headerSearch) {
      headerSearch.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = headerSearch.querySelector('input');
        const q = input ? input.value.trim() : '';
        setMobileMenu(false);
        navigate(q ? browseLink({ q }) : '#/browse');
      });
    }

    if (mobileSearch) {
      mobileSearch.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = mobileSearch.querySelector('input');
        const q = input ? input.value.trim() : '';
        setMobileMenu(false);
        navigate(q ? browseLink({ q }) : '#/browse');
      });
    }

    if (mobileMenu) {
      mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMobileMenu(false));
      });
    }

    document.addEventListener('click', (event) => {
      if (!isMobileMenuOpen()) return;
      if (topbar && topbar.contains(event.target)) return;
      setMobileMenu(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (modalRoot && modalRoot.firstElementChild) {
          closeModal();
          return;
        }
        if (isMobileMenuOpen()) setMobileMenu(false);
        return;
      }
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditableTarget(event.target)) {
        if (modalRoot && modalRoot.firstElementChild) return;
        event.preventDefault();
        if (headerSearch && headerSearch.offsetParent !== null) {
          const input = headerSearch.querySelector('input');
          if (input) input.focus();
        } else {
          setMobileMenu(true);
          const input = mobileSearch ? mobileSearch.querySelector('input') : null;
          if (input) input.focus();
        }
      }
    });

    if (modalRoot) {
      modalRoot.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-modal]')) {
          closeModal();
          return;
        }
        if (event.target.classList && event.target.classList.contains('modal-backdrop')) {
          closeModal();
        }
      });

      modalRoot.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const modal = modalRoot.querySelector('.modal');
        if (!modal) return;
        const focusable = Array.from(modal.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }

    app.addEventListener('submit', (event) => {
      const form = event.target.closest ? event.target.closest('form[data-search-form]') : null;
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector('input[name="q"]');
      const q = input ? input.value.trim() : '';
      navigate(q ? browseLink({ q }) : '#/browse');
    });

    window.addEventListener('hashchange', renderRoute);
  }

  /* ------------------------------------------------------------------ */
  /*  启动                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());
    setupInteractions();
    if (!location.hash) {
      history.replaceState(null, '', '#/');
    }
    renderRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
