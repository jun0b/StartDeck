/**
 * TabManagerWidget - タブ休止 / メモリ解放ウィジェット
 */
class TabManagerWidget extends WidgetBase {
  static widgetType = 'tab-manager';
  static defaultConfig = {
    title: 'タブマネージャー',
  };

  constructor(id, config) {
    super(id, config);
    this._tabCount = 0;
    this._discardedCount = 0;
    this._timer = null;
    this._listeners = {};
    this._selectedTabIds = new Set();
  }

  renderBody() {
    return `
      <div class="tab-manager-body">
        <div class="tab-manager__stats">
          <div class="tab-manager__stat">
            <span class="tab-manager__label">開いているタブ</span>
            <span class="tab-manager__value" id="tab-total-count-${this.id}">-</span>
          </div>
          <div class="tab-manager__stat">
            <span class="tab-manager__label">休止中のタブ</span>
            <span class="tab-manager__value" id="tab-discarded-count-${this.id}">-</span>
          </div>
        </div>
        <div class="tab-manager__actions" style="display:flex;gap:8px">
          <button class="btn btn--primary" id="btn-discard-tabs-${this.id}" style="flex:1" title="作業中以外のタブを休止状態にしてメモリを節約します。">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            一括メモリ解放
          </button>
          <button class="btn btn--ghost" id="btn-show-tabs-${this.id}" title="タブごとの詳細情報と個別管理を表示します。">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            タブ詳細
          </button>
        </div>
      </div>
    `;
  }

  onMount() {
    this._updateStats();
    
    // イベントリスナー
    this.element?.querySelector(`#btn-discard-tabs-${this.id}`)?.addEventListener('click', () => this._discardTabs());
    this.element?.querySelector(`#btn-show-tabs-${this.id}`)?.addEventListener('click', () => this._showTabListDialog());

    // ブラウザのタブイベントを監視
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      this._setupTabListeners();
    }

