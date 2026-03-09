/**
 * Storage - データ永続化ラッパー
 * chrome.storage.local / localStorage のフォールバック付き
 */
const Storage = {
  _useChrome: typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local,

  async get(key, defaultValue = null) {
    try {
      if (this._useChrome) {
        return new Promise((resolve) => {
          chrome.storage.local.get(key, (result) => {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
          });
        });
      } else {
        const val = localStorage.getItem(key);
        return val !== null ? JSON.parse(val) : defaultValue;
      }
    } catch (e) {
      console.warn('Storage.get error:', e);
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      if (this._useChrome) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, resolve);
        });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('Storage.set error:', e);
    }
  },

  async remove(key) {
    try {
      if (this._useChrome) {
        return new Promise((resolve) => {
          chrome.storage.local.remove(key, resolve);
        });
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage.remove error:', e);
    }
  },

  async getAll() {
    try {
      if (this._useChrome) {
        return new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });
      } else {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          try { data[key] = JSON.parse(localStorage.getItem(key)); }
          catch { data[key] = localStorage.getItem(key); }
        }
        return data;
      }
    } catch (e) {
      console.warn('Storage.getAll error:', e);
      return {};
    }
  },

  async exportData() {
    const data = await this.getAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `startdeck-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          for (const [key, value] of Object.entries(data)) {
            await this.set(key, value);
          }
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
};
