/**
 * PreviewManager - 外部リンクのプレビュー表示とリーダーモードを管理する
 */
const PreviewManager = {
  overlay: null,
  frame: null,
  loading: null,
  urlText: null,
  readerView: null,
  isReaderMode: false,
  currentUrl: '',
  zoomLevel: 1.0,

  init() {
    this.overlay = document.getElementById('link-preview-overlay');
    this.frame = document.getElementById('preview-frame');
    this.loading = this.overlay.querySelector('.preview-loading');
    this.urlText = document.getElementById('preview-url-text');
    this.readerView = document.getElementById('preview-reader-view');

    // 閉じるボタン
    document.getElementById('preview-close-btn')?.addEventListener('click', () => this.close());
    
    // 背景クリックで閉じる
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // 新しいタブで開くボタン
    document.getElementById('preview-open-external')?.addEventListener('click', () => {
      const url = this.currentUrl;
      if (url && url !== 'about:blank') {
        window.open(url, '_blank', 'noopener,noreferrer');
        this.close();
      }
    });

    // ズーム操作
    document.getElementById('preview-zoom-in')?.addEventListener('click', () => this.zoom(0.1));
    document.getElementById('preview-zoom-out')?.addEventListener('click', () => this.zoom(-0.1));
    document.getElementById('preview-zoom-text')?.addEventListener('click', () => this.resetZoom());

    // リーダーモード切り替え
    document.getElementById('preview-toggle-reader')?.addEventListener('click', () => this.toggleReader());

    // iframe読み込み完了イベント
    this.frame.addEventListener('load', () => {
      if (!this.isReaderMode) {
        this.loading.classList.add('done');
        setTimeout(() => this.loading.classList.add('hidden'), 400);
      }
    });
  },

  zoom(delta) {
    this.zoomLevel = Math.min(2.0, Math.max(0.5, this.zoomLevel + delta));
    this._applyZoom();
  },

  resetZoom() {
    this.zoomLevel = 1.0;
    this._applyZoom();
  },

  _applyZoom() {
    const text = document.getElementById('preview-zoom-text');
    if (text) text.textContent = `${Math.round(this.zoomLevel * 100)}%`;

    if (this.frame) {
      // transform: scale を使った疑似ズーム
      // 拡大時はiframe自体を逆数倍に広げてからscaleで縮めることで解像度を維持する
      const scale = this.zoomLevel;
      const invScale = 100 / scale;
      this.frame.style.width = `${invScale}%`;
      this.frame.style.height = `${invScale}%`;
      this.frame.style.transform = `scale(${scale})`;
      this.frame.style.transformOrigin = 'top left';
    }

    if (this.readerView) {
      // リーダーモードは標準のzoomプロパティが使いやすい
      this.readerView.style.zoom = this.zoomLevel;
    }
  },

  /**
   * プレビューを開く
   * @param {string} url 
   */
  open(url) {
    if (!url) return;
    if (url.startsWith('chrome://') || url.startsWith('about:')) return;

    this.currentUrl = url;
    this.isReaderMode = false;
    this.resetZoom();
    this.readerView.classList.add('hidden');
    this.frame.classList.remove('hidden');
    document.getElementById('preview-toggle-reader').classList.remove('active');

    this.urlText.textContent = url;
    this.loading.classList.remove('done', 'hidden');
    this.overlay.classList.add('active');
    this.frame.src = url;

    // 体感速度向上のため、最大3.5秒でローディング表示をフェードアウトさせる
    if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
    this._loadingTimeout = setTimeout(() => {
      if (!this.isReaderMode && this.overlay.classList.contains('active')) {
        this.loading.classList.add('done');
        setTimeout(() => this.loading.classList.add('hidden'), 400);
      }
    }, 3500);
  },

  close() {
    this.overlay.classList.remove('active');
    setTimeout(() => {
      this.frame.src = 'about:blank';
      this.currentUrl = '';
      this.isReaderMode = false;
    }, 400);
  },

  async toggleReader() {
    const btn = document.getElementById('preview-toggle-reader');
    this.isReaderMode = !this.isReaderMode;

    if (this.isReaderMode) {
      btn.classList.add('active');
      this.frame.classList.add('hidden');
      this.readerView.classList.remove('hidden');
      this.loading.classList.remove('hidden');
      await this.loadReaderContent();
    } else {
      btn.classList.remove('active');
      this.readerView.classList.add('hidden');
      this.frame.classList.remove('hidden');
      this.loading.classList.add('hidden');
    }
  },

  async loadReaderContent() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'proxyFetch', url: this.currentUrl });
      if (!response || !response.ok) throw new Error('本文の取得に失敗しました');

      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'text/html');
      
      const title = doc.querySelector('h1')?.innerText || doc.title;
      const body = this.extractMainContent(doc);

      document.getElementById('reader-title').textContent = title;
      document.getElementById('reader-meta').textContent = new URL(this.currentUrl).hostname;
      document.getElementById('reader-body').innerHTML = body;

    } catch (err) {
      document.getElementById('reader-body').innerHTML = `<p style="color:var(--accent-danger)">リーダーモードで読み込めませんでした。${err.message}</p>`;
    } finally {
      this.loading.classList.add('hidden');
    }
  },

  /**
   * 本文っぽい要素を力技で抽出する簡易版
   */
  extractMainContent(doc) {
    // 不要な要素を削除
    const removals = 'script, style, nav, footer, header, aside, .ads, .comment, #comments, .sidebar, .menu, .nav, .footer';
    doc.querySelectorAll(removals).forEach(el => el.remove());

    // 本文が含まれていそうな要素の候補
    let bestEl = null;
    let maxPCount = 0;

    // articleタグがあれば最優先
    const article = doc.querySelector('article');
    if (article) return article.innerHTML;

    // Pタグが多い要素を探す
    const candidates = doc.querySelectorAll('div, section, main');
    candidates.forEach(el => {
      const pTags = el.querySelectorAll('p');
      if (pTags.length > maxPCount) {
        maxPCount = pTags.length;
        bestEl = el;
      }
    });

    if (bestEl) {
      // 本文以外のリンク（ナビゲーション等）をさらに削る
      const content = bestEl.cloneNode(true);
      return content.innerHTML;
    }

    return '本文の抽出に失敗しました。';
  },

  bindLinks(container) {
    const links = container.querySelectorAll('a[href^="http"]');
    links.forEach(a => {
      if (a.querySelector('.preview-trigger-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'preview-trigger-icon';
      icon.title = 'プレビューを表示';
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.open(a.href);
      });
      const titleEl = a.querySelector('.rss-article__title') || a;
      if (titleEl === a) a.appendChild(icon);
      else titleEl.appendChild(icon);
    });
  }
};
