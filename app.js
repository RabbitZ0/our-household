// Our Household App
const state = {
  data: { chores: [], groceries: [], meals: [], bills: [], plans: [], notes: [], babyLogs: [], milestones: [], appointments: [], babyNotes: [] },
  config: null,
  currentMonthPlans: new Date(),
  currentMonthBills: new Date(),
  showPaidBills: false
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  if (isNaN(date)) return d;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function displayName(value) {
  const map = {
    me: 'Michael (Me)',
    wife: 'Amber (Wife)',
    michael: 'Michael (Me)',
    amber: 'Amber (Wife)',
    both: 'Both'
  };
  return map[value] || value;
}

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function nextDueDate(iso, recur) {
  if (!recur || recur === 'none') return null;
  if (recur === 'weekly') return addDays(iso, 7);
  if (recur === 'biweekly') return addDays(iso, 14);
  if (recur === 'monthly') return addMonths(iso, 1);
  if (recur === 'yearly') return addMonths(iso, 12);
  return null;
}

function recurLabel(recur) {
  const map = { monthly: 'Monthly', weekly: 'Weekly', biweekly: 'Every 2 weeks', yearly: 'Yearly' };
  return map[recur] || '';
}

function ensureArrays() {
  const keys = ['chores', 'groceries', 'meals', 'bills', 'plans', 'notes', 'babyLogs', 'milestones', 'appointments', 'babyNotes'];
  keys.forEach(k => { if (!Array.isArray(state.data[k])) state.data[k] = []; });
}

// Config
function loadConfig() {
  const saved = localStorage.getItem('gh-config');
  if (saved) {
    state.config = JSON.parse(saved);
    $('#setup-modal').classList.add('hidden');
    loadData();
  }
}

function saveConfig() {
  const config = {
    user: $('#gh-user').value.trim(),
    repo: $('#gh-repo').value.trim(),
    token: $('#gh-token').value.trim()
  };
  if (!config.user || !config.repo || !config.token) {
    alert('Please fill all fields');
    return;
  }
  state.config = config;
  localStorage.setItem('gh-config', JSON.stringify(config));
  $('#setup-modal').classList.add('hidden');
  loadData();
}

// GitHub API
async function ghFetch(path, options = {}) {
  const { user, repo, token } = state.config;
  const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadData() {
  try {
    const file = await ghFetch('data.json');
    const content = decodeURIComponent(escape(atob(file.content)));
    state.data = JSON.parse(content);
    state.sha = file.sha;
    ensureArrays();
    renderAll();
  } catch (e) {
    console.warn('No data yet or error:', e);
    state.data = { chores: [], groceries: [], meals: [], bills: [], plans: [], notes: [], babyLogs: [], milestones: [], appointments: [], babyNotes: [] };
    state.sha = null;
    renderAll();
    await saveData();
  }
}

async function saveData() {
  if (!state.config) return;
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(state.data, null, 2))));
    const body = {
      message: 'Update household data',
      content
    };
    if (state.sha) body.sha = state.sha;
    const res = await ghFetch('data.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    state.sha = res.content.sha;
  } catch (e) {
    console.error(e);
    alert('Failed to save. Check token permissions (needs repo scope).');
  }
}

