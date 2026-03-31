/**
 * RSSWidget - RSSフィードウィジェット
 */
class RSSWidget extends WidgetBase {
  static widgetType = 'rss';
  static defaultConfig = {
    title: 'ニュース',
    feeds: [
      { name: 'Google ニュース', url: 'https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja' },
    ],
    activeTab: 0,
    perPage: 7,
    showThumbnail: true
  };

  constructor(id, config) {
    super(id, config);
    this._articles = {};
    this._currentPage = 0;
    this._loading = false;

    // 既存ユーザー向け：初期設定がNHKのままの場合、Googleニュースに自動置換
    if (this.config.feeds && this.config.feeds.length === 1 &&
        this.config.feeds[0].url === 'https://www.nhk.or.jp/rss/news/cat0.xml') {
      this.config.feeds[0] = { name: 'Google ニュース', url: 'https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja' };
      this.save();
    }
  }

  renderBody() {
    const feeds = this.config.feeds || [];
    if (feeds.length === 0) {
      return `<div class="empty-state" style="padding:20px 0">フィードがありません<br><span style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px;display:inline-block">「･･･」メニューからフィードを追加してください</span></div>`;
    }

    const active = Math.min(this.config.activeTab || 0, feeds.length - 1);
    const tabs = feeds.map((f, i) => {
      let pageUrl = f.url;
      try { pageUrl = new URL(f.url).origin; } catch {}
      const u = new URL(chrome.runtime.getURL("/_favicon/"));
      u.searchParams.set("pageUrl", pageUrl);
      u.searchParams.set("size", "32");
      return `<div class="rss-tab ${i === active ? 'active' : ''}" data-idx="${i}">
        <img class="rss-tab__icon" src="${u.toString()}" alt="" data-hide-on-error="true">
        <span>${this._escapeHtml(f.name)}</span>
      </div>`;
    }).join('');

    return `
      <div class="tabs-scroll-container">
        <button class="tabs-scroll-btn left"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="rss-tabs">
          ${tabs}
        </div>
        <button class="tabs-scroll-btn right"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
      <div class="rss-article-list" id="rss-list-${this.id}">
        <div class="loading-spinner"></div>
      </div>
      <div class="rss-pagination" id="rss-pagination-${this.id}"></div>
    `;
  }

