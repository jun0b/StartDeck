/**
 * TopSitesWidget - よく見るサイト自動取得ウィジェット
 */
class TopSitesWidget extends WidgetBase {
  static widgetType = 'top-sites';
  static defaultConfig = {
    title: 'よく見るサイト',
    maxItems: 8,
    displayMode: 'icon' // 'icon' (grid) or 'list'
  };

  constructor(id, config) {
    super(id, config);
    this.sites = [];
    this.isLoaded = false;
    this.error = null;
  }

  renderBody() {
    if (!this.isLoaded) {
      return `<div class="empty-state" style="padding: 24px;">読み込み中...</div>`;
    }

    if (this.error) {
      return `<div class="empty-state" style="padding: 24px;"><div style="color: var(--accent-danger);">${this.error}</div></div>`;
    }

    if (this.sites.length === 0) {
      return `
        <div class="empty-state" style="padding: 24px;">
          <div style="font-size: 0.85rem; color: var(--text-secondary);">取得できるサイトがありません</div>
        </div>`;
    }

    const mode = this.config.displayMode || 'icon';
    const itemsHtml = this.sites.map(site => {
      let favicon;
      try {
        const u = new URL(chrome.runtime.getURL("/_favicon/"));
        u.searchParams.set("pageUrl", site.url);
        u.searchParams.set("size", "64");
        favicon = u.toString();
      } catch {
        favicon = "";
      }
      
      const fallback = site.title ? site.title[0].toUpperCase() : '?';
      const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23444%22/><text x=%2212%22 y=%2216%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2212%22>${fallback}</text></svg>`;

      return `
        <a href="${this._escapeHtml(site.url)}" 
           class="bookmark-item ${mode === 'icon' ? 'bookmark-item--icon' : ''}" 
           title="${this._escapeHtml(site.title || site.url)}">
          <img class="bookmark-item__favicon" src="${favicon}" alt="" loading="lazy" 
               data-fallback="${fallbackSvg}" 
               onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}">
          <span class="bookmark-item__name">${this._escapeHtml(site.title || site.url)}</span>
        </a>`;
    }).join('');

    return `
      <div class="bookmark-list ${mode === 'icon' ? 'bookmark-list--icon' : 'bookmark-list--list'}">
        ${itemsHtml}
      </div>`;
  }

  onMount() {
    if (!this.isLoaded) {
      this._fetchTopSites();
    }
  }

  async _fetchTopSites() {
    if (typeof chrome === 'undefined' || !chrome.topSites) {
      this.error = '権限を反映させるため、chrome://extensions/ から拡張機能をリロードしてください。';
      this.isLoaded = true;
      this.updateBody();
      return;
    }

    chrome.topSites.get((data) => {
      if (chrome.runtime.lastError) {
        this.error = chrome.runtime.lastError.message;
      } else {
        const max = this.config.maxItems || 8;
        this.sites = (data || []).slice(0, max);
        this.error = null;
      }
      this.isLoaded = true;
      this.updateBody();
    });
  }

  getSettingsFields() {
    return [
      { key: 'maxItems', label: '表示件数', type: 'number', min: 1, max: 20 },
      { key: 'displayMode', label: '表示モード', type: 'select', options: [
        { value: 'icon', label: 'アイコン（グリッド）' },
        { value: 'list', label: 'リスト' }
      ]},
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'refresh') {
      this.isLoaded = false;
      this.updateBody();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getContextMenuItems() {
    return [
      { action: 'refresh', label: '更新', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }
}

WidgetTypes['top-sites'] = TopSitesWidget;
