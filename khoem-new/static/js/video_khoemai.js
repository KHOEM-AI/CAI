// =============================================================================
// KHOEM_AI 3.0
// File : static/js/video_khoemai.js
// =============================================================================

// ============================================================================
// PART 1: Application Information, Global Configuration, Session Manager,
//         Application State, DOM Elements, Utility Functions, Loading Manager,
//         Notification Manager, API Request Helper, Progress Manager,
//         Local Cache, Initialization
// ============================================================================

// --- 1.1 Application Information ---
const APP_INFO = {
  name: 'KHOEM_AI',
  version: '3.0',
  description: 'AI Video Generator',
  author: 'KHOEM Team',
  apiBase: '/api',
};

// --- 1.2 Global Configuration ---
const CONFIG = {
  api: {
    generateVideo: '/api/video/generate',
    pollProgress: '/api/video/progress',
    cancelVideo: '/api/video/cancel',
    history: '/api/video/history',
    deleteHistory: '/api/video/history/delete',
    favorite: '/api/video/favorite',
    account: '/api/account',
    subscription: '/api/subscription',
    usage: '/api/usage',
    coupon: '/api/coupon',
    statistics: '/api/statistics',
  },
  poll: {
    interval: 3000,       // ms between progress polls
    maxAttempts: 200,     // max polls before timeout
  },
  limits: {
    free: {
      maxMinutes: 0.5,
      maxDurationSec: 15,
    },
    premium: {
      maxMinutes: Infinity,
      maxDurationSec: 60,
    },
    enterprise: {
      maxMinutes: Infinity,
      maxDurationSec: 120,
    },
  },
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  prompt: {
    maxLength: 1000,
  },
  storage: {
    prefix: 'khoemai_',
  },
};

// --- 1.3 Session Manager ---
const SessionManager = (() => {
  const _storageKey = CONFIG.storage.prefix + 'session';

  function get() {
    try {
      return JSON.parse(localStorage.getItem(_storageKey)) || {};
    } catch {
      return {};
    }
  }

  function set(data) {
    try {
      const current = get();
      localStorage.setItem(_storageKey, JSON.stringify({ ...current, ...data }));
    } catch (e) {
      console.warn('SessionManager.set error:', e);
    }
  }

  function clear() {
    localStorage.removeItem(_storageKey);
  }

  function getToken() {
    return get().token || null;
  }

  function setToken(token) {
    set({ token });
  }

  function getUserId() {
    return get().userId || null;
  }

  return { get, set, clear, getToken, setToken, getUserId };
})();

// --- 1.4 Application State ---
const AppState = {
  isGenerating: false,
  currentJobId: null,
  pollTimer: null,
  pollAttempts: 0,
  account: null,
  subscription: null,
  videoHistory: [],
  favorites: new Set(),
  currentVideo: null,
  currentPage: 1,
  searchQuery: '',
  selectedDuration: 5,
  selectedResolution: '720p',
  selectedStyle: 'cinematic',
  selectedFps: 24,
  selectedQuality: 'standard',
  selectedImage: null,
  promptText: '',
  usageStats: null,
};

// --- 1.5 DOM Elements (lazy-loaded) ---
const Els = {
  get promptInput()       { return document.getElementById('prompt-input'); },
  get charCounter()       { return document.getElementById('char-counter'); },
  get imageInput()        { return document.getElementById('image-input'); },
  get imagePreview()      { return document.getElementById('image-preview'); },
  get imagePreviewWrap()  { return document.getElementById('image-preview-wrapper'); },
  get removeImageBtn()    { return document.getElementById('remove-image-btn'); },
  get cameraBtn()         { return document.getElementById('camera-btn'); },
  get durationSelect()    { return document.getElementById('duration-select'); },
  get resolutionSelect()  { return document.getElementById('resolution-select'); },
  get styleSelect()       { return document.getElementById('style-select'); },
  get fpsSelect()         { return document.getElementById('fps-select'); },
  get qualitySelect()     { return document.getElementById('quality-select'); },
  get generateBtn()       { return document.getElementById('generate-btn'); },
  get resetBtn()          { return document.getElementById('reset-btn'); },
  get loadingOverlay()    { return document.getElementById('loading-overlay'); },
  get progressBar()       { return document.getElementById('progress-bar'); },
  get progressText()      { return document.getElementById('progress-text'); },
  get progressPercent()   { return document.getElementById('progress-percent'); },
  get queueStatus()       { return document.getElementById('queue-status'); },
  get cancelBtn()         { return document.getElementById('cancel-btn'); },
  get retryBtn()          { return document.getElementById('retry-btn'); },
  get videoPlayer()       { return document.getElementById('video-player'); },
  get videoContainer()    { return document.getElementById('video-container'); },
  get videoInfo()         { return document.getElementById('video-info'); },
  get historyGrid()       { return document.getElementById('history-grid'); },
  get historySearch()     { return document.getElementById('history-search'); },
  get clearHistoryBtn()   { return document.getElementById('clear-history-btn'); },
  get refreshGalleryBtn() { return document.getElementById('refresh-gallery-btn'); },
  get emptyState()        { return document.getElementById('empty-state'); },
  get errorState()        { return document.getElementById('error-state'); },
  get upgradeDialog()     { return document.getElementById('upgrade-dialog'); },
  get planBadge()         { return document.getElementById('plan-badge'); },
  get usageDisplay()      { return document.getElementById('usage-display'); },
  get remainingDisplay()  { return document.getElementById('remaining-display'); },
  get upgradeBtn()        { return document.getElementById('upgrade-btn'); },
  get notificationArea()  { return document.getElementById('notification-area'); },
  get dropZone()          { return document.getElementById('drop-zone'); },
};

// --- 1.6 Utility Functions ---
const Utils = {
  formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  },

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('km-KH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  copyToClipboard(text) {
    return navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : new Promise((res, rej) => {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy') ? res() : rej();
          document.body.removeChild(ta);
        });
  },

  sanitize(str) {
    return String(str).replace(/[<>&"']/g, c =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])
    );
  },

  isValidUrl(str) {
    try { new URL(str); return true; } catch { return false; }
  },
};