// Tabs
function setupTabs() {
  $$('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tabs button').forEach(b => b.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      $(`#${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// Render
function renderAll() {
  renderHome();
  renderPlans();
  renderGrocery();
  renderBills();
  renderChores();
  renderNotes();
  renderBaby();
  $('#current-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderHome() {
  const today = todayISO();
  const chores = (state.data.chores || []).filter(c => !c.done).slice(0, 5);
  $('#today-chores ul').innerHTML = chores.length ? chores.map(c => `<li>${c.text} <small>(${displayName(c.assigned)})</small></li>`).join('') : '<li>No pending chores</li>';

  const soonBills = (state.data.bills || []).filter(b => !b.paid && b.dueDate >= today).slice(0, 4);
  $('#today-bills ul').innerHTML = soonBills.length ? soonBills.map(b => `<li>${b.name} — $${b.amount} <small>${formatDate(b.dueDate)}</small></li>`).join('') : '<li>No upcoming bills</li>';

  const todayMeals = (state.data.meals || []).filter(m => m.date === today);
  $('#today-meals ul').innerHTML = todayMeals.length ? todayMeals.map(m => `<li>${m.type}: ${m.description}</li>`).join('') : '<li>No meals planned</li>';

  const recentNotes = (state.data.notes || []).slice(-3).reverse();
  $('#today-notes ul').innerHTML = recentNotes.length ? recentNotes.map(n => `<li>${n.text} <small>— ${displayName(n.author)}</small></li>`).join('') : '<li>No notes</li>';
}

function renderList(ul, items, renderer, empty = 'Nothing here yet') {
  if (!ul) return;
  ul.innerHTML = items.length ? items.map(renderer).join('') : `<li class="empty">${empty}</li>`;
}

function renderChores() {
  renderList($('#chores-list'), state.data.chores || [], c => `
    <li class="${c.done ? 'done' : ''}">
      <span>${c.text} <small>(${displayName(c.assigned)})</small></span>
      <span>
        <button class="toggle-btn" data-id="${c.id}">${c.done ? '↺' : '✓'}</button>
        <button class="delete-btn" data-id="${c.id}">×</button>
      </span>
    </li>
  `, 'No chores');
  bindListActions('#chores-list', 'chores');
}

function renderGrocery() {
  renderList($('#grocery-list'), state.data.groceries || [], g => `
    <li>
      <span>${g.item}</span>
      <button class="delete-btn" data-id="${g.id}">×</button>
    </li>
  `, 'Shopping list is empty');
  bindListActions('#grocery-list', 'groceries');

  renderList($('#meals-list'), (state.data.meals || []).sort((a,b) => (a.date || '').localeCompare(b.date || '')), m => `
    <li>
      <span>${formatDate(m.date)} — ${m.type}: ${m.description}</span>
      <button class="delete-btn" data-id="${m.id}">×</button>
    </li>
  `, 'No meals planned');
  bindListActions('#meals-list', 'meals');
}

function renderBills() {
  const summaryEl = $('#bills-summary');
  if (summaryEl) {
    const today = todayISO();
    const bills = state.data.bills || [];
    const unpaid = bills.filter(b => !b.paid);
    const overdue = unpaid.filter(b => b.dueDate < today);
    const thisMonth = unpaid.filter(b => (b.dueDate || '').startsWith(today.slice(0, 7)));
    const totalUnpaid = unpaid.reduce((s, b) => s + Number(b.amount || 0), 0);
    const totalThisMonth = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);
    summaryEl.innerHTML = `
      <div class="summary-card"><strong>Unpaid</strong><span>$${totalUnpaid.toFixed(2)}</span></div>
      <div class="summary-card"><strong>This month</strong><span>$${totalThisMonth.toFixed(2)}</span></div>
      <div class="summary-card ${overdue.length ? 'warn' : ''}"><strong>Overdue</strong><span>${overdue.length}</span></div>
    `;
  }

  let list = [...(state.data.bills || [])].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  if (!state.showPaidBills) list = list.filter(b => !b.paid);

  renderList($('#bills-list'), list, b => {
    const recur = b.recur && b.recur !== 'none' ? ` <span class="badge">${recurLabel(b.recur)}</span>` : '';
    return `
      <li class="${b.paid ? 'done' : ''}">
        <span>${b.name} — $${Number(b.amount).toFixed(2)} <small>due ${formatDate(b.dueDate)}${recur}</small></span>
        <span>
          <button class="toggle-btn" data-id="${b.id}">${b.paid ? '↺' : '✓'}</button>
          <button class="delete-btn" data-id="${b.id}">×</button>
        </span>
      </li>
    `;
  }, 'No bills');

  bindListActions('#bills-list', 'bills');
  renderCalendar('bills', state.currentMonthBills, (state.data.bills || []).filter(b => !b.paid).map(b => b.dueDate).filter(Boolean));
}

function renderPlans() {
  renderList($('#plans-list'), (state.data.plans || []).sort((a,b) => (a.date || '').localeCompare(b.date || '')), p => `
    <li>
      <span>${formatDate(p.date)} — ${p.title}${p.description ? ': ' + p.description : ''}</span>
      <button class="delete-btn" data-id="${p.id}">×</button>
    </li>
  `, 'No plans');
  bindListActions('#plans-list', 'plans');
  renderCalendar('plans', state.currentMonthPlans, (state.data.plans || []).map(p => p.date).filter(Boolean));
}

function renderNotes() {
  renderList($('#notes-list'), [...(state.data.notes || [])].reverse(), n => `
    <li>
      <span>${n.text} <small>— ${displayName(n.author)} · ${formatDate(n.date)}</small></span>
      <button class="delete-btn" data-id="${n.id}">×</button>
    </li>
  `, 'No notes');
  bindListActions('#notes-list', 'notes');
}

function renderBaby() {
  const today = todayISO();
  const logs = state.data.babyLogs || [];
  const todayLogs = logs.filter(l => (l.time || '').startsWith(today));
  const feedings = todayLogs.filter(l => l.type === 'feeding').length;
  const diapers = todayLogs.filter(l => l.type === 'diaper').length;

  const summary = $('#baby-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="summary-card"><strong>Feedings today</strong><span>${feedings}</span></div>
      <div class="summary-card"><strong>Diapers today</strong><span>${diapers}</span></div>
      <div class="summary-card"><strong>Logs today</strong><span>${todayLogs.length}</span></div>
    `;
  }

  renderList($('#logs-list'), [...logs].reverse().slice(0, 30), l => `
    <li>
      <span><span class="badge">${l.type}</span> ${l.note || ''} <small>${formatDate(l.time)} ${formatTime(l.time)}</small></span>
      <button class="delete-btn" data-id="${l.id}">×</button>
    </li>
  `, 'No logs yet');
  bindListActions('#logs-list', 'babyLogs');

  renderList($('#milestones-list'), [...(state.data.milestones || [])].sort((a,b) => (b.date || '').localeCompare(a.date || '')), m => `
    <li>
      <span>${formatDate(m.date)} — ${m.text}</span>
      <button class="delete-btn" data-id="${m.id}">×</button>
    </li>
  `, 'No milestones yet');
  bindListActions('#milestones-list', 'milestones');

  renderList($('#appts-list'), [...(state.data.appointments || [])].sort((a,b) => (a.date || '').localeCompare(b.date || '')), a => `
    <li>
      <span>${formatDate(a.date)} — ${a.title}${a.note ? ': ' + a.note : ''}</span>
      <button class="delete-btn" data-id="${a.id}">×</button>
    </li>
  `, 'No appointments');
  bindListActions('#appts-list', 'appointments');

  renderList($('#baby-notes-list'), [...(state.data.babyNotes || [])].reverse(), n => `
    <li>
      <span>${n.text} <small>— ${displayName(n.author)} · ${formatDate(n.date)}</small></span>
      <button class="delete-btn" data-id="${n.id}">×</button>
    </li>
  `, 'No memories yet');
  bindListActions('#baby-notes-list', 'babyNotes');
}

function bindListActions(selector, key) {
  const ul = $(selector);
  if (!ul) return;
  ul.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      state.data[key] = (state.data[key] || []).filter(i => i.id !== btn.dataset.id);
      await saveData();
      renderAll();
    };
  });
  ul.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const item = (state.data[key] || []).find(i => i.id === btn.dataset.id);
      if (!item) return;
      if (key === 'chores') {
        item.done = !item.done;
      }
      if (key === 'bills') {
        const wasPaid = item.paid;
        item.paid = !item.paid;
        if (!wasPaid && item.paid && item.recur && item.recur !== 'none') {
          const nextDate = nextDueDate(item.dueDate, item.recur);
          if (nextDate) {
            state.data.bills.push({
              id: uid(),
              name: item.name,
              amount: item.amount,
              dueDate: nextDate,
              paid: false,
              recur: item.recur
            });
          }
        }
      }
      await saveData();
      renderAll();
    };
  });
}

