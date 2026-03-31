/**
 * IpWidget - インターネット接続性＆グローバルIP表示ウィジェット
 */
class IpWidget extends WidgetBase {
  static widgetType = "ip";
  static defaultConfig = {
    title: "インターネット接続性",
  };

  constructor(id, config) {
    super(id, config);
    this._ipv4 = null;
    this._ipv6 = null;
    this._isOnline = navigator.onLine;
    this._isLoading = false;

    // イベントリスナーをバインド
    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
  }

  renderBody() {
    const statusColor = this._isOnline ? "var(--accent-success)" : "var(--accent-danger)";
    const statusText = this._isOnline ? "接続中" : "オフライン";
    const statusIcon = this._isOnline
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>';

    let content = "";
    if (this._isLoading) {
      content = `
        <div style="display: flex; align-items: center; padding: 12px 14px; gap: 10px;">
          <div style="width: 14px; height: 14px; border: 2px solid var(--border-color); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; box-sizing: border-box;"></div>
          <span style="font-size: 0.85rem; color: var(--text-tertiary);">取得中...</span>
        </div>
      `;
    } else {
      const displayV4 = `
        <div class="ip-copy-text" data-ip="${this._escapeHtml(this._ipv4 || '')}" title="クリックしてIPv4をコピー" style="cursor: pointer; transition: color 0.2s ease;">
          <span style="color: var(--text-tertiary); font-weight: 700; margin-right: 4px; font-size: 0.75rem;">IPv4:</span>${this._ipv4 ? this._escapeHtml(this._ipv4) : '取得失敗'}
        </div>
      `;

      const displayV6 = this._ipv6 ? `
        <div class="ip-copy-text" data-ip="${this._escapeHtml(this._ipv6)}" title="クリックしてIPv6をコピー" style="cursor: pointer; transition: color 0.2s ease;">
          <span style="color: var(--text-tertiary); font-weight: 700; margin-right: 4px; font-size: 0.75rem;">IPv6:</span>${this._escapeHtml(this._ipv6)}
        </div>
      ` : '';

      content = `
        <div style="display: flex; flex-direction: column; padding: 12px 24px; gap: 6px; font-family: var(--font-mono, monospace); font-size: 0.8rem; line-height: 1.4;">
          <div style="display: flex; align-items: center; gap: 10px; margin-left: -4px;">
            <div style="color: ${statusColor}; display: flex; align-items: center; justify-content: center;">
              ${statusIcon}
            </div>
            <span style="font-weight: 600; font-size: 0.85rem; color: ${this._isOnline ? 'var(--text-primary)' : statusColor}; white-space: nowrap; font-family: var(--font-sans, system-ui);">${statusText}:</span>
          </div>
          ${this._isOnline ? `
            <div style="display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
              ${displayV4}
              ${displayV6}
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div style="padding: 2px 0;">
        ${content}
      </div>
      <div style="text-align: right; padding: 4px 14px 0; font-size: 0.65rem; color: var(--text-tertiary); opacity: 0.8;">Powered by ipify.org</div>
    `;
  }

  onMount() {
    window.addEventListener("online", this._handleOnline);
    window.addEventListener("offline", this._handleOffline);

    this._bindEvents();

    if (this._isOnline && !this._ipv4 && !this._ipv6 && !this._isLoading) {
      this._fetchIp();
    }
  }

  onDestroy() {
    window.removeEventListener("online", this._handleOnline);
    window.removeEventListener("offline", this._handleOffline);
  }

  _bindEvents() {
    if (!this.element) return;
    
    // IPをクリックした時にコピーする機能を追加
    const copyElements = this.element.querySelectorAll(".ip-copy-text");
    copyElements.forEach(el => {
      el.addEventListener("click", async () => {
        const ip = el.dataset.ip;
        if (!ip) return;
        try {
          await navigator.clipboard.writeText(ip);
          
          // トースト通知を表示 (WidgetManagerのユーティリティを利用)
          if (typeof WidgetManager !== 'undefined' && WidgetManager._showToast) {
            WidgetManager._showToast(`コピーしました: ${ip}`, 'success');
          }
          
          // 一時的に色を変えてフィードバック
          const originalColor = el.style.color;
          el.style.color = 'var(--accent-success)';
          setTimeout(() => { if (el) el.style.color = originalColor; }, 1000);
          
        } catch (err) {
          console.error("Failed to copy IP:", err);
        }
      });
      
      // ホバー時の演出
      el.addEventListener("mouseenter", () => { el.style.color = 'var(--text-primary)'; });
      el.addEventListener("mouseleave", () => { el.style.color = ''; });
    });
  }

  _handleOnline() {
    this._isOnline = true;
    this.updateBody();
    this._fetchIp();
  }

  _handleOffline() {
    this._isOnline = false;
    this.updateBody();
  }

  async _fetchIp(force = false) {
    this._isLoading = true;
    this.updateBody();

    const timestamp = force ? `&t=${Date.now()}` : '';

    try {
      // IPv4とIPv6をそれぞれ独立して取得
      const [v4Res, v6Res] = await Promise.allSettled([
        fetch(`https://api.ipify.org?format=json${timestamp}`).then(r => r.json()),
        fetch(`https://api6.ipify.org?format=json${timestamp}`).then(r => r.json())
      ]);

      this._ipv4 = v4Res.status === 'fulfilled' ? v4Res.value.ip : null;
      this._ipv6 = v6Res.status === 'fulfilled' ? v6Res.value.ip : null;

    } catch (error) {
      console.error("IP Fetch Error:", error);
      this._ipv4 = null;
      this._ipv6 = null;
    } finally {
      this._isLoading = false;
      this.updateBody();
    }
  }

  getContextMenuItems() {
    return [
      {
        action: "refresh",
        label: "IPを再取得",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
      },
      { divider: true },
      ...super.getContextMenuItems(),
    ];
  }

  handleContextMenuAction(action) {
    if (action === "refresh") {
      if (this._isOnline && !this._isLoading) {
        this._fetchIp(true);
      }
      return true;
    }
    return super.handleContextMenuAction(action);
  }
}

WidgetTypes.ip = IpWidget;
