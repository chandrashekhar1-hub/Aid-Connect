/**
 * AidConnect — Frontend API Client
 * Handles all communication with the backend server
 * Includes: JWT auth, offline fallback, Socket.IO
 */

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

/* ══════════════════════════════════
   TOKEN MANAGEMENT
══════════════════════════════════ */
const Auth = {
  getToken:        ()    => localStorage.getItem('aidconnect_token'),
  getRefreshToken: ()    => localStorage.getItem('aidconnect_refresh'),
  setTokens: (access, refresh) => {
    localStorage.setItem('aidconnect_token', access);
    localStorage.setItem('aidconnect_refresh', refresh);
  },
  clearTokens: () => {
    localStorage.removeItem('aidconnect_token');
    localStorage.removeItem('aidconnect_refresh');
    localStorage.removeItem('aidconnect_user');
  },
  setUser: (user) => localStorage.setItem('aidconnect_user', JSON.stringify(user)),
  getUser: ()     => JSON.parse(localStorage.getItem('aidconnect_user') || 'null'),
  isLoggedIn: ()  => !!localStorage.getItem('aidconnect_token')
};

/* ══════════════════════════════════
   HTTP CLIENT
══════════════════════════════════ */
async function request(method, endpoint, body=null, auth=true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${Auth.getToken()}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    let res = await fetch(`${API_BASE}${endpoint}`, config);

    // Auto-refresh if 401
    if (res.status === 401 && auth) {
      const refreshed = await refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${Auth.getToken()}`;
        res = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
      } else {
        Auth.clearTokens();
        window.location.href = 'login.html';
        return null;
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    // Offline fallback — use cached data if available
    if (!navigator.onLine) {
      console.warn('Offline — serving from cache:', endpoint);
      return getCachedData(endpoint);
    }
    console.error(`API Error [${method} ${endpoint}]:`, e.message);
    throw e;
  }
}

async function refreshToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: Auth.getRefreshToken() })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('aidconnect_token', data.accessToken);
      return true;
    }
    return false;
  } catch { return false; }
}

/* OFFLINE CACHE */
function cacheData(key, data) {
  try { localStorage.setItem(`cache_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}
function getCachedData(key) {
  try {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 10 * 60 * 1000) return null; // 10 min TTL
    return data;
  } catch { return null; }
}

/* Shorthand helpers */
const get    = (url, auth=true) => request('GET', url, null, auth);
const post   = (url, body, auth=true) => request('POST', url, body, auth);
const put    = (url, body, auth=true) => request('PUT', url, body, auth);
const del    = (url, auth=true) => request('DELETE', url, null, auth);

/* ══════════════════════════════════
   AUTH API
══════════════════════════════════ */
const AuthAPI = {
  register: async (data) => {
    const res = await post('/auth/register', data, false);
    if (res?.success) {
      Auth.setTokens(res.accessToken, res.refreshToken);
      Auth.setUser(res.user);
    }
    return res;
  },

  login: async (email, password) => {
    const res = await post('/auth/login', { email, password }, false);
    if (res?.success) {
      Auth.setTokens(res.accessToken, res.refreshToken);
      Auth.setUser(res.user);
    }
    return res;
  },

  // Google OAuth — sends ID token to backend for server-side verification
  googleLogin: async (idToken) => {
    const res = await post('/auth/google', { idToken }, false);
    if (res?.success) {
      Auth.setTokens(res.accessToken, res.refreshToken);
      Auth.setUser(res.user);
    }
    return res;
  },

  logout: async () => {
    try { await post('/auth/logout', { refreshToken: Auth.getRefreshToken() }); } catch {}
    Auth.clearTokens();
    window.location.href = 'login.html';
  },

  me: () => get('/auth/me')
};

