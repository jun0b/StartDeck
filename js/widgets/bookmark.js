/**
 * BookmarkWidget - ブックマークウィジェット
 */
class BookmarkWidget extends WidgetBase {
  static widgetType = 'bookmark';
  static defaultConfig = {
    title: 'ブックマーク',
    displayMode: 'icon',
    bookmarks: [
      { name: 'YouTube', url: 'https://www.youtube.com/' },
      { name: 'Google', url: 'https://www.google.com/' },
    ]
  };

  renderBody() {
    const mode = this.config.displayMode || 'icon';
    const bookmarks = this.config.bookmarks || [];

    const addFooter = `
      <div class="bookmark-footer">
        <div class="bookmark-footer__add-btn bookmark-add-btn">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>追加</span>
        </div>
      </div>`;

    if (bookmarks.length === 0) {
      return `<div class="empty-state" style="padding:20px">ブックマークがありません</div>${addFooter}`;
    }

    const items = bookmarks.map((b, i) => {
      let favicon;
      try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=64`; }
      catch { favicon = ''; }
      if (mode === 'icon') {
        return `<a href="${this._escapeHtml(b.url)}" class="bookmark-item bookmark-item--icon" title="${this._escapeHtml(b.name)}" data-idx="${i}">
          <img class="bookmark-item__favicon" src="${favicon}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23444%22/><text x=%2212%22 y=%2216%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2212%22>${b.name[0]}</text></svg>'">
          <span class="bookmark-item__name">${this._escapeHtml(b.name)}</span>
        </a>`;
      } else {
        return `<a href="${this._escapeHtml(b.url)}" class="bookmark-item" title="${this._escapeHtml(b.url)}" data-idx="${i}">
          <img class="bookmark-item__favicon" src="${favicon}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23444%22/><text x=%2212%22 y=%2216%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2212%22>${b.name[0]}</text></svg>'">
          <span class="bookmark-item__name">${this._escapeHtml(b.name)}</span>
        </a>`;
      }
    }).join('');

    return `<div class="bookmark-list ${mode === 'icon' ? 'bookmark-list--icon' : 'bookmark-list--list'}">${items}</div>${addFooter}`;
  }

  onMount() {
    if (!this.element) return;
    this.element.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.dataset.idx);
        this._showBookmarkMenu(e, idx);
      });
    });
    this.element.querySelector('.bookmark-add-btn')?.addEventListener('click', () => this._showAddDialog());
  }

  getSettingsFields() {
    return [
      { key: 'displayMode', label: '表示モード', type: 'select', options: [
        { value: 'icon', label: 'アイコン' }, { value: 'list', label: 'リスト' }
      ]},
    ];
  }

  _showBookmarkMenu(e, idx) {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = e.clientY + 'px';
    menu.style.left = e.clientX + 'px';
    menu.innerHTML = `
      <div class="context-menu__item" data-action="edit"><svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> 編集</div>
      <div class="context-menu__item" data-action="up"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg> 前へ移動</div>
      <div class="context-menu__item" data-action="down"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> 次へ移動</div>
      <div class="context-menu__item" data-action="add"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 追加</div>
      <div class="context-menu__divider"></div>
      <div class="context-menu__item context-menu__item--danger" data-action="delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> 削除</div>
    `;
    menu.addEventListener('click', (ev) => {
      const action = ev.target.closest('.context-menu__item')?.dataset.action;
      menu.remove();
      if (action === 'edit') this._showEditDialog(idx);
      else if (action === 'up' && idx > 0) {
        const arr = this.config.bookmarks;
        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
        this.save(); this.updateBody();
      }
      else if (action === 'down' && idx < this.config.bookmarks.length - 1) {
        const arr = this.config.bookmarks;
        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
        this.save(); this.updateBody();
      }
      else if (action === 'add') this._showAddDialog();
      else if (action === 'delete') { this.config.bookmarks.splice(idx, 1); this.save(); this.updateBody(); }
    });
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function handler() { menu.remove(); document.removeEventListener('click', handler); }), 0);
  }

  _showAddDialog() { this._showEditDialog(-1); }

  _showEditDialog(idx) {
    const isEdit = idx >= 0;
    const bm = isEdit ? this.config.bookmarks[idx] : { name: '', url: '' };
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><span class="modal__title">${isEdit ? 'ブックマーク編集' : 'ブックマーク追加'}</span><button class="modal__close">&times;</button></div>
        <div class="modal__body">
          <div class="form-group"><label class="form-label">名前</label><input class="form-input" id="bm-name" value="${this._escapeHtml(bm.name)}"></div>
          <div class="form-group"><label class="form-label">URL</label><input class="form-input" id="bm-url" value="${this._escapeHtml(bm.url)}" placeholder="https://..."></div>
        </div>
        <div class="modal__footer"><button class="btn btn--ghost modal-cancel">キャンセル</button><button class="btn btn--primary modal-save">保存</button></div>
      </div>
    `;
    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.modal-save').addEventListener('click', () => {
      const name = overlay.querySelector('#bm-name').value.trim();
      const url = overlay.querySelector('#bm-url').value.trim();
      if (!name || !url) return;
      if (isEdit) { this.config.bookmarks[idx] = { name, url }; }
      else { if (!this.config.bookmarks) this.config.bookmarks = []; this.config.bookmarks.push({ name, url }); }
      this.save(); this.updateBody(); close();
    });
    document.body.appendChild(overlay);
  }

  getContextMenuItems() {
    return [
      { action: 'addBookmark', label: 'ブックマークを追加', icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'addBookmark') {
      this._showAddDialog();
      return true;
    }
    return super.handleContextMenuAction(action);
  }
}
WidgetTypes.bookmark = BookmarkWidget;