// --- 1.7 Loading Manager ---
const LoadingManager = {
  show(msg = 'កំពុងដំណើរការ...') {
    const el = Els.loadingOverlay;
    if (!el) return;
    el.querySelector('.loading-message') &&
      (el.querySelector('.loading-message').textContent = msg);
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  },

  hide() {
    const el = Els.loadingOverlay;
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  },

  setMessage(msg) {
    const el = Els.loadingOverlay?.querySelector('.loading-message');
    if (el) el.textContent = msg;
  },
};

// --- 1.8 Notification Manager ---
const NotificationManager = {
  _queue: [],
  _showing: false,

  show(message, type = 'info', duration = 4000) {
    this._queue.push({ message, type, duration });
    if (!this._showing) this._next();
  },

  _next() {
    if (!this._queue.length) { this._showing = false; return; }
    this._showing = true;
    const { message, type, duration } = this._queue.shift();
    const container = Els.notificationArea || document.body;
    const el = document.createElement('div');
    el.className = `notification notification--${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <span class="notification__icon">${this._icon(type)}</span>
      <span class="notification__msg">${Utils.sanitize(message)}</span>
      <button class="notification__close" aria-label="បិទ">✕</button>
    `;
    el.querySelector('.notification__close').onclick = () => this._remove(el);
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('notification--visible'));
    const timer = setTimeout(() => this._remove(el), duration);
    el._timer = timer;
  },

  _remove(el) {
    clearTimeout(el._timer);
    el.classList.remove('notification--visible');
    el.addEventListener('transitionend', () => {
      el.remove();
      this._next();
    }, { once: true });
  },

  _icon(type) {
    return { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
  },

  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration)   { this.show(msg, 'error', duration); },
  warning(msg, duration) { this.show(msg, 'warning', duration); },
  info(msg, duration)    { this.show(msg, 'info', duration); },
};

// --- 1.9 API Request Helper ---
const API = {
  async request(url, options = {}) {
    const token = SessionManager.getToken();
    const headers = {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        SessionManager.clear();
        NotificationManager.warning('សូមចូលគណនីម្ដងទៀត');
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      throw err;
    }
  },

  get(url, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(qs ? `${url}?${qs}` : url, { method: 'GET' });
  },

  post(url, body) {
    return this.request(url, { method: 'POST', body });
  },

  delete(url, body) {
    return this.request(url, { method: 'DELETE', body });
  },
};

// --- 1.10 Progress Manager ---
const ProgressManager = {
  set(percent, message = '') {
    const bar = Els.progressBar;
    const text = Els.progressText;
    const pct = Els.progressPercent;

    if (bar) {
      bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      bar.setAttribute('aria-valuenow', percent);
    }
    if (text && message) text.textContent = message;
    if (pct) pct.textContent = `${Math.round(percent)}%`;
  },

  reset() {
    this.set(0, '');
  },

  setQueueStatus(msg) {
    if (Els.queueStatus) Els.queueStatus.textContent = msg;
  },
};

// --- 1.11 Local Cache ---
const LocalCache = (() => {
  const _store = {};

  function set(key, value) {
    _store[key] = { value, ts: Date.now() };
  }

  function get(key) {
    const item = _store[key];
    if (!item) return null;
    if (Date.now() - item.ts > CONFIG.cache.ttl) {
      delete _store[key];
      return null;
    }
    return item.value;
  }

  function invalidate(key) {
    delete _store[key];
  }

  function clear() {
    Object.keys(_store).forEach(k => delete _store[k]);
  }

  return { set, get, invalidate, clear };
})();

// --- 1.12 Initialization ---
function initApp() {
  restoreFormFromStorage();
  initPromptInput();
  initImageUpload();
  initDragDrop();
  initSelectors();
  initGenerateButton();
  initResetButton();
  initVideoHistory();
  initHistorySearch();
  initGalleryRefresh();
  initClearHistory();
  loadAccount();
  loadVideoHistory();
}

document.addEventListener('DOMContentLoaded', initApp);


// ============================================================================
// PART 2: Prompt Input Controller, Image Upload, Image Preview, Remove Image,
//         Duration Selector, Resolution Selector, Style Selector, FPS Selector,
//         Quality Selector, Camera Support, Drag & Drop Image, Input Validation,
//         Generate Button Controller, Reset Form, Character Counter,
//         Auto Save Prompt, LocalStorage Restore, UI Update
// ============================================================================

// --- 2.1 Prompt Input Controller ---
function initPromptInput() {
  const input = Els.promptInput;
  if (!input) return;

  input.addEventListener('input', Utils.debounce(() => {
    AppState.promptText = input.value.trim();
    updateCharCounter();
    autoSavePrompt();
    updateGenerateButtonState();
  }, 200));

  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') generateVideo();
  });
}

// --- 2.2 Character Counter ---
function updateCharCounter() {
  const el = Els.charCounter;
  if (!el) return;
  const len = (Els.promptInput?.value || '').length;
  el.textContent = `${len} / ${CONFIG.prompt.maxLength}`;
  el.classList.toggle('char-counter--warn', len > CONFIG.prompt.maxLength * 0.9);
  el.classList.toggle('char-counter--over', len > CONFIG.prompt.maxLength);
}

// --- 2.3 Image Upload ---
function initImageUpload() {
  const input = Els.imageInput;
  const cameraBtn = Els.cameraBtn;

  if (input) {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImageFile(file);
    });
  }

  if (cameraBtn) {
    cameraBtn.addEventListener('click', openCamera);
  }
}

function handleImageFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    NotificationManager.error('ប្រភេទរូបភាព​មិនត្រូវបានគាំទ្រ (JPEG, PNG, WEBP, GIF)');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    NotificationManager.error('រូបភាពធំពេក (អតិបរមា 10MB)');
    return;
  }

  AppState.selectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => showImagePreview(e.target.result);
  reader.readAsDataURL(file);
}

// --- 2.4 Image Preview ---
function showImagePreview(src) {
  const preview = Els.imagePreview;
  const wrap = Els.imagePreviewWrap;
  if (preview) preview.src = src;
  if (wrap) wrap.classList.remove('hidden');
  updateGenerateButtonState();
}

// --- 2.5 Remove Image ---
function initRemoveImage() {
  const btn = Els.removeImageBtn;
  if (btn) btn.addEventListener('click', removeImage);
}