  onMount() {
    if (!this.element) return;

    this.element.querySelectorAll('.rss-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetIdx = parseInt(tab.dataset.idx);
        if (this.config.activeTab === targetIdx) return;

        this.element.querySelectorAll('.rss-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        this.config.activeTab = targetIdx;
        this._currentPage = 0;
        this.save();

        const feed = (this.config.feeds || [])[targetIdx];
        if (feed) {
          const listEl = this.element.querySelector(`#rss-list-${this.id}`);
          if (listEl) listEl.innerHTML = '<div class="loading-spinner"></div>';
          const pagEl = this.element.querySelector(`#rss-pagination-${this.id}`);
          if (pagEl) pagEl.innerHTML = '';
          this._loadFeed(feed, targetIdx);
        }
      });
    });

    const activeIdx = this.config.activeTab || 0;
    const feed = (this.config.feeds || [])[activeIdx];
    if (feed) this._loadFeed(feed, activeIdx);
  }

  async _loadFeed(feed, idx) {
    const listEl = this.element?.querySelector(`#rss-list-${this.id}`);
    if (!listEl) return;

    const cacheKey = `rss_cache_${feed.url}`;
    const cached = await Storage.get(cacheKey, null);
    const now = Date.now();

    if (cached && cached.articles && (now - cached.timestamp < 600000)) {
      this._articles[idx] = cached.articles;
      this._renderArticles(listEl);
      return;
    }

    try {
      let text;
      // Service Worker経由でfetch（CORSバイパス）
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const response = await chrome.runtime.sendMessage({ action: 'proxyFetch', url: feed.url });
        if (response && response.ok) {
          text = response.data;
        } else {
          throw new Error(response?.error || 'Fetch failed');
        }
      } else {
        // フォールバック: 直接fetch（file://で開いた場合等）
        const res = await fetch(feed.url);
        text = await res.text();
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');

      const articles = [];
      const items = doc.querySelectorAll('item, entry');
      items.forEach(item => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || item.querySelector('link')?.getAttribute('href') || '';
        const desc = item.querySelector('description, summary, content')?.textContent || '';
        const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';
        let thumb = '';
        const enclosure = item.querySelector('enclosure[type^="image"], media\\:content, media\\:thumbnail');
        if (enclosure) thumb = enclosure.getAttribute('url') || '';
        if (!thumb) {
          const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
          if (imgMatch) thumb = imgMatch[1];
        }

        const fullDesc = this._stripHtml(desc);
        articles.push({
          title,
          link,
          desc: fullDesc.substring(0, 200),
          fullDesc: fullDesc,
          pubDate,
          thumb
        });
      });

      this._articles[idx] = articles;
      await Storage.set(cacheKey, { articles, timestamp: now });
      this._renderArticles(listEl);
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">フィードを読み込めませんでした<br><span style="font-size:0.72rem">${this._escapeHtml(e.message)}</span></div>`;
    }
  }

  _renderArticles(listEl) {
    const idx = this.config.activeTab || 0;
    const articles = this._articles[idx] || [];
    const perPage = this.config.perPage || 7;
    const totalPages = Math.max(1, Math.ceil(articles.length / perPage));
    this._currentPage = Math.min(this._currentPage, totalPages - 1);
    const start = this._currentPage * perPage;
    const pageArticles = articles.slice(start, start + perPage);
    const showThumb = this.config.showThumbnail;

    listEl.innerHTML = pageArticles.map((a, i) => {
      const timeAgo = a.pubDate ? this._timeAgo(new Date(a.pubDate)) : '';
      const articleIdx = start + i;
      return `
        <a href="${this._escapeHtml(a.link)}" class="rss-article" rel="noopener" data-idx="${articleIdx}">
          ${showThumb && a.thumb ? `<img class="rss-article__thumb" src="${this._escapeHtml(a.thumb)}" alt="" loading="lazy" data-hide-on-error="true">` : ''}
          <div class="rss-article__content">
            <div class="rss-article__title">${this._escapeHtml(a.title)}</div>
            <div class="rss-article__summary">
              <span class="rss-article__date">${timeAgo}</span>
              ${a.desc ? ` — ${this._escapeHtml(a.desc)}` : ''}
            </div>
          </div>
        </a>`;
    }).join('') || '<div class="empty-state">記事がありません</div>';

    this._bindArticleHovers(listEl);

    const pagEl = this.element?.querySelector(`#rss-pagination-${this.id}`);
    if (pagEl && totalPages > 1) {
      pagEl.innerHTML = `
        <button class="rss-pagination__btn" id="rss-prev-${this.id}" ${this._currentPage === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="rss-pagination__info">${this._currentPage + 1}/${totalPages}</span>
        <button class="rss-pagination__btn" id="rss-next-${this.id}" ${this._currentPage >= totalPages - 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      `;
      pagEl.querySelector(`#rss-prev-${this.id}`)?.addEventListener('click', () => {
        if (this._currentPage > 0) { this._currentPage--; this._renderArticles(listEl); }
      });
      pagEl.querySelector(`#rss-next-${this.id}`)?.addEventListener('click', () => {
        if (this._currentPage < totalPages - 1) { this._currentPage++; this._renderArticles(listEl); }
      });
    } else if (pagEl) {
      pagEl.innerHTML = '';
    }
  }

  _timeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    return `${Math.floor(diff / 86400)}日前`;
  }

  _bindArticleHovers(listEl) {
    const articles = listEl.querySelectorAll('.rss-article');
    const tabIdx = this.config.activeTab || 0;
    const allArticles = this._articles[tabIdx] || [];

    articles.forEach(el => {
      let timer;
      el.addEventListener('mouseenter', (e) => {
        timer = setTimeout(() => {
          const idx = parseInt(el.dataset.idx);
          const data = allArticles[idx];
          if (data) this._showPopup(el, data);
        }, 400); // 400msホバーで表示
      });

      el.addEventListener('mouseleave', () => {
        clearTimeout(timer);
        this._hidePopup();
      });
    });
  }

  _showPopup(targetEl, data) {
    let popup = document.querySelector('.widget-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'widget-popup';
      document.body.appendChild(popup);
    }

    popup.innerHTML = `
      <div class="widget-popup__title">${this._escapeHtml(data.title)}</div>
      <div class="widget-popup__body">${this._escapeHtml(data.fullDesc || data.desc)}</div>
      <div class="widget-popup__footer">
        <a href="${this._escapeHtml(data.link)}" class="widget-popup__link" rel="noopener">
          元の記事を読む
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    `;

    const rect = targetEl.getBoundingClientRect();
    const popupWidth = 380;

    // 表示位置の計算
    let left = rect.right + 10;
    let top = rect.top;

    // 右側にスペースがない場合は左側に表示
    if (left + popupWidth > window.innerWidth) {
      left = rect.left - popupWidth - 10;
    }

    // 上下の調整
    if (top + 300 > window.innerHeight) {
      top = window.innerHeight - 320;
    }

    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
    popup.classList.add('visible');

    // ポップアップ自体にマウスが乗っている間は消さない
    popup.onmouseenter = () => {
      popup.classList.add('visible');
    };
    popup.onmouseleave = () => {
      this._hidePopup();
    };
  }

  _hidePopup() {
    const popup = document.querySelector('.widget-popup');
    if (popup) {
      popup.classList.remove('visible');
    }
  }

  _getDomain(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }

  _stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
  }

  _showManageDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // parentModalとして自身を渡すためにzIndexを指定しないか、基本のままでOK
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">RSSフィードを管理</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div style="margin-bottom:16px;max-height:300px;overflow-y:auto;overscroll-behavior:contain" id="rss-feed-list">
            ${(this.config.feeds || []).map((f, i) => `
              <div class="draggable-item" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:4px;padding:8px 0;border-bottom:1px solid var(--border-color); cursor: grab; transition: opacity 0.2s;">
                <span style="font-size:0.8rem;color:var(--text-tertiary);padding-right:4px">≡</span>
                <span style="flex:1;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${this._escapeHtml(f.url)}">${this._escapeHtml(f.name)}</span>
                <button class="btn btn--ghost" style="padding:2px 8px;font-size:0.75rem" data-action="edit" data-idx="${i}">編集</button>
                <button class="btn btn--danger" style="padding:2px 8px;font-size:0.75rem" data-remove="${i}">削除</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn--ghost" id="btn-add-feed" style="width:100%;font-size:0.85rem">+ 新しいフィードを追加</button>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary modal-close-btn">閉じる</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this.updateBody(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.remove);
        if (confirm(`「${this.config.feeds[i].name}」を削除しますか？`)) {
          this.config.feeds.splice(i, 1);
          if (this.config.activeTab >= this.config.feeds.length) {
            this.config.activeTab = Math.max(0, this.config.feeds.length - 1);
          }
          this.save();
          overlay.remove();
          this._showManageDialog();
        }
      });
    });

    overlay.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._showEditDialog(parseInt(btn.dataset.idx), overlay);
      });
    });

    overlay.querySelector('#btn-add-feed').addEventListener('click', () => {
      this._showEditDialog(-1, overlay);
    });

    // ドラッグ＆ドロップ実装
    let draggedIdx = null;
    overlay.querySelectorAll('.draggable-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedIdx = parseInt(item.dataset.idx);
        e.dataTransfer.effectAllowed = 'move';
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        overlay.querySelectorAll('.draggable-item').forEach(el => {
          el.style.borderTop = '';
          el.style.borderBottom = '1px solid var(--border-color)';
        });
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          item.style.borderTop = '2px solid var(--accent-primary)';
          item.style.borderBottom = '1px solid var(--border-color)';
        } else {
          item.style.borderTop = '';
          item.style.borderBottom = '2px solid var(--accent-primary)';
        }
      });
      item.addEventListener('dragleave', () => {
        item.style.borderTop = '';
        item.style.borderBottom = '1px solid var(--border-color)';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = parseInt(item.dataset.idx);
        if (draggedIdx === null || draggedIdx === targetIdx) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let insertIdx = targetIdx;
        if (e.clientY > midY) insertIdx++;

        const arr = this.config.feeds;
        const [movedItem] = arr.splice(draggedIdx, 1);
        if (insertIdx > draggedIdx) insertIdx--;
        arr.splice(insertIdx, 0, movedItem);

        this.save();
        overlay.remove();
        this._showManageDialog();
      });
    });

    document.body.appendChild(overlay);
  }

  _showEditDialog(editIndex = -1, parentModal = null) {
    const isEdit = editIndex >= 0;
    const feed = isEdit ? this.config.feeds[editIndex] : { name: '', url: '' };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // 既存のモーダルより上に表示するためのz-index調整
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">${isEdit ? 'フィードを編集' : '新しいフィードを追加'}</span>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="form-label">フィード名</label>
            <input class="form-input" id="rss-feed-name" value="${this._escapeHtml(feed.name)}" placeholder="例: NHK">
          </div>
          <div class="form-group">
            <label class="form-label">RSS URL</label>
            <input class="form-input" id="rss-feed-url" value="${this._escapeHtml(feed.url)}" placeholder="https://...">
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-cancel-btn">キャンセル</button>
          <button class="btn btn--primary" id="rss-save-btn">${isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel-btn').addEventListener('click', close);

    overlay.querySelector('#rss-save-btn').addEventListener('click', () => {
      const name = overlay.querySelector('#rss-feed-name').value.trim();
      const url = overlay.querySelector('#rss-feed-url').value.trim();
      if (!name || !url) {
        alert('フィード名とURLを入力してください');
        return;
      }
      
      if (!this.config.feeds) this.config.feeds = [];
      
      if (isEdit) {
        this.config.feeds[editIndex] = { name, url };
      } else {
        this.config.feeds.push({ name, url });
      }
      
      this.save();
      close();
      if (parentModal) {
        parentModal.remove();
        this._showManageDialog();
      } else {
        this.updateBody();
      }
    });

    document.body.appendChild(overlay);
  }

  getContextMenuItems() {
    return [
      { action: 'manageFeeds', label: 'フィードを管理', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
      { action: 'refresh', label: '更新', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'manageFeeds') {
      this._showManageDialog();
      return true;
    } else if (action === 'refresh') {
      const activeIdx = this.config.activeTab || 0;
      const feed = (this.config.feeds || [])[activeIdx];
      if (feed) {
        Storage.set(`rss_cache_${feed.url}`, null).then(() => this._loadFeed(feed, activeIdx));
      }
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [
      { key: 'perPage', label: '1ページあたりの記事数', type: 'number', min: 3, max: 20 },
      { key: 'showThumbnail', label: 'サムネイルを表示', type: 'checkbox' },
    ];
  }
}
WidgetTypes.rss = RSSWidget;