    this._timer = setInterval(() => this._updateStats(), 30000);
  }

  onDestroy() {
    if (this._timer) clearInterval(this._timer);
    this._removeTabListeners();
  }

  _setupTabListeners() {
    const updateHandler = () => this._updateStats();
    this._listeners = {
      onCreated: updateHandler,
      onRemoved: updateHandler,
      onUpdated: (tabId, changeInfo) => {
        if (changeInfo.status === 'complete' || changeInfo.discarded !== undefined) {
          updateHandler();
        }
      }
    };
    chrome.tabs.onCreated.addListener(this._listeners.onCreated);
    chrome.tabs.onRemoved.addListener(this._listeners.onRemoved);
    chrome.tabs.onUpdated.addListener(this._listeners.onUpdated);
  }

  _removeTabListeners() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    if (this._listeners.onCreated) chrome.tabs.onCreated.removeListener(this._listeners.onCreated);
    if (this._listeners.onRemoved) chrome.tabs.onRemoved.removeListener(this._listeners.onRemoved);
    if (this._listeners.onUpdated) chrome.tabs.onUpdated.removeListener(this._listeners.onUpdated);
  }

  handleContextMenuAction(action) {
    return super.handleContextMenuAction(action);
  }

  async _updateStats() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    try {
      const allTabs = await chrome.tabs.query({});
      this._tabCount = allTabs.length;
      this._discardedCount = allTabs.filter(t => t.discarded).length;

      const totalEl = this.element?.querySelector(`#tab-total-count-${this.id}`);
      const discEl = this.element?.querySelector(`#tab-discarded-count-${this.id}`);

      if (totalEl) totalEl.textContent = this._tabCount;
      if (discEl) discEl.textContent = this._discardedCount;
      
      const listContainer = document.querySelector('#tab-list-container');
      if (listContainer) {
        this._renderTabList(listContainer);
      }
    } catch (e) {
      console.error('Failed to update tab stats:', e);
    }
  }

  async _discardTabs() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    const btn = this.element?.querySelector(`#btn-discard-tabs-${this.id}`);
    const originalContent = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '解放中...';
    }

    try {
      const tabs = await chrome.tabs.query({ active: false, discarded: false });
      let count = 0;
      for (const tab of tabs) {
        try {
          await chrome.tabs.discard(tab.id);
          count++;
        } catch (err) {}
      }

      if (typeof WidgetManager !== 'undefined') {
        WidgetManager._showToast(`${count}個のタブを休止しました`, 'success');
      }
    } catch (e) {
      console.error('Failed to discard tabs:', e);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
      this._updateStats();
    }
  }

  async _showTabListDialog() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    this._selectedTabIds.clear();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width:550px; max-width:95vw;">
        <div class="modal__header">
          <span class="modal__title">開いているタブの一覧</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="tab-list-toolbar" style="padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);">
          <label class="checkbox-container" style="display:flex; align-items:center; cursor:pointer; font-size:0.85rem; user-select:none;">
            <input type="checkbox" id="btn-toggle-select-all" style="margin-right:8px; width:16px; height:16px;">
            全選択
          </label>
          <div style="flex:1"></div>
          <button class="btn btn--primary btn--small" id="btn-batch-discard" disabled style="padding: 4px 10px; font-size:0.75rem;">選択中を解放</button>
          <button class="btn btn--danger btn--small" id="btn-batch-close" disabled style="padding: 4px 10px; font-size:0.75rem;">選択中を閉じる</button>
        </div>
        <div class="modal__body" style="max-height:450px; overflow-y:auto; overscroll-behavior:contain; padding:0;">
          <div id="tab-list-container" class="tab-list">
            <div style="padding:20px; text-align:center; color:var(--text-tertiary);">読み込み中...</div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary modal-close-btn">閉じる</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this._updateStats(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // 全選択トグルの制御
    const selectAllCheck = overlay.querySelector('#btn-toggle-select-all');
    selectAllCheck.addEventListener('change', async (e) => {
      const tabs = await chrome.tabs.query({});
      const currentTabId = (await chrome.tabs.getCurrent())?.id;
      
      if (e.target.checked) {
        tabs.forEach(t => {
          if (!t.active && t.id !== currentTabId) this._selectedTabIds.add(t.id);
        });
      } else {
        this._selectedTabIds.clear();
      }
      this._renderTabList(overlay.querySelector('#tab-list-container'));
      this._updateBatchButtonStates(overlay);
    });

    // 一括操作ボタン
    overlay.querySelector('#btn-batch-discard').addEventListener('click', async () => {
      let count = 0;
      for (const id of this._selectedTabIds) {
        try { await chrome.tabs.discard(id); count++; } catch(err) {}
      }
      this._selectedTabIds.clear();
      selectAllCheck.checked = false;
      this._updateStats();
      WidgetManager._showToast(`${count}個のタブを解放しました`, 'success');
    });

    overlay.querySelector('#btn-batch-close').addEventListener('click', async () => {
      if (confirm(`選択した ${this._selectedTabIds.size} 個のタブを閉じますか？`)) {
        await chrome.tabs.remove(Array.from(this._selectedTabIds));
        this._selectedTabIds.clear();
        selectAllCheck.checked = false;
        this._updateStats();
      }
    });

    document.body.appendChild(overlay);
    this._renderTabList(overlay.querySelector('#tab-list-container'));
  }

  _updateBatchButtonStates(overlay) {
    const hasSelection = this._selectedTabIds.size > 0;
    overlay.querySelector('#btn-batch-discard').disabled = !hasSelection;
    overlay.querySelector('#btn-batch-close').disabled = !hasSelection;
  }

  async _renderTabList(container) {
    if (!container) return;

    try {
      const tabs = await chrome.tabs.query({});
      const currentTabId = (await chrome.tabs.getCurrent())?.id;

      if (tabs.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-tertiary);">タブがありません。</div>';
        return;
      }

      container.innerHTML = tabs.map(tab => {
        const isCurrent = tab.id === currentTabId || tab.active;
        const isSelected = this._selectedTabIds.has(tab.id);
        const iconStyle = tab.discarded ? 'filter: grayscale(1); opacity: 0.6;' : '';
        const titleColor = tab.discarded ? 'var(--text-tertiary)' : 'var(--text-primary)';
        const statusBadge = tab.discarded ? '<span class="tab-badge tab-badge--discarded">休止中</span>' : (isCurrent ? '<span class="tab-badge tab-badge--active">アクティブ</span>' : '');

        return `
          <div class="tab-item ${tab.discarded ? 'tab-item--discarded' : ''} ${isSelected ? 'selected' : ''}" data-tab-id="${tab.id}" data-window-id="${tab.windowId}">
            <div class="tab-item__select" style="padding-right:8px; display:flex; align-items:center;">
              ${!isCurrent ? `<input type="checkbox" class="tab-checkbox" ${isSelected ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">` : '<div style="width:16px"></div>'}
            </div>
            <div class="tab-item__icon" style="cursor:pointer">
              <img src="${tab.favIconUrl || 'icons/icon16.png'}" style="width:16px;height:16px;${iconStyle}">
            </div>
            <div class="tab-item__content" style="cursor:pointer">
              <div class="tab-item__top">
                <span class="tab-item__title" style="color:${titleColor}" title="${this._escapeHtml(tab.title)}">${this._escapeHtml(tab.title)}</span>
                ${statusBadge}
              </div>
              <div class="tab-item__bottom">
                <span class="tab-item__url">${this._escapeHtml(this._getHostname(tab.url))}</span>
              </div>
            </div>
            <div class="tab-item__actions">
              ${(!tab.discarded && !isCurrent) ? `<button class="btn-icon" data-action="discard" title="メモリ解放" style="color:var(--accent-light)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              </button>` : ''}
              ${!isCurrent ? `<button class="btn-icon btn-icon--danger" data-action="close" title="このタブを閉じる">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      // イベント紐づけ
      container.querySelectorAll('.tab-item').forEach(item => {
        const tabId = parseInt(item.dataset.tabId);
        const windowId = parseInt(item.dataset.windowId);
        
        // タブへのジャンプ（アイコンと内容部分）
        const jumpTarget = item.querySelector('.tab-item__content, .tab-item__icon');
        jumpTarget?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await chrome.tabs.update(tabId, { active: true });
          await chrome.windows.update(windowId, { focused: true });
        });

        // チェックボックス
        const checkbox = item.querySelector('.tab-checkbox');
        checkbox?.addEventListener('change', (e) => {
          if (e.target.checked) this._selectedTabIds.add(tabId);
          else this._selectedTabIds.delete(tabId);
          this._updateBatchButtonStates(container.closest('.modal'));
        });

        item.querySelector('[data-action="discard"]')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await chrome.tabs.discard(tabId);
        });

        item.querySelector('[data-action="close"]')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await chrome.tabs.remove(tabId);
        });
      });
      
    } catch (e) {
      console.error('Failed to render tab list:', e);
      container.innerHTML = `<div style="padding:20px; color:var(--accent-red);">読み込みエラーが発生しました。</div>`;
    }
  }

  _getHostname(url) {
    try {
      return new URL(url).hostname || url;
    } catch (e) {
      return url;
    }
  }
}
WidgetTypes['tab-manager'] = TabManagerWidget;