function removeImage() {
  AppState.selectedImage = null;
  const input = Els.imageInput;
  if (input) input.value = '';
  const wrap = Els.imagePreviewWrap;
  if (wrap) wrap.classList.add('hidden');
  const preview = Els.imagePreview;
  if (preview) preview.src = '';
  updateGenerateButtonState();
}

// --- 2.6 Camera Support ---
function openCamera() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  };
  input.click();
}

// --- 2.7 Drag & Drop Image ---
function initDragDrop() {
  const zone = Els.dropZone || document.body;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    } else if (file) {
      NotificationManager.warning('សូមទម្លាក់តែឯកសាររូបភាព');
    }
  });
}

// --- 2.8 Duration / Resolution / Style / FPS / Quality Selectors ---
function initSelectors() {
  const map = [
    [Els.durationSelect,   'selectedDuration',   (v) => parseInt(v)],
    [Els.resolutionSelect,  'selectedResolution', (v) => v],
    [Els.styleSelect,       'selectedStyle',      (v) => v],
    [Els.fpsSelect,         'selectedFps',        (v) => parseInt(v)],
    [Els.qualitySelect,     'selectedQuality',    (v) => v],
  ];

  map.forEach(([el, key, parse]) => {
    if (!el) return;
    el.addEventListener('change', () => {
      AppState[key] = parse(el.value);
      if (key === 'selectedDuration') validateDurationForPlan();
    });
  });
}

function validateDurationForPlan() {
  const plan = AppState.subscription?.plan || 'free';
  const limit = CONFIG.limits[plan]?.maxDurationSec ?? CONFIG.limits.free.maxDurationSec;
  if (AppState.selectedDuration > limit) {
    NotificationManager.warning(`ផែនការ ${plan} អាចបង្កើតវីដេអូបានតែ ${Utils.formatDuration(limit)} ប៉ុណ្ណោះ`);
    if (Els.durationSelect) Els.durationSelect.value = limit;
    AppState.selectedDuration = limit;
  }
}

// --- 2.9 Input Validation ---
function validateForm() {
  const prompt = (Els.promptInput?.value || '').trim();

  if (!prompt && !AppState.selectedImage) {
    NotificationManager.error('សូមបញ្ចូល Prompt ឬជ្រើសរូបភាព');
    Els.promptInput?.focus();
    return false;
  }

  if (prompt.length > CONFIG.prompt.maxLength) {
    NotificationManager.error(`Prompt ត្រូវតែមិនលើស ${CONFIG.prompt.maxLength} តួអក្សរ`);
    return false;
  }

  if (!canGenerateVideo()) {
    showUpgradeDialog();
    return false;
  }

  return true;
}

// --- 2.10 Generate Button Controller ---
function initGenerateButton() {
  const btn = Els.generateBtn;
  if (btn) btn.addEventListener('click', generateVideo);
}

function updateGenerateButtonState() {
  const btn = Els.generateBtn;
  if (!btn) return;
  const prompt = (Els.promptInput?.value || '').trim();
  const hasContent = !!prompt || !!AppState.selectedImage;
  btn.disabled = !hasContent || AppState.isGenerating;
  btn.classList.toggle('btn--active', hasContent && !AppState.isGenerating);
}

// --- 2.11 Reset Form ---
function initResetButton() {
  const btn = Els.resetBtn;
  if (btn) btn.addEventListener('click', resetForm);
}

function resetForm() {
  if (Els.promptInput) Els.promptInput.value = '';
  AppState.promptText = '';
  removeImage();
  updateCharCounter();
  updateGenerateButtonState();
  localStorage.removeItem(CONFIG.storage.prefix + 'prompt');
  NotificationManager.info('ទម្រង់ត្រូវបានរស្តូ');
}

// --- 2.12 Auto Save Prompt ---
const autoSavePrompt = Utils.debounce(() => {
  try {
    localStorage.setItem(
      CONFIG.storage.prefix + 'prompt',
      Els.promptInput?.value || ''
    );
  } catch {}
}, 500);

// --- 2.13 LocalStorage Restore ---
function restoreFormFromStorage() {
  try {
    const savedPrompt = localStorage.getItem(CONFIG.storage.prefix + 'prompt');
    if (savedPrompt && Els.promptInput) {
      Els.promptInput.value = savedPrompt;
      AppState.promptText = savedPrompt.trim();
      updateCharCounter();
    }
  } catch {}
}

// --- 2.14 UI Update ---
function updateUI() {
  updateGenerateButtonState();
  updateCharCounter();
  updateUsageDisplay();
  updatePlanBadge();
}


// ============================================================================
// PART 3: Generate Video, Text→Video API, Image→Video API, Request Builder,
//         FormData / JSON Creator, POST /api/video/generate, Loading Overlay,
//         Progress Bar, Queue Status, Job ID, Poll Progress, Cancel Generation,
//         Retry Generation, Error Handler, Success Handler, Notification,
//         Voice Notification, Auto Refresh Progress, Response Parser,
//         Download URL, Preview URL
// ============================================================================

// --- 3.1 Generate Video (main entry) ---
async function generateVideo() {
  if (AppState.isGenerating) {
    NotificationManager.warning('វីដេអូមួយកំពុងត្រូវបានបង្កើត');
    return;
  }

  if (!validateForm()) return;

  AppState.isGenerating = true;
  AppState.pollAttempts = 0;
  updateGenerateButtonState();
  ProgressManager.reset();
  LoadingManager.show('កំពុងបង្ហើបការបង្កើតវីដេអូ...');

  try {
    const request = buildVideoRequest();
    const response = await uploadAndGenerate(request);
    if (!response) throw new Error('មិនទទួលបានការឆ្លើយតប');
    handleVideoResponse(response);
  } catch (err) {
    handleVideoError(err);
  }
}

// --- 3.2 Request Builder ---
function buildVideoRequest() {
  return {
    prompt: (Els.promptInput?.value || '').trim(),
    duration: AppState.selectedDuration,
    resolution: AppState.selectedResolution,
    style: AppState.selectedStyle,
    fps: AppState.selectedFps,
    quality: AppState.selectedQuality,
    hasImage: !!AppState.selectedImage,
  };
}

