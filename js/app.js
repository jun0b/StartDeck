/**
 * App - アプリケーションエントリーポイント
 */
const App = {
  async init() {
    await SearchManager.init();
    await WidgetManager.init();
    await WidgetManager._applyBackground();
    this._bindGlobalEvents();
    this._initSettingsPanel();

    if (!WidgetManager.layout.widgets || WidgetManager.layout.widgets.length === 0) {
      this._setupDefaultWidgets();
    }
  },

  _setupDefaultWidgets() {
    WidgetManager.addWidget('clock', 0, { title: '時計', mode: 'digital', showSeconds: true, showDate: true, use24h: true });
    WidgetManager.addWidget('bookmark', 0, {
      title: 'ブックマーク',
      displayMode: 'icon',
      bookmarks: [
        { name: 'YouTube', url: 'https://www.youtube.com/' },
        { name: 'Google', url: 'https://www.google.com/' },
        { name: 'Twitter/X', url: 'https://x.com/' },
        { name: 'GitHub', url: 'https://github.com/' },
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
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
        document.querySelector('.settings-panel')?.classList.remove('open');
      }
    });
  },

  _initSettingsPanel() {
    const settingsBtn = document.getElementById('settings-toggle');
    const panel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('settings-close');

    settingsBtn?.addEventListener('click', () => panel?.classList.toggle('open'));
    closeBtn?.addEventListener('click', () => panel?.classList.remove('open'));

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

    // --- 背景設定 ---
    const bgTypeSelect = document.getElementById('setting-bg-type');
    const bgUrlInput = document.getElementById('setting-bg-url');
    const bgApplyBtn = document.getElementById('setting-bg-apply');
    const bgUrlGroup = document.getElementById('bg-url-group');
    const bgFileGroup = document.getElementById('bg-file-group');
    const bgColorGroup = document.getElementById('bg-color-group');
    const bgColorInput = document.getElementById('setting-bg-color');
    const bgColorHex = document.getElementById('setting-bg-color-hex');

    const updateBgUI = (type) => {
      if (bgUrlGroup) bgUrlGroup.style.display = (type === 'custom') ? '' : 'none';
      if (bgFileGroup) bgFileGroup.style.display = (type === 'custom' || type === 'auto') ? '' : 'none';
      if (bgColorGroup) bgColorGroup.style.display = (type === 'solid') ? '' : 'none';
    };

    // 背景をリアルタイム適用する共通関数
    const applyBgNow = async () => {
      const type = bgTypeSelect?.value || 'auto';
      const url = bgUrlInput?.value || '';
      if (type === 'custom' && url) {
        await WidgetManager.setBackground('custom', url);
      } else if (type === 'auto') {
        await Storage.remove('bg_cache');
        await WidgetManager.setBackground('auto', '');
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
      });
    }

    if (bgUrlInput) {
      bgUrlInput.value = WidgetManager.layout.background?.url || '';
      bgUrlInput.addEventListener('change', () => applyBgNow()); // blur/Enter時
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
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
