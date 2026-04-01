/**
 * ClockWidget - 時計ウィジェット
 */
class ClockWidget extends WidgetBase {
  static widgetType = 'clock';
  static defaultConfig = {
    title: '時計',
    mode: 'digital',
    showSeconds: true,
    showDate: true,
    timezone: '',
    use24h: true
  };

  constructor(id, config) {
    super(id, config);
    this._timer = null;
  }

  renderBody() {
    const mode = this.config.mode || 'digital';
    if (mode === 'analog') {
      return `
        <div class="clock-body">
          <div class="clock-analog">
            <div class="clock-analog__face">
              <div class="clock-analog__hand clock-analog__hand--hour" id="clock-hour-${this.id}"></div>
              <div class="clock-analog__hand clock-analog__hand--minute" id="clock-min-${this.id}"></div>
              <div class="clock-analog__hand clock-analog__hand--second" id="clock-sec-${this.id}"></div>
              <div class="clock-analog__center"></div>
            </div>
          </div>
          <div class="clock-date" id="clock-date-${this.id}"></div>
        </div>`;
    }
    return `
      <div class="clock-body">
        <div class="clock-digital" id="clock-time-${this.id}"></div>
        <div class="clock-date" id="clock-date-${this.id}"></div>
      </div>`;
  }

  onMount() {
    this._updateClock();
    this._timer = setInterval(() => this._updateClock(), 1000);
  }

  onDestroy() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  onVisibilityChange(isVisible) {
    if (isVisible) {
      this._updateClock();
      if (!this._timer) {
        this._timer = setInterval(() => this._updateClock(), 1000);
      }
    } else {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  }

  _updateClock() {
    const opts = {};
    if (this.config.timezone) opts.timeZone = this.config.timezone;
    const now = new Date();
    const mode = this.config.mode || 'digital';

    if (mode === 'digital') {
      const timeEl = document.getElementById(`clock-time-${this.id}`);
      if (timeEl) {
        const h = this.config.use24h
          ? String(now.getHours()).padStart(2, '0')
          : String(now.getHours() % 12 || 12).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const ampm = !this.config.use24h ? (now.getHours() >= 12 ? ' PM' : ' AM') : '';
        timeEl.textContent = this.config.showSeconds ? `${h}:${m}:${s}${ampm}` : `${h}:${m}${ampm}`;
      }
    } else {
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const hourDeg = (h % 12 + m / 60) * 30;
      const minDeg = (m + s / 60) * 6;
      const secDeg = s * 6;

      const hourEl = document.getElementById(`clock-hour-${this.id}`);
      const minEl = document.getElementById(`clock-min-${this.id}`);
      const secEl = document.getElementById(`clock-sec-${this.id}`);
      if (hourEl) hourEl.style.transform = `rotate(${hourDeg}deg)`;
      if (minEl) minEl.style.transform = `rotate(${minDeg}deg)`;
      if (secEl) secEl.style.transform = `rotate(${secDeg}deg)`;
    }

    if (this.config.showDate) {
      const dateEl = document.getElementById(`clock-date-${this.id}`);
      if (dateEl) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${days[now.getDay()]})`;
      }
    }
  }

  getContextMenuItems() {
    return [
      { action: 'toggle24h', label: this.config.use24h ? '12時間表示にする' : '24時間表示にする', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'toggle24h') {
      this.config.use24h = !this.config.use24h;
      this.save();
      this._updateClock();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'mode', label: '表示モード', type: 'select', options: [
        { value: 'digital', label: 'デジタル' }, { value: 'analog', label: 'アナログ' }
      ]},
      { key: 'use24h', label: '24時間表示', type: 'checkbox' },
      { key: 'showSeconds', label: '秒を表示', type: 'checkbox' },
      { key: 'showDate', label: '日付を表示', type: 'checkbox' },
      { key: 'timezone', label: 'タイムゾーン（空欄=ローカル）', type: 'text', placeholder: 'Asia/Tokyo' },
    ];
  }
}
WidgetTypes.clock = ClockWidget;
