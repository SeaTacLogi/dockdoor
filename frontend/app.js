// When the page is opened from a file on your computer, talk to your local server.
// When it is opened from the live website, talk to the same website.
const API = location.protocol === 'file:' ? 'http://localhost:3000' : '';

// =====================
// STAFF LOGIN
// =====================
function getToken() {
  return sessionStorage.getItem('jry_token');
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function updateStaffUI() {
  const loggedIn = !!getToken();
  document.getElementById('appointments-section').classList.toggle('hidden', !loggedIn);
  document.getElementById('staff-login-btn').classList.toggle('hidden', loggedIn);
  document.getElementById('staff-logout-btn').classList.toggle('hidden', !loggedIn);

  const nameEl = document.getElementById('staff-name');
  nameEl.classList.toggle('hidden', !loggedIn);
  nameEl.textContent = loggedIn ? `Hello, ${sessionStorage.getItem('jry_name') || 'staff'}` : '';

  if (loggedIn) {
    document.getElementById('login-section').classList.add('hidden');
    loadAppointments();
  }
}

function showLogin() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('login-email').focus();
}

function logout() {
  sessionStorage.removeItem('jry_token');
  sessionStorage.removeItem('jry_name');
  document.getElementById('appointments-list').innerHTML = '';
  updateStaffUI();
}

// Called when the server says the login is missing or expired
function handleUnauthorized() {
  logout();
  showToast('Please log in again.', 'error');
  showLogin();
}

