/**
 * IpWidget - インターネット接続性＆グローバルIP表示ウィジェット
 */
class IpWidget extends WidgetBase {
  static widgetType = "ip";
  static defaultConfig = {
    title: "インターネット接続性",
    showV4: true,
    showV6: true,
  };

  constructor(id, config) {
    super(id, config);
    this._v4Data = null;
    this._v6Data = null;
    this._isOnline = navigator.onLine;
    this._isLoading = false;
    this._hoverTimer = null;
    this._hideTimer = null;

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
          <span style="font-size: 0.85rem; color: var(--text-tertiary);">情報を取得中...</span>
        </div>
      `;
    } else {
      const renderIpRow = (data, label) => {
        if (!data) return "";
        const { ip } = data;
        return `
          <div class="ip-row" data-type="${label === 'IPv4' ? 'v4' : 'v6'}" style="display: flex; align-items: center; gap: 10px; padding: 6px 14px; cursor: default; transition: background 0.15s ease; border-radius: var(--border-radius-sm);">
            <span style="background: var(--bg-secondary); color: var(--text-tertiary); font-size: 0.62rem; padding: 1px 5px; border-radius: 4px; font-weight: 700; min-width: 32px; text-align: center;">${label}</span>
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this._escapeHtml(ip)}
            </div>
          </div>
        `;
      };

      const showV4 = this.config.showV4 !== false;
      const showV6 = this.config.showV6 !== false;

      content = `
        <div style="display: flex; flex-direction: column; padding: 4px 6px;">
          <div style="display: flex; align-items: center; gap: 8px; margin: 6px 14px 4px;">
            <div style="color: ${statusColor}; display: flex; align-items: center; justify-content: center;">
              ${statusIcon}
            </div>
            <span style="font-weight: 700; font-size: 0.8rem; color: ${this._isOnline ? 'var(--text-primary)' : statusColor}; font-family: var(--font-sans, system-ui);">${statusText}</span>
          </div>
          ${this._isOnline ? `
            <div style="display: flex; flex-direction: column; gap: 2px;">
              ${showV4 ? renderIpRow(this._v4Data, 'IPv4') : ''}
              ${showV6 ? renderIpRow(this._v6Data, 'IPv6') : ''}
              ${((showV4 && !this._v4Data) || (showV6 && !this._v6Data)) && (this._v4Data || this._v6Data) ? '' : ( (!this._v4Data && !this._v6Data && (showV4 || showV6)) ? '<div style="font-size: 0.75rem; color: var(--text-tertiary); padding: 10px 14px;">IP情報を取得できませんでした。</div>' : '' )}
            </div>
          ` : '<div style="font-size: 0.75rem; color: var(--text-tertiary); padding: 10px 14px;">オフラインのため情報を表示できません。</div>'}
        </div>
      `;
    }

    return `
      <div style="padding: 0;">
        ${content}
      </div>
      <div style="text-align: right; padding: 2px 14px 4px; font-size: 0.55rem; color: var(--text-tertiary); opacity: 0.5;">Powered by ipinfo.io</div>
    `;
  }

  onMount() {
    // イベントリスナーの重複登録を避ける
    window.removeEventListener("online", this._handleOnline);
    window.removeEventListener("offline", this._handleOffline);
    window.addEventListener("online", this._handleOnline);
    window.addEventListener("offline", this._handleOffline);

    this._bindHovers();

    const showV4 = this.config.showV4 !== false;
    const showV6 = this.config.showV6 !== false;

    if (this._isOnline && !this._v4Data && !this._v6Data && !this._isLoading && (showV4 || showV6)) {
      this._fetchIp();
    }
  }

  onDestroy() {
    window.removeEventListener("online", this._handleOnline);
    window.removeEventListener("offline", this._handleOffline);
    this._hidePopup();
  }

  _bindHovers() {
    if (!this.element) return;
    
    const rows = this.element.querySelectorAll(".ip-row");
    rows.forEach(row => {
      row.onmouseenter = () => {
        row.style.background = "var(--bg-input)";
        clearTimeout(this._hideTimer);
        this._hoverTimer = setTimeout(() => {
          const type = row.dataset.type;
          const data = type === 'v4' ? this._v4Data : this._v6Data;
          if (data) this._showPopup(row, data, type.toUpperCase());
        }, 300);
      };
      
      row.onmouseleave = () => {
        row.style.background = "";
        clearTimeout(this._hoverTimer);
        this._hideTimer = setTimeout(() => this._hidePopup(), 300);
      };
    });
  }

  _showPopup(targetEl, data, label) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup';
      document.body.appendChild(popup);
    }

    const { ip, hostname, org, city, region, country, loc } = data;
    
    popup.innerHTML = `
      <div class="widget-popup__title" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: var(--accent-primary); color: white; font-size: 0.62rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; letter-spacing: 0.05em;">${label}</span>
          <span style="font-family: var(--font-mono, monospace); font-size: 0.9rem;">${this._escapeHtml(ip)}</span>
        </div>
        <button class="pw-copy-btn ip-popup-copy" data-ip="${this._escapeHtml(ip)}" title="IPをコピー">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
      <div class="widget-popup__body">
        <div class="stock-popup-grid" style="margin-top: 4px;">
          <div class="stock-popup-item" style="grid-column: span 2;">
            <div class="stock-popup-label">HOSTNAME</div>
            <div class="stock-popup-value" style="word-break: break-all; font-size: 0.8rem; color: var(--text-primary); font-family: var(--font-mono, monospace);">${this._escapeHtml(hostname || 'N/A')}</div>
          </div>
          <div class="stock-popup-item" style="grid-column: span 2;">
            <div class="stock-popup-label">ISP / ORGANIZATION</div>
            <div class="stock-popup-value" style="font-size: 0.8rem;">${this._escapeHtml(org || 'N/A')}</div>
          </div>
          <div class="stock-popup-item">
            <div class="stock-popup-label">LOCATION</div>
            <div class="stock-popup-value">${this._escapeHtml([city, region].filter(Boolean).join(', ') || 'N/A')}</div>
          </div>
          <div class="stock-popup-item">
            <div class="stock-popup-label">COUNTRY / COORDS</div>
            <div class="stock-popup-value">${this._escapeHtml(country || '')} ${loc ? `<span style="font-size: 0.65rem; color: var(--text-tertiary); margin-left: 4px;">(${loc})</span>` : ''}</div>
          </div>
        </div>
      </div>
    `;

    const rect = targetEl.getBoundingClientRect();
    const popupWidth = 380;
    
    let left = rect.right + 10;
    let top = rect.top;

    if (left + popupWidth > window.innerWidth) {
      left = rect.left - popupWidth - 10;
    }
    if (top + 300 > window.innerHeight) {
      top = Math.max(10, window.innerHeight - 320);
    }
    if (top < 10) top = 10;

    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.width = '380px';
    popup.classList.add('visible');

    const copyBtn = popup.querySelector('.ip-popup-copy');
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      const text = copyBtn.dataset.ip;
      try {
        await navigator.clipboard.writeText(text);
        if (typeof WidgetManager !== 'undefined' && WidgetManager._showToast) {
          WidgetManager._showToast(`コピーしました: ${text}`, 'success');
        }
        copyBtn.classList.add('pw-copy-btn--copied');
        setTimeout(() => { if (copyBtn) copyBtn.classList.remove('pw-copy-btn--copied'); }, 1500);
      } catch (err) {
        console.error("Failed to copy IP:", err);
      }
    };

    // 他のウィジェット（RSS等）と同じ形式でイベントを登録
    popup.onmouseenter = () => clearTimeout(this._hideTimer);
    popup.onmouseleave = () => {
      this._hideTimer = setTimeout(() => this._hidePopup(), 300);
    };
  }

  _hidePopup() {
    const popup = document.querySelector('.widget-popup');
    if (popup) {
      popup.classList.remove('visible');
    }
  }

  _handleOnline() {
    this._isOnline = true;
    this.updateBody();
    this._fetchIp();
  }

  _handleOffline() {
    this._isOnline = false;
    this._v4Data = null;
    this._v6Data = null;
    this.updateBody();
  }

  async _fetchIp(force = false) {
    this._isLoading = true;
    this.updateBody();

    const timestamp = force ? `&t=${Date.now()}` : '';
    const showV4 = this.config.showV4 !== false;
    const showV6 = this.config.showV6 !== false;

    try {
      const fetchPromises = [];
      if (showV4) fetchPromises.push(fetch(`https://api.ipify.org?format=json${timestamp}`).then(r => r.json()));
      else fetchPromises.push(Promise.resolve(null));

