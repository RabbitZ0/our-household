// Our Household App
const state = {
  data: { chores: [], groceries: [], meals: [], bills: [], plans: [], notes: [] },
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
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function daysUntil(iso) {
  const today = new Date(todayISO() + 'T00:00:00');
  const due = new Date(iso + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

function billStatus(bill) {
  if (bill.paid) return { class: 'paid', label: 'Paid' };
  const days = daysUntil(bill.dueDate);
  if (days < 0) return { class: 'overdue', label: 'Overdue' };
  if (days <= 3) return { class: 'due-soon', label: days === 0 ? 'Due today' : `Due in ${days}d` };
  return { class: 'upcoming', label: `Due ${formatDate(bill.dueDate)}` };
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

  const soonBills = state.data.bills
    .filter(b => !b.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  $('#today-bills ul').innerHTML = soonBills.length
    ? soonBills.map(b => {
        const st = billStatus(b);
        return `<li class="bill-${st.class}">${b.name} — $${Number(b.amount).toFixed(2)} <small>${st.label}</small></li>`;
      }).join('')
    : '<li>No upcoming bills</li>';

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
  const today = todayISO();
  const unpaid = state.data.bills.filter(b => !b.paid);
  const overdue = unpaid.filter(b => b.dueDate < today);
  const thisMonth = unpaid.filter(b => b.dueDate.startsWith(today.slice(0, 7)));
  const totalUnpaid = unpaid.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalThisMonth = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);

  $('#bills-summary').innerHTML = `
    <div class="summary-card"><strong>Unpaid</strong><span>$${totalUnpaid.toFixed(2)}</span></div>
    <div class="summary-card"><strong>This month</strong><span>$${totalThisMonth.toFixed(2)}</span></div>
    <div class="summary-card ${overdue.length ? 'warn' : ''}"><strong>Overdue</strong><span>${overdue.length}</span></div>
  `;

  let list = [...state.data.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!state.showPaidBills) list = list.filter(b => !b.paid);

  renderList($('#bills-list'), list, b => {
    const st = billStatus(b);
    const recur = b.recur && b.recur !== 'none' ? `<span class="badge">${recurLabel(b.recur)}</span>` : '';
    const cat = b.category ? `<span class="badge muted">${b.category}</span>` : '';
    return `
      <li class="${b.paid ? 'done' : ''} bill-${st.class}">
        <div class="bill-info">
          <span class="bill-name">${b.name} — $${Number(b.amount).toFixed(2)}</span>
          <span class="bill-meta">${st.label} ${recur} ${cat}</span>
        </div>
        <span class="bill-actions">
          <button class="toggle-btn" data-id="${b.id}" title="${b.paid ? 'Mark unpaid' : 'Mark paid'}">${b.paid ? '↺' : '✓'}</button>
          <button class="delete-btn" data-id="${b.id}">×</button>
        </span>
      </li>
    `;
  }, 'No bills');

  bindListActions('#bills-list', 'bills');
  renderCalendar('bills', state.currentMonthBills, state.data.bills.filter(b => !b.paid).map(b => b.dueDate));
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
      if (!item) return;
      if (key === 'chores') {
        item.done = !item.done;
      }
      if (key === 'bills') {
        const wasPaid = item.paid;
        item.paid = !item.paid;
        // When marking a recurring bill as paid, create the next occurrence
        if (!wasPaid && item.paid && item.recur && item.recur !== 'none') {
          const nextDate = nextDueDate(item.dueDate, item.recur);
          if (nextDate) {
            state.data.bills.push({
              id: uid(),
              name: item.name,
              amount: item.amount,
              dueDate: nextDate,
              paid: false,
              recur: item.recur,
              category: item.category || ''
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
    const recur = $('#bill-recur').value;
    const category = $('#bill-category').value.trim();
    if (!name || !dueDate) return;
    state.data.bills.push({
      id: uid(),
      name,
      amount: amount || 0,
      dueDate,
      paid: false,
      recur: recur === 'none' ? undefined : recur,
      category: category || undefined
    });
    $('#bill-name').value = '';
    $('#bill-amount').value = '';
    $('#bill-category').value = '';
    $('#bill-recur').value = 'none';
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
  $('#save-config').onclick = saveConfig;
  loadConfig();
  const t = todayISO();
  $('#plan-date').value = t;
  $('#meal-date').value = t;
  $('#bill-due').value = t;
});
