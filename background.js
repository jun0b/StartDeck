/**
 * Background Service Worker - メディアタブ検出・制御
 */

// コンテキストメニューの初期化
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-options",
    title: "オプション",
    contexts: ["action"]
  });
});

// コンテキストメニューのクリックハンドラ
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-options") {
    chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
  }
});

// メディア関連のURLパターン
const MEDIA_URL_PATTERNS = [
  '*://www.youtube.com/watch*',
  '*://music.youtube.com/*',
  '*://open.spotify.com/*',
  '*://soundcloud.com/*',
  '*://www.nicovideo.jp/watch/*'
];

// メディア再生中のタブを検索
async function findMediaTab() {
  try {
    // 1. まず音声再生中のタブを探す（最優先）
    const allTabs = await chrome.tabs.query({});
    const audibleTab = allTabs.find(t => t.audible);
    if (audibleTab) return audibleTab;

    // 2. 音声なしでもメディアURLに一致するタブを探す
    try {
      const mediaTabs = await chrome.tabs.query({ url: MEDIA_URL_PATTERNS });
      if (mediaTabs.length > 0) return mediaTabs[0];
    } catch (e) {
      // URLパターンでのクエリに失敗した場合はスキップ
    }

    return null;
  } catch (e) {
    console.error('findMediaTab error:', e);
    return null;
  }
}

// メディア情報を取得
async function getMediaState() {
  try {
    const tab = await findMediaTab();
    if (!tab) {
      return { status: 'no_media' };
    }

    // chrome:// や edge:// 等のシステムページにはスクリプト注入できない
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      return { status: 'no_media' };
    }

    // スクリプト注入してメディア情報を取得
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeMediaInfo,
        world: 'MAIN'
      });

      if (results && results[0] && results[0].result) {
        return { status: 'connected', data: results[0].result, tabId: tab.id };
      }
    } catch (scriptErr) {
      console.warn('Script injection failed, using tab info fallback:', scriptErr.message);
    }

    // スクリプト注入失敗時のフォールバック: タブ情報を使用
    const fallbackData = {
      title: tab.title || '再生中',
      artist: '',
      artwork: tab.favIconUrl || '',
      isPlaying: tab.audible || false,
      currentTime: 0,
      duration: 0
    };

    // YouTubeの場合、サムネイルをURLから生成
    if (tab.url && tab.url.includes('youtube.com/watch')) {
      try {
        const videoId = new URL(tab.url).searchParams.get('v');
        if (videoId) {
          fallbackData.artwork = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      } catch (e) {}
      // タイトルから " - YouTube" を除去
      fallbackData.title = (tab.title || '').replace(/ - YouTube$/, '');
    } else if (tab.url && tab.url.includes('music.youtube.com')) {
      fallbackData.title = (tab.title || '').replace(/ - YouTube Music$/, '');
    }

    return { status: 'connected', data: fallbackData, tabId: tab.id };
  } catch (e) {
    console.error('getMediaState error:', e);
    return { status: 'error', error: e.message };
  }
}

// メディアタブにコントロールコマンドを送信
async function controlMedia(command, tabId) {
  try {
    if (!tabId) {
      const tab = await findMediaTab();
      if (!tab) return;
      tabId = tab.id;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: controlMediaPage,
      args: [command],
      world: 'MAIN'
    });
  } catch (e) {
    console.error('controlMedia error:', e);
  }
}

// シーク操作
async function seekMedia(time, tabId) {
  try {
    if (!tabId) {
      const tab = await findMediaTab();
      if (!tab) return;
      tabId = tab.id;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: seekMediaPage,
      args: [time],
      world: 'MAIN'
    });
  } catch (e) {
    console.error('seekMedia error:', e);
  }
}

// === ページに注入されるスクリプト ===

