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
    this._latency = null;
    this._latencyLastUpdate = null;
    this._isLatencyLoading = false;
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
            ${this._isOnline ? `
              <div class="latency-container" style="margin-left: auto; display: flex; align-items: center; gap: 6px; cursor: help; padding: 2px 4px; border-radius: 4px; transition: background 0.2s;">
                <span id="latency-val-${this.id}" style="font-size: 0.7rem; color: var(--text-tertiary); font-family: var(--font-mono, monospace);">${this._latency ? `${this._latency}ms` : (this._isLatencyLoading ? '...' : '--')}</span>
                <button class="latency-refresh-btn" id="latency-refresh-${this.id}" title="レイテンシを再計測" style="border: none; background: none; padding: 2px; cursor: pointer; color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; opacity: 0.6; transition: all 0.2s; border-radius: 4px;">
                  <svg class="${this._isLatencyLoading ? 'spinning' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="${this._isLatencyLoading ? 'animation: spin 1s linear infinite;' : ''}"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              </div>
            ` : ''}
          </div>
          ${this._isOnline ? `
            <div style="display: flex; flex-direction: column; gap: 2px;">
              ${showV4 ? renderIpRow(this._v4Data, 'IPv4') : ''}
              ${showV6 ? renderIpRow(this._v6Data, 'IPv6') : ''}
              ${((showV4 && !this._v4Data) || (showV6 && !this._v6Data)) && (this._v4Data || this._v6Data) ? '' : ( (!this._v4Data && !this._v6Data && (showV4 || showV6)) ? '<div style="font-size: 0.75rem; color: var(--text-tertiary); padding: 10px 14px;">IP情報を取得できませんでした。</div>' : '' )}
            </div>
            <div style="padding: 6px 14px 4px;">
              <button class="btn btn--ghost btn--sm speed-test-btn" id="speed-test-${this.id}" style="width: 100%; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                スピードテストを実行
              </button>
            </div>
          ` : '<div style="font-size: 0.75rem; color: var(--text-tertiary); padding: 10px 14px;">オフラインのため情報を表示できません。</div>'}
        </div>
      `;
    }

    return `
      <div style="padding: 0;">
        ${content}
      </div>
      </div>
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

    const testBtn = this.element.querySelector(`#speed-test-${this.id}`);
    if (testBtn) {
      testBtn.onclick = () => this._showSpeedTestModal();
    }

    const latencyBtn = this.element.querySelector(`#latency-refresh-${this.id}`);
    if (latencyBtn) {
      latencyBtn.onclick = (e) => {
        e.stopPropagation();
        this._fetchLatency();
      };
      latencyBtn.onmouseenter = () => { latencyBtn.style.opacity = '1'; latencyBtn.style.background = 'var(--bg-secondary)'; };
      latencyBtn.onmouseleave = () => { if (!this._isLatencyLoading) { latencyBtn.style.opacity = '0.6'; latencyBtn.style.background = 'none'; } };
    }

    if (this._isOnline && this._latency === null && !this._isLatencyLoading) {
      // 起動直後のCPU負荷による誤差を防ぐため、少し待ってから計測を開始する
      setTimeout(() => {
        if (this.element && this._latency === null && !this._isLatencyLoading) {
          this._fetchLatency();
        }
      }, 2500);
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

    const latencyContainer = this.element.querySelector(".latency-container");
    if (latencyContainer) {
      latencyContainer.onmouseenter = () => {
        latencyContainer.style.background = "var(--bg-secondary)";
        clearTimeout(this._hideTimer);
        this._hoverTimer = setTimeout(() => {
          if (this._latency) this._showLatencyPopup(latencyContainer);
        }, 300);
      };
      latencyContainer.onmouseleave = () => {
        latencyContainer.style.background = "";
        clearTimeout(this._hoverTimer);
        this._hideTimer = setTimeout(() => this._hidePopup(), 300);
      };
    }
  }

  _showLatencyPopup(targetEl) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup widget-popup--ip';
      document.body.appendChild(popup);
    } else {
      popup.className = 'widget-popup widget-popup--ip';
    }

    const lastUpdateStr = this._latencyLastUpdate ? this._latencyLastUpdate.toLocaleTimeString() : 'N/A';
    
    let quality = '普通';
    let qualityColor = 'var(--text-secondary)';
    if (this._latency < 30) { quality = '極めて良好'; qualityColor = 'var(--accent-success)'; }
    else if (this._latency < 60) { quality = '良好'; qualityColor = 'var(--accent-primary)'; }
    else if (this._latency > 150) { quality = '遅延あり'; qualityColor = 'var(--accent-danger)'; }

    popup.innerHTML = `
      <div class="widget-popup__title" style="display: flex; align-items: center; gap: 10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style="font-weight: 700; font-size: 0.9rem;">ネットワーク遅延 (Ping)</span>
      </div>
      <div class="widget-popup__body">
        <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; padding: 4px 0;">
          <span style="font-size: 2rem; font-weight: 800; font-family: var(--font-mono, monospace); line-height: 1;">${this._latency}</span>
          <span style="color: var(--text-tertiary); font-size: 0.8rem;">ms</span>
          <span style="margin-left: auto; font-size: 0.75rem; font-weight: 700; color: ${qualityColor}">${quality}</span>
        </div>
        
        <div class="stock-popup-grid">
          <div class="stock-popup-item" style="grid-column: span 2;">
            <div class="stock-popup-label">宛先サーバー / サービス</div>
            <div class="stock-popup-value" style="font-size: 0.8rem;">Cloudflare Edge (1.1.1.1)</div>
          </div>
          <div class="stock-popup-item">
            <div class="stock-popup-label">計測方法</div>
            <div class="stock-popup-value">HTTPS HEAD</div>
          </div>
          <div class="stock-popup-item">
            <div class="stock-popup-label">最終更新</div>
            <div class="stock-popup-value">${lastUpdateStr}</div>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 0.7rem; color: var(--text-tertiary); line-height: 1.4; padding-top: 8px; border-top: 1px solid var(--border-color);">
          この値は、あなたのデバイスから各サービスへの応答速度を示します。数値が小さいほど、ウェブサイトの読み込みやオンライン通話が快適になります。
        </div>
      </div>
    `;

    this._positionPopup(targetEl, popup, 320);
    popup.classList.add('visible');

    popup.onmouseenter = () => clearTimeout(this._hideTimer);
    popup.onmouseleave = () => {
      this._hideTimer = setTimeout(() => this._hidePopup(), 300);
    };
  }

  _showPopup(targetEl, data, label) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup widget-popup--ip';
      document.body.appendChild(popup);
    } else {
      popup.className = 'widget-popup widget-popup--ip';
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
        <div style="margin-top: 12px; font-size: 0.55rem; color: var(--text-tertiary); opacity: 0.5; text-align: right; padding-top: 4px; border-top: 1px solid var(--border-color);">Powered by ipinfo.io</div>
      </div>
    `;

    this._positionPopup(targetEl, popup, 380);
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
      popup.classList.remove('widget-popup--ip');
    }
  }

  _handleOnline() {
    this._isOnline = true;
    this.updateBody();
    this._fetchIp();
    this._fetchLatency();
  }

  _handleOffline() {
    this._isOnline = false;
    this._v4Data = null;
    this._v6Data = null;
    this._latency = null;
    this.updateBody();
  }

  async _fetchLatency() {
    if (!this._isOnline || this._isLatencyLoading) return;
    
    this._isLatencyLoading = true;
    const latencyVal = this.element.querySelector(`#latency-val-${this.id}`);
    const latencyIcon = this.element.querySelector(`#latency-refresh-${this.id} svg`);
    if (latencyVal) latencyVal.textContent = '...';
    if (latencyIcon) latencyIcon.style.animation = 'spin 1s linear infinite';

    try {
      // 複数の大手CDNへのHEADリクエストで平均的なレイテンシを計測（キャッシュ回避）
      const start = performance.now();
      await fetch("https://1.1.1.1/cdn-cgi/trace", { mode: 'no-cors', cache: 'no-store' });
      this._latency = Math.round(performance.now() - start);
      this._latencyLastUpdate = new Date();
    } catch (error) {
      console.error("Latency Fetch Error:", error);
      this._latency = null;
    } finally {
      this._isLatencyLoading = false;
      this.updateBody();
    }
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

  /* --- Speed Test logic --- */

  _showSpeedTestModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    overlay.innerHTML = `
      <div class="modal" style="width: 480px; max-width: 95%; overflow: hidden; display: flex; flex-direction: column;">
        <div class="modal__header">
          <span class="modal__title">スピードテスト (M-Lab)</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body" style="padding: 24px; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div id="st-status-${this.id}" style="font-size: 0.9rem; color: var(--text-tertiary); margin-bottom: 20px;">サーバーを探索中...</div>
          
          <div class="speed-meter-container" style="position: relative; width: 140px; height: 140px; margin-bottom: 20px;">
            <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-secondary)" stroke-width="8"></circle>
              <circle id="st-progress-bar-${this.id}" cx="50" cy="50" r="45" fill="none" stroke="var(--accent-primary)" stroke-width="8" stroke-dasharray="283" stroke-dashoffset="283" style="transition: stroke-dashoffset 0.1s linear;"></circle>
            </svg>
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div id="st-current-val-${this.id}" style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-mono, monospace); line-height: 1;">0</div>
              <div id="st-current-unit-${this.id}" style="font-size: 0.75rem; color: var(--text-tertiary);">Mbps</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; width: 100%; margin-top: 10px;">
            <div style="text-align: center;">
              <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 4px;">Latency</div>
              <div id="st-ping-${this.id}" style="font-size: 1.1rem; font-weight: 600; font-family: var(--font-mono, monospace);">-</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 4px;">Download</div>
              <div id="st-down-${this.id}" style="font-size: 1.1rem; font-weight: 600; font-family: var(--font-mono, monospace); color: var(--accent-primary);">-</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 4px;">Upload</div>
              <div id="st-up-${this.id}" style="font-size: 1.1rem; font-weight: 600; font-family: var(--font-mono, monospace); color: var(--accent-success);">-</div>
            </div>
          </div>

          <div id="st-server-${this.id}" style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 24px; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
          <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-top: 8px; text-align: center; opacity: 0.7;">※計測中にタブを切り替えると、正常に測定できない場合があります。</div>
        </div>
        <div class="modal__footer" style="display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 0.6rem; color: var(--text-tertiary); opacity: 0.7;">Powered by M-Lab NDT7 API</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn--ghost modal-close-btn" style="min-width: 80px;">キャンセル</button>
            <button id="st-retry-btn-${this.id}" class="btn btn--primary" style="display: none; min-width: 80px;">再試行</button>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      this._abortTest();
      overlay.remove();
    };
    overlay.querySelector('.modal__close').onclick = close;
    overlay.querySelector('.modal-close-btn').onclick = close;
    
    document.body.appendChild(overlay);

    this._startTest(overlay);
  }

  _abortTest() {
    if (this._speedTestWS) {
      this._speedTestWS.onmessage = null;
      this._speedTestWS.onerror = null;
      this._speedTestWS.onclose = null;
      this._speedTestWS.close();
      this._speedTestWS = null;
    }
  }

  async _startTest(modal) {
    const status = modal.querySelector(`#st-status-${this.id}`);
    const pingEl = modal.querySelector(`#st-ping-${this.id}`);
    const downEl = modal.querySelector(`#st-down-${this.id}`);
    const upEl = modal.querySelector(`#st-up-${this.id}`);
    const serverEl = modal.querySelector(`#st-server-${this.id}`);
    const curVal = modal.querySelector(`#st-current-val-${this.id}`);
    const curUnit = modal.querySelector(`#st-current-unit-${this.id}`);
    const progressBar = modal.querySelector(`#st-progress-bar-${this.id}`);
    const retryBtn = modal.querySelector(`#st-retry-btn-${this.id}`);
    const closeBtn = modal.querySelector('.modal-close-btn');

    const updateProgress = (val, max = 100) => {
      const percent = Math.min(100, (val / max) * 100);
      const offset = 283 - (283 * percent) / 100;
      progressBar.style.strokeDashoffset = offset;
    };

    const setVal = (v) => { curVal.textContent = v > 100 ? Math.round(v) : v.toFixed(1); };

    try {
      status.textContent = '最適なサーバーを選択中...';
      const locateRes = await fetch('https://locate.measurementlab.net/v2/nearest/ndt/ndt7');
      if (!locateRes.ok) throw new Error('サーバーの取得に失敗しました');
      const locateData = await locateRes.json();
      const server = locateData.results[0];
      const wsUrl = server.urls['wss:///ndt/v7/download'];
      
      serverEl.textContent = `Server: ${server.location.city}, ${server.location.country} (${server.machine})`;

      // --- Ping (Simple fetch) ---
      status.textContent = 'レイテンシを計測中...';
      const startPing = performance.now();
      await fetch(`https://${server.machine}/ndt/v7/download?bytes=0`, { mode: 'no-cors' });
      const ping = Math.round(performance.now() - startPing);
      pingEl.textContent = `${ping}ms`;

      // --- Download (ndt7 WebSocket) ---
      status.textContent = 'ダウンロード計測中...';
      curUnit.textContent = 'Mbps';
      
      const downloadResult = await new Promise((resolve, reject) => {
        let startTime = null;
        let totalBytes = 0;
        let lastReportTime = 0;

        const ws = new WebSocket(wsUrl, 'net.measurementlab.ndt.v7');
        ws.binaryType = 'arraybuffer';
        this._speedTestWS = ws;
        
        ws.onopen = () => { startTime = performance.now(); };
        ws.onmessage = (e) => {
          if (typeof e.data === 'string') return; // Ignore JSON reports
          if (!startTime) startTime = performance.now();
          
          totalBytes += e.data.byteLength;
          const now = performance.now();
          const duration = (now - startTime) / 1000;
          
          if (duration > 0 && now - lastReportTime > 100) {
            const mbps = (totalBytes * 8) / (duration * 1000000);
            if (!isNaN(mbps)) {
              setVal(mbps);
              updateProgress(duration, 10);
              lastReportTime = now;
            }
          }
        };
        ws.onclose = () => {
          if (!startTime) { resolve(0); return; }
          const duration = (performance.now() - startTime) / 1000;
          const finalMbps = duration > 0 ? (totalBytes * 8) / (duration * 1000000) : 0;
          resolve(finalMbps || 0);
        };
        ws.onerror = reject;
      });

      downEl.textContent = `${downloadResult.toFixed(1)} Mbps`;
      this._speedTestWS = null;

      // --- Upload (ndt7 WebSocket) ---
      status.textContent = 'アップロード計測中...';
      updateProgress(0);
      curVal.textContent = '0';
      const upUrl = server.urls['wss:///ndt/v7/upload'];

      const uploadResult = await new Promise((resolve, reject) => {
        const ws = new WebSocket(upUrl, 'net.measurementlab.ndt.v7');
        ws.binaryType = 'arraybuffer';
        this._speedTestWS = ws;
        
        let startTime = null;
        let totalBytesSent = 0;
        let lastReportTime = 0;
        const testDuration = 10000; // 10 seconds

        ws.onopen = () => {
          startTime = performance.now();
          lastReportTime = startTime;
          
          const sendData = () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            const now = performance.now();
            const duration = now - startTime;
            
            if (duration >= testDuration) {
              ws.close();
              return;
            }

            // バッファが空いたら追加で送信（1回64KB）
            // バッファに溜まりすぎないように制限
            while (ws.bufferedAmount < 512 * 1024) {
              const data = new Uint8Array(64 * 1024);
              ws.send(data);
              totalBytesSent += data.byteLength;
            }

            if (now - lastReportTime > 150) {
              // 送信済みデータからバッファ分を引いて、実送信量を推定
              const actualSent = totalBytesSent - ws.bufferedAmount;
              const mbps = (actualSent * 8) / (duration / 1000 * 1000000);
              if (mbps > 0) {
                setVal(mbps);
                updateProgress(duration, testDuration);
              }
              lastReportTime = now;
            }
            
            setTimeout(sendData, 10);
          };
          
          sendData();
        };

        ws.onmessage = (e) => {
          // サーバーからのレポート（JSON）を無視しても良いが、
          // 終了時にサーバー側の統計を使うとより正確
          if (typeof e.data === 'string') {
            try {
              const report = JSON.parse(e.data);
              // 必要があればサーバー側の数値を採用
            } catch(ex) {}
          }
        };

        ws.onclose = () => {
          const duration = (performance.now() - startTime) / 1000;
          const actualSent = totalBytesSent - ws.bufferedAmount;
          const finalMbps = duration > 0 ? (actualSent * 8) / (duration * 1000000) : 0;
          resolve(finalMbps);
        };
        ws.onerror = reject;
      });

      upEl.textContent = `${uploadResult.toFixed(1)} Mbps`;
      setVal(uploadResult);
      updateProgress(100);

      status.textContent = '計測完了';
      closeBtn.textContent = '閉じる';
      retryBtn.style.display = 'block';
      retryBtn.onclick = () => {
        retryBtn.style.display = 'none';
        closeBtn.textContent = 'キャンセル';
        this._startTest(modal);
      };

    } catch (err) {
      console.error(err);
      status.textContent = 'エラーが発生しました';
      status.style.color = 'var(--accent-danger)';
      retryBtn.style.display = 'block';
      retryBtn.onclick = () => {
        status.style.color = '';
        retryBtn.style.display = 'none';
        this._startTest(modal);
      };
    }
  }
}

WidgetTypes.ip = IpWidget;
