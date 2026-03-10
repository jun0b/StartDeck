/**
 * WeatherWidget - 天気ウィジェット (Open-Meteo API)
 */
class WeatherWidget extends WidgetBase {
  static widgetType = 'weather';
  static defaultConfig = {
    title: '天気',
    latitude: 35.6895,
    longitude: 139.6917,
    locationName: '東京',
    unit: 'celsius'
  };

  renderBody() {
    return '<div class="weather-body"><div class="loading-spinner"></div></div>';
  }

  onMount() {
    this._fetchWeather();
  }

  async _fetchWeather() {
    const body = this.element?.querySelector('.weather-body');
    if (!body) return;

    try {
      const lat = this.config.latitude || 35.6895;
      const lon = this.config.longitude || 139.6917;
      const unit = this.config.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
      const tempUnit = unit === 'celsius' ? '°C' : '°F';

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${unit}&timezone=auto&forecast_days=5`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.current || !data.daily) throw new Error('Invalid data');

      const current = data.current;
      const daily = data.daily;
      const weatherDesc = this._weatherCodeToDesc(current.weather_code);
      const weatherIcon = this._weatherCodeToIcon(current.weather_code);

      const days = ['日', '月', '火', '水', '木', '金', '土'];
      const forecastHtml = daily.time.slice(1, 5).map((d, i) => {
        const date = new Date(d);
        const dayName = days[date.getDay()];
        const icon = this._weatherCodeToIcon(daily.weather_code[i + 1]);
        return `
          <div class="weather-day">
            <span class="weather-day__name">${dayName}</span>
            <div class="weather-day__icon">${icon}</div>
            <div class="weather-day__temps">
              <span class="weather-day__temp-high">${Math.round(daily.temperature_2m_max[i + 1])}${tempUnit}</span>
              <br>${Math.round(daily.temperature_2m_min[i + 1])}${tempUnit}
            </div>
          </div>`;
      }).join('');

      body.innerHTML = `
        <div class="weather-current" id="weather-current-${this.id}">
          <div class="weather-current__icon">${weatherIcon}</div>
          <div>
            <div class="weather-current__temp">${Math.round(current.temperature_2m)}${tempUnit}</div>
            <div class="weather-current__desc">${weatherDesc}</div>
            <div class="weather-current__location">${this._escapeHtml(this.config.locationName || '')}</div>
          </div>
        </div>
        <div class="weather-forecast">${forecastHtml}</div>
        <div style="text-align: right; padding-top: 6px; font-size: 0.65rem; color: var(--text-tertiary);">Powered by Open-Meteo</div>
      `;

      this._bindHovers(data);
    } catch (e) {
      body.innerHTML = `<div class="empty-state">天気情報を取得できませんでした<br><span style="font-size:0.72rem;color:var(--text-tertiary)">設定から都市を確認してください</span></div>`;
    }
  }

  _bindHovers(data) {
    const current = this.element?.querySelector(`#weather-current-${this.id}`);
    if (!current) return;

    let timer;
    current.addEventListener('mouseenter', () => {
      timer = setTimeout(() => {
        this._showPopup(current, data);
      }, 400);
    });
    current.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      this._hidePopup();
    });
  }

  _showPopup(targetEl, data) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup';
      document.body.appendChild(popup);
    }

    const hourly = data.hourly;
    // 現在時刻より少し前の正時から13件取得（現在時刻＋12時間分をカバー）
    const now = new Date();
    const currentHourIdx = hourly.time.findIndex(t => new Date(t) > now) - 1;
    const startIndex = Math.max(0, currentHourIdx);
    const nextHours = hourly.time.slice(startIndex, startIndex + 12);
    const unit = this.config.unit === 'fahrenheit' ? '°F' : '°C';

    const hourlyHtml = nextHours.map((time, i) => {
      const idx = startIndex + i;
      const t = new Date(time);
      const timeStr = `${t.getHours()}:00`;
      const temp = Math.round(hourly.temperature_2m[idx]);
      const icon = this._weatherCodeToIcon(hourly.weather_code[idx]);
      return `
        <div class="weather-popup-hour">
          <span class="weather-popup-hour__time">${timeStr}</span>
          <div class="weather-popup-hour__icon">${icon}</div>
          <span class="weather-popup-hour__temp">${temp}${unit}</span>
        </div>
      `;
    }).join('');

    popup.innerHTML = `
      <div class="widget-popup__title">${this._escapeHtml(this.config.locationName)} の時間別予報</div>
      <div class="widget-popup__body">
        <div class="weather-popup-hourly">
          ${hourlyHtml}
        </div>
      </div>
    `;

    const rect = targetEl.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    if (left + 250 > window.innerWidth) left = rect.left - 260;
    if (top + 350 > window.innerHeight) top = window.innerHeight - 360;

    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.width = '250px';
    popup.classList.add('visible');
  }

  _hidePopup() {
    const popup = document.querySelector('.widget-popup');
    if (popup) popup.classList.remove('visible');
  }

  _weatherCodeToDesc(code) {
    const map = {
      0: '快晴', 1: '概ね晴れ', 2: '一部曇り', 3: '曇り',
      45: '霧', 48: '着氷性の霧', 51: '弱い霧雨', 53: '霧雨', 55: '強い霧雨',
      61: '弱い雨', 63: '雨', 65: '強い雨', 66: '着氷性の弱い雨', 67: '着氷性の強い雨',
      71: '弱い雪', 73: '雪', 75: '強い雪', 77: '雪粒', 80: '弱いにわか雨', 81: 'にわか雨', 82: '強いにわか雨',
      85: '弱いにわか雪', 86: '強いにわか雪', 95: '雷雨', 96: '雷雨（ひょう）', 99: '激しい雷雨（ひょう）'
    };
    return map[code] || '不明';
  }

  _weatherCodeToIcon(code) {
    let svg;
    if (code === 0 || code === 1) {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    } else if (code === 2 || code === 3) {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
    } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" stroke="#94a3b8"/></svg>`;
    } else if (code >= 71 && code <= 86) {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`;
    } else if (code >= 95) {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" stroke="#94a3b8"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`;
    } else {
      svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
    }
    return svg;
  }

  getContextMenuItems() {
    return [
      { action: 'refresh', label: '更新', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'refresh') {
      this._fetchWeather();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'locationName', label: '地域名', type: 'text', placeholder: '東京' },
      { key: 'latitude', label: '緯度', type: 'text', placeholder: '35.6895' },
      { key: 'longitude', label: '経度', type: 'text', placeholder: '139.6917' },
      { key: 'unit', label: '温度単位', type: 'select', options: [
        { value: 'celsius', label: '摂氏 (°C)' }, { value: 'fahrenheit', label: '華氏 (°F)' }
      ]},
    ];
  }
}
WidgetTypes.weather = WeatherWidget;