// --- 3.3 FormData / JSON Creator ---
function createRequestBody(req) {
  if (AppState.selectedImage) {
    // Image → Video
    const fd = new FormData();
    fd.append('image', AppState.selectedImage);
    fd.append('prompt', req.prompt);
    fd.append('duration', req.duration);
    fd.append('resolution', req.resolution);
    fd.append('style', req.style);
    fd.append('fps', req.fps);
    fd.append('quality', req.quality);
    return fd;
  } else {
    // Text → Video
    return req;
  }
}

// --- 3.4 POST /api/video/generate ---
async function uploadAndGenerate(req) {
  const body = createRequestBody(req);
  LoadingManager.setMessage('កំពុងផ្ញើសំណើ...');
  return await API.post(CONFIG.api.generateVideo, body);
}

// --- 3.5 Poll Progress ---
async function pollVideoProgress(jobId) {
  AppState.currentJobId = jobId;
  AppState.pollAttempts = 0;

  const poll = async () => {
    if (!AppState.isGenerating) return;

    AppState.pollAttempts++;
    if (AppState.pollAttempts > CONFIG.poll.maxAttempts) {
      handleVideoError(new Error('ការបង្កើតវីដេអូប្រើពេលយូរពេក'));
      return;
    }

    try {
      const data = await API.get(CONFIG.api.pollProgress, { jobId });
      if (!data) return;

      updateProgress(data);

      if (data.status === 'completed') {
        finishGeneration(data);
      } else if (data.status === 'failed') {
        handleVideoError(new Error(data.error || 'ការបង្កើតបរាជ័យ'));
      } else {
        AppState.pollTimer = setTimeout(poll, CONFIG.poll.interval);
      }
    } catch (err) {
      AppState.pollTimer = setTimeout(poll, CONFIG.poll.interval * 2);
    }
  };

  poll();
}

// --- 3.6 Cancel Generation ---
function cancelVideo() {
  if (!AppState.currentJobId) return;
  clearTimeout(AppState.pollTimer);

  API.post(CONFIG.api.cancelVideo, { jobId: AppState.currentJobId })
    .catch(() => {});

  AppState.isGenerating = false;
  AppState.currentJobId = null;
  LoadingManager.hide();
  ProgressManager.reset();
  NotificationManager.info('ការបង្កើតវីដេអូត្រូវបានលុបចោល');
  updateGenerateButtonState();
}

// --- 3.7 Retry Generation ---
async function retryVideo() {
  if (AppState.isGenerating) return;
  NotificationManager.info('កំពុងព្យាយាមម្ដងទៀត...');
  await generateVideo();
}

// --- 3.8 Update Progress ---
function updateProgress(data) {
  const percent = data.progress ?? 0;
  const status = statusToKhmer(data.status, data.queuePosition);
  ProgressManager.set(percent, status);
  if (data.queuePosition != null) {
    ProgressManager.setQueueStatus(`ចំណាត់ថ្នាក់ក្នុងជួរ: ${data.queuePosition}`);
  }
}

