/**
 * PasswordWidget - パスワード生成ウィジェット
 */
class PasswordWidget extends WidgetBase {
  static widgetType = 'password';
  static DEFAULT_SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  static defaultConfig = {
    title: 'パスワード生成',
    length: 16,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
    symEditorOpen: false,
  };

  renderBody() {
    const { length, useUpper, useLower, useNumbers, useSymbols, symbols, symEditorOpen } = this.config;
    const sym = symbols ?? PasswordWidget.DEFAULT_SYMBOLS;
    const editorOpen = symEditorOpen ?? false;
    return `
      <div class="pw-widget">
        <div class="pw-options">
          <div class="pw-option-row">
            <label class="pw-label">文字数</label>
            <div class="pw-length-control">
              <button class="pw-len-btn" id="pw-len-minus-${this.id}">−</button>
              <span class="pw-len-val" id="pw-len-val-${this.id}">${length}</span>
              <button class="pw-len-btn" id="pw-len-plus-${this.id}">＋</button>
            </div>
          </div>
          <div class="pw-option-row">
            <label class="pw-label">含む文字</label>
            <div class="pw-chars">
              <label class="pw-check-label ${useUpper ? 'active' : ''}" id="pw-upper-lbl-${this.id}">
                <input type="checkbox" id="pw-upper-${this.id}" ${useUpper ? 'checked' : ''}>A-Z
              </label>
              <label class="pw-check-label ${useLower ? 'active' : ''}" id="pw-lower-lbl-${this.id}">
                <input type="checkbox" id="pw-lower-${this.id}" ${useLower ? 'checked' : ''}>a-z
              </label>
              <label class="pw-check-label ${useNumbers ? 'active' : ''}" id="pw-num-lbl-${this.id}">
                <input type="checkbox" id="pw-num-${this.id}" ${useNumbers ? 'checked' : ''}>0-9
              </label>
              <label class="pw-check-label ${useSymbols ? 'active' : ''}" id="pw-sym-lbl-${this.id}">
                <input type="checkbox" id="pw-sym-${this.id}" ${useSymbols ? 'checked' : ''}>記号
              </label>
            </div>
          </div>
          <div class="pw-sym-editor ${useSymbols ? '' : 'pw-sym-editor--hidden'}" id="pw-sym-editor-${this.id}">
            <button class="pw-sym-toggle-btn" id="pw-sym-toggle-${this.id}">
              <span>使用する記号</span>
              <svg class="pw-sym-chevron ${editorOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="pw-sym-body ${editorOpen ? '' : 'pw-sym-body--hidden'}" id="pw-sym-body-${this.id}">
              <div class="pw-sym-editor-inner">
                <input
                  class="pw-sym-input"
                  id="pw-sym-input-${this.id}"
                  type="text"
                  value="${this._escAttr(sym)}"
                  placeholder="記号を入力…"
                  spellcheck="false"
                  autocomplete="off"
                >
                <button class="pw-sym-reset-btn" id="pw-sym-reset-${this.id}" title="デフォルトに戻す">↺</button>
              </div>
            </div>
          </div>
        </div>

        <div class="pw-result-area">
          <div class="pw-result" id="pw-result-${this.id}">
            <span class="pw-result__text" id="pw-result-text-${this.id}">—</span>
            <button class="pw-copy-btn" id="pw-copy-${this.id}" title="コピー">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        <button class="pw-generate-btn" id="pw-gen-${this.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          パスワードを生成
        </button>
      </div>
    `;
  }

