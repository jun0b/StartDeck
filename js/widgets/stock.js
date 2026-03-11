/**
 * StockWidget - 株価ウィジェット (Yahoo Finance非公式API)
 */
class StockWidget extends WidgetBase {
  static widgetType = 'stock';
  static defaultConfig = {
    title: '株価',
    symbols: ['AAPL', 'GOOGL', 'MSFT'],
    refreshInterval: 60
  };

  constructor(id, config) {
    super(id, config);
    this._timer = null;
  }

  renderBody() {
    return `<div class="stock-list" id="stock-list-${this.id}"><div class="loading-spinner"></div></div>`;
  }

  onMount() {
    this._fetchStocks();
    const interval = (this.config.refreshInterval || 60) * 1000;
    this._timer = setInterval(() => this._fetchStocks(), interval);
  }

  onDestroy() {
    if (this._timer) clearInterval(this._timer);
  }

  async _fetchStocks() {
    const listEl = this.element?.querySelector(`#stock-list-${this.id}`);
    if (!listEl) return;

    const symbols = this.config.symbols || [];
    if (symbols.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding:20px 0;">銘柄が設定されていません<br><span style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px;display:inline-block">「･･･」メニューの「銘柄を管理」から追加してください</span></div>';
      return;
    }

    try {
      if (!this.config.names) this.config.names = {};

      const fetchUrl = async (url) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          const res = await chrome.runtime.sendMessage({ action: 'proxyFetch', url });
          if (!res || !res.ok) throw new Error(res?.error || 'Fetch failed');
          return JSON.parse(res.data);
        } else {
          const res = await fetch(url);
          return await res.json();
        }
      };