function statusToKhmer(status, queuePos) {
  const map = {
    queued:      `ក្នុងជួររង់ចាំ${queuePos != null ? ` (#${queuePos})` : ''}`,
    processing:  'កំពុងដំណើរការ...',
    rendering:   'កំពុង Render...',
    uploading:   'កំពុង Upload...',
    completed:   'បានបញ្ចប់!',
    failed:      'បរាជ័យ',
  };
  return map[status] || status;
}

// --- 3.9 Handle Video Response ---
function handleVideoResponse(data) {
  if (data.jobId) {
    // Async job
    NotificationManager.info('ចូលជួររង់ចាំ...', 2000);
    LoadingManager.setMessage('រង់ចាំជួរ...');
    pollVideoProgress(data.jobId);
  } else if (data.videoUrl) {
    // Sync response
    finishGeneration(data);
  } else {
    handleVideoError(new Error('ការឆ្លើយតបមិនត្រឹមត្រូវ'));
  }
}

// --- 3.10 Finish Generation ---
function finishGeneration(data) {
  clearTimeout(AppState.pollTimer);
  AppState.isGenerating = false;
  AppState.currentJobId = null;

  LoadingManager.hide();
  ProgressManager.set(100, 'បានបញ្ចប់!');
  updateGenerateButtonState();

  const video = {
    id: data.id || Utils.generateId(),
    videoUrl: data.videoUrl || data.download_url,
    previewUrl: data.previewUrl || data.thumbnail_url || data.videoUrl,
    prompt: AppState.promptText,
    duration: AppState.selectedDuration,
    resolution: AppState.selectedResolution,
    style: AppState.selectedStyle,
    fps: AppState.selectedFps,
    quality: AppState.selectedQuality,
    createdAt: new Date().toISOString(),
  };

  AppState.currentVideo = video;
  playVideo(video.videoUrl);
  updateVideoInfo(video);
  addToHistory(video);
  updateUsage();
  voiceNotify('វីដេអូរបស់អ្នកបានបញ្ចប់ហើយ!');
  NotificationManager.success('វីដេអូត្រូវបានបង្កើតដោយជោគជ័យ!');
}

// --- 3.11 Handle Video Error ---
function handleVideoError(err) {
  clearTimeout(AppState.pollTimer);
  AppState.isGenerating = false;
  AppState.currentJobId = null;

  LoadingManager.hide();
  ProgressManager.reset();
  updateGenerateButtonState();

  const message = err?.message || 'កំហុសមិនស្គាល់';
  NotificationManager.error(`ការបង្កើតវីដេអូបរាជ័យ: ${message}`);

  const retryBtn = Els.retryBtn;
  if (retryBtn) retryBtn.classList.remove('hidden');
}

// --- 3.12 Voice Notification ---
function voiceNotify(text) {
  if (!window.speechSynthesis) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'km-KH';
    utter.volume = 0.8;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// Bind cancel/retry buttons
document.addEventListener('DOMContentLoaded', () => {
  Els.cancelBtn?.addEventListener('click', cancelVideo);
  Els.retryBtn?.addEventListener('click', retryVideo);
});


// ============================================================================
// PART 4: Video Preview, HTML5 Video Player, Play/Pause, Stop, Replay,
//         Fullscreen, Volume Control, Playback Speed, Download Video,
//         Copy Video Link, Share Video, Save Favorite, Remove Favorite,
//         Recent Videos, Video History, Search History, Delete History,
//         Clear History, Video Information, Thumbnail Preview, Auto Play,
//         Auto Scroll, Voice Notification, LocalStorage Sync,
//         API History Loader, API Delete History, API Favorite,
//         Refresh Gallery, Empty State, Error State, UI Update
// ============================================================================

// --- 4.1 Play Video ---
function playVideo(url) {
  const player = Els.videoPlayer;
  const container = Els.videoContainer;
  if (!player || !url) return;

  player.src = url;
  player.load();
  player.play().catch(() => {});

  if (container) container.classList.remove('hidden');

  player.addEventListener('ended', () => {
    voiceNotify('វីដេអូបានចប់');
  }, { once: true });

  autoScrollToPlayer();
}

// --- 4.2 Pause Video ---
function pauseVideo() {
  Els.videoPlayer?.pause();
}

// --- 4.3 Stop Video ---
function stopVideo() {
  const player = Els.videoPlayer;
  if (!player) return;
  player.pause();
  player.currentTime = 0;
}

// --- 4.4 Replay Video ---
function replayVideo() {
  const player = Els.videoPlayer;
  if (!player) return;
  player.currentTime = 0;
  player.play().catch(() => {});
}

// --- 4.5 Fullscreen ---
function toggleFullscreen() {
  const player = Els.videoPlayer;
  if (!player) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    player.requestFullscreen().catch(() => {});
  }
}

// --- 4.6 Volume Control ---
function setVolume(value) {
  const player = Els.videoPlayer;
  if (!player) return;
  player.volume = Math.min(1, Math.max(0, parseFloat(value)));
  player.muted = player.volume === 0;
}

// --- 4.7 Playback Speed ---
function setPlaybackSpeed(speed) {
  const player = Els.videoPlayer;
  if (!player) return;
  player.playbackRate = parseFloat(speed);
}

// --- 4.8 Download Video ---
function downloadVideo(url, filename) {
  const videoUrl = url || AppState.currentVideo?.videoUrl;
  if (!videoUrl) { NotificationManager.warning('គ្មានវីដេអូដែលអាចទាញយក'); return; }

  const a = document.createElement('a');
  a.href = videoUrl;
  a.download = filename || `khoemai_video_${Date.now()}.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  NotificationManager.success('ការទាញយកបានចាប់ផ្ដើម');
}

// --- 4.9 Copy Video Link ---
async function copyVideoLink(url) {
  const videoUrl = url || AppState.currentVideo?.videoUrl;
  if (!videoUrl) { NotificationManager.warning('គ្មានតំណភ្ជាប់ដើម្បីចម្លង'); return; }
  try {
    await Utils.copyToClipboard(videoUrl);
    NotificationManager.success('តំណភ្ជាប់ត្រូវបានចម្លង!');
  } catch {
    NotificationManager.error('មិនអាចចម្លងបាន');
  }
}

// --- 4.10 Share Video ---
async function shareVideo(video) {
  const v = video || AppState.currentVideo;
  if (!v) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'KHOEM_AI Video',
        text: v.prompt || 'AI Generated Video',
        url: v.videoUrl,
      });
    } catch {}
  } else {
    await copyVideoLink(v.videoUrl);
  }
}

// --- 4.11 Save Favorite ---
async function saveFavorite(videoId) {
  AppState.favorites.add(videoId);
  saveLocalFavorites();
  try {
    await API.post(CONFIG.api.favorite, { videoId, action: 'add' });
    NotificationManager.success('បានរក្សាទុកក្នុងចំណូលចិត្ត');
  } catch {
    NotificationManager.error('មិនអាចរក្សាទុកបាន');
  }
  renderVideoHistory();
}

// --- 4.12 Remove Favorite ---
async function removeFavorite(videoId) {
  AppState.favorites.delete(videoId);
  saveLocalFavorites();
  try {
    await API.post(CONFIG.api.favorite, { videoId, action: 'remove' });
    NotificationManager.info('បានដក​ចេញពីចំណូលចិត្ត');
  } catch {}
  renderVideoHistory();
}

function saveLocalFavorites() {
  try {
    localStorage.setItem(
      CONFIG.storage.prefix + 'favorites',
      JSON.stringify([...AppState.favorites])
    );
  } catch {}
}

function loadLocalFavorites() {
  try {
    const raw = localStorage.getItem(CONFIG.storage.prefix + 'favorites');
    if (raw) AppState.favorites = new Set(JSON.parse(raw));
  } catch {}
}

// --- 4.13 Load Video History (API) ---
async function loadVideoHistory() {
  loadLocalFavorites();

  const cached = LocalCache.get('videoHistory');
  if (cached) {
    AppState.videoHistory = cached;
    renderVideoHistory();
    return;
  }

  try {
    const data = await API.get(CONFIG.api.history);
    if (data && Array.isArray(data.videos)) {
      AppState.videoHistory = data.videos;
      LocalCache.set('videoHistory', data.videos);
      addHistoryToLocalStorage(data.videos);
    }
  } catch {
    AppState.videoHistory = loadHistoryFromLocalStorage();
  }

  renderVideoHistory();
}

// --- 4.14 Render Video History ---
function renderVideoHistory() {
  const grid = Els.historyGrid;
  if (!grid) return;

  const query = AppState.searchQuery.toLowerCase();
  const list = AppState.videoHistory.filter(v =>
    !query || (v.prompt || '').toLowerCase().includes(query)
  );

  if (!list.length) {
    showEmptyState(grid, AppState.searchQuery ? 'រកមិនឃើញ' : 'គ្មានវីដេអូទេ');
    return;
  }

  grid.innerHTML = '';
  list.forEach(v => {
    const card = createVideoCard(v);
    grid.appendChild(card);
  });
}

function createVideoCard(video) {
  const isFav = AppState.favorites.has(video.id);
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.id = video.id;
  card.innerHTML = `
    <div class="video-card__thumb">
      <img src="${Utils.sanitize(video.previewUrl || video.thumbnailUrl || '')}"
           alt="Thumbnail" loading="lazy" onerror="this.src='/static/img/placeholder.jpg'">
      <button class="video-card__play-btn" aria-label="លេង">▶</button>
    </div>
    <div class="video-card__body">
      <p class="video-card__prompt" title="${Utils.sanitize(video.prompt || '')}">${Utils.sanitize((video.prompt || '').slice(0, 80))}${(video.prompt || '').length > 80 ? '...' : ''}</p>
      <div class="video-card__meta">
        <span>${Utils.formatDate(video.createdAt)}</span>
        <span>${video.resolution || ''} · ${video.duration || ''}s</span>
      </div>
      <div class="video-card__actions">
        <button class="btn btn--icon fav-btn" data-id="${video.id}" aria-label="${isFav ? 'ដក' : 'រក្សា'}ចំណូលចិត្ត">
          ${isFav ? '★' : '☆'}
        </button>
        <button class="btn btn--icon dl-btn" data-url="${Utils.sanitize(video.videoUrl || '')}" aria-label="ទាញយក">⬇</button>
        <button class="btn btn--icon share-btn" aria-label="ចែករំលែក">↗</button>
        <button class="btn btn--icon del-btn" data-id="${video.id}" aria-label="លុប">🗑</button>
      </div>
    </div>
  `;

  card.querySelector('.video-card__play-btn').onclick = () => {
    playVideo(video.videoUrl);
    updateVideoInfo(video);
    AppState.currentVideo = video;
  };
  card.querySelector('.fav-btn').onclick = () =>
    isFav ? removeFavorite(video.id) : saveFavorite(video.id);
  card.querySelector('.dl-btn').onclick = () =>
    downloadVideo(video.videoUrl);
  card.querySelector('.share-btn').onclick = () => shareVideo(video);
  card.querySelector('.del-btn').onclick = () => deleteHistory(video.id);

  return card;
}

// --- 4.15 Search History ---
function initHistorySearch() {
  const input = Els.historySearch;
  if (!input) return;
  input.addEventListener('input', Utils.debounce(() => {
    AppState.searchQuery = input.value.trim();
    renderVideoHistory();
  }, 300));
}

function searchHistory(query) {
  AppState.searchQuery = query;
  renderVideoHistory();
}

// --- 4.16 Delete History ---
async function deleteHistory(videoId) {
  if (!confirm('តើអ្នកពិតជាចង់លុបវីដេអូនេះ?')) return;

  AppState.videoHistory = AppState.videoHistory.filter(v => v.id !== videoId);
  LocalCache.invalidate('videoHistory');
  renderVideoHistory();

  try {
    await API.delete(CONFIG.api.deleteHistory, { videoId });
    NotificationManager.success('វីដេអូត្រូវបានលុប');
  } catch {
    NotificationManager.error('មិនអាចលុបពី Server');
  }

  saveHistoryToLocalStorage(AppState.videoHistory);
}

// --- 4.17 Clear History ---
function initClearHistory() {
  const btn = Els.clearHistoryBtn;
  if (btn) btn.addEventListener('click', clearHistory);
}

async function clearHistory() {
  if (!confirm('តើអ្នកចង់លុបប្រវត្តិទាំងអស់?')) return;

  AppState.videoHistory = [];
  LocalCache.invalidate('videoHistory');
  renderVideoHistory();
  localStorage.removeItem(CONFIG.storage.prefix + 'history');

  try {
    await API.delete(CONFIG.api.deleteHistory, { all: true });
    NotificationManager.success('ប្រវត្តិទាំងអស់ត្រូវបានលុប');
  } catch {
    NotificationManager.error('មិនអាចលុបពី Server');
  }
}

// --- 4.18 Refresh Gallery ---
function initGalleryRefresh() {
  const btn = Els.refreshGalleryBtn;
  if (btn) btn.addEventListener('click', refreshGallery);
}

async function refreshGallery() {
  LocalCache.invalidate('videoHistory');
  await loadVideoHistory();
  NotificationManager.info('Gallery ត្រូវបានធ្វើបច្ចុប្បន្ន');
}

// --- 4.19 Video Information ---
function updateVideoInfo(video) {
  const el = Els.videoInfo;
  if (!el) return;
  el.innerHTML = `
    <div class="video-info__row"><span>Prompt:</span><span>${Utils.sanitize(video.prompt || '—')}</span></div>
    <div class="video-info__row"><span>រយៈពេល:</span><span>${video.duration}s</span></div>
    <div class="video-info__row"><span>គុណភាព:</span><span>${video.resolution} · ${video.fps}fps · ${video.quality}</span></div>
    <div class="video-info__row"><span>Style:</span><span>${video.style}</span></div>
    <div class="video-info__row"><span>បង្កើតនៅ:</span><span>${Utils.formatDate(video.createdAt)}</span></div>
  `;
  el.classList.remove('hidden');
}

// --- 4.20 Auto Scroll ---
function autoScrollToPlayer() {
  const container = Els.videoContainer;
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// --- 4.21 Empty / Error State ---
function showEmptyState(container, message = 'គ្មានវីដេអូ') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">🎬</div>
      <p class="empty-state__text">${Utils.sanitize(message)}</p>
    </div>
  `;
}

function showErrorState(container, message = 'កំហុសក្នុងការផ្ទុក') {
  container.innerHTML = `
    <div class="error-state">
      <div class="error-state__icon">⚠</div>
      <p class="error-state__text">${Utils.sanitize(message)}</p>
      <button class="btn btn--secondary" onclick="refreshGallery()">ព្យាយាមម្ដងទៀត</button>
    </div>
  `;
}

// --- 4.22 LocalStorage Helpers ---
function addToHistory(video) {
  AppState.videoHistory.unshift(video);
  LocalCache.invalidate('videoHistory');
  saveHistoryToLocalStorage(AppState.videoHistory);
  renderVideoHistory();
}

function saveHistoryToLocalStorage(history) {
  try {
    localStorage.setItem(
      CONFIG.storage.prefix + 'history',
      JSON.stringify(history.slice(0, 50))
    );
  } catch {}
}

function loadHistoryFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.storage.prefix + 'history');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addHistoryToLocalStorage(history) {
  saveHistoryToLocalStorage(history);
}

