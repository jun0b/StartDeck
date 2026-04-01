/**
 * SystemWidget - システムリソース（CPU/メモリ）監視ウィジェット
 */
class SystemWidget extends WidgetBase {
  static widgetType = 'system';
  static defaultConfig = {
    title: 'システムリソース',
    refreshInterval: 2, // 秒
    viewType: 'bar', // 'bar' or 'pie'
    showCPU: true,
    showMemory: true
  };

  constructor(id, config) {
    super(id, config);
    this._timer = null;
    this._lastCpuInfo = null;
  }

  renderBody() {
    const isPie = this.config.viewType === 'pie';
    return `
      <div class="system-body ${isPie ? 'system-body--pie' : ''}">
        <div class="system-error" style="display:none; font-size:0.75rem; color:#ff4444; padding:8px; line-height:1.4; background:rgba(255,0,0,0.1); border-radius:4px; margin-bottom:8px;">
          APIが利用できません。拡張機能を更新してください。
        </div>

        ${this.config.showCPU ? `
          <div class="system-item ${isPie ? 'system-item--pie' : ''}">
            <div class="system-item__header">
              <span class="system-item__label">CPU</span>
              ${!isPie ? '<span class="system-item__value cpu-val">--%</span>' : ''}
            </div>
            ${isPie ? `
              <div class="system-pie cpu-pie">
                <span class="system-pie-value cpu-val">--%</span>
              </div>
            ` : `
              <div class="system-progress">
                <div class="system-progress__bar cpu-bar" style="width: 0%"></div>
              </div>
            `}
          </div>
        ` : ''}

        ${this.config.showMemory ? `
          <div class="system-item ${isPie ? 'system-item--pie' : ''}">
            <div class="system-item__header">
              <span class="system-item__label">メモリ</span>
              ${!isPie ? '<span class="system-item__value mem-val">--%</span>' : ''}
            </div>
            ${isPie ? `
              <div class="system-pie mem-pie">
                <span class="system-pie-value mem-val">--%</span>
              </div>
            ` : `
              <div class="system-progress">
                <div class="system-progress__bar mem-bar" style="width: 0%"></div>
              </div>
            `}
            <div class="system-item__footer mem-detail">
              -- / -- GB
            </div>
          </div>
        ` : ''}
      </div>`;
  }

  onMount() {
    this.onDestroy();
    if (!chrome.system || !chrome.system.cpu || !chrome.system.memory) {
      const errEl = this.element.querySelector('.system-error');
      if (errEl) errEl.style.display = 'block';
      return;
    }

    this._updateStats();
    this._timer = setInterval(() => this._updateStats(), (this.config.refreshInterval || 2) * 1000);
  }

  onDestroy() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  onVisibilityChange(isVisible) {
    if (isVisible) {
      this._updateStats();
      if (!this._timer) {
        this._timer = setInterval(() => this._updateStats(), (this.config.refreshInterval || 2) * 1000);
      }
    } else {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  }

  async _updateStats() {
    if (this.config.showCPU) await this._updateCpu();
    if (this.config.showMemory) await this._updateMemory();
  }

  async _updateCpu() {
    try {
      const cpuInfo = await new Promise(resolve => chrome.system.cpu.getInfo(resolve));
      if (!cpuInfo) return;

      if (this._lastCpuInfo) {
        let totalIdle = 0, totalTotal = 0;
        for (let i = 0; i < cpuInfo.processors.length; i++) {
          const current = cpuInfo.processors[i].usage;
          const prev = this._lastCpuInfo.processors[i].usage;
          const idle = current.idle - prev.idle;
          const total = (current.idle + current.kernel + current.user) - (prev.idle + prev.kernel + prev.user);
          totalIdle += idle;
          totalTotal += total;
        }

        const usage = totalTotal > 0 ? Math.round(((totalTotal - totalIdle) / totalTotal) * 100) : 0;
        this._updateUI('.cpu-val', '.cpu-bar', '.cpu-pie', usage);
      }
      this._lastCpuInfo = cpuInfo;
    } catch (e) { console.error(e); }
  }

  async _updateMemory() {
    try {
      const memInfo = await new Promise(resolve => chrome.system.memory.getInfo(resolve));
      if (!memInfo) return;
      const usage = Math.round(((memInfo.capacity - memInfo.availableCapacity) / memInfo.capacity) * 100);

      this._updateUI('.mem-val', '.mem-bar', '.mem-pie', usage);

      const detailEl = this.element.querySelector('.mem-detail');
      if (detailEl) {
        const usedGB = ((memInfo.capacity - memInfo.availableCapacity) / (1024 ** 3)).toFixed(1);
        const totalGB = (memInfo.capacity / (1024 ** 3)).toFixed(1);
        detailEl.textContent = `${usedGB} / ${totalGB} GB`;
      }
    } catch (e) { console.error(e); }
  }

  _updateUI(valSelector, barSelector, pieSelector, usage) {
    const valEl = this.element.querySelectorAll(valSelector);
    const barEl = this.element.querySelector(barSelector);
    const pieEl = this.element.querySelector(pieSelector);
    const color = this._getUsageColor(usage);

    valEl.forEach(el => { el.textContent = `${usage}%`; });
    if (barEl) {
      barEl.style.width = `${usage}%`;
      barEl.style.backgroundColor = color;
    }
    if (pieEl) {
      pieEl.style.setProperty('--pie-percent', `${usage}%`);
      pieEl.style.setProperty('--pie-color', color);
    }
  }

  _getUsageColor(p) {
    if (p < 60) return 'var(--accent-primary)';
    if (p < 85) return '#ffaa00';
    return '#ff4444';
  }

  getSettingsFields() {
    return [
      { key: 'viewType', label: '表示形式', type: 'select', options: [{value: 'bar', label: 'プログレスバー'}, {value: 'pie', label: '円グラフ'}] },
      { key: 'refreshInterval', label: '更新間隔（秒）', type: 'number', min: 1, max: 10 },
      { key: 'showCPU', label: 'CPUを表示', type: 'checkbox' },
      { key: 'showMemory', label: 'メモリを表示', type: 'checkbox' },
    ];
  }
}
WidgetTypes.system = SystemWidget;