      if (showV6) fetchPromises.push(fetch(`https://api6.ipify.org?format=json${timestamp}`).then(r => r.json()));
      else fetchPromises.push(Promise.resolve(null));

      const [v4IpRes, v6IpRes] = await Promise.allSettled(fetchPromises);

      const v4Ip = (showV4 && v4IpRes.status === 'fulfilled' && v4IpRes.value) ? v4IpRes.value.ip : null;
      const v6Ip = (showV6 && v6IpRes.status === 'fulfilled' && v6IpRes.value) ? v6IpRes.value.ip : null;

      const detailPromises = [];
      const order = []; 
      
      if (v4Ip) {
        detailPromises.push(fetch(`https://ipinfo.io/${v4Ip}/json`).then(r => r.json()));
        order.push('v4');
      }
      if (v6Ip) {
        detailPromises.push(fetch(`https://ipinfo.io/${v6Ip}/json`).then(r => r.json()));
        order.push('v6');
      }

      const results = await Promise.allSettled(detailPromises);
      
      this._v4Data = null;
      this._v6Data = null;

      results.forEach((res, idx) => {
        const type = order[idx];
        const ip = (type === 'v4' ? v4Ip : v6Ip);
        if (res.status === 'fulfilled') {
          if (type === 'v4') this._v4Data = res.value;
          else this._v6Data = res.value;
        } else {
          if (type === 'v4') this._v4Data = { ip };
          else this._v6Data = { ip };
        }
      });

    } catch (error) {
      console.error("IP Fetch Error:", error);
    } finally {
      this._isLoading = false;
      this.updateBody();
    }
  }

  getSettingsFields() {
    return [
      { key: 'title', label: 'タイトル', type: 'text' },
      { key: 'showV4', label: 'IPv4を表示する', type: 'checkbox', default: true },
      { key: 'showV6', label: 'IPv6を表示する', type: 'checkbox', default: true },
    ];
  }

  getContextMenuItems() {
    return [
      {
        action: "refresh",
        label: "情報を更新",
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