/* ══════════════════════════════════
   REPORTS API
══════════════════════════════════ */
const ReportsAPI = {
  getAll: async (params={}) => {
    const query = new URLSearchParams(params).toString();
    const res = await get(`/reports${query ? '?' + query : ''}`);
    if (res) cacheData('/reports', res);
    return res;
  },

  getById:  (id)   => get(`/reports/${id}`),
  create:   (data) => post('/reports', data),
  update:   (id, data) => put(`/reports/${id}`, data),
  delete:   (id)   => del(`/reports/${id}`),
  escalate: (id)   => post(`/reports/${id}/escalate`),

  // SMS-style report (offline)
  createOffline: (data) => {
    const pending = JSON.parse(localStorage.getItem('pending_reports') || '[]');
    pending.push({ ...data, id: 'offline_' + Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem('pending_reports', JSON.stringify(pending));
    return { success: true, offline: true, message: 'Saved offline. Will sync when connected.' };
  },

  // Sync pending offline reports
  syncOffline: async () => {
    const pending = JSON.parse(localStorage.getItem('pending_reports') || '[]');
    if (!pending.length || !navigator.onLine) return 0;
    let synced = 0;
    for (const report of pending) {
      try {
        const { id, ...data } = report;
        await post('/reports', data);
        synced++;
      } catch {}
    }
    if (synced > 0) localStorage.removeItem('pending_reports');
    return synced;
  }
};

/* ══════════════════════════════════
   VOLUNTEERS API
══════════════════════════════════ */
const VolunteersAPI = {
  getAll:  (params={}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/volunteers${query ? '?' + query : ''}`);
  },
  getMe:   () => get('/volunteers/me'),
  updateMe:(data) => put('/volunteers/me', data),
  updateLocation: (lat, lng) => put('/volunteers/me', { location: { type: 'Point', coordinates: [lng, lat] } })
};

/* ══════════════════════════════════
   TASKS API
══════════════════════════════════ */
const TasksAPI = {
  getAll:       (params={}) => { const q = new URLSearchParams(params).toString(); return get(`/tasks${q?'?'+q:''}`); },
  create:       (data)  => post('/tasks', data),
  updateStatus: (id, status, extra={}) => put(`/tasks/${id}/status`, { status, ...extra })
};

/* ══════════════════════════════════
   MATCH API
══════════════════════════════════ */
const MatchAPI = {
  findVolunteers: (reportId, limit=5) => post('/match', { reportId, limit })
};

/* ══════════════════════════════════
   SOS API
══════════════════════════════════ */
const SOSAPI = {
  trigger: async (message='') => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          try {
            const res = await post('/sos', { lat, lng, message });
            resolve(res);
          } catch {
            // Offline SOS — store locally
            const sos = { lat, lng, message, ts: new Date().toISOString() };
            localStorage.setItem('pending_sos', JSON.stringify(sos));
            resolve({ success: true, offline: true });
          }
        },
        () => {
          // No GPS — use approximate
          post('/sos', { lat: 0, lng: 0, message: `SOS (no GPS): ${message}` }).then(resolve).catch(() => resolve({ success: true, offline: true }));
        }
      );
    });
  }
};

/* ══════════════════════════════════
   NOTIFICATIONS API
══════════════════════════════════ */
const NotificationsAPI = {
  getAll:  () => get('/notifications'),
  readAll: () => put('/notifications/read-all')
};

/* ══════════════════════════════════
   INVENTORY API
══════════════════════════════════ */
const InventoryAPI = {
  getAll:  (zone) => get(`/inventory${zone ? '?zone=' + zone : ''}`),
  update:  (id, data) => put(`/inventory/${id}`, data)
};

/* ══════════════════════════════════
   STATS API
══════════════════════════════════ */
const StatsAPI = {
  getDashboard: () => get('/stats')
};

/* ══════════════════════════════════
   SMS REPORT (offline fallback)
══════════════════════════════════ */
const SMS = {
  format: (type, pincode, message) => `REPORT ${type} ${pincode} ${message}`,
  types: { flood:'FL', medical:'MD', food:'FD', shelter:'SH', infrastructure:'IN', fire:'FR', earthquake:'EQ', other:'OT' },
  openSMSApp: (type, pincode, message) => {
    const smsBody = SMS.format(SMS.types[type] || 'OT', pincode, message);
    window.open(`sms:+919999999999?body=${encodeURIComponent(smsBody)}`);
  }
};

/* ══════════════════════════════════
   SOCKET.IO REAL-TIME CLIENT
══════════════════════════════════ */
let socket = null;
const SocketClient = {
  connect: (onEvent) => {
    if (!Auth.isLoggedIn()) return;

    // Dynamically load socket.io-client if not loaded
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      script.onload = () => SocketClient._init(onEvent);
      document.head.appendChild(script);
    } else {
      SocketClient._init(onEvent);
    }
  },

  _init: (onEvent) => {
    socket = io(SOCKET_URL, {
      auth: { token: Auth.getToken() },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);
      if (onEvent) onEvent('connect', { id: socket.id });
    });

    socket.on('notification', (data) => {
      showGlobalNotification(data.title, data.message);
      if (onEvent) onEvent('notification', data);
    });

    socket.on('sos:alert', (data) => {
      showGlobalNotification('🆘 SOS ALERT', `${data.user?.name || 'Someone'} needs emergency help!`, 'error');
      if (onEvent) onEvent('sos', data);
    });

    socket.on('report:updated', (data) => { if (onEvent) onEvent('report:updated', data); });
    socket.on('task:created',   (data) => { if (onEvent) onEvent('task:created', data); });
    socket.on('task:updated',   (data) => { if (onEvent) onEvent('task:updated', data); });
    socket.on('report:new_sms', (data) => { if (onEvent) onEvent('report:new_sms', data); });
    socket.on('inventory:low_stock', (data) => { if (onEvent) onEvent('inventory:low_stock', data); });
    socket.on('volunteer:location:broadcast', (data) => { if (onEvent) onEvent('volunteer:location', data); });

    socket.on('disconnect', () => console.warn('⚠️ Socket.IO disconnected'));
    socket.on('connect_error', (e) => console.error('Socket error:', e.message));
  },

  emit: (event, data) => { if (socket) socket.emit(event, data); },

  updateLocation: (lat, lng) => {
    SocketClient.emit('volunteer:location', { lat, lng });
  },

  disconnect: () => { if (socket) socket.disconnect(); }
};

/* ══════════════════════════════════
   GEOLOCATION HELPER
══════════════════════════════════ */
const GeoHelper = {
  watchId: null,

  startTracking: (onUpdate) => {
    if (!navigator.geolocation) return;
    GeoHelper.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onUpdate(latitude, longitude);
        SocketClient.updateLocation(latitude, longitude);
        VolunteersAPI.updateLocation(latitude, longitude);
      },
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  },

  stopTracking: () => {
    if (GeoHelper.watchId) {
      navigator.geolocation.clearWatch(GeoHelper.watchId);
      GeoHelper.watchId = null;
    }
  },

  getCurrentPosition: () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  })
};

/* ══════════════════════════════════
   OFFLINE DETECTION + AUTO-SYNC
══════════════════════════════════ */
window.addEventListener('online', async () => {
  console.log('🌐 Back online — syncing pending data');
  const synced = await ReportsAPI.syncOffline();
  if (synced > 0) showGlobalNotification('✅ Synced', `${synced} offline report(s) uploaded!`);
});

window.addEventListener('offline', () => {
  showGlobalNotification('⚠️ Offline Mode', 'Reports will be saved locally and synced when connected.', 'warn');
});

/* ══════════════════════════════════
   GLOBAL NOTIFICATION TOAST
══════════════════════════════════ */
function showGlobalNotification(title, message, type='success') {
  let container = document.getElementById('global-notif-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-notif-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:320px;';
    document.body.appendChild(container);
  }

  const colors = { success: '#22C55E', error: '#EF4444', warn: '#E85D04', info: '#3B82F6' };
  const icons  = { success: '✅', error: '🆘', warn: '⚠️', info: 'ℹ️' };

  const notif = document.createElement('div');
  notif.style.cssText = `background:${colors[type]||colors.success};color:#fff;padding:14px 18px;border-radius:10px;font-family:Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.2);transform:translateX(120%);transition:transform .4s;`;
  notif.innerHTML = `
    <div style="font-size:14px;font-weight:700;margin-bottom:3px;">${icons[type]} ${title}</div>
    <div style="font-size:12px;opacity:0.88;">${message}</div>
  `;
  container.appendChild(notif);
  setTimeout(() => notif.style.transform = 'translateX(0)', 50);
  setTimeout(() => { notif.style.transform = 'translateX(120%)'; setTimeout(() => notif.remove(), 400); }, 4000);
}

/* ══════════════════════════════════
   INIT — Auto-load on every page
══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Redirect to login if not authenticated (except login/index pages)
  const publicPages = ['login.html', 'index.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  if (!publicPages.includes(currentPage) && !Auth.isLoggedIn()) {
    // Uncomment in production: window.location.href = 'login.html';
  }

  // Try to connect socket for authenticated users
  if (Auth.isLoggedIn()) {
    SocketClient.connect((event, data) => {
      if (event === 'notification') {
        const badge = document.querySelector('.badge-dot');
        if (badge) badge.style.display = 'block';
      }
    });
  }

  // Populate user info in UI if user elements exist
  const user = Auth.getUser();
  if (user) {
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.name);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role);
    document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = user.email);
  }

  // Auto-sync pending offline data
  if (navigator.onLine) ReportsAPI.syncOffline();
});

/* Export for use across pages */
window.AidConnect = { Auth, AuthAPI, ReportsAPI, VolunteersAPI, TasksAPI, MatchAPI, SOSAPI, NotificationsAPI, InventoryAPI, StatsAPI, SMS, SocketClient, GeoHelper, showGlobalNotification };
