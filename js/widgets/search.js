/**
 * SearchWidget - 検索バーウィジェット（グローバル検索バー）
 */
const SearchManager = {
  engines: [],
  currentEngine: null,

  async init() {
    let saved = await Storage.get('search_engines', null);
    if (saved) {
      // 既存ユーザー向け：Perplexityをリストから自動的に削除
      const filtered = saved.filter(e => e.id !== 'perplexity');
      if (filtered.length !== saved.length) {
        saved = filtered;
        await Storage.set('search_engines', saved);
      }
    }
    this.engines = saved || this._defaultEngines();
    const currentId = await Storage.get('search_current_engine', 'bing');
    this.currentEngine = this.engines.find(e => e.id === currentId) || this.engines[0];
    if (currentId === 'perplexity') {
       this.currentEngine = this.engines[0];
       await Storage.set('search_current_engine', this.currentEngine.id);
    }
    this._render();
    this._bind();
  },

  _defaultEngines() {
    return [
      { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s', icon: chrome.runtime.getURL('/_favicon/?pageUrl=https://www.bing.com&size=32') },
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', icon: chrome.runtime.getURL('/_favicon/?pageUrl=https://www.google.com&size=32') },
      { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', icon: chrome.runtime.getURL('/_favicon/?pageUrl=https://duckduckgo.com&size=32') }
    ];
  },

  _render() {
    const container = document.getElementById('search-container');
    if (!container) return;

    container.innerHTML = `
      <div class="search-bar-wrapper">
        <div class="search-bar">
          <div class="search-bar__engine-btn" id="search-engine-toggle">
            <img class="search-bar__engine-icon" src="${this.currentEngine.icon}" alt="" data-hide-on-error="true">
            <span class="search-bar__engine-name">${this.currentEngine.name}</span>
          </div>
          <div class="search-bar__separator"></div>
          <input class="search-bar__input" id="search-input" type="text" placeholder="${this.currentEngine.name} で検索..." autocomplete="off" spellcheck="false">
          <button class="search-bar__submit" id="search-submit">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div class="search-engine-dropdown" id="search-dropdown"></div>
      </div>
    `;
  },

  _bind() {
    const input = document.getElementById('search-input');
    const submit = document.getElementById('search-submit');
    const toggle = document.getElementById('search-engine-toggle');
    const dropdown = document.getElementById('search-dropdown');

    if (!input) return;

    const doSearch = () => {
      const q = input.value.trim();
      if (!q) return;
      const url = this.currentEngine.url.replace('%s', encodeURIComponent(q));
      window.location.href = url;
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    submit?.addEventListener('click', doSearch);

    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showDropdown();
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('show');
    });
  },

  _showDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = this.engines.map(e => `
      <div class="search-engine-dropdown__item ${e.id === this.currentEngine.id ? 'active' : ''}" data-engine-id="${e.id}">
        <img src="${e.icon}" alt="" width="18" height="18" data-hide-on-error="true">
        <span>${e.name}</span>
      </div>
    `).join('') + `
      <div class="search-engine-dropdown__divider"></div>
      <div class="search-engine-dropdown__item" id="manage-search-engines">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>検索エンジンを管理</span>
      </div>
    `;

    dropdown.classList.add('show');

    dropdown.querySelectorAll('.search-engine-dropdown__item[data-engine-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setEngine(item.dataset.engineId);
        dropdown.classList.remove('show');
      });
    });

    document.getElementById('manage-search-engines')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.remove('show');
      this._showManageEnginesDialog();
    });
  },

  async setEngine(id) {
    this.currentEngine = this.engines.find(e => e.id === id) || this.engines[0];
    await Storage.set('search_current_engine', id);
    this._render();
    this._bind();
  },

  async _showManageEnginesDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">検索エンジンを管理</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div id="engine-list" style="margin-bottom:16px;max-height:300px;overflow-y:auto">
            ${this.engines.map((e, i) => `
              <div class="draggable-item" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color);cursor:grab">
                <span style="font-size:0.8rem;color:var(--text-tertiary)">≡</span>
                <img src="${e.icon}" width="16" height="16" data-hide-on-error="true">
                <span style="flex:1;font-size:0.85rem">${this._escapeHtml(e.name)}</span>
                <button class="btn btn--ghost" style="padding:2px 8px;font-size:0.72rem" data-action="edit" data-idx="${i}">編集</button>
                <button class="btn btn--danger" style="padding:2px 8px;font-size:0.72rem" data-remove="${i}" ${this.engines.length <= 1 ? 'disabled' : ''}>削除</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn--ghost" id="btn-add-engine" style="width:100%;font-size:0.82rem">+ 新しいエンジンを追加</button>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary modal-close-btn">閉じる</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this._render(); this._bind(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);

    // ドラッグ＆ドロップ実装
    let draggedIdx = null;
    overlay.querySelectorAll('.draggable-item').forEach(item => {
      item.addEventListener('dragstart', (e) => { draggedIdx = parseInt(item.dataset.idx); e.dataTransfer.effectAllowed = 'move'; item.style.opacity = '0.5'; });
      item.addEventListener('dragend', () => { item.style.opacity = '1'; overlay.querySelectorAll('.draggable-item').forEach(el => el.style.borderTop = ''); });
      item.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const rect = item.getBoundingClientRect(); if (e.clientY < rect.top + rect.height/2) { item.style.borderTop = '2px solid var(--accent-primary)'; } else { item.style.borderTop = ''; } });
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetIdx = parseInt(item.dataset.idx);
        if (draggedIdx === null || draggedIdx === targetIdx) return;
        const rect = item.getBoundingClientRect();
        let insertIdx = targetIdx;
        if (e.clientY > rect.top + rect.height/2) insertIdx++;
        const [moved] = this.engines.splice(draggedIdx, 1);
        if (insertIdx > draggedIdx) insertIdx--;
        this.engines.splice(insertIdx, 0, moved);
        await Storage.set('search_engines', this.engines);
        overlay.remove();
        this._showManageEnginesDialog();
      });
    });

    overlay.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => { this._showAddEngineDialog(parseInt(btn.dataset.idx), overlay); });
    });

    overlay.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        if (confirm(`「${this.engines[idx].name}」を削除しますか？`)) {
          const removed = this.engines.splice(idx, 1)[0];
          if (this.currentEngine.id === removed.id) this.currentEngine = this.engines[0];
          await Storage.set('search_engines', this.engines);
          await Storage.set('search_current_engine', this.currentEngine.id);
          overlay.remove();
          this._showManageEnginesDialog();
        }
      });
    });

    overlay.querySelector('#btn-add-engine').addEventListener('click', () => {
      this._showAddEngineDialog(-1, overlay);
    });

    document.body.appendChild(overlay);
  },

  _showAddEngineDialog(editIdx = -1, parentModal = null) {
    const isEdit = editIdx >= 0;
    const engine = isEdit ? this.engines[editIdx] : { name: '', url: '' };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">${isEdit ? '検索エンジンを編集' : '検索エンジンを追加'}</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="form-label">名前</label>
            <input class="form-input" id="new-engine-name" type="text" value="${this._escapeHtml(engine.name)}" placeholder="例: Yahoo">
          </div>
          <div class="form-group">
            <label class="form-label">検索URL（%s = 検索語）</label>
            <input class="form-input" id="new-engine-url" type="text" value="${this._escapeHtml(engine.url)}" placeholder="例: https://search.yahoo.co.jp/search?p=%s">
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-cancel">キャンセル</button>
          <button class="btn btn--primary modal-save">${isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', close);

    overlay.querySelector('.modal-save').addEventListener('click', async () => {
      const name = overlay.querySelector('#new-engine-name').value.trim();
      const url = overlay.querySelector('#new-engine-url').value.trim();
      if (!name || !url || !url.includes('%s')) {
        alert('名前とURL（%sを含む）を入力してください');
        return;
      }

      const origin = new URL(url).origin;
      const u = new URL(chrome.runtime.getURL("/_favicon/"));
      u.searchParams.set("pageUrl", origin);
      u.searchParams.set("size", "32");
      const icon = u.toString();

      if (isEdit) {
        this.engines[editIdx] = { ...this.engines[editIdx], name, url, icon };
      } else {
        const id = 'custom_' + Date.now();
        this.engines.push({ id, name, url, icon });
      }

      await Storage.set('search_engines', this.engines);
      close();
      if (parentModal) {
        parentModal.remove();
        this._showManageEnginesDialog();
      }
    });

    document.body.appendChild(overlay);
  },

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
