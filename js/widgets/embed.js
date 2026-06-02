/**
 * EmbedWidget - 埋め込みWebページウィジェット
 */
class EmbedWidget extends WidgetBase {
  static widgetType = 'embed';
  static defaultConfig = {
    title: '埋め込みWeb',
    url: '',
    height: 300,
    zoom: 100,
    bgColor: '#ffffff',
    bgOpacity: 0
  };

  _getBgColorStyle(hex, opacity) {
    if (!hex || !hex.startsWith('#')) return 'transparent';
    if (hex.length === 7) {
      const r = parseInt(hex.substring(1, 3), 16);
      const g = parseInt(hex.substring(3, 5), 16);
      const b = parseInt(hex.substring(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  }

  renderBody() {
    const url = this.config.url || '';
    const height = this.config.height || 300;
    const zoomLevel = this.config.zoom ?? 100;
    const scale = zoomLevel / 100;
    const bgColor = this.config.bgColor || '#ffffff';
    const bgOpacity = this.config.bgOpacity ?? 0;

    if (!url) {
      return `
        <div class="embed-placeholder">
          <div class="embed-placeholder__icon">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <span>URLが設定されていません</span>
          <span style="font-size:0.72rem;color:var(--text-tertiary)">設定からURLを入力してください</span>
        </div>`;
    }

    const bgStyle = this._getBgColorStyle(bgColor, bgOpacity / 100);

    return `
      <div class="embed-body" style="height: ${height}px; background-color: ${bgStyle}; overflow: hidden; position: relative; border-radius: var(--radius-md, 8px);">
        <iframe src="${this._escapeHtml(url)}" style="width: ${100 / scale}%; height: ${100 / scale}%; transform: scale(${scale}); transform-origin: 0 0; border: none; background: transparent; position: absolute; top: 0; left: 0;" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" loading="lazy"></iframe>
      </div>`;
  }

  getContextMenuItems() {
    return [
      { action: 'refresh', label: '再読み込み', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'refresh') {
      this.updateBody();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'url', label: '埋め込みURL', type: 'text', placeholder: 'https://example.com' },
      { key: 'height', label: '高さ (px)', type: 'number', min: 100, max: 800, step: 10 },
      { key: 'zoom', label: '拡大率 (%)', type: 'number', min: 10, max: 500, step: 10 },
      { key: 'bgColor', label: '背景色', type: 'color' },
      { key: 'bgOpacity', label: '背景透明度 (%)', type: 'number', min: 0, max: 100, step: 1 },
      { key: '_info', label: '', type: 'info', content: '※一部のWebサイト（Google検索画面など）は、セキュリティ上の理由から埋め込みがブロックされます。' }
    ];
  }
}
WidgetTypes.embed = EmbedWidget;
