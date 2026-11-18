// Our Household App
const state = {
  data: { chores: [], groceries: [], meals: [], bills: [], plans: [], notes: [] },
  config: null,
  currentMonthPlans: new Date(),
  currentMonthBills: new Date()
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
    renderAll();
  } catch (e) {
    console.warn('No data yet or error:', e);
    state.data = { chores: [], groceries: [], meals: [], bills: [], plans: [], notes: [] };
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
  $('#current-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderHome() {
  const today = todayISO();
  const chores = state.data.chores.filter(c => !c.done).slice(0, 5);
  $('#today-chores ul').innerHTML = chores.length ? chores.map(c => `<li>${c.text} <small>(${displayName(c.assigned)})</small></li>`).join('') : '<li>No pending chores</li>';

  const soonBills = state.data.bills.filter(b => !b.paid && b.dueDate >= today).slice(0, 4);
  $('#today-bills ul').innerHTML = soonBills.length ? soonBills.map(b => `<li>${b.name} — $${b.amount} <small>${formatDate(b.dueDate)}</small></li>`).join('') : '<li>No upcoming bills</li>';

  const todayMeals = state.data.meals.filter(m => m.date === today);
  $('#today-meals ul').innerHTML = todayMeals.length ? todayMeals.map(m => `<li>${m.type}: ${m.description}</li>`).join('') : '<li>No meals planned</li>';

  const recentNotes = state.data.notes.slice(-3).reverse();
  $('#today-notes ul').innerHTML = recentNotes.length ? recentNotes.map(n => `<li>${n.text} <small>— ${displayName(n.author)}</small></li>`).join('') : '<li>No notes</li>';
}

function renderList(ul, items, renderer, empty = 'Nothing here yet') {
  ul.innerHTML = items.length ? items.map(renderer).join('') : `<li class="empty">${empty}</li>`;
}

function renderChores() {
  renderList($('#chores-list'), state.data.chores, c => `
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
  renderList($('#grocery-list'), state.data.groceries, g => `
    <li>
      <span>${g.item}</span>
      <button class="delete-btn" data-id="${g.id}">×</button>
    </li>
  `, 'Shopping list is empty');
  bindListActions('#grocery-list', 'groceries');

  renderList($('#meals-list'), state.data.meals.sort((a,b) => a.date.localeCompare(b.date)), m => `
    <li>
      <span>${formatDate(m.date)} — ${m.type}: ${m.description}</span>
      <button class="delete-btn" data-id="${m.id}">×</button>
    </li>
  `, 'No meals planned');
  bindListActions('#meals-list', 'meals');
}

function renderBills() {
  renderList($('#bills-list'), state.data.bills.sort((a,b) => a.dueDate.localeCompare(b.dueDate)), b => `
    <li class="${b.paid ? 'done' : ''}">
      <span>${b.name} — $${Number(b.amount).toFixed(2)} <small>due ${formatDate(b.dueDate)}</small></span>
      <span>
        <button class="toggle-btn" data-id="${b.id}">${b.paid ? '↺' : '✓'}</button>
        <button class="delete-btn" data-id="${b.id}">×</button>
      </span>
    </li>
  `, 'No bills');
  bindListActions('#bills-list', 'bills');
  renderCalendar('bills', state.currentMonthBills, state.data.bills.map(b => b.dueDate));
}

function renderPlans() {
  renderList($('#plans-list'), state.data.plans.sort((a,b) => a.date.localeCompare(b.date)), p => `
    <li>
      <span>${formatDate(p.date)} — ${p.title}${p.description ? ': ' + p.description : ''}</span>
      <button class="delete-btn" data-id="${p.id}">×</button>
    </li>
  `, 'No plans');
  bindListActions('#plans-list', 'plans');
  renderCalendar('plans', state.currentMonthPlans, state.data.plans.map(p => p.date));
}

function renderNotes() {
  renderList($('#notes-list'), [...state.data.notes].reverse(), n => `
    <li>
      <span>${n.text} <small>— ${displayName(n.author)} · ${formatDate(n.date)}</small></span>
      <button class="delete-btn" data-id="${n.id}">×</button>
    </li>
  `, 'No notes');
  bindListActions('#notes-list', 'notes');
}

function bindListActions(selector, key) {
  const ul = $(selector);
  ul.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      state.data[key] = state.data[key].filter(i => i.id !== btn.dataset.id);
      await saveData();
      renderAll();
    };
  });
  ul.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const item = state.data[key].find(i => i.id === btn.dataset.id);
      if (item) {
        if (key === 'chores') item.done = !item.done;
        if (key === 'bills') item.paid = !item.paid;
        await saveData();
        renderAll();
      }
    };
  });
}

// Calendars
function renderCalendar(type, date, eventDates) {
  const cal = $(`#calendar-${type}`);
  const monthYear = $(`#month-year-${type}`);
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
    const has = eventDates.includes(iso);
    html += `<div class="day ${isToday ? 'today' : ''} ${has ? 'has-event' : ''}" data-date="${iso}">${d}</div>`;
  }
  cal.innerHTML = html;

  cal.querySelectorAll('.day[data-date]').forEach(day => {
    day.onclick = () => {
      if (type === 'plans') $('#plan-date').value = day.dataset.date;
      if (type === 'bills') $('#bill-due').value = day.dataset.date;
    };
  });
}

function setupCalendars() {
  $('#prev-month-plans').onclick = () => { state.currentMonthPlans.setMonth(state.currentMonthPlans.getMonth() - 1); renderPlans(); };
  $('#next-month-plans').onclick = () => { state.currentMonthPlans.setMonth(state.currentMonthPlans.getMonth() + 1); renderPlans(); };
  $('#prev-month-bills').onclick = () => { state.currentMonthBills.setMonth(state.currentMonthBills.getMonth() - 1); renderBills(); };
  $('#next-month-bills').onclick = () => { state.currentMonthBills.setMonth(state.currentMonthBills.getMonth() + 1); renderBills(); };
}

// Add actions
function setupAdds() {
  $('#add-chore').onclick = async () => {
    const text = $('#chore-text').value.trim();
    if (!text) return;
    state.data.chores.push({ id: uid(), text, assigned: $('#chore-assign').value, done: false });
    $('#chore-text').value = '';
    await saveData();
    renderAll();
  };

  $('#add-grocery').onclick = async () => {
    const item = $('#grocery-item').value.trim();
    if (!item) return;
    state.data.groceries.push({ id: uid(), item });
    $('#grocery-item').value = '';
    await saveData();
    renderAll();
  };

  $('#add-meal').onclick = async () => {
    const description = $('#meal-desc').value.trim();
    const date = $('#meal-date').value;
    if (!description || !date) return;
    state.data.meals.push({ id: uid(), date, type: $('#meal-type').value, description });
    $('#meal-desc').value = '';
    await saveData();
    renderAll();
  };

  $('#add-bill').onclick = async () => {
    const name = $('#bill-name').value.trim();
    const amount = $('#bill-amount').value;
    const dueDate = $('#bill-due').value;
    if (!name || !dueDate) return;
    state.data.bills.push({ id: uid(), name, amount: amount || 0, dueDate, paid: false });
    $('#bill-name').value = ''; $('#bill-amount').value = '';
    await saveData();
    renderAll();
  };

  $('#add-plan').onclick = async () => {
    const title = $('#plan-title').value.trim();
    const date = $('#plan-date').value;
    if (!title || !date) return;
    state.data.plans.push({ id: uid(), date, title, description: $('#plan-desc').value.trim() });
    $('#plan-title').value = ''; $('#plan-desc').value = '';
    await saveData();
    renderAll();
  };

  $('#add-note').onclick = async () => {
    const text = $('#note-text').value.trim();
    if (!text) return;
    state.data.notes.push({ id: uid(), text, author: $('#note-author').value, date: todayISO() });
    $('#note-text').value = '';
    await saveData();
    renderAll();
  };
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCalendars();
  setupAdds();
  $('#save-config').onclick = saveConfig;
  loadConfig();
  const t = todayISO();
  $('#plan-date').value = t;
  $('#meal-date').value = t;
  $('#bill-due').value = t;
});