// --- 4.23 Video History Initialization ---
function initVideoHistory() {
  const player = Els.videoPlayer;
  if (!player) return;

  // Wire up controls if present
  document.getElementById('play-pause-btn')?.addEventListener('click', () => {
    player.paused ? player.play() : pauseVideo();
  });
  document.getElementById('stop-btn')?.addEventListener('click', stopVideo);
  document.getElementById('replay-btn')?.addEventListener('click', replayVideo);
  document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreen);
  document.getElementById('volume-slider')?.addEventListener('input', (e) => setVolume(e.target.value));
  document.getElementById('speed-select')?.addEventListener('change', (e) => setPlaybackSpeed(e.target.value));
  document.getElementById('download-btn')?.addEventListener('click', () => downloadVideo());
  document.getElementById('copy-link-btn')?.addEventListener('click', () => copyVideoLink());
  document.getElementById('share-btn')?.addEventListener('click', () => shareVideo());
}


// ============================================================================
// PART 5: User Profile, Guest Mode, Login Status, API Token, Usage Counter,
//         Daily/Monthly Usage, Free/Premium/Enterprise Plan, Remaining Minutes,
//         Remaining Credits, Generate Permission, Usage Validation,
//         Video Duration Validation, Maximum Duration Check, Free Limit (6 min),
//         Premium Unlimited, Subscription Status, Upgrade Dialog,
//         Payment Button, Billing Information, Purchase History, Invoice Loader,
//         Coupon Code, Referral Code, Reward Points, Usage Statistics,
//         Reset Monthly Usage, LocalStorage Sync, Server Sync,
//         Auto Refresh Account, Notification System, Voice Alert,
//         Error Handler, Account Logout, Session Refresh, Security Validation
// ============================================================================

