/**
 * MemoWidget - メモウィジェット
 */
class MemoWidget extends WidgetBase {
  static widgetType = 'memo';
  static defaultConfig = {
    title: 'メモ',
    memos: [{ name: 'メモ 1', content: '' }],
    activeTab: 0
  };

  renderBody() {
    const memos = this.config.memos || [{ name: 'メモ 1', content: '' }];
    const active = Math.min(this.config.activeTab || 0, memos.length - 1);

    const tabs = memos.map((m, i) => `
      <div class="memo-tab ${i === active ? 'active' : ''}" data-idx="${i}">
        <span>${this._escapeHtml(m.name)}</span>
      </div>
    `).join('') + `<div class="memo-tab-add" title="新規メモ">+</div>`;

    return `
      <div class="tabs-scroll-container">
        <button class="tabs-scroll-btn left"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="memo-tabs scrollable-tabs">${tabs}</div>
        <button class="tabs-scroll-btn right"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
      <textarea class="memo-editor" id="memo-editor-${this.id}" placeholder="ここにメモを入力...">${this._escapeHtml(memos[active]?.content || '')}</textarea>
    `;
  }

  onMount() {
    if (!this.element) return;
    const editor = this.element.querySelector(`#memo-editor-${this.id}`);
    let saveTimeout;
    editor?.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const idx = Math.min(this.config.activeTab || 0, (this.config.memos || []).length - 1);
        if (this.config.memos && this.config.memos[idx]) {
          this.config.memos[idx].content = editor.value;
          this.save();
        }
      }, 500);
    });

    this.element.querySelectorAll('.memo-tab[data-idx]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetIdx = parseInt(tab.dataset.idx);
        if (this.config.activeTab === targetIdx) return;

        // タブの表示更新
        this.element.querySelectorAll('.memo-tab[data-idx]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 設定保存
        this.config.activeTab = targetIdx;
        this.save();

        // エディタの内容更新
        const editor = this.element.querySelector(`#memo-editor-${this.id}`);
        if (editor) {
          editor.value = this.config.memos[targetIdx]?.content || '';
        }
      });

      tab.addEventListener('dblclick', (e) => {
        this._promptRename(parseInt(tab.dataset.idx));
      });

      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showTabMenu(e, parseInt(tab.dataset.idx));
      });
    });



    this.element.querySelector('.memo-tab-add')?.addEventListener('click', () => {
      this.config.memos.push({ name: `メモ ${this.config.memos.length + 1}`, content: '' });
      this.config.activeTab = this.config.memos.length - 1;
      this.save();
      this.updateBody();
    });
  }

  _promptRename(idx) {
    const name = this.config.memos[idx]?.name || '';
    const newName = prompt('メモの名前:', name);
    if (newName && newName.trim()) {
      this.config.memos[idx].name = newName.trim();
      this.save();
      this.updateBody();
    }
  }

  _showTabMenu(e, idx) {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = e.clientY + 'px';
    menu.style.left = e.clientX + 'px';
    menu.innerHTML = `
      <div class="context-menu__item" data-action="rename"><svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> 名前を変更</div>
      ${this.config.memos.length > 1 ? '<div class="context-menu__divider"></div><div class="context-menu__item context-menu__item--danger" data-action="delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> 削除</div>' : ''}
    `;

    menu.addEventListener('click', (ev) => {
      const action = ev.target.closest('.context-menu__item')?.dataset.action;
      menu.remove();
      if (action === 'rename') {
        this._promptRename(idx);
      } else if (action === 'delete') {
        if (this.config.memos.length <= 1) return;
        if (confirm(`「${this.config.memos[idx].name}」を削除してもよろしいですか？`)) {
          this.config.memos.splice(idx, 1);
          if (this.config.activeTab >= this.config.memos.length) {
            this.config.activeTab = Math.max(0, this.config.memos.length - 1);
          }
          this.save();
          this.updateBody();
        }
      }
    });

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function handler() { menu.remove(); document.removeEventListener('click', handler); }), 0);
  }

  getContextMenuItems() {
    return [
      { action: 'addMemo', label: 'メモを追加', icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
      { action: 'clearMemo', label: '現在のメモをクリア', icon: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'addMemo') {
      this.config.memos.push({ name: `メモ ${this.config.memos.length + 1}`, content: '' });
      this.config.activeTab = this.config.memos.length - 1;
      this.save();
      this.updateBody();
      return true;
    } else if (action === 'clearMemo') {
      const idx = Math.min(this.config.activeTab || 0, (this.config.memos || []).length - 1);
      if (this.config.memos && this.config.memos[idx]) {
        this.config.memos[idx].content = '';
        this.save();
        this.updateBody();
      }
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [];
  }
}
WidgetTypes.memo = MemoWidget;