// メディア情報を取得
function scrapeMediaInfo() {
  try {
    // MediaSession APIを最優先で使用
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      const meta = navigator.mediaSession.metadata;
      let artwork = '';
      if (meta.artwork && meta.artwork.length > 0) {
        artwork = meta.artwork[meta.artwork.length - 1].src;
      }

      const video = document.querySelector('video, audio');
      const currentTime = video ? video.currentTime : 0;
      const rawDuration = video ? video.duration : 0;
      const host = window.location.hostname;
      
      let isLive = !isFinite(rawDuration) || rawDuration === 0;
      if (!isLive && host.includes('youtube.com') && document.querySelector('.ytp-live')) {
        isLive = true;
      }

      if (meta.title) {
        return {
          title: meta.title,
          artist: meta.artist || '',
          artwork: artwork,
          isPlaying: video ? !video.paused : (navigator.mediaSession.playbackState === 'playing'),
          currentTime: currentTime,
          duration: isLive ? 0 : rawDuration,
          isLive: isLive
        };
      }
    }

    // フォールバック: DOM要素から取得
    const host = window.location.hostname;
    const video = document.querySelector('video, audio');
    if (!video) return null;

    const rawDur = video.duration;
    let isLive = !isFinite(rawDur) || rawDur === 0;
    if (!isLive && host.includes('youtube.com') && document.querySelector('.ytp-live')) {
      isLive = true;
    }

    const d = {
      title: '', artist: '', artwork: '',
      isPlaying: !video.paused,
      currentTime: video.currentTime || 0,
      duration: isLive ? 0 : rawDur,
      isLive: isLive
    };

    if (host.includes('youtube.com')) {
      if (host.includes('music')) {
        const player = document.querySelector('ytmusic-player-bar');
        if (player) {
          d.title = player.querySelector('.title')?.innerText || '';
          let artistText = player.querySelector('.subtitle')?.innerText || '';
          if (artistText.includes('•')) artistText = artistText.split('•')[0].trim();
          d.artist = artistText;
          const img = player.querySelector('.thumbnail-image-wrapper img');
          if (img) d.artwork = img.src.replace(/w\d+-h\d+/, 'w480-h480');
        }
      } else {
        d.title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText
               || document.querySelector('#above-the-fold #title yt-formatted-string')?.innerText
               || document.querySelector('h1.title')?.innerText
               || document.title.replace(/ - YouTube$/, '') || '';
        d.artist = document.querySelector('#owner #channel-name a')?.innerText
                || document.querySelector('#upload-info #channel-name a')?.innerText || '';
        const id = new URLSearchParams(window.location.search).get('v');
        d.artwork = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
      }
    } else {
      d.title = document.title || '';
    }

    return d;
  } catch (e) {
    return null;
  }
}

// メディア操作
function controlMediaPage(command) {
  const video = document.querySelector('video, audio');
  const host = window.location.hostname;

  if (command === 'toggle') {
    if (video) {
      video.paused ? video.play() : video.pause();
    }
  } else if (command === 'next') {
    if (host.includes('music.youtube.com')) {
      document.querySelector('.next-button')?.click();
    } else if (host.includes('youtube.com')) {
      document.querySelector('.ytp-next-button')?.click();
    }
  } else if (command === 'prev') {
    if (host.includes('music.youtube.com')) {
      document.querySelector('.previous-button')?.click();
    } else if (host.includes('youtube.com')) {
      const prevBtn = document.querySelector('.ytp-prev-button');
      if (prevBtn && prevBtn.style.display !== 'none') {
        prevBtn.click();
      } else if (video) {
        video.currentTime = 0;
      }
    } else if (video) {
      video.currentTime = 0;
    }
  }
}

// シーク操作
function seekMediaPage(time) {
  const video = document.querySelector('video, audio');
  if (video) {
    video.currentTime = time;
  }
}

// === メッセージリスナー ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 汎用fetchプロキシ（CORSバイパス）
  if (request.action === 'proxyFetch') {
    fetch(request.url)
      .then(res => res.text())
      .then(text => sendResponse({ ok: true, data: text }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.action === 'getMediaState') {
    getMediaState().then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ status: 'error', error: err.message });
    });
    return true;
  }

  if (request.action === 'controlMedia') {
    controlMedia(request.command, request.tabId).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.action === 'seekMedia') {
    seekMedia(request.time, request.tabId).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
