/**
 * MediaWidget - メディアコントロールウィジェット
 * ブラウザで再生中のメディア（YouTube, YouTube Music等）を操作
 */
class MediaWidget extends WidgetBase {
  static widgetType = 'media';
  static defaultConfig = {
    title: 'メディア',
    pollInterval: 1000 // 状態取得間隔(ms)
  };

  constructor(id, config) {
    super(id, config);
    // 保存済みconfigの古い値を上書き
    this.config.pollInterval = 1000;
    this._mediaState = null;
    this._tabId = null;
    this._timer = null;
    this._seeking = false;
  }

  renderBody() {
    return `<div class="media-widget" id="media-body-${this.id}">
      <div class="media-widget__empty">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span>メディアを再生していません</span>
      </div>
    </div>`;
  }

  onMount() {
    // Service Workerの起動を待つため少し遅延してからポーリング開始
    setTimeout(() => this._startPolling(), 500);
  }

  onDestroy() {
    this._stopPolling();
  }

  _startPolling() {
    this._stopPolling();
    this._pollMedia();
    this._timer = setInterval(() => this._pollMedia(), this.config.pollInterval || 1000);
  }

  _stopPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _pollMedia() {
    // chrome.runtime APIが利用可能か確認
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('Media widget: chrome.runtime API not available');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getMediaState' });
      if (chrome.runtime.lastError) {
        console.warn('Media poll lastError:', chrome.runtime.lastError);
        return;
      }
      if (response && response.status === 'connected' && response.data) {
        this._mediaState = response.data;
        this._tabId = response.tabId;
        if (!this._seeking) this._renderPlayer();
      } else {
        if (this._mediaState) {
          this._mediaState = null;
          this._tabId = null;
          this._renderEmpty();
        }
      }
    } catch (e) {
      console.warn('Media poll error:', e.message);
    }
  }

  _renderEmpty() {
    const body = this.element?.querySelector(`#media-body-${this.id}`);
    if (!body) return;
    body.innerHTML = `
      <div class="media-widget__empty">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span>メディアを再生していません</span>
      </div>`;
  }

  _renderPlayer() {
    const body = this.element?.querySelector(`#media-body-${this.id}`);
    if (!body) return;
    const d = this._mediaState;
    if (!d) return;

    const currentStr = this._formatTime(d.currentTime || 0);
    const durationStr = this._formatTime(d.duration || 0);
    const progress = d.duration > 0 ? ((d.currentTime / d.duration) * 100) : 0;

    body.innerHTML = `
      <div class="media-widget__player">
        ${d.artwork ? `<img class="media-widget__artwork media-widget__goto-tab" src="${this._escapeHtml(d.artwork)}" alt="" loading="lazy" data-hide-on-error="true" title="タブに移動" style="cursor:pointer">` : ''}
        <div class="media-widget__info">
          <div class="media-widget__title media-widget__goto-tab" style="cursor:pointer" title="タブに移動">${this._escapeHtml(d.title || '不明な曲')}</div>
          ${d.artist ? `<div class="media-widget__artist">${this._escapeHtml(d.artist)}</div>` : ''}
        </div>
        <div class="media-widget__progress">
          <div class="media-widget__progress-bar" id="media-progress-${this.id}">
            <div class="media-widget__progress-fill" style="width:${progress}%"></div>
            <input type="range" class="media-widget__progress-input" min="0" max="${Math.floor(d.duration || 0)}" value="${Math.floor(d.currentTime || 0)}" id="media-seek-${this.id}">
          </div>
          <div class="media-widget__time">
            <span>${currentStr}</span>
            <span>${durationStr}</span>
          </div>
        </div>
        <div class="media-widget__controls">
          <button class="media-widget__btn" data-cmd="prev" title="前へ">
            <svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
          </button>
          <button class="media-widget__btn media-widget__btn--play" data-cmd="toggle" title="${d.isPlaying ? '一時停止' : '再生'}">
            ${d.isPlaying
              ? '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
              : '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
            }
          </button>
          <button class="media-widget__btn" data-cmd="next" title="次へ">
            <svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          </button>
        </div>
      </div>`;

    // タブジャンプバインド
    body.querySelectorAll('.media-widget__goto-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (this._tabId) {
          chrome.tabs.get(this._tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) return;
            chrome.windows.update(tab.windowId, { focused: true });
            chrome.tabs.update(this._tabId, { active: true });
          });
        }
      });
    });

    // コントロールボタンバインド
    body.querySelectorAll('.media-widget__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = btn.dataset.cmd;
        chrome.runtime.sendMessage({ action: 'controlMedia', command: cmd, tabId: this._tabId });
        if (cmd === 'toggle' && this._mediaState) {
          this._mediaState.isPlaying = !this._mediaState.isPlaying;
          this._renderPlayer();
        }
      });
    });

    // シークバーバインド
    const seekInput = body.querySelector(`#media-seek-${this.id}`);
    if (seekInput) {
      seekInput.addEventListener('input', () => { this._seeking = true; });
      seekInput.addEventListener('change', () => {
        const time = parseFloat(seekInput.value);
        chrome.runtime.sendMessage({ action: 'seekMedia', time, tabId: this._tabId });
        if (this._mediaState) this._mediaState.currentTime = time;
        this._seeking = false;
      });
    }
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getContextMenuItems() {
    return [
      { action: 'openTab', label: 'タブに移動', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'openTab') {
      if (this._tabId) {
        chrome.tabs.get(this._tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) return;
          chrome.windows.update(tab.windowId, { focused: true });
          chrome.tabs.update(this._tabId, { active: true });
        });
      }
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [];
  }
}
WidgetTypes.media = MediaWidget;