// --- 5.1 Load Account ---
async function loadAccount() {
  const cached = LocalCache.get('account');
  if (cached) {
    AppState.account = cached;
    await loadSubscription();
    updateUI();
    return;
  }

  try {
    const data = await API.get(CONFIG.api.account);
    if (data) {
      AppState.account = data;
      LocalCache.set('account', data);
      SessionManager.set({ userId: data.id });
    }
  } catch {
    AppState.account = null; // Guest mode
  }

  await loadSubscription();
  updateUI();

  // Auto refresh every 5 minutes
  setTimeout(refreshAccount, 5 * 60 * 1000);
}

// --- 5.2 Load Subscription ---
async function loadSubscription() {
  if (!AppState.account) {
    AppState.subscription = { plan: 'free', usedMinutes: 0, maxMinutes: CONFIG.limits.free.maxMinutes };
    updateUI();
    return;
  }

  const cached = LocalCache.get('subscription');
  if (cached) {
    AppState.subscription = cached;
    updateUI();
    return;
  }

  try {
    const data = await API.get(CONFIG.api.subscription);
    if (data) {
      AppState.subscription = data;
      LocalCache.set('subscription', data);
    }
  } catch {
    AppState.subscription = { plan: 'free', usedMinutes: 0, maxMinutes: CONFIG.limits.free.maxMinutes };
  }

  updateUI();
}

// --- 5.3 Check Video Limit ---
function checkVideoLimit(durationSec) {
  const sub = AppState.subscription || {};
  const plan = sub.plan || 'free';

  if (plan === 'enterprise') return { allowed: true };

  const usedMinutes = sub.usedMinutes || 0;
  const maxMinutes = sub.maxMinutes || CONFIG.limits.free.maxMinutes;
  const remaining = calculateRemainingMinutes();
  const requestedMinutes = durationSec / 60;

  if (plan === 'free' && requestedMinutes > remaining) {
    return {
      allowed: false,
      reason: `អ្នក​ប្រើ​ Free Plan អស់ ${maxMinutes} នាទី (ប្រើ: ${usedMinutes.toFixed(1)}, នៅសល់: ${remaining.toFixed(1)})`,
    };
  }

  return { allowed: true };
}

// --- 5.4 Calculate Remaining Minutes ---
function calculateRemainingMinutes() {
  const sub = AppState.subscription || {};
  const plan = sub.plan || 'free';
  if (plan !== 'free') return Infinity;
  const maxMinutes = sub.maxMinutes || CONFIG.limits.free.maxMinutes;
  const usedMinutes = sub.usedMinutes || 0;
  return Math.max(0, maxMinutes - usedMinutes);
}

// --- 5.5 Can Generate Video ---
function canGenerateVideo() {
  if (!AppState.account) {
    // Guest: allow limited usage tracked locally
    return getGuestUsageMinutes() < CONFIG.limits.free.maxMinutes;
  }
  const check = checkVideoLimit(AppState.selectedDuration);
  return check.allowed;
}

function getGuestUsageMinutes() {
  try {
    return parseFloat(localStorage.getItem(CONFIG.storage.prefix + 'guest_usage') || '0');
  } catch { return 0; }
}

function incrementGuestUsage(seconds) {
  const current = getGuestUsageMinutes();
  try {
    localStorage.setItem(
      CONFIG.storage.prefix + 'guest_usage',
      (current + seconds / 60).toFixed(3)
    );
  } catch {}
}

// --- 5.6 Update Usage ---
async function updateUsage() {
  if (!AppState.account) {
    incrementGuestUsage(AppState.selectedDuration);
    return;
  }

  if (AppState.subscription) {
    AppState.subscription.usedMinutes = (AppState.subscription.usedMinutes || 0) + AppState.selectedDuration / 60;
    LocalCache.invalidate('subscription');
    updateUsageDisplay();
    saveUsage();
  }

  syncUsage();
}

