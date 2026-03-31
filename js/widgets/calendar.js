/**
 * CalendarWidget - Googleカレンダー(iCal)ウィジェット
 */
class CalendarWidget extends WidgetBase {
  static widgetType = 'calendar';
  static defaultConfig = {
    title: 'カレンダー',
    calendars: [],
    daysAhead: 7
  };

  renderBody() {
    const cals = this.config.calendars || [];
    if (cals.length === 0) {
      return `
        <div class="empty-state">
          カレンダーが設定されていません<br>
          <span style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px">
            「･･･」メニューの「カレンダーを管理」からiCal URLを追加してください
          </span>
        </div>`;
    }

    return `
      <div class="calendar-events" id="cal-events-${this.id}">
        <div class="loading-spinner"></div>
      </div>`;
  }

  onMount() {
    if ((this.config.calendars || []).length > 0) {
      this._loadEvents();
    }
  }

  async _loadEvents() {
    const eventsEl = this.element?.querySelector(`#cal-events-${this.id}`);
    if (!eventsEl) return;

    const allEvents = [];
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

    for (let ci = 0; ci < this.config.calendars.length; ci++) {
      const cal = this.config.calendars[ci];
      try {
        const res = await new Promise((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'proxyFetch', url: cal.url }, resolve);
          } else {
            fetch(cal.url)
              .then(r => r.text())
              .then(text => resolve({ ok: true, data: text }))
              .catch(err => resolve({ ok: false, error: err.message }));
          }
        });
        if (!res || !res.ok) throw new Error(res?.error || 'Fetch failed');
        const events = this._parseIcal(res.data);
        const color = colors[ci % colors.length];
        events.forEach(e => { e.color = color; e.calName = cal.name; });
        allEvents.push(...events);
      } catch (e) {
        console.warn('Calendar fetch error:', cal.name, e);
      }
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(todayStart);
    endDate.setDate(endDate.getDate() + (this.config.daysAhead || 7));

    // フィルター: 今日の過去イベントや終日イベントが消えないように調整
    const filtered = allEvents
      .filter(e => {
        let eventEnd = e.end;
        if (!eventEnd) {
          eventEnd = new Date(e.start);
          if (e.allDay) eventEnd.setDate(eventEnd.getDate() + 1);
        }
        // イベントの終了時刻が現在より未来、かつ開始時刻が表示期間内（endDateより前）であること
        return eventEnd > now && e.start < endDate;
      })
      .sort((a, b) => a.start - b.start);

    if (filtered.length === 0) {
      eventsEl.innerHTML = '<div class="empty-state">今後の予定はありません</div>';
      return;
    }

    let html = '';
    let currentDate = '';
    const days = ['日', '月', '火', '水', '木', '金', '土'];

    // 直近の予定（今日・明日）を判定するための基準日時
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (let i = 0; i < filtered.length; i++) {
      const event = filtered[i];
      const dateStr = `${event.start.getMonth() + 1}/${event.start.getDate()}(${days[event.start.getDay()]})`;
      const isToday = event.start.toDateString() === now.toDateString();
      const isTomorrow = event.start.toDateString() === tomorrow.toDateString();

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        let headerCls = 'calendar-date-header';
        let headerText = dateStr;

        if (isToday) {
          headerCls += ' calendar-date-header--today';
          headerText = '今日';
        } else if (isTomorrow) {
          headerText = '明日';
        }
        html += `<div class="${headerCls}">${headerText}</div>`;
      }

      const timeStr = event.allDay ? '終日' :
        `${String(event.start.getHours()).padStart(2,'0')}:${String(event.start.getMinutes()).padStart(2,'0')}` +
        (event.end ? ` - ${String(event.end.getHours()).padStart(2,'0')}:${String(event.end.getMinutes()).padStart(2,'0')}` : '');

      let eventCls = 'calendar-event';
      // 直近の予定（今日のこれから、または現在進行中）をハイライト
      const isUpcoming = isToday && (event.start >= now || (event.end && event.end > now && event.start <= now));
      if (isUpcoming) eventCls += ' calendar-event--upcoming';

      html += `
        <div class="${eventCls}" data-index="${i}">
          <div class="calendar-event__color" style="background:${event.color}"></div>
          <div class="calendar-event__info">
            <div class="calendar-event__title">${this._escapeHtml(event.summary)}</div>
            <div class="calendar-event__time">${timeStr}</div>
          </div>
        </div>`;
    }

    eventsEl.innerHTML = html;

    eventsEl.querySelectorAll('.calendar-event').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index, 10);
        if (filtered[index]) {
          this._showEventDetails(filtered[index]);
        }
      });
    });
  }

  _parseIcal(icalText) {
    const events = [];
    const eventBlocks = icalText.split('BEGIN:VEVENT');

    const now = new Date();
    const expandLimit = new Date();
    expandLimit.setDate(expandLimit.getDate() + 90);

    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split('END:VEVENT')[0];
      const summary = this._getIcalProp(block, 'SUMMARY');
      const dtstart = this._getIcalProp(block, 'DTSTART');
      const dtend = this._getIcalProp(block, 'DTEND');
      const rrule = this._getIcalProp(block, 'RRULE');
      let description = this._getIcalProp(block, 'DESCRIPTION');
      let location = this._getIcalProp(block, 'LOCATION');

      if (description) description = description.replace(/\\n/g, '\n').replace(/\\,/g, ',');
      if (location) location = location.replace(/\\,/g, ',');

      if (!summary || !dtstart) continue;

      const allDay = dtstart.length === 8;
      const start = this._parseIcalDate(dtstart);
      const end = dtend ? this._parseIcalDate(dtend) : null;

      if (!start) continue;

      const duration = end ? end.getTime() - start.getTime() : 0;

      // オリジナルのイベントを追加
      events.push({ summary, start: new Date(start), end: end ? new Date(end) : null, allDay, description, location });

      // 簡易的な繰り返し（RRULE）展開の解釈（WEEKLYやDAILYなど）
      if (rrule) {
        const rruleMap = {};
        rrule.split(';').forEach(part => {
          const [k, v] = part.split('=');
          if (k && v) rruleMap[k] = v;
        });

        let untilDate = expandLimit;
        if (rruleMap['UNTIL']) {
          const ud = this._parseIcalDate(rruleMap['UNTIL']);
          if (ud && ud < untilDate) untilDate = ud;
        }

        const freq = rruleMap['FREQ'];
        const interval = parseInt(rruleMap['INTERVAL']) || 1;

        let pDate = new Date(start);

        for (let j = 0; j < 50; j++) {
          if (freq === 'DAILY') pDate.setDate(pDate.getDate() + interval);
          else if (freq === 'WEEKLY') pDate.setDate(pDate.getDate() + interval * 7);
          else if (freq === 'MONTHLY') pDate.setMonth(pDate.getMonth() + interval);
          else if (freq === 'YEARLY') pDate.setFullYear(pDate.getFullYear() + interval);
          else break;

          if (pDate > untilDate || pDate > expandLimit) break;

          events.push({
            summary,
            start: new Date(pDate),
            end: duration ? new Date(pDate.getTime() + duration) : null,
            allDay,
            description,
            location
          });
        }
      }
    }

    return events;
  }

  _getIcalProp(block, prop) {
    const regex = new RegExp(`(?:^|\\n)${prop}[^:]*:(.+?)(?:\\r?\\n(?!\\s)|$)`, 's');
    const match = block.match(regex);
    if (!match) return null;
    return match[1].replace(/\r?\n\s/g, '').trim();
  }

  _parseIcalDate(str) {
    try {
      if (str.length === 8) {
        return new Date(parseInt(str.substr(0,4)), parseInt(str.substr(4,2))-1, parseInt(str.substr(6,2)));
      }
      const clean = str.replace(/[TZ]/g, (c) => c === 'T' ? 'T' : '');
      if (str.includes('Z')) {
        return new Date(Date.UTC(
          parseInt(clean.substr(0,4)), parseInt(clean.substr(4,2))-1, parseInt(clean.substr(6,2)),
          parseInt(clean.substr(9,2)||0), parseInt(clean.substr(11,2)||0), parseInt(clean.substr(13,2)||0)
        ));
      }
      return new Date(
        parseInt(clean.substr(0,4)), parseInt(clean.substr(4,2))-1, parseInt(clean.substr(6,2)),
        parseInt(clean.substr(9,2)||0), parseInt(clean.substr(11,2)||0)
      );
    } catch { return null; }
  }

  _formatTextWithLinks(text) {
    if (!text) return '';
    const escaped = this._escapeHtml(text);
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return escaped.replace(urlRegex, '<a href="$1" style="color:var(--accent-primary);text-decoration:underline">$1</a>');
  }

  _formatDescription(text) {
    if (!text) return '';
    const hasHtml = /<[a-z][\s\S]*>/i.test(text);
    if (hasHtml) {
      // HTMLが含まれている場合は安全にaタグのtargetのみ書き換える
      const temp = document.createElement('div');
      // 拡張機能はCSP(Script Src 'self')が適用されているためinnerHTMLでもスクリプト実行はブロックされるので比較的安全
      temp.innerHTML = text;
      temp.querySelectorAll('a').forEach(a => {
        // a.target = '_blank'; // 今回の対応で新規タブでは開かないように削除
        a.style.color = 'var(--accent-primary)';
        a.style.textDecoration = 'underline';
      });
      return temp.innerHTML;
    } else {
      // 単なるテキストの場合はURLをリンクにし、改行をbrに変換
      return this._formatTextWithLinks(text).replace(/\n/g, '<br>');
    }
  }

  _showEventDetails(event) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${event.start.getFullYear()}年${event.start.getMonth() + 1}月${event.start.getDate()}日(${days[event.start.getDay()]})`;

    let timeStr = event.allDay ? '終日' :
      `${String(event.start.getHours()).padStart(2,'0')}:${String(event.start.getMinutes()).padStart(2,'0')}`;

    if (!event.allDay && event.end) {
      if (event.start.toDateString() === event.end.toDateString()) {
        timeStr += ` - ${String(event.end.getHours()).padStart(2,'0')}:${String(event.end.getMinutes()).padStart(2,'0')}`;
      } else {
        timeStr += ` - ${event.end.getMonth() + 1}/${event.end.getDate()} ${String(event.end.getHours()).padStart(2,'0')}:${String(event.end.getMinutes()).padStart(2,'0')}`;
      }
    }

    const descContent = this._formatDescription(event.description);
    const locContent = this._formatTextWithLinks(event.location);

    const descHtml = event.description ? `<div style="margin-top:16px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary);background:var(--bg-input);padding:12px;border-radius:var(--border-radius-sm);word-break:break-word;overflow-wrap:anywhere">${descContent}</div>` : '';
    const locHtml = event.location ? `<div style="margin-top:12px;font-size:0.85rem;display:flex;align-items:flex-start;gap:6px"><svg style="width:16px;height:16px;flex-shrink:0;color:var(--text-tertiary);margin-top:2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span style="color:var(--text-primary);word-break:break-all">${locContent}</span></div>` : '';

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
            <div style="width:14px;height:14px;border-radius:3px;background:${event.color};flex-shrink:0"></div>
            <span class="modal__title" style="font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this._escapeHtml(event.summary)}">${this._escapeHtml(event.summary)}</span>
          </div>
          <button class="modal__close" style="flex-shrink:0;margin-left:8px">&times;</button>
        </div>
        <div class="modal__body" style="padding:20px;max-height:60vh;overflow-y:auto">
          <div style="font-size:0.95rem;font-weight:500;color:var(--text-primary);display:flex;align-items:center;flex-wrap:wrap;gap:8px">
            <svg style="width:16px;height:16px;flex-shrink:0;color:var(--text-tertiary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${dateStr} <span style="color:var(--text-secondary);font-weight:400">${timeStr}</span>
          </div>
          ${locHtml}
          ${descHtml}
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  _showManageDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let currentUrl = '';
    if (this.config.calendars && this.config.calendars.length > 0) {
      currentUrl = this.config.calendars[0].url || '';
    }

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><span class="modal__title">iCalカレンダー設定</span><button class="modal__close">&times;</button></div>
        <div class="modal__body">
          <div style="margin-bottom:12px;font-size:0.78rem;color:var(--text-secondary)">
            Googleカレンダーの「設定」→ カレンダーを選択 → 「iCal形式の秘密のアドレス」をコピーして貼り付けてください
          </div>
          <div class="form-group"><label class="form-label">iCal URL</label><input class="form-input" id="cal-url" value="${this._escapeHtml(currentUrl)}" placeholder="https://calendar.google.com/..."></div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-close-btn">キャンセル</button>
          <button class="btn btn--primary" id="cal-save-btn">保存</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this.updateBody(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#cal-save-btn')?.addEventListener('click', () => {
      const url = overlay.querySelector('#cal-url').value.trim();
      if (!url) {
        this.config.calendars = [];
      } else {
        this.config.calendars = [{ url }];
      }
      this.save();
      close();
      this._loadEvents();
    });

    document.body.appendChild(overlay);
  }

  getContextMenuItems() {
    return [
      { action: 'manageCalendars', label: 'カレンダーを管理', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
      { action: 'refresh', label: '更新', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'manageCalendars') {
      this._showManageDialog();
      return true;
    } else if (action === 'refresh') {
      this._loadEvents();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'daysAhead', label: '表示日数', type: 'number', min: 1, max: 30 }
    ];
  }
}
WidgetTypes.calendar = CalendarWidget;
