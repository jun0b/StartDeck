/**
 * NetworkWidget - ネットワークエンジニア向けツール（サブネット計算機）
 */
class NetworkWidget extends WidgetBase {
  static widgetType = 'network';
  static defaultConfig = {
    title: 'ネットワーク計算機'
  };

  constructor(id, config) {
    super(id, config);
    this._currentInput = '';
    this._refSortOrder = 'desc'; // 'desc' = /32 -> /1, 'asc' = /1 -> /32
  }

  renderBody() {
    const res = this._currentInput ? this._calculateSubnet(this._currentInput) : null;
    
    return `
      <div class="network-widget">
        <div class="network-input-group">
          <input type="text" class="form-input network-input" id="net-input-${this.id}" 
            placeholder="192.168.1.1/24" 
            value="${this._escapeHtml(this._currentInput)}">
          <button class="btn btn--primary network-calc-btn" id="net-calc-${this.id}">計算</button>
        </div>
        
        <div id="net-result-${this.id}" class="network-result-container">
          ${res ? this._renderResultTable(res) : ''}
        </div>

        <div class="network-actions">
          <button class="btn btn--ghost btn--sm network-toggle-ref" id="net-open-ref-${this.id}">
            サブネット一覧表示
          </button>
        </div>
      </div>
    `;
  }