// --- 5.7 Save Usage (local) ---
function saveUsage() {
  try {
    localStorage.setItem(
      CONFIG.storage.prefix + 'usage',
      JSON.stringify({
        usedMinutes: AppState.subscription?.usedMinutes || 0,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {}
}

// --- 5.8 Sync Usage (server) ---
async function syncUsage() {
  if (!AppState.account) return;
  try {
    await API.post(CONFIG.api.usage, {
      usedMinutes: AppState.subscription?.usedMinutes || 0,
    });
  } catch {}
}

// --- 5.9 Update UI displays ---
function updateUsageDisplay() {
  const el = Els.usageDisplay;
  const rem = Els.remainingDisplay;
  const sub = AppState.subscription;
  if (!sub) return;

  if (el) {
    el.textContent = `ប្រើ: ${(sub.usedMinutes || 0).toFixed(1)} / ${sub.maxMinutes === Infinity ? '∞' : sub.maxMinutes} នាទី`;
  }

  if (rem && sub.plan === 'free') {
    const r = calculateRemainingMinutes();
    rem.textContent = `នៅសល់: ${r.toFixed(1)} នាទី`;
    rem.classList.toggle('usage--warn', r < 1);
  }
}

function updatePlanBadge() {
  const el = Els.planBadge;
  if (!el) return;
  const plan = AppState.subscription?.plan || 'free';
  const labels = { free: '🆓 Free', premium: '💎 Premium', enterprise: '🏢 Enterprise' };
  el.textContent = labels[plan] || plan;
  el.className = `plan-badge plan-badge--${plan}`;
}

// --- 5.10 Upgrade Dialog ---
function showUpgradeDialog() {
  const dialog = Els.upgradeDialog;
  if (dialog) {
    dialog.classList.remove('hidden');
    dialog.setAttribute('aria-hidden', 'false');
  }
}

function hideUpgradeDialog() {
  const dialog = Els.upgradeDialog;
  if (dialog) {
    dialog.classList.add('hidden');
    dialog.setAttribute('aria-hidden', 'true');
  }
}

function openPayment(plan = 'premium') {
  hideUpgradeDialog();
  const paymentUrl = `/payment?plan=${plan}&redirect=${encodeURIComponent(location.pathname)}`;
  window.location.href = paymentUrl;
}

// --- 5.11 Apply Coupon ---
async function applyCoupon(code) {
  if (!code) { NotificationManager.warning('សូមបញ្ចូល Coupon Code'); return; }
  try {
    const data = await API.post(CONFIG.api.coupon, { code });
    if (data?.success) {
      NotificationManager.success(`Coupon ត្រូវបានអនុវត្ត: ${data.discount || ''}`);
      LocalCache.invalidate('subscription');
      await loadSubscription();
    }
  } catch (err) {
    NotificationManager.error(err.message || 'Coupon មិនត្រឹមត្រូវ');
  }
}

// --- 5.12 Load Statistics ---
async function loadStatistics() {
  try {
    const data = await API.get(CONFIG.api.statistics);
    if (data) {
      AppState.usageStats = data;
      renderStatistics(data);
    }
  } catch {}
}

function renderStatistics(stats) {
  const el = document.getElementById('statistics-container');
  if (!el || !stats) return;
  el.innerHTML = `
    <div class="stat-card"><span class="stat-label">ថ្ងៃនេះ</span><span class="stat-value">${stats.today?.videos || 0} វីដេអូ</span></div>
    <div class="stat-card"><span class="stat-label">ខែនេះ</span><span class="stat-value">${stats.month?.videos || 0} វីដេអូ</span></div>
    <div class="stat-card"><span class="stat-label">សរុប</span><span class="stat-value">${stats.total?.videos || 0} វីដេអូ</span></div>
    <div class="stat-card"><span class="stat-label">ម៉ោងបង្កើត</span><span class="stat-value">${((stats.total?.minutes || 0) / 60).toFixed(1)}h</span></div>
  `;
}

// --- 5.13 Refresh Account ---
async function refreshAccount() {
  LocalCache.invalidate('account');
  LocalCache.invalidate('subscription');
  await loadAccount();
}

// --- 5.14 Account Logout ---
async function logoutAccount() {
  if (!confirm('តើអ្នកពិតជាចង់ចេញ?')) return;

  try {
    await API.post('/api/auth/logout');
  } catch {}

  SessionManager.clear();
  AppState.account = null;
  AppState.subscription = null;
  LocalCache.clear();
  NotificationManager.info('អ្នកបានចាកចេញ');

  setTimeout(() => { window.location.href = '/login'; }, 1000);
}

// --- 5.15 Reset Monthly Usage ---
async function resetMonthlyUsage() {
  try {
    await API.post('/api/usage/reset', { type: 'monthly' });
    LocalCache.invalidate('subscription');
    await loadSubscription();
    NotificationManager.success('ការប្រើប្រាស់ប្រចាំខែត្រូវបានកំណត់ឡើងវិញ');
  } catch (err) {
    NotificationManager.error(err.message || 'មិនអាច Reset បាន');
  }
}

// --- 5.16 Session Refresh / Security Validation ---
async function refreshSession() {
  try {
    const data = await API.post('/api/auth/refresh');
    if (data?.token) SessionManager.setToken(data.token);
  } catch {
    SessionManager.clear();
  }
}

function validateSecurity() {
  const token = SessionManager.getToken();
  if (!token) return false;
  // Basic JWT expiry check (decode payload without verify)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      refreshSession();
      return false;
    }
    return true;
  } catch {
    return !!token; // treat as valid if not JWT
  }
}

// Wire upgrade/payment dialog buttons
document.addEventListener('DOMContentLoaded', () => {
  Els.upgradeBtn?.addEventListener('click', showUpgradeDialog);
  document.getElementById('close-upgrade-btn')?.addEventListener('click', hideUpgradeDialog);
  document.getElementById('pay-premium-btn')?.addEventListener('click', () => openPayment('premium'));
  document.getElementById('pay-enterprise-btn')?.addEventListener('click', () => openPayment('enterprise'));
  document.getElementById('coupon-apply-btn')?.addEventListener('click', () => {
    const input = document.getElementById('coupon-input');
    applyCoupon(input?.value?.trim());
  });
  document.getElementById('logout-btn')?.addEventListener('click', logoutAccount);
  document.getElementById('load-stats-btn')?.addEventListener('click', loadStatistics);
  removeImage && initRemoveImage();
});


// ============================================================================
// Exports (for module environments or testing)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateVideo, cancelVideo, retryVideo,
    playVideo, pauseVideo, stopVideo, replayVideo,
    downloadVideo, copyVideoLink, shareVideo,
    saveFavorite, removeFavorite,
    loadVideoHistory, deleteHistory, clearHistory, refreshGallery,
    loadAccount, loadSubscription, refreshAccount, logoutAccount,
    checkVideoLimit, canGenerateVideo, calculateRemainingMinutes,
    updateUsage, saveUsage, syncUsage, resetMonthlyUsage,
    showUpgradeDialog, openPayment, applyCoupon, loadStatistics,
    NotificationManager, LoadingManager, ProgressManager,
    SessionManager, Utils, API, AppState, CONFIG,
  };
}
