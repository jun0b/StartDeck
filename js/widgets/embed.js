/**
 * EmbedWidget - 埋め込みWebページウィジェット
 */
class EmbedWidget extends WidgetBase {
  static widgetType = 'embed';
  static defaultConfig = {
    title: '埋め込みWeb',
    url: '',
    height: 300
  };

  renderBody() {
    const url = this.config.url || '';
    const height = this.config.height || 300;

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

    return `
      <div class="embed-body">
        <iframe src="${this._escapeHtml(url)}" style="height:${height}px" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" loading="lazy"></iframe>
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
      { key: 'height', label: '高さ (px)', type: 'number', min: 100, max: 800 },
      { key: '_info', label: '', type: 'info', content: '※一部のWebサイト（Google検索画面など）は、セキュリティ上の理由から埋め込みがブロックされます。' }
    ];
  }
}
WidgetTypes.embed = EmbedWidget;
