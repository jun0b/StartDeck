/**
 * BookmarkWidget - ブックマークウィジェット
 */
class BookmarkWidget extends WidgetBase {
  static widgetType = "bookmark";
  static defaultConfig = {
    title: "ブックマーク",
    displayMode: "icon",
    activeGroupIndex: 0,
    groups: [
      {
        name: "よく使う",
        bookmarks: [
          { name: "YouTube", url: "https://www.youtube.com/" },
          { name: "Google", url: "https://www.google.com/" },
        ],
      },
    ],
  };

  constructor(id, config) {
    super(id, config);

    // Migrate old format to new group format if needed
    if (this.config.bookmarks && !this.config.groups) {
      this.config.groups = [
        { name: "デフォルト", bookmarks: this.config.bookmarks }
      ];
      delete this.config.bookmarks;
      this.save();
    }
    if (typeof this.config.activeGroupIndex !== 'number') {
      this.config.activeGroupIndex = 0;
    }
  }

  renderBody() {
    const mode = this.config.displayMode || "icon";
    const groups = this.config.groups || [];

    if (groups.length === 0) {
      return `<div class="empty-state" style="padding:20px">グループがありません<br><span style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px;display:inline-block">右クリックメニューからグループを追加してください</span></div>`;
    }

    const activeIndex = Math.min(this.config.activeGroupIndex || 0, groups.length - 1);

    // Render Tabs
    const tabsHtml = groups.map((g, i) => {
      return `<div class="bookmark-tab ${i === activeIndex ? 'active' : ''}" data-idx="${i}">
        <span>${this._escapeHtml(g.name)}</span>
      </div>`;
    }).join('');

    const activeGroup = groups[activeIndex];
    const bookmarks = activeGroup ? (activeGroup.bookmarks || []) : [];

    const addFooter = `
      <div class="bookmark-footer">
        <div class="bookmark-footer__add-btn bookmark-add-btn">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>ブックマーク追加</span>
        </div>
      </div>`;

    if (bookmarks.length === 0) {
      return `
        <div class="bookmark-tabs">${tabsHtml}</div>
        <div class="empty-state" style="padding:20px">ブックマークがありません</div>
        ${addFooter}`;
    }

    const itemsHtml = bookmarks.map((b, i) => {
        let favicon;
        try {
          const u = new URL(chrome.runtime.getURL("/_favicon/"));
          u.searchParams.set("pageUrl", b.url);
          u.searchParams.set("size", "64");
          favicon = u.toString();
        } catch {
          favicon = "";
        }

        const fallback = b.name ? b.name[0] : '?';
        const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23444%22/><text x=%2212%22 y=%2216%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2212%22>${fallback}</text></svg>`;

        if (mode === "icon") {
          return `<a href="${this._escapeHtml(b.url)}" class="bookmark-item bookmark-item--icon" title="${this._escapeHtml(b.name)}" data-idx="${i}">
          <img class="bookmark-item__favicon" src="${favicon}" alt="" loading="lazy" data-fallback="${fallbackSvg}">
          <span class="bookmark-item__name">${this._escapeHtml(b.name)}</span>
        </a>`;
        } else {
          return `<a href="${this._escapeHtml(b.url)}" class="bookmark-item" title="${this._escapeHtml(b.url)}" data-idx="${i}">
          <img class="bookmark-item__favicon" src="${favicon}" alt="" loading="lazy" data-fallback="${fallbackSvg}">
          <span class="bookmark-item__name">${this._escapeHtml(b.name)}</span>
        </a>`;
        }
      }).join("");

    return `
      <div class="bookmark-tabs">${tabsHtml}</div>
      <div class="bookmark-list ${mode === "icon" ? "bookmark-list--icon" : "bookmark-list--list"}">${itemsHtml}</div>
      ${addFooter}
    `;
  }

  onMount() {
    if (!this.element) return;

    // Tab switching
    this.element.querySelectorAll(".bookmark-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.config.activeGroupIndex = parseInt(tab.dataset.idx);
        this.save();
        this.updateBody();
      });
    });

    // Bookmark item context menu
    this.element.querySelectorAll(".bookmark-item").forEach((item) => {
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.dataset.idx);
        this._showBookmarkMenu(e, idx);
      });
    });

    this.element
      .querySelector(".bookmark-add-btn")
      ?.addEventListener("click", () => this._showAddBookmarkDialog());
  }

  getSettingsFields() {
    return [
      {
        key: "displayMode",
        label: "表示モード",
        type: "select",
        options: [
          { value: "icon", label: "アイコン" },
          { value: "list", label: "リスト" },
        ],
      },
    ];
  }

  _getActiveGroup() {
    const groups = this.config.groups || [];
    const idx = Math.min(this.config.activeGroupIndex || 0, groups.length - 1);
    return { group: groups[idx], index: idx, groups };
  }

  _showBookmarkMenu(e, idx) {
    document.querySelectorAll(".context-menu").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.top = e.clientY + "px";
    menu.style.left = e.clientX + "px";
    menu.innerHTML = `
      <div class="context-menu__item" data-action="edit"><svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> 編集</div>
      <div class="context-menu__item" data-action="up"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg> 前へ移動</div>
      <div class="context-menu__item" data-action="down"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> 次へ移動</div>
      <div class="context-menu__item" data-action="add"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 追加</div>
      <div class="context-menu__divider"></div>
      <div class="context-menu__item context-menu__item--danger" data-action="delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> 削除</div>
    `;
    menu.addEventListener("click", (ev) => {
      const action = ev.target.closest(".context-menu__item")?.dataset.action;
      menu.remove();

      const { group } = this._getActiveGroup();
      if (!group) return;
      const bms = group.bookmarks || [];

      if (action === "edit") this._showEditBookmarkDialog(idx);
      else if (action === "up" && idx > 0) {
        [bms[idx - 1], bms[idx]] = [bms[idx], bms[idx - 1]];
        this.save();
        this.updateBody();
      } else if (action === "down" && idx < bms.length - 1) {
        [bms[idx], bms[idx + 1]] = [bms[idx + 1], bms[idx]];
        this.save();
        this.updateBody();
      } else if (action === "add") this._showAddBookmarkDialog();
      else if (action === "delete") {
        bms.splice(idx, 1);
        this.save();
        this.updateBody();
      }
    });
    document.body.appendChild(menu);
    setTimeout(
      () =>
        document.addEventListener("click", function handler() {
          menu.remove();
          document.removeEventListener("click", handler);
        }),
      0,
    );
  }

  _showAddBookmarkDialog() {
    this._showEditBookmarkDialog(-1);
  }

  _showEditBookmarkDialog(idx) {
    const { group } = this._getActiveGroup();
    if (!group) return;
    const bms = group.bookmarks || [];

    const isEdit = idx >= 0;
    const bm = isEdit ? bms[idx] : { name: "", url: "" };

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><span class="modal__title">${isEdit ? "ブックマーク編集" : "ブックマーク追加"}</span><button class="modal__close">&times;</button></div>
        <div class="modal__body">
          <div class="form-group"><label class="form-label">名前</label><input class="form-input" id="bm-name" value="${this._escapeHtml(bm.name)}" placeholder="例: YouTube"></div>
          <div class="form-group"><label class="form-label">URL</label><input class="form-input" id="bm-url" value="${this._escapeHtml(bm.url)}" placeholder="https://..."></div>
        </div>
        <div class="modal__footer"><button class="btn btn--ghost modal-cancel">キャンセル</button><button class="btn btn--primary modal-save">保存</button></div>
      </div>
    `;
    const close = () => overlay.remove();
    overlay.querySelector(".modal__close").addEventListener("click", close);
    overlay.querySelector(".modal-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".modal-save").addEventListener("click", () => {
      const name = overlay.querySelector("#bm-name").value.trim();
      const url = overlay.querySelector("#bm-url").value.trim();
      if (!name || !url) return;
      if (isEdit) {
        bms[idx] = { name, url };
      } else {
        if (!group.bookmarks) group.bookmarks = [];
        group.bookmarks.push({ name, url });
      }
      this.save();
      this.updateBody();
      close();
    });
    document.body.appendChild(overlay);
  }

  _showManageGroupsDialog(editIndex = -1) {
    const isEdit = editIndex >= 0;
    const group = isEdit ? this.config.groups[editIndex] : { name: '', bookmarks: [] };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><span class="modal__title">グループを管理</span><button class="modal__close">&times;</button></div>
        <div class="modal__body">
          <div style="margin-bottom:16px;max-height:200px;overflow-y:auto" id="bookmark-group-list">
            ${(this.config.groups || []).map((g, i) => `
              <div class="draggable-item" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:4px;padding:6px 0;border-bottom:1px solid var(--border-color); cursor: grab; transition: opacity 0.2s;">
                <span style="font-size:0.8rem;color:var(--text-tertiary);padding-right:4px">≡</span>
                <span style="flex:1;font-size:0.82rem;font-weight:${i === editIndex ? 'bold' : 'normal'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this._escapeHtml(g.name)}</span>
                <button class="btn btn--ghost" style="padding:2px 8px;font-size:0.72rem" data-action="edit" data-idx="${i}">編集</button>
                <button class="btn btn--danger" style="padding:2px 8px;font-size:0.72rem" data-remove="${i}">削除</button>
              </div>
            `).join('')}
          </div>
          <div style="font-weight:600;margin-bottom:8px;font-size:0.85rem">${isEdit ? 'グループを編集' : '新しいグループを追加'}</div>
          <div class="form-group"><label class="form-label">グループ名</label><input class="form-input" id="group-name" value="${this._escapeHtml(group.name)}" placeholder="例: よく使う"></div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost modal-close-btn">閉じる</button>
          ${isEdit ? '<button class="btn btn--ghost" id="group-cancel-edit-btn">追加に戻る</button>' : ''}
          <button class="btn btn--primary" id="group-save-btn">${isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    `;

    const close = () => { overlay.remove(); this.updateBody(); };
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.remove);
        if (confirm(`グループ「${this.config.groups[i].name}」を削除してもよろしいですか？ 中のブックマークもすべて削除されます。`)) {
          this.config.groups.splice(i, 1);
          if (this.config.activeGroupIndex >= this.config.groups.length) {
            this.config.activeGroupIndex = Math.max(0, this.config.groups.length - 1);
          }
          this.save();
          close();
          this._showManageGroupsDialog();
        }
      });
    });

    overlay.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        close();
        this._showManageGroupsDialog(i);
      });
    });

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

        const arr = this.config.groups;
        const [movedItem] = arr.splice(draggedIdx, 1);
        if (insertIdx > draggedIdx) insertIdx--;
        arr.splice(insertIdx, 0, movedItem);

        this.save();
        close();

        // Restore edit state
        let newEditIdx = editIndex;
        if (editIndex === draggedIdx) newEditIdx = insertIdx;
        else if (editIndex !== -1) {
          if (draggedIdx < editIndex && insertIdx >= editIndex) newEditIdx--;
          else if (draggedIdx > editIndex && insertIdx <= editIndex) newEditIdx++;
        }
        this._showManageGroupsDialog(newEditIdx);
      });
    });

    overlay.querySelector('#group-cancel-edit-btn')?.addEventListener('click', () => {
      close();
      this._showManageGroupsDialog(-1);
    });

    overlay.querySelector('#group-save-btn')?.addEventListener('click', () => {
      const name = overlay.querySelector('#group-name').value.trim();
      if (!name) return;
      if (!this.config.groups) this.config.groups = [];
      if (isEdit) {
        this.config.groups[editIndex].name = name;
      } else {
        this.config.groups.push({ name, bookmarks: [] });
      }
      this.save();
      close();
      this._showManageGroupsDialog(-1);
    });

    document.body.appendChild(overlay);
  }

  getContextMenuItems() {
    return [
      {
        action: "manageGroups",
        label: "グループを管理",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      },
      {
        action: "addBookmark",
        label: "ブックマークを追加",
        icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      },
      { divider: true },
      ...super.getContextMenuItems(),
    ];
  }

  handleContextMenuAction(action) {
    if (action === "manageGroups") {
      this._showManageGroupsDialog();
      return true;
    }
    if (action === "addBookmark") {
      this._showAddBookmarkDialog();
      return true;
    }
    return super.handleContextMenuAction(action);
  }
}
WidgetTypes.bookmark = BookmarkWidget;
