/**
 * TaskWidget - タスクウィジェット
 */
class TaskWidget extends WidgetBase {
  static widgetType = 'task';
  static defaultConfig = {
    title: 'タスク',
    tasks: [],
    showCompleted: true
  };

  renderBody() {
    const tasks = this.config.tasks || [];
    const show = this.config.showCompleted;
    const filtered = show ? tasks : tasks.filter(t => !t.done);
    const doneCount = tasks.filter(t => t.done).length;

    const items = filtered.map((t, i) => {
      const realIdx = tasks.indexOf(t);
      return `
        <div class="task-item ${t.done ? 'completed' : ''}" data-idx="${realIdx}">
          <div class="task-item__checkbox ${t.done ? 'checked' : ''}" data-idx="${realIdx}"></div>
          <span class="task-item__text">${this._escapeHtml(t.text)}</span>
          ${t.date ? `<span class="task-item__date">${t.date}</span>` : ''}
          <button class="task-item__delete" data-idx="${realIdx}">
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
    }).join('');

    return `
      <div class="task-input-row">
        <input class="task-input" id="task-input-${this.id}" type="text" placeholder="新しいタスクを追加..." autocomplete="off">
        <button class="task-add-btn" id="task-add-${this.id}">追加</button>
      </div>
      <div class="task-list">${items || '<div class="empty-state">タスクはありません</div>'}</div>
      <div class="task-footer">
        <span>${doneCount}/${tasks.length} 完了</span>
        <button class="btn btn--ghost" style="font-size:0.72rem;padding:2px 8px" id="task-toggle-${this.id}">
          ${show ? '完了済みを非表示' : '完了済みを表示'}
        </button>
      </div>
    `;
  }

  onMount() {
    if (!this.element) return;

    const input = this.element.querySelector(`#task-input-${this.id}`);
    const addBtn = this.element.querySelector(`#task-add-${this.id}`);
    const toggleBtn = this.element.querySelector(`#task-toggle-${this.id}`);

    const addTask = () => {
      const text = input?.value.trim();
      if (!text) return;
      if (!this.config.tasks) this.config.tasks = [];
      this.config.tasks.push({ text, done: false, date: '', created: Date.now() });
      this.save();
      this.updateBody();
    };

    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
    addBtn?.addEventListener('click', addTask);
    toggleBtn?.addEventListener('click', () => {
      this.config.showCompleted = !this.config.showCompleted;
      this.save();
      this.updateBody();
    });

    this.element.querySelectorAll('.task-item__checkbox').forEach(cb => {
      cb.addEventListener('click', () => {
        const idx = parseInt(cb.dataset.idx);
        this.config.tasks[idx].done = !this.config.tasks[idx].done;
        this.save();
        this.updateBody();
      });
    });

    this.element.querySelectorAll('.task-item__delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.config.tasks.splice(idx, 1);
        this.save();
        this.updateBody();
      });
    });
  }

  getContextMenuItems() {
    return [
      { action: 'clearCompleted', label: '完了済みを削除', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' },
      { divider: true },
      ...super.getContextMenuItems()
    ];
  }

  handleContextMenuAction(action) {
    if (action === 'clearCompleted') {
      if (!this.config.tasks) return true;
      this.config.tasks = this.config.tasks.filter(t => !t.done);
      this.save();
      this.updateBody();
      return true;
    }
    return super.handleContextMenuAction(action);
  }

  getSettingsFields() {
    return [];
  }
}
WidgetTypes.task = TaskWidget;
