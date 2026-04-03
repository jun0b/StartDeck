/**
 * App - アプリケーションエントリーポイント
 */
const App = {
  async init() {
    if (typeof PreviewManager !== 'undefined') PreviewManager.init();
    await SearchManager.init();
    await WidgetManager.init();
    await WidgetManager._applyBackground();
    this._bindGlobalEvents();
    this._initSettingsPanel();
    this._initIdleDetection();

    if (!WidgetManager.layout.widgets || WidgetManager.layout.widgets.length === 0) {
      this._setupDefaultWidgets();
    }
  },

  _setupDefaultWidgets() {
    WidgetManager.addWidget('clock', 0, { title: '時計', mode: 'digital', showSeconds: true, showDate: true, use24h: true });
    WidgetManager.addWidget('bookmark', 0, {
      title: 'ブックマーク',
      displayMode: 'icon',
      activeGroupIndex: 0,
      groups: [
        {
          name: 'よく使う',
          bookmarks: [
            { name: 'YouTube', url: 'https://www.youtube.com/' },
            { name: 'Google', url: 'https://www.google.com/' },
            { name: 'Twitter/X', url: 'https://x.com/' },
            { name: 'GitHub', url: 'https://github.com/' },
          ]
        }
      ]
    });
    WidgetManager.addWidget('weather', 0, { title: '天気', locationName: '東京', latitude: 35.6895, longitude: 139.6917 });
    WidgetManager.addWidget('rss', 1, { title: 'ニュース', feeds: [{ name: 'NHK', url: 'https://www.nhk.or.jp/rss/news/cat0.xml' }], perPage: 7, showThumbnail: true });
    WidgetManager.addWidget('task', 1, { title: 'タスク', tasks: [], showCompleted: true });
    WidgetManager.addWidget('memo', 2, { title: 'メモ', memos: [{ name: 'メモ 1', content: '' }], activeTab: 0 });
  },

  _bindGlobalEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape') {
        if (document.body.classList.contains('is-idle')) {
          this._wakeUp();
          return;
        }
        if (typeof PreviewManager !== 'undefined' && PreviewManager.overlay?.classList.contains('active')) {
          PreviewManager.close();
          return;
        }
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
        document.querySelector('.settings-panel')?.classList.remove('open');
      }
    });

    document.addEventListener('error', (e) => {
      const target = e.target;
      if (target.tagName?.toLowerCase() === 'img') {
        if (target.hasAttribute('data-fallback')) {
          const fallback = target.getAttribute('data-fallback');
          if (target.src !== fallback) {
            target.src = fallback;
          }
        } else if (target.hasAttribute('data-hide-on-error')) {
          target.style.display = 'none';
        }
      }
    }, true);

    // --- Tab Scroll Logic Optimization ---
    let scrollUpdateTimer;
    const updateScrollButtons = (container) => {
      if (!container) return;
      const tabs = container.querySelector('.rss-tabs, .bookmark-tabs, .memo-tabs');
      if (!tabs) return;
      const leftBtn = container.querySelector('.tabs-scroll-btn.left');
      const rightBtn = container.querySelector('.tabs-scroll-btn.right');
      const canScrollLeft = tabs.scrollLeft > 2;
      const canScrollRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 2;
      if (leftBtn) leftBtn.classList.toggle('visible', canScrollLeft);
      if (rightBtn) rightBtn.classList.toggle('visible', canScrollRight);
    };

    document.addEventListener('mouseover', (e) => {
      const container = e.target.closest('.tabs-scroll-container');
      if (container) {
        updateScrollButtons(container);
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.tabs-scroll-btn');
      if (btn) {
        const tabs = btn.parentElement.querySelector('.rss-tabs, .bookmark-tabs, .memo-tabs');
        if (tabs) {
          const amount = 150;
          if (btn.classList.contains('left')) {
            tabs.scrollBy({ left: -amount, behavior: 'smooth' });
          } else {
            tabs.scrollBy({ left: amount, behavior: 'smooth' });
          }
          // スクロール後にボタン状態を更新
          setTimeout(() => updateScrollButtons(btn.parentElement), 300);
        }
      }
    });

    document.addEventListener('scroll', (e) => {
      if (e.target.classList && (e.target.classList.contains('rss-tabs') || e.target.classList.contains('bookmark-tabs') || e.target.classList.contains('memo-tabs'))) {
        if (scrollUpdateTimer) return;
        scrollUpdateTimer = setTimeout(() => {
          updateScrollButtons(e.target.closest('.tabs-scroll-container'));
          scrollUpdateTimer = null;
        }, 50);
      }
    }, true);
  },

  _initSettingsPanel() {
    const settingsBtn = document.getElementById('settings-toggle');
    const panel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('settings-close');

    let bgTimerInterval;
    const startBgTimer = () => {
      stopBgTimer();
      updateBgTimer();
      bgTimerInterval = setInterval(updateBgTimer, 1000);
    };
    const stopBgTimer = () => {
      if (bgTimerInterval) clearInterval(bgTimerInterval);
      const timerEl = document.getElementById('bg-update-timer');
      if (timerEl) timerEl.textContent = '';
    };
    const updateBgTimer = async () => {
      const timerEl = document.getElementById('bg-update-timer');
      if (!timerEl) return;
      const type = bgTypeSelect?.value || 'auto';
      if (type !== 'auto') {
        timerEl.textContent = '';
        return;
      }
      const cacheKey = `bg_cache_${type}`;
      const cached = await Storage.get(cacheKey, null);
      if (!cached || !cached.timestamp) {
        timerEl.textContent = '(未取得)';
        return;
      }
      const interval = parseInt(bgIntervalInput?.value || '60');
      const nextUpdate = cached.timestamp + (interval * 60 * 1000);
      const remaining = nextUpdate - Date.now();
      if (remaining <= 0) {
        timerEl.textContent = '(更新待ち)';
      } else {
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        
        const hStr = String(hours).padStart(2, '0');
        const mStr = String(mins).padStart(2, '0');
        const sStr = String(secs).padStart(2, '0');
        
        timerEl.textContent = `(あと ${hStr}:${mStr}:${sStr})`;
      }
    };

    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel?.classList.toggle('open');
      if (isOpen) startBgTimer();
      else stopBgTimer();
    });

    closeBtn?.addEventListener('click', () => {
      panel?.classList.remove('open');
      stopBgTimer();
    });

    // パネル外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (panel?.classList.contains('open')) {
        if (!panel.contains(e.target) && !settingsBtn.contains(e.target)) {
          panel.classList.remove('open');
          stopBgTimer();
        }
      }
    });

    panel?.addEventListener('click', (e) => {
      e.stopPropagation(); // パネル内でのクリックがドキュメントに伝播して閉じるのを防ぐ
    });

    // --- テーマ切替 ---
    const themeSelect = document.getElementById('setting-theme');
    const savedTheme = localStorage.getItem('hd_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('hd_theme', theme);
      });
    }

    // --- カラム数 ---
    const colCountSelect = document.getElementById('setting-columns');
    if (colCountSelect) {
      colCountSelect.value = WidgetManager.getColumnCount();
      colCountSelect.addEventListener('change', () => {
        WidgetManager.setColumnCount(parseInt(colCountSelect.value));
      });
    }

    // --- 透明度とブラー ---
    const opacitySlider = document.getElementById('setting-widget-opacity');
    const opacityVal = document.getElementById('val-widget-opacity');
    const blurSlider = document.getElementById('setting-widget-blur');
    const blurVal = document.getElementById('val-widget-blur');

    if (opacitySlider && opacityVal) {
      const currentOpacity = WidgetManager.layout.opacity ?? 0.72;
      opacitySlider.value = Math.round(currentOpacity * 100);
      opacityVal.textContent = Math.round(currentOpacity * 100) + '%';
      
      opacitySlider.addEventListener('input', () => {
        const val = parseInt(opacitySlider.value) / 100;
        opacityVal.textContent = opacitySlider.value + '%';
        WidgetManager.layout.opacity = val;
        WidgetManager._applyWidgetStyles();
        WidgetManager.saveLayout();
      });
    }

    if (blurSlider && blurVal) {
      const currentBlur = WidgetManager.layout.blur ?? 20;
      blurSlider.value = currentBlur;
      blurVal.textContent = currentBlur + 'px';
      
      blurSlider.addEventListener('input', () => {
        const val = parseInt(blurSlider.value);
        blurVal.textContent = val + 'px';
        WidgetManager.layout.blur = val;
        WidgetManager._applyWidgetStyles();
        WidgetManager.saveLayout();
      });
    }

    // --- 背景設定 ---
    const bgTypeSelect = document.getElementById('setting-bg-type');
    const bgUrlInput = document.getElementById('setting-bg-url');
    const bgApplyBtn = document.getElementById('setting-bg-apply');
    const bgUrlGroup = document.getElementById('bg-url-group');
    const bgFileGroup = document.getElementById('bg-file-group');
    const bgColorGroup = document.getElementById('bg-color-group');
    const bgColorInput = document.getElementById('setting-bg-color');
    const bgColorHex = document.getElementById('setting-bg-color-hex');

    const bgIntervalGroup = document.getElementById('bg-interval-group');
    const bgIntervalInput = document.getElementById('setting-bg-interval');

    const updateBgUI = (type) => {
      if (bgUrlGroup) bgUrlGroup.style.display = (type === 'custom') ? '' : 'none';
      if (bgFileGroup) bgFileGroup.style.display = (type === 'custom') ? '' : 'none';
      if (bgColorGroup) bgColorGroup.style.display = (type === 'solid') ? '' : 'none';
      if (bgIntervalGroup) bgIntervalGroup.style.display = (type === 'auto') ? '' : 'none';
    };

    // 背景をリアルタイム適用する共通関数
    const applyBgNow = async () => {
      const type = bgTypeSelect?.value || 'auto';
      const url = bgUrlInput?.value || '';
      const interval = parseInt(bgIntervalInput?.value || '60');

      if (type === 'custom' && url) {
        await WidgetManager.setBackground('custom', url);
      } else if (type === 'auto') {
        // 設定変更時、既存の画像があればその取得時刻を「今」に書き換えてタイマーをリセットする
        const cacheKey = `bg_cache_${type}`;
        const cached = await Storage.get(cacheKey, null);
        if (cached && cached.url) {
          cached.timestamp = Date.now();
          await Storage.set(cacheKey, cached);
        }
        await WidgetManager.setBackground(type, '', '', interval);
      } else if (type === 'solid') {
        const color = bgColorInput?.value || '#111114';
        await WidgetManager.setBackground('solid', '', color);
      } else {
        await WidgetManager.setBackground('none', '');
      }
      WidgetManager._applyBackground();
    };

    if (bgTypeSelect) {
      const currentType = WidgetManager.layout.background?.type || 'auto';
      bgTypeSelect.value = currentType;
      updateBgUI(currentType);
      bgTypeSelect.addEventListener('change', () => {
        updateBgUI(bgTypeSelect.value);
        applyBgNow();
        if (panel?.classList.contains('open')) updateBgTimer();
      });
    }

    if (bgUrlInput) {
      bgUrlInput.value = WidgetManager.layout.background?.url || '';
      bgUrlInput.addEventListener('change', () => applyBgNow()); // blur/Enter時
    }

    if (bgIntervalInput) {
      bgIntervalInput.value = WidgetManager.layout.background?.bgInterval || 60;
      bgIntervalInput.addEventListener('change', () => {
        let val = parseInt(bgIntervalInput.value);
        if (isNaN(val) || val < 1) val = 1;
        bgIntervalInput.value = val;
        applyBgNow();
        if (panel?.classList.contains('open')) updateBgTimer();
      });
    }

    // 背景色の初期値
    const savedColor = WidgetManager.layout.background?.color || '#111114';
    if (bgColorInput) bgColorInput.value = savedColor;
    if (bgColorHex) bgColorHex.value = savedColor;

    // カラーピッカーとテキスト入力の連動 + リアルタイム適用
    bgColorInput?.addEventListener('input', () => {
      if (bgColorHex) bgColorHex.value = bgColorInput.value;
      if (bgTypeSelect?.value === 'solid') applyBgNow();
    });
    bgColorHex?.addEventListener('change', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(bgColorHex.value) && bgColorInput) {
        bgColorInput.value = bgColorHex.value;
        if (bgTypeSelect?.value === 'solid') applyBgNow();
      }
    });

    bgApplyBtn?.addEventListener('click', () => applyBgNow());

    const bgFileInput = document.getElementById('setting-bg-file');
    bgFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        if (bgUrlInput) bgUrlInput.value = dataUrl;
        await WidgetManager.setBackground('custom', dataUrl);
        WidgetManager._applyBackground();
      };
      reader.readAsDataURL(file);
    });

    // --- データ ---
    const exportBtn = document.getElementById('setting-export');
    const importBtn = document.getElementById('setting-import');
    const importFile = document.getElementById('setting-import-file');

    exportBtn?.addEventListener('click', () => Storage.exportData());
    importBtn?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await Storage.importData(file);
        location.reload();
      } catch (err) {
        alert('インポートに失敗しました: ' + err.message);
      }
    });
  },

  _initIdleDetection() {
    const idleCheck = document.getElementById('setting-idle-enabled');
    const idleTimeInput = document.getElementById('setting-idle-time');
    const idleGroup = document.getElementById('idle-time-group');
    const idleTestBtn = document.getElementById('setting-idle-test');
    let idleTimeout;
    let clockInterval;
    let lastTestStartTime = 0; // テスト開始時のタイムスタンプを保持

    const resetTimer = (e) => {
      // テストボタンをクリックした直後（800ms以内）は操作を無視する
      if (this._lastTestStartTime && Date.now() - this._lastTestStartTime < 800) {
        return;
      }

      // 常に現在のIdle状態を確認して起きる
      if (document.body.classList.contains('is-idle')) {
        this._wakeUp();
      }
      
      clearTimeout(idleTimeout);
      
      const enabled = WidgetManager.layout.idleEnabled || false;
      const mins = parseInt(WidgetManager.layout.idleTime || 5);
      
      if (enabled && mins > 0) {
        idleTimeout = setTimeout(goIdle, mins * 60 * 1000);
      }
    };

    /**
     * 離席状態からの復帰（共有化）
     */
    this._wakeUp = () => {
      if (document.body.classList.contains('is-idle')) {
        document.body.classList.remove('is-idle');
        if (clockInterval) {
          clearTimeout(clockInterval);
          clockInterval = null;
        }
      }
    };

    const goIdle = () => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        resetTimer();
        return;
      }
      // テスト時、設定パネルなどは閉じる
      document.querySelector('.settings-panel')?.classList.remove('open');
      document.body.classList.add('is-idle');
      
      // ダイアログ（モーダル）やメニューをすべて閉じる
      try {
        document.querySelectorAll('.modal-overlay, .context-menu').forEach(el => el.remove());
        document.querySelectorAll('.widget-popup.visible').forEach(popup => popup.classList.remove('visible'));
      } catch (e) {
        console.error('Failed to cleanup overlays on idle:', e);
      }

      updateIdleClock();
    };

    const updateIdleClock = () => {
      // 次の秒の「0ミリ秒」の瞬間に更新を予約する同期ロジック
      const now = new Date();
      
      // 前のタイマーがあれば破棄（二重起動防止）
      if (clockInterval) {
        clearTimeout(clockInterval);
        clockInterval = null;
      }
      const clockEl = document.getElementById('idle-clock');
      const dateEl = document.getElementById('idle-date');
      if (clockEl) {
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        clockEl.textContent = `${hh}:${mm}:${ss}`;
      }
      if (dateEl) {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const day = days[now.getDay()];
        dateEl.textContent = `${m}/${d} ${day}`;
      }

      // 次の秒までのミリ秒を計算して再帰的にセット
      if (document.body.classList.contains('is-idle')) {
        const nextTick = 1000 - now.getMilliseconds();
        clockInterval = setTimeout(updateIdleClock, nextTick);
      }
    };

    // 初期値反映
    const isEnabled = WidgetManager.layout.idleEnabled || false;
    if (idleCheck) {
      idleCheck.checked = isEnabled;
      if (idleGroup) idleGroup.style.display = isEnabled ? 'block' : 'none';

      idleCheck.addEventListener('change', () => {
        const checked = idleCheck.checked;
        WidgetManager.layout.idleEnabled = checked;
        if (idleGroup) idleGroup.style.display = checked ? 'block' : 'none';
        WidgetManager.saveLayout();
        resetTimer();
      });
    }

    if (idleTimeInput) {
      idleTimeInput.value = WidgetManager.layout.idleTime || 5;
      idleTimeInput.addEventListener('change', () => {
        let val = parseInt(idleTimeInput.value);
        if (isNaN(val) || val < 1) val = 1;
        idleTimeInput.value = val;
        WidgetManager.layout.idleTime = val;
        WidgetManager.saveLayout();
        resetTimer();
      });
    }

    // テストボタン
    idleTestBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._lastTestStartTime = Date.now();
      goIdle();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(idleTimeout);
        if (clockInterval) {
          clearInterval(clockInterval);
          clockInterval = null;
        }
      } else {
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      document.addEventListener(evt, resetTimer, { capture: true, passive: true });
    });

    // iframe領域での操作検知対応 (mouseenter)
    document.addEventListener('mouseenter', (e) => {
      if (e.target.tagName === 'IFRAME') resetTimer(e);
    }, { capture: true, passive: true });

    resetTimer();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