// Calendars
function renderCalendar(type, date, eventDates) {
  const cal = $(`#calendar-${type}`);
  const monthYear = $(`#month-year-${type}`);
  if (!cal || !monthYear) return;
  const year = date.getFullYear();
  const month = date.getMonth();
  monthYear.textContent = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="day-header">${d}</div>`).join('');
  for (let i = 0; i < startDay; i++) html += '<div class="day other"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = iso === todayISO();
    const has = (eventDates || []).includes(iso);
    html += `<div class="day ${isToday ? 'today' : ''} ${has ? 'has-event' : ''}" data-date="${iso}">${d}</div>`;
  }
  cal.innerHTML = html;

  cal.querySelectorAll('.day[data-date]').forEach(day => {
    day.onclick = () => {
      if (type === 'plans' && $('#plan-date')) $('#plan-date').value = day.dataset.date;
      if (type === 'bills' && $('#bill-due')) $('#bill-due').value = day.dataset.date;
    };
  });
}

function setupCalendars() {
  const pPrev = $('#prev-month-plans');
  const pNext = $('#next-month-plans');
  const bPrev = $('#prev-month-bills');
  const bNext = $('#next-month-bills');
  if (pPrev) pPrev.onclick = () => { state.currentMonthPlans.setMonth(state.currentMonthPlans.getMonth() - 1); renderPlans(); };
  if (pNext) pNext.onclick = () => { state.currentMonthPlans.setMonth(state.currentMonthPlans.getMonth() + 1); renderPlans(); };
  if (bPrev) bPrev.onclick = () => { state.currentMonthBills.setMonth(state.currentMonthBills.getMonth() - 1); renderBills(); };
  if (bNext) bNext.onclick = () => { state.currentMonthBills.setMonth(state.currentMonthBills.getMonth() + 1); renderBills(); };
}

// Add actions
function setupAdds() {
  const addChore = $('#add-chore');
  if (addChore) addChore.onclick = async () => {
    const text = $('#chore-text').value.trim();
    if (!text) return;
    state.data.chores.push({ id: uid(), text, assigned: $('#chore-assign').value, done: false });
    $('#chore-text').value = '';
    await saveData();
    renderAll();
  };

  const addGrocery = $('#add-grocery');
  if (addGrocery) addGrocery.onclick = async () => {
    const item = $('#grocery-item').value.trim();
    if (!item) return;
    state.data.groceries.push({ id: uid(), item });
    $('#grocery-item').value = '';
    await saveData();
    renderAll();
  };

  const addMeal = $('#add-meal');
  if (addMeal) addMeal.onclick = async () => {
    const description = $('#meal-desc').value.trim();
    const date = $('#meal-date').value;
    if (!description || !date) return;
    state.data.meals.push({ id: uid(), date, type: $('#meal-type').value, description });
    $('#meal-desc').value = '';
    await saveData();
    renderAll();
  };

  const addBill = $('#add-bill');
  if (addBill) addBill.onclick = async () => {
    const name = $('#bill-name').value.trim();
    const amount = $('#bill-amount').value;
    const dueDate = $('#bill-due').value;
    const recurEl = $('#bill-recur');
    const recur = recurEl ? recurEl.value : 'none';
    if (!name || !dueDate) return;
    state.data.bills.push({
      id: uid(),
      name,
      amount: amount || 0,
      dueDate,
      paid: false,
      recur: recur === 'none' ? undefined : recur
    });
    $('#bill-name').value = '';
    $('#bill-amount').value = '';
    if (recurEl) recurEl.value = 'none';
    await saveData();
    renderAll();
  };

  const addPlan = $('#add-plan');
  if (addPlan) addPlan.onclick = async () => {
    const title = $('#plan-title').value.trim();
    const date = $('#plan-date').value;
    if (!title || !date) return;
    state.data.plans.push({ id: uid(), date, title, description: $('#plan-desc').value.trim() });
    $('#plan-title').value = ''; $('#plan-desc').value = '';
    await saveData();
    renderAll();
  };

  const addNote = $('#add-note');
  if (addNote) addNote.onclick = async () => {
    const text = $('#note-text').value.trim();
    if (!text) return;
    state.data.notes.push({ id: uid(), text, author: $('#note-author').value, date: todayISO() });
    $('#note-text').value = '';
    await saveData();
    renderAll();
  };

  const addLog = $('#add-log');
  if (addLog) addLog.onclick = async () => {
    const type = $('#log-type').value;
    const note = $('#log-note').value.trim();
    state.data.babyLogs.push({ id: uid(), type, note, time: new Date().toISOString() });
    $('#log-note').value = '';
    await saveData();
    renderAll();
  };

  const addMilestone = $('#add-milestone');
  if (addMilestone) addMilestone.onclick = async () => {
    const text = $('#milestone-text').value.trim();
    const date = $('#milestone-date').value || todayISO();
    if (!text) return;
    state.data.milestones.push({ id: uid(), date, text });
    $('#milestone-text').value = '';
    await saveData();
    renderAll();
  };

  const addAppt = $('#add-appt');
  if (addAppt) addAppt.onclick = async () => {
    const title = $('#appt-title').value.trim();
    const date = $('#appt-date').value;
    const note = $('#appt-note').value.trim();
    if (!title || !date) return;
    state.data.appointments.push({ id: uid(), date, title, note });
    $('#appt-title').value = '';
    $('#appt-note').value = '';
    await saveData();
    renderAll();
  };

  const addBabyNote = $('#add-baby-note');
  if (addBabyNote) addBabyNote.onclick = async () => {
    const text = $('#baby-note-text').value.trim();
    if (!text) return;
    state.data.babyNotes.push({ id: uid(), text, author: $('#baby-note-author').value, date: todayISO() });
    $('#baby-note-text').value = '';
    await saveData();
    renderAll();
  };

  const showPaid = $('#show-paid-bills');
  if (showPaid) {
    showPaid.onchange = () => {
      state.showPaidBills = showPaid.checked;
      renderBills();
    };
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCalendars();
  setupAdds();
  const saveBtn = $('#save-config');
  if (saveBtn) saveBtn.onclick = saveConfig;
  loadConfig();
  const t = todayISO();
  ['#plan-date', '#meal-date', '#bill-due', '#milestone-date', '#appt-date'].forEach(id => {
    const el = $(id);
    if (el) el.value = t;
  });
});