  onMount() {
    const root = this.element;
    const input = root.querySelector(`#net-input-${this.id}`);
    const calcBtn = root.querySelector(`#net-calc-${this.id}`);
    const openRefBtn = root.querySelector(`#net-open-ref-${this.id}`);

    if (calcBtn && input) {
      calcBtn.onclick = () => {
        this._currentInput = input.value.trim();
        this.updateBody();
      };
      input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          this._currentInput = input.value.trim();
          this.updateBody();
        }
      };
    }

    if (openRefBtn) {
      openRefBtn.onclick = () => {
        this._showSubnetTableModal();
      };
    }
  }

  _showSubnetTableModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    overlay.innerHTML = `
      <div class="modal" style="width: 500px; max-width: 90%; display: flex; flex-direction: column; overflow: hidden;">
        <div class="modal__header">
          <span class="modal__title">サブネット一覧</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body" style="padding: 0; overflow-y: auto; flex: 1;">
          ${this._renderReferenceTable()}
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary modal-close-btn">閉じる</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').onclick = close;
    overlay.querySelector('.modal-close-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    
    // ソート機能のイベント委譲
    overlay.querySelector('.modal__body').onclick = (e) => {
      const th = e.target.closest('.sort-header');
      if (th) {
        this._refSortOrder = this._refSortOrder === 'desc' ? 'asc' : 'desc';
        overlay.querySelector('.modal__body').innerHTML = this._renderReferenceTable();
      }
    };
    
    document.body.appendChild(overlay);
  }

  _calculateSubnet(input) {
    if (!input) return null;

    try {
      let ipStr = '';
      let maskStr = '';
      let cidr = -1;

      // Check format: 192.168.1.1/24
      if (input.includes('/')) {
        const parts = input.split('/');
        ipStr = parts[0].trim();
        cidr = parseInt(parts[1].trim());
        if (isNaN(cidr) || cidr < 0 || cidr > 32) throw new Error('Invalid CIDR');
        maskStr = this._cidrToMask(cidr);
      } 
      // Check format: 192.168.1.1 255.255.255.0
      else {
        const parts = input.trim().split(/\s+/);
        if (parts.length >= 2) {
          ipStr = parts[0];
          maskStr = parts[1];
          cidr = this._maskToCidr(maskStr);
        } else {
          ipStr = parts[0];
          cidr = 32;
          maskStr = '255.255.255.255';
        }
      }

      const ipNum = this._ipToLong(ipStr);
      const maskNum = this._ipToLong(maskStr);
      
      const networkNum = (ipNum & maskNum) >>> 0;
      const broadcastNum = (networkNum | (~maskNum)) >>> 0;
      
      const addrCount = Math.pow(2, 32 - cidr);
      const usableCount = cidr >= 31 ? 0 : addrCount - 2;

      let ipClass = '';
      const firstOctet = (ipNum >>> 24) & 0xFF;
      if (firstOctet < 128) ipClass = 'A';
      else if (firstOctet < 192) ipClass = 'B';
      else if (firstOctet < 224) ipClass = 'C';
      else if (firstOctet < 240) ipClass = 'D (マルチキャスト)';
      else ipClass = 'E (予約済み)';

      return {
        ip: ipStr,
        mask: maskStr,
        cidr: cidr,
        network: this._longToIp(networkNum),
        broadcast: this._longToIp(broadcastNum),
        usableStart: cidr >= 31 ? 'N/A' : this._longToIp(networkNum + 1),
        usableEnd: cidr >= 31 ? 'N/A' : this._longToIp(broadcastNum - 1),
        addrCount: addrCount.toLocaleString(),
        usableCount: usableCount > 0 ? usableCount.toLocaleString() : (cidr >= 31 ? '-' : '0'),
        ipClass: ipClass
      };
    } catch (e) {
      return { error: '無効な形式です。<br>例: 192.168.1.1/24<br>例: 192.168.1.1 255.255.255.0' };
    }
  }

  _renderResultTable(res) {
    if (res.error) return `<div class="network-error">${res.error}</div>`;

    return `
      <table class="network-res-table">
        <tr>
          <th>IPアドレス</th>
          <td class="mono" style="font-weight: 700;">${res.ip}</td>
        </tr>
        <tr>
          <th>サブネットマスク</th>
          <td class="mono"><strong>/${res.cidr}</strong> (${res.mask})</td>
        </tr>
        <tr>
          <th>ネットワークアドレス<br>(開始IP)</th>
          <td class="mono">${res.network}</td>
        </tr>
        <tr>
          <th>ホストアドレス<br>(使用可能IP)</th>
          <td class="mono">
            ${res.usableStart}<br>
            ～<br>
            ${res.usableEnd}
          </td>
        </tr>
        <tr>
          <th>ブロードキャストアドレス<br>(終了IP)</th>
          <td class="mono">${res.broadcast}</td>
        </tr>
        <tr>
          <th>アドレス数</th>
          <td>IPアドレス数 : <strong>${res.addrCount}</strong> (ホストアドレス数 : ${res.usableCount})</td>
        </tr>
        <tr>
          <th>IPアドレスクラス</th>
          <td>クラス${res.ipClass}</td>
        </tr>
      </table>
    `;
  }

  _renderReferenceTable() {
    const isDesc = this._refSortOrder === 'desc';
    const sortIcon = isDesc ? '▼' : '▲';
    
    let html = `
      <table class="network-ref-table">
        <thead>
          <tr>
            <th class="sort-header" style="cursor: pointer; user-select: none;">
              CIDR ${sortIcon}
            </th>
            <th>サブネットマスク</th>
            <th>ホスト数</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (isDesc) {
      for (let c = 32; c >= 1; c--) {
        html += this._renderRefRow(c);
      }
    } else {
      for (let c = 1; c <= 32; c++) {
        html += this._renderRefRow(c);
      }
    }

    html += `</tbody></table>`;
    return html;
  }

  _renderRefRow(c) {
    const mask = this._cidrToMask(c);
    const count = Math.pow(2, 32 - c);
    const usable = c >= 31 ? 0 : count - 2;
    return `
      <tr>
        <td class="mono">/${c}</td>
        <td class="mono">${mask}</td>
        <td>${usable > 0 ? usable.toLocaleString() : (c >= 31 ? '-' : '0')}</td>
      </tr>
    `;
  }

  // Helpers
  _ipToLong(ip) {
    // 厳密な形式チェック
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      throw new Error('Invalid IP');
    }
    const parts = ip.split('.').map(p => {
      const n = Number(p);
      if (isNaN(n) || n < 0 || n > 255 || p !== n.toString()) {
        throw new Error('Invalid IP');
      }
      return n;
    });
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  _longToIp(long) {
    return [
      (long >>> 24) & 0xFF,
      (long >>> 16) & 0xFF,
      (long >>> 8) & 0xFF,
      long & 0xFF
    ].join('.');
  }

  _cidrToMask(cidr) {
    if (cidr === 0) return '0.0.0.0';
    const mask = (0xFFFFFFFF << (32 - cidr)) >>> 0;
    return this._longToIp(mask);
  }

  _maskToCidr(mask) {
    const long = this._ipToLong(mask);
    
    // サブネットマスクの妥当性チェック（1が連続しているか）
    const v = (~long) >>> 0;
    if ((v & (v + 1)) !== 0) {
      throw new Error('Invalid Mask');
    }

    let cidr = 0;
    for (let i = 31; i >= 0; i--) {
      if ((long >>> i) & 1) cidr++;
      else break;
    }
    return cidr;
  }

  getSettingsFields() {
    return [
      { key: 'title', label: 'タイトル', type: 'text' },
      { type: 'info', content: 'IPアドレスとCIDR（/24）またはサブネットマスクを入力して計算できます。' }
    ];
  }
}

WidgetTypes.network = NetworkWidget;