document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      })
    });
    const data = await res.json();

    if (res.ok) {
      sessionStorage.setItem('jry_token', data.token);
      sessionStorage.setItem('jry_name', data.name);
      document.getElementById('login-form').reset();
      showToast('✅ Logged in', 'success');
      updateStaffUI();
    } else {
      showToast(`❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Could not connect to server', 'error');
  }
});

// =====================
// LOAD AVAILABLE SLOTS
// =====================
document.getElementById('apt-date').addEventListener('change', async function () {
  const date = this.value;
  const select = document.getElementById('apt-time');

  // Block weekends on the frontend
  const day = new Date(date + 'T00:00:00').getDay();
  if (day === 0 || day === 6) {
    select.innerHTML = '<option value="">-- Not open on weekends --</option>';
    showToast('❌ We are not open on weekends. Please select a weekday.', 'error');
    return;
  }

  select.innerHTML = '<option value="">Loading...</option>';

  try {
    const res = await fetch(`${API}/appointments/slots/${date}`);
    const data = await res.json();

    if (data.available_slots.length === 0) {
      select.innerHTML = '<option value="">No slots available</option>';
      if (data.message) showToast(`❌ ${data.message}`, 'error');
      return;
    }

    select.innerHTML = '<option value="">-- Select a time --</option>';
    data.available_slots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = formatTime(slot);
      select.appendChild(option);
    });
  } catch (err) {
    select.innerHTML = '<option value="">Error loading slots</option>';
  }
});

// =====================
// SUBMIT BOOKING FORM
// =====================
document.getElementById('booking-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const startTime = document.getElementById('apt-time').value;
  if (!startTime) {
    showToast('Please select a time slot', 'error');
    return;
  }

  // Calculate end time (30 min after start)
  const endTime = addMinutes(startTime, 30);

  const body = {
    appointment_date:  document.getElementById('apt-date').value,
    start_time:        startTime,
    end_time:          endTime,
    appointment_type:  document.getElementById('apt-type').value,
    company_name:      document.getElementById('company-name').value,
    truck_number:      document.getElementById('truck-number').value,
    driver_name:       document.getElementById('driver-name').value,
    driver_contact:    document.getElementById('driver-contact').value,
    bol_number:        document.getElementById('bol-number').value,
    reference_number:  document.getElementById('reference-number').value,
    cargo_type:        document.getElementById('cargo-type').value,
    weight:            document.getElementById('weight').value || null,
    pallet_count:      document.getElementById('pallet-count').value || null,
    special_handling:  document.getElementById('special-handling').value,
    notes:             document.getElementById('notes').value
  };

  try {
    const res = await fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (res.ok) {
      showToast(`✅ Appointment booked! Confirmation #${data.id}`, 'success');
      document.getElementById('booking-form').reset();
      document.getElementById('apt-time').innerHTML = '<option value="">-- Select a date first --</option>';
      if (getToken()) loadAppointments();
    } else {
      showToast(`❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Could not connect to server', 'error');
  }
});

// =====================
// LOAD APPOINTMENTS (staff only)
// =====================
async function loadAppointments() {
  if (!getToken()) return;

  const list = document.getElementById('appointments-list');
  list.innerHTML = '<p class="empty-msg">Loading...</p>';

  try {
    const res = await fetch(`${API}/appointments`, { headers: authHeaders() });

    if (res.status === 401) return handleUnauthorized();

    const data = await res.json();

    if (data.length === 0) {
      list.innerHTML = '<p class="empty-msg">No appointments found.</p>';
      return;
    }

    list.innerHTML = '';
    data.forEach(apt => {
      const card = document.createElement('div');
      card.className = 'appointment-card';
      card.innerHTML = `
        <div class="appointment-info">
          <h3>${escapeHtml(apt.company_name)} — ${escapeHtml(apt.driver_name)}</h3>
          <p>📅 ${formatDate(apt.appointment_date)} &nbsp;|&nbsp; 🕐 ${formatTime(apt.start_time)} - ${formatTime(apt.end_time)}</p>
          <p>🚛 Truck: ${escapeHtml(apt.truck_number)} &nbsp;|&nbsp; Type: ${escapeHtml(apt.appointment_type)}</p>
          <p>📋 BOL: ${escapeHtml(apt.bol_number)} &nbsp;|&nbsp; Ref: ${escapeHtml(apt.reference_number)}</p>
        </div>
        <div class="appointment-actions">
          <span class="status-badge status-${escapeHtml(apt.status)}">${escapeHtml(apt.status.replace('_', ' '))}</span>
          ${getStatusButtons(Number(apt.id), apt.status)}
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = '<p class="empty-msg">Error loading appointments.</p>';
  }
}

// =====================
// UPDATE STATUS (staff only)
// =====================
async function updateStatus(id, status) {
  try {
    const res = await fetch(`${API}/appointments/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });

    if (res.status === 401) return handleUnauthorized();

    const data = await res.json();
    if (res.ok) {
      showToast(`✅ Status updated to ${status.replace('_', ' ')}`, 'success');
      loadAppointments();
    } else {
      showToast(`❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Could not connect to server', 'error');
  }
}

// =====================
// CANCEL APPOINTMENT (staff only)
// =====================
async function cancelAppointment(id) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;

  try {
    const res = await fetch(`${API}/appointments/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (res.status === 401) return handleUnauthorized();

    const data = await res.json();
    if (res.ok) {
      showToast('✅ Appointment cancelled', 'success');
      loadAppointments();
    } else {
      showToast(`❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Could not connect to server', 'error');
  }
}

// =====================
// HELPERS
// =====================
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function getStatusButtons(id, status) {
  if (status === 'cancelled' || status === 'completed') return '';

  let buttons = '';
  if (status === 'scheduled')   buttons += `<button class="btn-status" onclick="updateStatus(${id}, 'checked_in')">Check In</button>`;
  if (status === 'checked_in')  buttons += `<button class="btn-status" onclick="updateStatus(${id}, 'in_progress')">Start</button>`;
  if (status === 'in_progress') buttons += `<button class="btn-status" onclick="updateStatus(${id}, 'completed')">Complete</button>`;
  buttons += `<button class="btn-cancel" onclick="cancelAppointment(${id})">Cancel</button>`;
  return buttons;
}

function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60).toString().padStart(2, '0');
  const newM = (total % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => { toast.className = 'toast hidden'; }, 4000);
}

// Show the right screen when the page opens
updateStaffUI();