      const quotes = await Promise.all(symbols.map(async (sym) => {
        try {
          // intervalを5mに変更して、1日の間に複数のデータポイントを取得できるようにする
          const chartData = await fetchUrl(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=5m&range=1d`);
          const meta = chartData?.chart?.result?.[0]?.meta;
          if (!meta) return null;

          let name = this.config.names[sym];
          if (!name) {
            try {
              const searchData = await fetchUrl(`https://query2.finance.yahoo.com/v1/finance/search?q=${sym}`);
              const quote = (searchData?.quotes || []).find(q => q.symbol === sym) || searchData?.quotes?.[0];
              name = quote?.shortname || quote?.longname || sym;
              this.config.names[sym] = name;
              this.save(); // 名前をキャッシュ
            } catch (e) {
              name = sym;
            }
          }

          return {
            symbol: meta.symbol || sym,
            name: name,
            price: meta.regularMarketPrice || 0,
            prevClose: meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice || 0,
            high: meta.regularMarketDayHigh || 0,
            low: meta.regularMarketDayLow || 0,
            volume: meta.regularMarketVolume || 0,
            currency: meta.currency || '',
            history: chartData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []
          };
        } catch (e) {
          console.error('Failed to fetch stock:', sym, e);
          return null;
        }
      }));

      const validQuotes = quotes.filter(q => q !== null);
      if (validQuotes.length === 0) throw new Error('データがありません');

      listEl.innerHTML = validQuotes.map(q => {
        const currentPrice = q.price;
        const prevClose = q.prevClose;
        const change = currentPrice - prevClose;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;

        const priceStr = currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const changeDir = change >= 0 ? 'up' : 'down';
        const arrow = change >= 0 ? '▲' : '▼';

        // リンク先URLの生成（日本株(.T)は日本のYahooファイナンス、それ以外は米国Yahooファイナンスへ）
        const isJP = q.symbol.endsWith('.T');
        const stockUrl = isJP
          ? `https://finance.yahoo.co.jp/quote/${encodeURIComponent(q.symbol)}`
          : `https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}`;

        return `
          <a href="${stockUrl}" target="_blank" class="stock-item" data-idx="${validQuotes.indexOf(q)}">
            <div>
              <div class="stock-item__symbol">${this._escapeHtml(q.symbol)}</div>
              <div class="stock-item__name">${this._escapeHtml(q.name)}</div>
            </div>
            <div>
              <div class="stock-item__price">${priceStr} ${this._escapeHtml(q.currency)}</div>
              <div class="stock-item__change ${changeDir}">${arrow} ${Math.abs(change).toFixed(2)} (${Math.abs(changePercent).toFixed(2)}%)</div>
            </div>
          </a>`;
      }).join('') + '<div style="text-align: right; padding: 6px 8px 0; font-size: 0.65rem; color: var(--text-tertiary);">Powered by Yahoo Finance</div>';

      this._bindHovers(listEl, validQuotes);
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">株価を取得できませんでした<br><span style="font-size:0.72rem;color:var(--text-tertiary)">${this._escapeHtml(e.message)}</span></div>`;
    }
  }

  _bindHovers(listEl, quotes) {
    const items = listEl.querySelectorAll('.stock-item');
    items.forEach(el => {
      let timer;
      el.addEventListener('mouseenter', () => {
        timer = setTimeout(() => {
          const idx = parseInt(el.dataset.idx);
          const data = quotes[idx];
          if (data) this._showPopup(el, data);
        }, 400);
      });
      el.addEventListener('mouseleave', () => {
        clearTimeout(timer);
        this._hidePopup();
      });
    });
  }

  _showPopup(targetEl, data) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup';
      document.body.appendChild(popup);
    }

    const formatVol = (v) => {
      if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(2) + 'K';
      return v;
    };

    popup.innerHTML = `
      <div class="widget-popup__title">${this._escapeHtml(data.name)} (${this._escapeHtml(data.symbol)})</div>
      <div class="widget-popup__body">
        <div class="stock-popup-chart" id="stock-chart-${this.id}">
          ${this._renderMiniChart(data)}
        </div>
        <div class="stock-popup-grid">
          <div class="stock-popup-item">
            <span class="stock-popup-label">現在値</span>
            <span class="stock-popup-value">${data.price.toLocaleString()} ${data.currency}</span>
          </div>
          <div class="stock-popup-item">
            <span class="stock-popup-label">前日終値</span>
            <span class="stock-popup-value">${data.prevClose.toLocaleString()}</span>
          </div>
          <div class="stock-popup-item">
            <span class="stock-popup-label">高値</span>
            <span class="stock-popup-value">${data.high.toLocaleString()}</span>
          </div>
          <div class="stock-popup-item">
            <span class="stock-popup-label">安値</span>
            <span class="stock-popup-value">${data.low.toLocaleString()}</span>
          </div>
          <div class="stock-popup-item" style="grid-column: span 2;">
            <span class="stock-popup-label">出来高</span>
            <span class="stock-popup-value">${formatVol(data.volume)}</span>
          </div>
        </div>
      </div>
    `;

    const rect = targetEl.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    if (left + 300 > window.innerWidth) left = rect.left - 310;

    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.width = '300px';
    popup.classList.add('visible');
  }

  _hidePopup() {
    const popup = document.querySelector('.widget-popup');
    if (popup) popup.classList.remove('visible');
  }

  _renderMiniChart(data) {
    const history = (data.history || []).filter(p => p !== null);
    if (history.length < 2) return '<div style="font-size:0.7rem;color:var(--text-tertiary)">チャートデータなし</div>';

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const padding = 2; // SVG内での余白
    const width = 280;
    const height = 64;

    const points = history.map((p, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    }).join(' ');

    const trendClass = data.price >= data.prevClose ? 'up' : 'down';

    return `
      <div style="position:relative; width:${width}px; height:${height}px;">
        <div style="position:absolute; top:2px; left:4px; font-size:10px; color:var(--text-tertiary); font-weight:bold; pointer-events:none;">1D</div>
        <svg viewBox="0 0 ${width} ${height}" class="stock-chart-svg">
          <!-- 基準線 (前日終値相当の位置を点線で示す) -->
          <line x1="0" y1="${height - ((data.prevClose - min) / range) * (height - padding * 2) - padding}" x2="${width}" y2="${height - ((data.prevClose - min) / range) * (height - padding * 2) - padding}"
                stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4" />
          <path class="stock-chart-path ${trendClass}" d="M ${points}" />
        </svg>
      </div>
    `;
  }

  _showManageDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">銘柄を管理</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div style="margin-bottom:12px;font-size:0.78rem;color:var(--text-secondary)">
            米国株: AAPL, GOOGL 等<br>
            日本株: 7203.T (トヨタ), 6758.T (ソニー) 等
          </div>
          <div id="stock-symbol-list" style="margin-bottom:16px;max-height:300px;overflow-y:auto">
            ${(this.config.symbols || []).map((s, i) => `
              <div class="draggable-item" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:4px;padding:8px 0;border-bottom:1px solid var(--border-color); cursor: grab; transition: opacity 0.2s;">
                <span style="font-size:0.8rem;color:var(--text-tertiary);padding-right:4px">≡</span>
                <span style="flex:1;font-size:0.85rem;font-weight:600">${this._escapeHtml(s)}</span>
                <button class="btn btn--ghost" style="padding:2px 8px;font-size:0.75rem" data-action="edit" data-idx="${i}">編集</button>
                <button class="btn btn--danger" style="padding:2px 8px;font-size:0.75rem" data-remove="${i}">削除</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn--ghost" id="btn-add-symbol" style="width:100%;font-size:0.85rem">+ 新しい銘柄を追加</button>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary modal-close-btn">閉じる</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this.updateBody(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.remove);
        if (confirm(`銘柄「${this.config.symbols[i]}」を削除しますか？`)) {
          this.config.symbols.splice(i, 1);
          this.save();
          overlay.remove();
          this._showManageDialog();
        }
      });
    });

    overlay.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._showEditDialog(parseInt(btn.dataset.idx), overlay);
      });
    });

    overlay.querySelector('#btn-add-symbol').addEventListener('click', () => {
      this._showEditDialog(-1, overlay);
    });

    let draggedIdx = null;
    overlay.querySelectorAll('.draggable-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedIdx = parseInt(item.dataset.idx);
        e.dataTransfer.effectAllowed = 'move';
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        overlay.querySelectorAll('.draggable-item').forEach(el => {
          el.style.borderTop = '';
          el.style.borderBottom = '1px solid var(--border-color)';
        });
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          item.style.borderTop = '2px solid var(--accent-primary)';
          item.style.borderBottom = '1px solid var(--border-color)';
        } else {
          item.style.borderTop = '';
          item.style.borderBottom = '2px solid var(--accent-primary)';
        }
      });
      item.addEventListener('dragleave', () => {
        item.style.borderTop = '';
        item.style.borderBottom = '1px solid var(--border-color)';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = parseInt(item.dataset.idx);
        if (draggedIdx === null || draggedIdx === targetIdx) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let insertIdx = targetIdx;
        if (e.clientY > midY) insertIdx++;

        const arr = this.config.symbols;
        const [movedItem] = arr.splice(draggedIdx, 1);
        if (insertIdx > draggedIdx) insertIdx--;
        arr.splice(insertIdx, 0, movedItem);

        this.save();
        overlay.remove();
        this._showManageDialog();
      });
    });

    document.body.appendChild(overlay);
  }

  _showEditDialog(editIndex = -1, parentModal = null) {
    const isEdit = editIndex >= 0;
    const symObj = isEdit ? this.config.symbols[editIndex] : '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">${isEdit ? '銘柄を編集' : '新しい銘柄を追加'}</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="form-label">ティッカーシンボル</label>
            <input class="form-input" id="stock-new-symbol" value="${this._escapeHtml(symObj)}" placeholder="例: AAPL">
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-cancel-btn">キャンセル</button>
          <button class="btn btn--primary" id="stock-save-btn">${isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel-btn').addEventListener('click', close);

    overlay.querySelector('#stock-save-btn').addEventListener('click', () => {
      const sym = overlay.querySelector('#stock-new-symbol').value.trim().toUpperCase();
      if (!sym) {
        alert('ティッカーシンボルを入力してください');
        return;
      }
      
      if (!this.config.symbols) this.config.symbols = [];

      if (isEdit) {
        if (this.config.symbols[editIndex] !== sym) {
          if (this.config.names) delete this.config.names[this.config.symbols[editIndex]];
        }
        this.config.symbols[editIndex] = sym;
      } else {
        if (!this.config.symbols.includes(sym)) {
          this.config.symbols.push(sym);
        } else {
          alert('既に登録されています');
          return;
        }
      }
      
      this.save();
      close();
      if (parentModal) {
        parentModal.remove();
        this._showManageDialog();
      } else {
        this.updateBody();
      }
    });

    document.body.appendChild(overlay);
  }

  getContextMenuItems() {
    return [
      { action: 'manageStocks', label: '銘柄を管理', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
      { action: 'refresh', label: '更新', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'manageStocks') {
      this._showManageDialog(-1);
      return true;
    } else if (action === 'refresh') {
      this._fetchStocks();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'refreshInterval', label: '更新間隔（秒）', type: 'number', min: 30, max: 3600 },
    ];
  }
}
WidgetTypes.stock = StockWidget;