  onMount() {
    const el = this.element;

    // 文字数 −/＋
    const lenVal = el.querySelector(`#pw-len-val-${this.id}`);
    el.querySelector(`#pw-len-minus-${this.id}`)?.addEventListener('click', () => {
      this.config.length = Math.max(4, (this.config.length || 16) - 1);
      if (lenVal) lenVal.textContent = this.config.length;
      this.save();
    });
    el.querySelector(`#pw-len-plus-${this.id}`)?.addEventListener('click', () => {
      this.config.length = Math.min(64, (this.config.length || 16) + 1);
      if (lenVal) lenVal.textContent = this.config.length;
      this.save();
    });

    // チェックボックス（記号以外）
    const checks = [
      { sel: `#pw-upper-${this.id}`, key: 'useUpper', lblSel: `#pw-upper-lbl-${this.id}` },
      { sel: `#pw-lower-${this.id}`, key: 'useLower', lblSel: `#pw-lower-lbl-${this.id}` },
      { sel: `#pw-num-${this.id}`,   key: 'useNumbers', lblSel: `#pw-num-lbl-${this.id}` },
    ];
    for (const { sel, key, lblSel } of checks) {
      const cb = el.querySelector(sel);
      const lbl = el.querySelector(lblSel);
      if (!cb) continue;
      cb.addEventListener('change', () => {
        this.config[key] = cb.checked;
        lbl?.classList.toggle('active', cb.checked);
        this.save();
      });
    }

    // 記号チェックボックス（エディタの表示/非表示も制御）
    const symCb     = el.querySelector(`#pw-sym-${this.id}`);
    const symLbl    = el.querySelector(`#pw-sym-lbl-${this.id}`);
    const symEditor = el.querySelector(`#pw-sym-editor-${this.id}`);
    const symBody   = el.querySelector(`#pw-sym-body-${this.id}`);
    const symChevron = el.querySelector(`#pw-sym-toggle-${this.id} .pw-sym-chevron`);
    symCb?.addEventListener('change', () => {
      this.config.useSymbols = symCb.checked;
      symLbl?.classList.toggle('active', symCb.checked);
      symEditor?.classList.toggle('pw-sym-editor--hidden', !symCb.checked);
      this.save();
    });

    // 記号エディタ ▼/▲ トグル
    el.querySelector(`#pw-sym-toggle-${this.id}`)?.addEventListener('click', () => {
      this.config.symEditorOpen = !this.config.symEditorOpen;
      symBody?.classList.toggle('pw-sym-body--hidden', !this.config.symEditorOpen);
      symChevron?.classList.toggle('open', this.config.symEditorOpen);
      this.save();
    });

    // 記号入力欄
    const symInput = el.querySelector(`#pw-sym-input-${this.id}`);
    symInput?.addEventListener('input', () => {
      // 重複を除去しながら保持
      const unique = [...new Set(symInput.value.split(''))].join('');
      this.config.symbols = unique || PasswordWidget.DEFAULT_SYMBOLS;
      this.save();
    });

    // リセットボタン
    el.querySelector(`#pw-sym-reset-${this.id}`)?.addEventListener('click', () => {
      this.config.symbols = PasswordWidget.DEFAULT_SYMBOLS;
      if (symInput) symInput.value = PasswordWidget.DEFAULT_SYMBOLS;
      this.save();
    });



    // 生成ボタン
    el.querySelector(`#pw-gen-${this.id}`)?.addEventListener('click', () => {
      this._generateAndShow();
    });

    // コピーボタン
    el.querySelector(`#pw-copy-${this.id}`)?.addEventListener('click', () => {
      const text = el.querySelector(`#pw-result-text-${this.id}`)?.textContent;
      if (text && text !== '—') {
        navigator.clipboard.writeText(text).then(() => {
          this._showCopied();
        });
      }
    });

    // 初回生成
    this._generateAndShow();
  }

  _generateAndShow() {
    const pw = this._generate();
    const root = this.element;
    const textEl = root?.querySelector(`#pw-result-text-${this.id}`);
    if (textEl) {
      textEl.textContent = pw || '※ 文字種を1つ以上選んでください';
      textEl.classList.toggle('pw-result__text--error', !pw);
    }
    // アニメーション
    const result = root?.querySelector(`#pw-result-${this.id}`);
    if (result) {
      result.classList.remove('pw-flash');
      void result.offsetWidth;
      result.classList.add('pw-flash');
    }
  }

  _generate() {
    const {
      length = 16, useUpper, useLower, useNumbers, useSymbols,
      symbols
    } = this.config;
    const UPPER   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWER   = 'abcdefghijklmnopqrstuvwxyz';
    const NUMBERS = '0123456789';
    const SYMBOLS = symbols || PasswordWidget.DEFAULT_SYMBOLS;

    let pool = '';
    const required = [];
    if (useUpper)   { pool += UPPER;   required.push(UPPER[Math.floor(Math.random() * UPPER.length)]); }
    if (useLower)   { pool += LOWER;   required.push(LOWER[Math.floor(Math.random() * LOWER.length)]); }
    if (useNumbers) { pool += NUMBERS; required.push(NUMBERS[Math.floor(Math.random() * NUMBERS.length)]); }
    if (useSymbols && SYMBOLS.length > 0) {
      pool += SYMBOLS;
      required.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }

    if (!pool) return '';

    const arr = [...required];
    const buf = new Uint32Array(length - required.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length; i++) {
      arr.push(pool[buf[i] % pool.length]);
    }

    // シャッフル (Fisher-Yates)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  _showCopied() {
    const btn = this.element?.querySelector(`#pw-copy-${this.id}`);
    if (!btn) return;
    btn.classList.add('pw-copy-btn--copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove('pw-copy-btn--copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 1800);
  }

  _escAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  getSettingsFields() {
    return [
      { key: 'length',     label: '文字数',        type: 'number', min: 4, max: 64 },
      { key: 'useUpper',   label: '大文字 (A-Z)',   type: 'checkbox' },
      { key: 'useLower',   label: '小文字 (a-z)',   type: 'checkbox' },
      { key: 'useNumbers', label: '数字 (0-9)',     type: 'checkbox' },
      { key: 'useSymbols', label: '記号を使う',     type: 'checkbox' },
      { key: 'symbols',    label: '使用する記号',   type: 'text', placeholder: '!@#$%^&*…' },
    ];
  }
}
WidgetTypes.password = PasswordWidget;
