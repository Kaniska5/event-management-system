/**
 * Event Management Module — Frontend Logic
 * Training Management System
 *
 * Handles:
 *  - Fetching and rendering events
 *  - Real-time search filtering
 *  - User registration + cancellation
 *  - Admin: event creation + events table
 *  - Toast notification system
 */

const API = 'http://localhost:3000';

/* ─────────────────────────────────────────────────────────────────
   UTILITY: Detect which page we are on
───────────────────────────────────────────────────────────────── */
const isAdminPage = !!document.getElementById('create-event-form');
const isUserPage  = !!document.getElementById('events-grid');

/* ─────────────────────────────────────────────────────────────────
   TOAST SYSTEM
   showToast(type, title, message)
   type: 'success' | 'error' | 'warn' | 'info'
───────────────────────────────────────────────────────────────── */
function showToast(type, title, message) {
  const container = document.getElementById('toast-container');

  const icons = {
    success: '✅',
    error:   '❌',
    warn:    '⚠️',
    info:    'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.style.animation = 'slideOut .3s ease forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

/* ─────────────────────────────────────────────────────────────────
   DATE FORMATTER: "May 10, 2026"
───────────────────────────────────────────────────────────────── */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────
   BADGE HELPER: returns badge HTML based on seats left
───────────────────────────────────────────────────────────────── */
function getBadge(seatsLeft, maxCapacity) {
  if (seatsLeft <= 0) return '<span class="badge badge-full">Full</span>';
  const pct = (seatsLeft / maxCapacity) * 100;
  if (pct <= 20) return '<span class="badge badge-low">Almost Full</span>';
  return '<span class="badge badge-open">Open</span>';
}

/* ─────────────────────────────────────────────────────────────────
   PROGRESS BAR COLOR CLASS
───────────────────────────────────────────────────────────────── */
function getProgressClass(seatsLeft, maxCapacity) {
  const pct = ((maxCapacity - seatsLeft) / maxCapacity) * 100;
  if (pct >= 100) return 'red';
  if (pct >= 80)  return 'yellow';
  return 'green';
}

/* ─────────────────────────────────────────────────────────────────
   FETCH ALL EVENTS
───────────────────────────────────────────────────────────────── */
async function fetchEvents() {
  try {
    const res  = await fetch(`${API}/events`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.events;
  } catch (err) {
    showToast('error', 'Connection Error', 'Could not load events. Is the server running?');
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════════
   USER PAGE LOGIC  (index.html)
   ══════════════════════════════════════════════════════════════
───────────────────────────────────────────────────────────────── */
if (isUserPage) {

  let allEvents = []; // Cache for search filtering

  /* ── Render stats cards ──────────────────────────────────── */
  function renderStats(events) {
    document.getElementById('stat-total').textContent = events.length;
    document.getElementById('stat-open').textContent  = events.filter(e => e.seats_left > 0).length;
    document.getElementById('stat-regs').textContent  = events.reduce((s, e) => s + e.registered_count, 0);
    document.getElementById('stat-full').textContent  = events.filter(e => e.seats_left <= 0).length;
  }

  /* ── Build a single event card HTML ─────────────────────── */
  function buildCard(event) {
    const isFull    = event.seats_left <= 0;
    const pct       = Math.min(100, Math.round((event.registered_count / event.max_capacity) * 100));
    const badge     = getBadge(event.seats_left, event.max_capacity);
    const barClass  = getProgressClass(event.seats_left, event.max_capacity);
    const dateLabel = formatDate(event.date);

    return `
      <article class="event-card${isFull ? ' full' : ''}" data-id="${event.id}" data-title="${event.title.toLowerCase()}">

        <div class="card-header">
          <h2 class="card-title">${event.title}</h2>
          ${badge}
        </div>

        <div class="card-meta">
          <div class="meta-item">
            <span class="icon">📅</span>
            <span>${dateLabel}</span>
          </div>
          <div class="meta-item">
            <span class="icon">📍</span>
            <span>${event.location}</span>
          </div>
        </div>

        <!-- Seats Progress -->
        <div class="seats-wrap">
          <div class="seats-label">
            <span>Seats Available</span>
            <strong>${isFull ? 'Full' : `${event.seats_left} / ${event.max_capacity}`}</strong>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${barClass}" style="width: ${pct}%"></div>
          </div>
        </div>

        <!-- Registration Form -->
        <div class="card-form">
          <div class="form-row">
            <input
              type="text"
              id="name-${event.id}"
              class="input-field"
              placeholder="Your name"
              ${isFull ? 'disabled' : ''}
              aria-label="Name for event ${event.id}"
            />
            <input
              type="email"
              id="email-${event.id}"
              class="input-field"
              placeholder="Your email"
              ${isFull ? 'disabled' : ''}
              aria-label="Email for event ${event.id}"
            />
          </div>

          <button
            id="reg-btn-${event.id}"
            class="btn btn-primary btn-sm btn-full"
            ${isFull ? 'disabled' : ''}
            onclick="registerForEvent(${event.id})"
            aria-label="Register for ${event.title}"
          >
            ${isFull ? '🚫 Event Full' : '✅ Register'}
          </button>

          <!-- Cancel Section -->
          <div style="display:flex;gap:8px;margin-top:4px;" id="cancel-row-${event.id}">
            <input
              type="email"
              id="cancel-email-${event.id}"
              class="input-field"
              placeholder="Email to cancel"
              aria-label="Email to cancel for event ${event.id}"
            />
            <button
              class="btn btn-ghost btn-sm"
              onclick="cancelRegistration(${event.id})"
              aria-label="Cancel registration for ${event.title}"
              style="white-space:nowrap;"
            >
              🗑 Cancel
            </button>
          </div>
        </div>

      </article>
    `;
  }

  /* ── Render event grid ───────────────────────────────────── */
  function renderEvents(events) {
    const grid     = document.getElementById('events-grid');
    const noResult = document.getElementById('no-results');

    if (events.length === 0) {
      grid.innerHTML = '';
      noResult.style.display = 'block';
      return;
    }

    noResult.style.display = 'none';
    grid.innerHTML = events.map(buildCard).join('');
  }

  /* ── Register for event ──────────────────────────────────── */
  async function registerForEvent(eventId) {
    const name  = document.getElementById(`name-${eventId}`)?.value.trim();
    const email = document.getElementById(`email-${eventId}`)?.value.trim();

    // Client-side validation
    if (!name) {
      showToast('warn', 'Missing Name', 'Please enter your name.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('warn', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const btn = document.getElementById(`reg-btn-${eventId}`);
    btn.disabled = true;
    btn.textContent = 'Registering…';

    try {
      const res  = await fetch(`${API}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, name, email })
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', 'Registered!', data.message);
        // Clear inputs & refresh
        document.getElementById(`name-${eventId}`).value  = '';
        document.getElementById(`email-${eventId}`).value = '';
        loadUserPage(); // refresh to update seat counts
      } else {
        // Handle specific server errors
        if (data.message.includes('already registered')) {
          showToast('warn', 'Duplicate Registration', data.message);
        } else if (data.message.includes('full')) {
          showToast('error', 'Event Full', data.message);
        } else {
          showToast('error', 'Registration Failed', data.message);
        }
        btn.disabled = false;
        btn.textContent = '✅ Register';
      }

    } catch (err) {
      showToast('error', 'Network Error', 'Could not connect to the server.');
      btn.disabled = false;
      btn.textContent = '✅ Register';
    }
  }

  /* ── Cancel registration ─────────────────────────────────── */
  async function cancelRegistration(eventId) {
    const email = document.getElementById(`cancel-email-${eventId}`)?.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('warn', 'Invalid Email', 'Please enter the email used during registration.');
      return;
    }

    try {
      const res  = await fetch(`${API}/cancel`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, email })
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', 'Cancelled!', data.message);
        document.getElementById(`cancel-email-${eventId}`).value = '';
        loadUserPage(); // refresh seats
      } else {
        if (data.message.includes('No registration found')) {
          showToast('warn', 'Not Found', data.message);
        } else {
          showToast('error', 'Cancellation Failed', data.message);
        }
      }

    } catch (err) {
      showToast('error', 'Network Error', 'Could not connect to the server.');
    }
  }

  /* ── Search filter (real-time) ───────────────────────────── */
  function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      const filtered = allEvents.filter(e => e.title.toLowerCase().includes(query));
      renderEvents(filtered);
    });
  }

  /* ── Load page ───────────────────────────────────────────── */
  async function loadUserPage() {
    allEvents = await fetchEvents();
    renderStats(allEvents);
    renderEvents(allEvents);
  }

  // Expose functions to HTML onclick attributes
  window.registerForEvent  = registerForEvent;
  window.cancelRegistration = cancelRegistration;

  // Boot
  initSearch();
  loadUserPage();
}

/* ─────────────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════════
   ADMIN PAGE LOGIC  (admin.html)
   ══════════════════════════════════════════════════════════════
───────────────────────────────────────────────────────────────── */
if (isAdminPage) {

  /* ── Render events in admin table ───────────────────────── */
  function renderAdminTable(events) {
    const tbody   = document.getElementById('admin-table-body');
    const empty   = document.getElementById('admin-empty');
    const table   = document.getElementById('admin-table');
    const counter = document.getElementById('admin-event-count');

    counter.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;

    if (events.length === 0) {
      table.style.display = 'none';
      empty.style.display  = 'block';
      return;
    }

    table.style.display = 'table';
    empty.style.display  = 'none';

    tbody.innerHTML = events.map(event => {
      const isFull = event.seats_left <= 0;
      const badge  = isFull
        ? '<span class="badge badge-full">Full</span>'
        : event.seats_left <= event.max_capacity * 0.2
          ? '<span class="badge badge-low">Almost Full</span>'
          : '<span class="badge badge-open">Open</span>';

      return `
        <tr>
          <td><strong style="color:var(--text-dark)">${event.title}</strong></td>
          <td>${formatDate(event.date)}</td>
          <td>${event.location}</td>
          <td>${event.max_capacity}</td>
          <td>
            <span style="font-weight:600;color:var(--accent)">${event.registered_count}</span>
            <span style="color:var(--text-light);font-size:12px;"> / ${event.max_capacity}</span>
          </td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');
  }

  /* ── Handle create event form submission ─────────────────── */
  const form = document.getElementById('create-event-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = document.getElementById('event-title').value.trim();
    const date     = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value.trim();
    const capacity = document.getElementById('event-capacity').value;

    // Client validation
    if (!title || !date || !location || !capacity) {
      showToast('warn', 'Incomplete Form', 'Please fill in all required fields.');
      return;
    }
    if (parseInt(capacity) < 1) {
      showToast('warn', 'Invalid Capacity', 'Capacity must be at least 1.');
      return;
    }

    // Future date check (warn only, not block)
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      showToast('warn', 'Past Date', 'The selected date is in the past. Proceeding anyway.');
    }

    const btn = document.getElementById('create-btn');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
      const res  = await fetch(`${API}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, date, location, max_capacity: parseInt(capacity) })
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', 'Event Created!', `"${title}" has been added successfully.`);
        form.reset();
        loadAdminPage(); // refresh table
      } else {
        showToast('error', 'Creation Failed', data.message);
      }

    } catch (err) {
      showToast('error', 'Network Error', 'Could not connect to the server.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Event';
    }
  });

  /* ── Set minimum date to today ───────────────────────────── */
  function setMinDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('event-date').min = today;
  }

  /* ── Load admin page ─────────────────────────────────────── */
  async function loadAdminPage() {
    const events = await fetchEvents();
    renderAdminTable(events);
  }

  // Boot
  setMinDate();
  loadAdminPage();
}
