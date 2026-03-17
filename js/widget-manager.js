/**
 * WidgetManager - ウィジェットの生成・管理・永続化
 */
const WidgetTypes = {};

class WidgetBase {
  constructor(id, config = {}) {
    this.id = id;
    this.type = this.constructor.widgetType || 'unknown';
    this.config = { title: 'ウィジェット', collapsed: false, ...config };
    this.element = null;
  }

  render() {
    const el = document.createElement('div');
    el.className = `widget ${this.config.collapsed ? 'collapsed' : ''}`;
    el.dataset.widgetId = this.id;
    el.dataset.widgetType = this.type;
    el.draggable = true;

    el.innerHTML = `
      <div class="widget__header">
        <div class="widget__header-left">
          <span class="widget__title">${this._escapeHtml(this.config.title)}</span>
          <svg class="widget__chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="widget__header-controls">
          <button class="widget__ctrl-btn widget-settings-btn">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>
      <div class="widget__body">
        ${this.renderBody()}
      </div>
    `;

    this.element = el;
    this._bindBaseEvents();
    this.onMount();
    return el;
  }

  renderBody() { return '<div class="empty-state">コンテンツなし</div>'; }
  onMount() {}
  onDestroy() {}

  getSettingsFields() { return []; }

  getContextMenuItems() {
    return [
      { action: 'settings', label: '設定', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
      { action: 'rename', label: '名前を変更', icon: '<svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' },
      { divider: true },
      { action: 'delete', label: '削除', icon: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', danger: true }
    ];
  }

  handleContextMenuAction(action) {
    return false; // Return true if handled completely in subclass
  }

  _bindBaseEvents() {
    const header = this.element.querySelector('.widget__header');
    const settingsBtn = this.element.querySelector('.widget-settings-btn');

    header.addEventListener('click', (e) => {
      if (e.target.closest('.widget__header-controls')) return;
      this.toggleCollapse();
    });

    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      WidgetManager.showWidgetMenu(this);
    });

    this.element.addEventListener('dragstart', (e) => {
      this.element.classList.add('dragging');
      e.dataTransfer.setData('text/plain', this.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    this.element.addEventListener('dragend', () => {
      this.element.classList.remove('dragging');
    });

    this.element.addEventListener('contextmenu', (e) => {
      // Don't show widget menu if right-clicking on elements that handle their own context menu
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      WidgetManager.showWidgetMenu(this, e);
    });
  }

  toggleCollapse() {
    this.config.collapsed = !this.config.collapsed;
    this.element.classList.toggle('collapsed', this.config.collapsed);
    this.save();
  }

  save() {
    WidgetManager.saveLayout();
  }

  updateBody() {
    if (!this.element) return;
    const body = this.element.querySelector('.widget__body');
    if (body) body.innerHTML = this.renderBody();
    this.onMount();
  }

  updateTitle(title) {
    this.config.title = title;
    const titleEl = this.element?.querySelector('.widget__title');
    if (titleEl) titleEl.textContent = title;
    this.save();
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

const WidgetManager = {
  widgets: {},
  columns: [],
  layout: null,

  async init() {
    this.layout = await Storage.get('dashboard_layout', this._defaultLayout());
    this._renderColumns();
    this._loadWidgets();
    this._bindDragDrop();
    this._bindAddButtons();
    this._bindBackgroundEvents();
  },

  _bindBackgroundEvents() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.bg-refresh-btn');
      if (btn) {
        btn.classList.add('loading');
        const bgConfig = this.layout.background || {};
        const cacheKey = `bg_cache_${bgConfig.type}`;
        await Storage.remove(cacheKey);
        await this._applyBackground();
        // loadingクラスの除去は再描画で自動的に行われる（新しいHTMLに置き換わるため）
      }
    });
  },

  _defaultLayout() {
    return {
      columns: 3,
      widgets: [],
      background: { type: 'auto', url: '', autoSource: 'unsplash' }
    };
  },

  _renderColumns() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    dashboard.innerHTML = '';
    dashboard.style.setProperty('--column-count', this.layout.columns);

    const container = document.createElement('div');
    container.className = 'column-container';
    dashboard.appendChild(container);

    this.columns = [];
    for (let i = 0; i < this.layout.columns; i++) {
      const col = document.createElement('div');
      col.className = 'column';
      col.dataset.column = i;
      col.innerHTML = `
        <div class="column__add-btn" data-column="${i}">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>ウィジェットを追加</span>
        </div>
      `;
      container.appendChild(col);
      this.columns.push(col);
    }

    // クレジット表示（再生成）
    let attribution = document.getElementById('bg-attribution');
    if (!attribution) {
      attribution = document.createElement('div');
      attribution.className = 'app-bg-attribution';
      attribution.id = 'bg-attribution';
    }
    dashboard.appendChild(attribution);
  },

  _loadWidgets() {
    if (!this.layout.widgets || this.layout.widgets.length === 0) return;
    for (const wData of this.layout.widgets) {
      this._createWidget(wData.type, wData.column, wData.config, wData.id);
    }
  },

  _createWidget(type, column, config = {}, id = null) {
    const WidgetClass = WidgetTypes[type];
    if (!WidgetClass) { console.warn('Unknown widget type:', type); return null; }
    if (!id) id = 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const widget = new WidgetClass(id, config);
    const el = widget.render();
    this.widgets[id] = widget;

    const col = this.columns[column] || this.columns[0];
    const addBtn = col.querySelector('.column__add-btn');
    if (addBtn) col.insertBefore(el, addBtn);
    else col.appendChild(el);

    return widget;
  },

  addWidget(type, column, config = {}) {
    const widget = this._createWidget(type, column, config);
    if (widget) {
      this.saveLayout();
      this._showToast(`${widget.config.title} を追加しました`, 'success');
    }
    return widget;
  },

  removeWidget(id) {
    const widget = this.widgets[id];
    if (!widget) return;
    widget.onDestroy();
    widget.element.remove();
    delete this.widgets[id];
    this.saveLayout();
    this._showToast('ウィジェットを削除しました', 'info');
  },

  _saveTimer: null,
  async saveLayout() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      const widgetData = [];
      for (const col of this.columns) {
        const colIndex = parseInt(col.dataset.column);
        const widgetEls = col.querySelectorAll('.widget');
        widgetEls.forEach(el => {
          const id = el.dataset.widgetId;
          const w = this.widgets[id];
          if (w) {
            widgetData.push({ id, type: w.type, column: colIndex, config: w.config });
          }
        });
      }
      this.layout.widgets = widgetData;
      await Storage.set('dashboard_layout', this.layout);
    }, 500);
  },

  _bindDragDrop() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    let lastCol = null;
    dashboard.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const col = e.target.closest('.column');
      if (col && col !== lastCol) {
        if (lastCol) lastCol.classList.remove('drag-over');
        col.classList.add('drag-over');
        lastCol = col;
      }
    });

    dashboard.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.column');
      if (col && !col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
        if (lastCol === col) lastCol = null;
      }
    });

    dashboard.addEventListener('drop', (e) => {
      e.preventDefault();
      document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
      lastCol = null;
      
      const widgetId = e.dataTransfer.getData('text/plain');
      const widget = this.widgets[widgetId];
      if (!widget) return;

      const col = e.target.closest('.column');
      if (!col) return;

      const addBtn = col.querySelector('.column__add-btn');
      const afterEl = this._getDragAfterElement(col, e.clientY);

      if (afterEl) col.insertBefore(widget.element, afterEl);
      else if (addBtn) col.insertBefore(widget.element, addBtn);
      else col.appendChild(widget.element);

      this.saveLayout();
    });
  },

  _getDragAfterElement(col, y) {
    const widgets = [...col.querySelectorAll('.widget:not(.dragging)')];
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;

    widgets.forEach(child => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = child;
      }
    });
    return closest;
  },

  _bindAddButtons() {
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.column__add-btn');
      if (addBtn) {
        const col = parseInt(addBtn.dataset.column);
        this.showWidgetPicker(col);
      }
    });
  },

  showWidgetPicker(column) {
    const widgetList = [
      { type: 'bookmark', name: 'ブックマーク', icon: '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' },
      { type: 'rss', name: 'RSS', icon: '<svg viewBox="0 0 24 24"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>' },
      { type: 'memo', name: 'メモ', icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
      { type: 'task', name: 'タスク', icon: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
      { type: 'weather', name: '天気', icon: '<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>' },
      { type: 'clock', name: '時計', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
      { type: 'media', name: 'メディア', icon: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
      { type: 'stock', name: '株価', icon: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
      { type: 'embed', name: '埋め込みWeb', icon: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' },
      { type: 'minicalendar', name: 'カレンダー', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
      { type: 'calendar', name: 'iCalカレンダー', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1"/></svg>' },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">ウィジェットを追加</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div class="widget-picker">
            ${widgetList.map(w => `
              <div class="widget-picker__item" data-type="${w.type}">
                <div class="widget-picker__icon">${w.icon}</div>
                <span class="widget-picker__name">${w.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('.modal__close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.widget-picker__item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        const WidgetClass = WidgetTypes[type];
        const defaultConfig = WidgetClass?.defaultConfig ? { ...WidgetClass.defaultConfig } : {};
        this.addWidget(type, column, defaultConfig);
        overlay.remove();
      });
    });

    document.body.appendChild(overlay);
  },

  showWidgetMenu(widget, e = null) {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    if (e) {
      menu.style.top = e.clientY + 'px';

      // Prevent running out of right edge
      if (e.clientX + 200 > window.innerWidth) { // Approx menu width
        menu.style.right = (window.innerWidth - e.clientX) + 'px';
        menu.style.left = 'auto';
      } else {
        menu.style.left = e.clientX + 'px';
        menu.style.right = 'auto';
      }
    } else {
      const rect = widget.element.querySelector('.widget-settings-btn').getBoundingClientRect();
      menu.style.top = rect.bottom + 4 + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      menu.style.left = 'auto';
    }

    const items = widget.getContextMenuItems ? widget.getContextMenuItems() : [];

    menu.innerHTML = items.map(item => {
      if (item.divider) return '<div class="context-menu__divider"></div>';
      return `
        <div class="context-menu__item ${item.danger ? 'context-menu__item--danger' : ''}" data-action="${item.action}">
          ${item.icon || ''}
          ${item.label}
        </div>
      `;
    }).join('');

    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.context-menu__item');
      if (!item) return;
      const action = item.dataset.action;
      menu.remove();

      if (widget.handleContextMenuAction && widget.handleContextMenuAction(action)) {
        return;
      }

      if (action === 'delete') {
        this.removeWidget(widget.id);
      } else if (action === 'rename') {
        this._showRenameDialog(widget);
      } else if (action === 'settings') {
        this._showSettingsDialog(widget);
      }
    });

    document.body.appendChild(menu);
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  },

  _showRenameDialog(widget) {
    const newName = prompt('新しい名前を入力してください:', widget.config.title);
    if (newName && newName.trim()) {
      widget.updateTitle(newName.trim());
    }
  },

  _showSettingsDialog(widget) {
    const fields = widget.getSettingsFields();
    if (fields.length === 0) {
      this._showToast('このウィジェットには設定項目がありません', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">${widget._escapeHtml(widget.config.title)} の設定</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          ${fields.map(f => this._renderSettingsField(f, widget)).join('')}
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-cancel-btn">キャンセル</button>
          <button class="btn btn--primary modal-save-btn">保存</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('.modal-save-btn').addEventListener('click', () => {
      for (const f of fields) {
        if (f.type === 'info') continue;
        const input = overlay.querySelector(`[data-field="${f.key}"]`);
        if (!input) continue;
        if (f.type === 'checkbox') widget.config[f.key] = input.checked;
        else if (f.type === 'number') widget.config[f.key] = Number(input.value);
        else if (f.type === 'textarea') widget.config[f.key] = input.value;
        else widget.config[f.key] = input.value;
      }
      widget.save();
      widget.updateBody();
      close();
      this._showToast('設定を保存しました', 'success');
    });

    document.body.appendChild(overlay);
  },

  _renderSettingsField(field, widget) {
    const val = widget.config[field.key] ?? field.default ?? '';
    switch (field.type) {
      case 'text':
        return `<div class="form-group"><label class="form-label">${field.label}</label><input class="form-input" data-field="${field.key}" type="text" value="${this._escAttr(val)}" placeholder="${field.placeholder || ''}"></div>`;
      case 'number':
        return `<div class="form-group"><label class="form-label">${field.label}</label><input class="form-input" data-field="${field.key}" type="number" value="${val}" min="${field.min || 0}" max="${field.max || 999}"></div>`;
      case 'select':
        return `<div class="form-group"><label class="form-label">${field.label}</label><select class="form-select" data-field="${field.key}">${(field.options || []).map(o => `<option value="${o.value}" ${o.value === val ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>`;
      case 'textarea':
        return `<div class="form-group"><label class="form-label">${field.label}</label><textarea class="form-input" data-field="${field.key}" rows="${field.rows || 4}" style="height:auto;padding:8px 12px;" placeholder="${field.placeholder || ''}">${this._escAttr(val)}</textarea></div>`;
      case 'checkbox':
        return `<div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-field="${field.key}" ${val ? 'checked' : ''} style="width:16px;height:16px"><label class="form-label" style="margin:0">${field.label}</label></div>`;
      case 'info':
        return `<div style="margin-bottom:12px;font-size:0.75rem;color:var(--text-tertiary);line-height:1.4"><span style="display:inline-block;margin-right:2px">ℹ️</span>${field.content}</div>`;
      default:
        return '';
    }
  },

  _escAttr(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  _showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  },

  async setBackground(type, value, color) {
    this.layout.background = { type, url: value || '', color: color || '' };
    await this.saveLayout();
    this._applyBackground();
  },

  async _applyBackground() {
    const bg = document.querySelector('.app-background');
    if (!bg) return;
    const bgConfig = this.layout.background || {};

    // まず初期化
    bg.style.backgroundImage = '';
    document.body.style.backgroundColor = '';

    if (bgConfig.type === 'custom' && bgConfig.url) {
      bg.style.backgroundImage = `url("${bgConfig.url}")`;
    } else if (bgConfig.type === 'auto' || bgConfig.type === 'nasa') {
      try {
        const cacheKey = `bg_cache_${bgConfig.type}`;
        const cached = await Storage.get(cacheKey, null);
        const now = Date.now();

        // キャッシュ有効期間: 1時間
        if (cached && cached.url && (now - cached.timestamp < 3600000)) {
          bg.style.backgroundImage = `url("${cached.url}")`;
        } else {
          let url = '';
          if (bgConfig.type === 'nasa') {
            const response = await chrome.runtime.sendMessage({ 
              action: 'proxyFetch', 
              url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY' 
            });
            if (response && response.ok) {
              const data = JSON.parse(response.data);
              if (data.media_type === 'image') {
                url = data.hdurl || data.url;
              } else {
                url = 'https://picsum.photos/1920/1080';
              }
            }
          } else {
            const response = await chrome.runtime.sendMessage({ 
              action: 'proxyFetch', 
              url: 'https://picsum.photos/1920/1080' 
            });
            // Picsum はリダイレクト先のURLが画像になるため、リクエスト自体が成功すればOK
            // ただし、プロキシ経由だとリダイレクト後のURL取得に工夫が必要な場合があるため
            // ここでは直接の fetch が失敗する場合の確実な代案としてプロキシを通す
            if (response && response.ok) {
              // background.js の proxyFetch は text() を返すため、
              // 画像URLそのものを取得するにはプロキシ側での対応が必要だが、
              // 一旦ここでは標準的な取得フローに合わせる
              url = 'https://picsum.photos/1920/1080?sig=' + now;
            }
          }

          if (url) {
            bg.style.backgroundImage = `url("${url}")`;
            await Storage.set(cacheKey, { url, timestamp: now });
          }
        }

        // クレジット表示の更新
        const attribution = document.getElementById('bg-attribution');
        if (attribution) {
          const refreshBtn = `
            <button class="bg-refresh-btn" title="壁紙を更新">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>`;

          if (bgConfig.type === 'nasa') {
            attribution.innerHTML = `Background: <a href="https://apod.nasa.gov/" target="_blank">NASA APOD</a> ${refreshBtn}`;
            attribution.style.opacity = '1';
          } else if (bgConfig.type === 'auto') {
            attribution.innerHTML = `Background: <a href="https://unsplash.com/" target="_blank">Unsplash</a> ${refreshBtn}`;
            attribution.style.opacity = '1';
          } else {
            attribution.style.opacity = '0';
          }
        }
      } catch (e) {
        console.warn('Background fetch failed:', e);
      }
    } else if (bgConfig.type === 'solid' || bgConfig.type === 'custom' || bgConfig.type === 'none') {
      const attribution = document.getElementById('bg-attribution');
      if (attribution) attribution.style.opacity = '0';

      if (bgConfig.type === 'solid' && bgConfig.color) {
        document.body.style.backgroundColor = bgConfig.color;
      }
    }
  },

  getColumnCount() { return this.layout.columns; },

  async setColumnCount(count) {
    count = Math.max(1, Math.min(4, count));
    this.layout.columns = count;

    const extraWidgets = [];
    for (let i = count; i < this.columns.length; i++) {
      const col = this.columns[i];
      col.querySelectorAll('.widget').forEach(el => {
        extraWidgets.push(el);
      });
    }

    this._renderColumns();

    for (const [id, widget] of Object.entries(this.widgets)) {
      const wData = this.layout.widgets.find(w => w.id === id);
      const colIdx = wData ? Math.min(wData.column, count - 1) : 0;
      const col = this.columns[colIdx];
      const addBtn = col.querySelector('.column__add-btn');
      if (addBtn) col.insertBefore(widget.element, addBtn);
      else col.appendChild(widget.element);
    }

    this._bindDragDrop();
    this._bindAddButtons();
    await this.saveLayout();
  }
};
