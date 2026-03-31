/**
 * WeatherWidget - 天気ウィジェット (Open-Meteo API)
 */
class WeatherWidget extends WidgetBase {
  static widgetType = 'weather';
  static defaultConfig = {
    title: '天気',
    locationName: '東京都',
    unit: 'celsius'
  };

  static CAPITALS = {
    '北海道': '札幌市', '岩手県': '盛岡市', '宮城県': '仙台市', '茨城県': '水戸市',
    '栃木県': '宇都宮市', '群馬県': '前橋市', '埼玉県': 'さいたま市', '東京都': '東京',
    '神奈川県': '横浜市', '石川県': '金沢市', '山梨県': '甲府市', '愛知県': '名古屋市',
    '三重県': '津市', '滋賀県': '大津市', '兵庫県': '神戸市', '島根県': '松江市',
    '香川県': '高松市', '愛媛県': '松山市', '沖縄県': '那覇市'
  };

  static PREFECTURES = {
    '北海道': { lat: 43.0642, lon: 141.3469 }, '青森県': { lat: 40.8244, lon: 140.7400 },
    '岩手県': { lat: 39.7036, lon: 141.1525 }, '宮城県': { lat: 38.2682, lon: 140.8694 },
    '秋田県': { lat: 39.7186, lon: 140.1025 }, '山形県': { lat: 38.2404, lon: 140.3633 },
    '福島県': { lat: 37.7503, lon: 140.4675 }, '茨城県': { lat: 36.3418, lon: 140.4468 },
    '栃木県': { lat: 36.5658, lon: 139.8836 }, '群馬県': { lat: 36.3911, lon: 139.0608 },
    '埼玉県': { lat: 35.8570, lon: 139.6489 }, '千葉県': { lat: 35.6047, lon: 140.1233 },
    '東京都': { lat: 35.6895, lon: 139.6917 }, '神奈川県': { lat: 35.4478, lon: 139.6425 },
    '新潟県': { lat: 37.9022, lon: 139.0236 }, '富山県': { lat: 36.6953, lon: 137.2114 },
    '石川県': { lat: 36.5947, lon: 136.6256 }, '福井県': { lat: 36.0641, lon: 136.2219 },
    '山梨県': { lat: 35.6639, lon: 138.5683 }, '長野県': { lat: 36.6513, lon: 138.1812 },
    '岐阜県': { lat: 35.4233, lon: 136.7606 }, '静岡県': { lat: 34.9756, lon: 138.3828 },
    '愛知県': { lat: 35.1802, lon: 136.9067 }, '三重県': { lat: 34.7303, lon: 136.5086 },
    '滋賀県': { lat: 35.0045, lon: 135.8686 }, '京都府': { lat: 35.0116, lon: 135.7680 },
    '大阪府': { lat: 34.6937, lon: 135.5022 }, '兵庫県': { lat: 34.6913, lon: 135.1830 },
    '奈良県': { lat: 34.6851, lon: 135.8048 }, '和歌山県': { lat: 34.2260, lon: 135.1675 },
    '鳥取県': { lat: 35.5011, lon: 134.2351 }, '島根県': { lat: 35.4723, lon: 133.0505 },
    '岡山県': { lat: 34.6618, lon: 133.9344 }, '広島県': { lat: 34.3853, lon: 132.4553 },
    '山口県': { lat: 34.1858, lon: 131.4714 }, '徳島県': { lat: 34.0703, lon: 134.5548 },
    '香川県': { lat: 34.3401, lon: 134.0433 }, '愛媛県': { lat: 33.8392, lon: 132.7653 },
    '高知県': { lat: 33.5597, lon: 133.5311 }, '福岡県': { lat: 33.5902, lon: 130.4017 },
    '佐賀県': { lat: 33.2635, lon: 130.2988 }, '長崎県': { lat: 32.7503, lon: 129.8777 },
    '熊本県': { lat: 32.8031, lon: 130.7079 }, '大分県': { lat: 33.2382, lon: 131.6126 },
    '宮崎県': { lat: 31.9111, lon: 131.4239 }, '鹿児島県': { lat: 31.5966, lon: 130.5571 },
    '沖縄県': { lat: 26.2124, lon: 127.6809 }
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
      const locName = this.config.locationName || '東京都';
      const locData = WeatherWidget.PREFECTURES[locName] || WeatherWidget.PREFECTURES['東京都'];
      const lat = locData.lat;
      const lon = locData.lon;

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

      const locCity = WeatherWidget.CAPITALS[locName] || locName.replace(/(都|府|県)$/, '市');

      body.innerHTML = `
        <div class="weather-current" id="weather-current-${this.id}">
          <div class="weather-current__icon">${weatherIcon}</div>
          <div>
            <div class="weather-current__temp">${Math.round(current.temperature_2m)}${tempUnit}</div>
            <div class="weather-current__desc">${weatherDesc}</div>
            <div class="weather-current__location">
              ${this._escapeHtml(locName)}
              <div style="font-size:0.65rem; color:var(--text-tertiary); line-height:1.2; margin-top:2px;">
                ${this._escapeHtml(locCity)} / Lat:${lat.toFixed(2)} Lon:${lon.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <div class="weather-forecast">${forecastHtml}</div>
        <div style="text-align: right; padding-top: 6px; font-size: 0.65rem; color: var(--text-tertiary);">Powered by Open-Meteo</div>
      `;

      this._bindHovers(data);
    } catch (e) {
      const msg = e.message === '地域が見つかりません' ? '地域が見つかりません' : '設定から都市を確認してください';
      body.innerHTML = `<div class="empty-state">天気情報を取得できませんでした<br><span style="font-size:0.72rem;color:var(--text-tertiary)">${this._escapeHtml(msg)}</span></div>`;
    }
  }

  _bindHovers(data) {
    const current = this.element?.querySelector(`#weather-current-${this.id}`);
    if (!current) return;

    current.addEventListener('mouseenter', () => {
      clearTimeout(this._hideTimer);
      this._hoverTimer = setTimeout(() => {
        this._showPopup(current, data);
      }, 400);
    });
    current.addEventListener('mouseleave', () => {
      clearTimeout(this._hoverTimer);
      this._hideTimer = setTimeout(() => {
        this._hidePopup();
      }, 300);
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

    popup.onmouseenter = () => clearTimeout(this._hideTimer);
    popup.onmouseleave = () => {
      this._hideTimer = setTimeout(() => this._hidePopup(), 300);
    };
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
      { key: 'locationName', label: '都道府県', type: 'select', options: Object.keys(WeatherWidget.PREFECTURES).map(p => ({ value: p, label: p })) },
      { key: 'unit', label: '温度単位', type: 'select', options: [
        { value: 'celsius', label: '摂氏 (°C)' }, { value: 'fahrenheit', label: '華氏 (°F)' }
      ]},
    ];
  }
}
WidgetTypes.weather = WeatherWidget;
