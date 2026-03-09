/**
 * MiniCalendarWidget - シンプルなカレンダー表示ウィジェット
 */
class MiniCalendarWidget extends WidgetBase {
  static widgetType = 'minicalendar';
  static defaultConfig = {
    title: 'カレンダー',
    startOnMonday: true
  };

  constructor(id, config) {
    super(id, config);
    this._viewDate = new Date();
  }

  renderBody() {
    const year = this._viewDate.getFullYear();
    const month = this._viewDate.getMonth();
    const today = new Date();
    const startOnMon = this.config.startOnMonday;

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                         '7月', '8月', '9月', '10月', '11月', '12月'];

    const dowLabels = startOnMon
      ? ['月', '火', '水', '木', '金', '土', '日']
      : ['日', '月', '火', '水', '木', '金', '土'];

    // 月の最初の日と最後の日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // カレンダーの開始日を計算
    let startDow = firstDay.getDay(); // 0=日, 1=月, ...
    if (startOnMon) {
      startDow = startDow === 0 ? 6 : startDow - 1; // 月曜=0に変換
    }

    // 前月の日を埋める
    const prevMonthLast = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthLast - i;
      const dow = startOnMon ? (dowLabels.length + days.length) % 7 : days.length % 7;
      days.push({ day: d, other: true, dow });
    }

    // 今月の日
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const rawDow = date.getDay();
      const isToday = date.toDateString() === today.toDateString();
      const isSun = rawDow === 0;
      const isSat = rawDow === 6;
      days.push({ day: d, other: false, isToday, isSun, isSat });
    }

    // 翌月の日を埋める（6行 = 42セルまで）
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, other: true });
    }
    // 5行で十分な場合は35セルまでに切り詰める
    if (days.length > 35 && days.slice(35).every(d => d.other)) {
      days.length = 35;
    }

    const daysHtml = days.map(d => {
      let cls = 'mini-calendar__day';
      if (d.isToday) cls += ' mini-calendar__day--today';
      if (d.other) cls += ' mini-calendar__day--other';
      if (d.isSun && !d.isToday && !d.other) cls += ' mini-calendar__day--sun';
      if (d.isSat && !d.isToday && !d.other) cls += ' mini-calendar__day--sat';
      return `<div class="${cls}">${d.day}</div>`;
    }).join('');

    return `
      <div class="mini-calendar">
        <div class="mini-calendar__nav">
          <button class="mini-calendar__nav-btn" id="cal-prev-${this.id}">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="mini-calendar__month" id="cal-today-${this.id}">${year}年${monthNames[month]}</span>
          <button class="mini-calendar__nav-btn" id="cal-next-${this.id}">
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="mini-calendar__grid">
          ${dowLabels.map(d => `<div class="mini-calendar__dow">${d}</div>`).join('')}
          ${daysHtml}
        </div>
      </div>
    `;
  }

  onMount() {
    if (!this.element) return;
    this.element.querySelector(`#cal-prev-${this.id}`)?.addEventListener('click', () => {
      this._viewDate.setMonth(this._viewDate.getMonth() - 1);
      this.updateBody();
    });
    this.element.querySelector(`#cal-next-${this.id}`)?.addEventListener('click', () => {
      this._viewDate.setMonth(this._viewDate.getMonth() + 1);
      this.updateBody();
    });
    this.element.querySelector(`#cal-today-${this.id}`)?.addEventListener('click', () => {
      this._viewDate = new Date();
      this.updateBody();
    });
  }

  getContextMenuItems() {
    return [
      { action: 'today', label: '今月へ移動', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'today') {
      this._viewDate = new Date();
      this.updateBody();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'startOnMonday', label: '月曜始まり', type: 'checkbox' },
    ];
  }
}
WidgetTypes.minicalendar = MiniCalendarWidget;
