/* ===== State ===== */
const TODAY = new Date().toISOString().slice(0, 10);
const OB_KEY = 'calorie-tracker-onboarded';

let state = {
  goal: 2000,
  meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  customMeals: [],    // [{ id, name, emoji }] — persisted separately (not per-day)
  hiddenMeals: []     // built-in meal IDs hidden by the user
};

/* ===== Persistence ===== */
function loadState() {
  try {
    const saved = localStorage.getItem('calorie-tracker-' + TODAY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.meals = parsed.meals || state.meals;
    }
    const goalStr = localStorage.getItem('calorie-tracker-goal');
    if (goalStr) state.goal = parseInt(goalStr, 10);

    // Custom meals persist across days
    const cm = localStorage.getItem('calorie-tracker-custom-meals');
    if (cm) {
      state.customMeals = JSON.parse(cm);
      for (const m of state.customMeals) {
        if (!state.meals[m.id]) state.meals[m.id] = [];
      }
    }
    const hm = localStorage.getItem('calorie-tracker-hidden-meals');
    if (hm) state.hiddenMeals = JSON.parse(hm);
  } catch (_) {}
}

function saveState() {
  localStorage.setItem('calorie-tracker-' + TODAY, JSON.stringify({ meals: state.meals }));
  localStorage.setItem('calorie-tracker-goal', String(state.goal));
  localStorage.setItem('calorie-tracker-custom-meals', JSON.stringify(state.customMeals));
  localStorage.setItem('calorie-tracker-hidden-meals', JSON.stringify(state.hiddenMeals));
}

/* ===== Render ===== */
const RING_CIRCUMFERENCE = 2 * Math.PI * 50;

function renderAll() {
  renderCustomMealCards();

  // Show/hide built-in meal cards
  const BUILTIN = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (const id of BUILTIN) {
    const card = document.getElementById('meal-' + id);
    if (card) card.style.display = state.hiddenMeals.includes(id) ? 'none' : '';
  }

  // Show/hide the "Add Custom Meal" card (max 1 custom meal)
  document.getElementById('add-custom-meal-btn').style.display =
    state.customMeals.length >= 1 ? 'none' : '';

  const visibleBuiltin = BUILTIN.filter(id => !state.hiddenMeals.includes(id));
  const meals = [...visibleBuiltin, ...state.customMeals.map(m => m.id)];
  let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  for (const meal of meals) {
    const items = state.meals[meal];
    const mealCals = items.reduce((s, i) => s + i.calories, 0);
    totalCals    += mealCals;
    totalProtein += items.reduce((s, i) => s + (i.protein || 0), 0);
    totalCarbs   += items.reduce((s, i) => s + (i.carbs   || 0), 0);
    totalFat     += items.reduce((s, i) => s + (i.fat     || 0), 0);

    document.getElementById('cals-' + meal).textContent = Math.round(mealCals) + ' kcal';

    const list = document.getElementById('list-' + meal);
    list.innerHTML = '';
    for (let idx = 0; idx < items.length; idx++) {
      list.appendChild(buildFoodItem(meal, idx, items[idx]));
    }
  }

  document.getElementById('stat-consumed').textContent = Math.round(totalCals);
  document.getElementById('stat-goal').textContent = state.goal || '—';
  document.getElementById('mac-protein').textContent = totalProtein.toFixed(1) + 'g';
  document.getElementById('mac-carbs').textContent   = totalCarbs.toFixed(1)   + 'g';
  document.getElementById('mac-fat').textContent     = totalFat.toFixed(1)     + 'g';

  const ringEl = document.getElementById('ring-fg');
  const remaining = state.goal - totalCals;
  document.getElementById('ring-remaining').textContent = state.goal ? Math.abs(Math.round(remaining)) : '—';

  if (state.goal) {
    const pct = Math.min(totalCals / state.goal, 1);
    ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
    ringEl.classList.toggle('over', remaining < 0);
    document.getElementById('ring-remaining').style.color = remaining < 0 ? 'var(--danger)' : 'var(--text)';
  } else {
    ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }
}

/* ===== Custom Meal Cards ===== */
const MEAL_EMOJIS = ['🥘','🫕','💪','🏋️','🥤','🍵','🧃','🥙','🌮','🫔',
                     '🍜','🥣','🧇','🥚','🥩','🫙','🍱','🍛','🥐','🍚'];

function renderCustomMealCards() {
  const container = document.getElementById('custom-meals-container');
  // Only rebuild DOM if card count changed; otherwise just update contents
  const existing = container.querySelectorAll('.meal-card');
  if (existing.length !== state.customMeals.length) {
    container.innerHTML = '';
    for (const m of state.customMeals) {
      container.appendChild(buildCustomMealCard(m));
    }
  }
}

function buildCustomMealCard({ id, name, emoji }) {
  const div = document.createElement('div');
  div.className = 'meal-card';
  div.id = 'meal-' + id;
  div.innerHTML = `
    <div class="meal-header">
      <div class="meal-header-left">
        <span class="meal-icon">${emoji}</span>
        <span class="meal-title">${escHtml(name)}</span>
        <button class="meal-remove-btn" data-delete-meal="${id}" title="Remove meal">✕</button>
      </div>
      <div class="meal-header-right">
        <span class="meal-cals" id="cals-${id}">0 kcal</span>
        <button class="add-btn" data-meal="${id}">+ Add</button>
      </div>
    </div>
    <ul class="food-list" id="list-${id}"></ul>
  `;
  return div;
}

function buildFoodItem(meal, idx, item) {
  const li = document.createElement('li');
  li.className = 'food-item';
  const macroStr = [
    item.protein != null ? `P ${item.protein.toFixed(1)}g` : null,
    item.carbs   != null ? `C ${item.carbs.toFixed(1)}g`   : null,
    item.fat     != null ? `F ${item.fat.toFixed(1)}g`     : null
  ].filter(Boolean).join('  ·  ');

  li.innerHTML = `
    <div class="food-item-left">
      <span class="food-item-name">${escHtml(item.name)}</span>
      ${macroStr ? `<span class="food-item-macros">${macroStr}</span>` : ''}
    </div>
    <div class="food-item-right">
      <span class="food-item-cals">${Math.round(item.calories)} kcal</span>
      <button class="remove-btn" aria-label="Remove" data-meal="${meal}" data-idx="${idx}">×</button>
    </div>
  `;
  return li;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Modal helpers ===== */
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

/* ===== Custom Confirm Dialog ===== */
let _confirmCallback = null;

document.getElementById('confirm-ok').addEventListener('click', () => {
  closeModal('modal-confirm');
  if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
});
document.getElementById('confirm-cancel').addEventListener('click', () => {
  closeModal('modal-confirm');
  _confirmCallback = null;
});

function showConfirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  _confirmCallback = onConfirm;
  openModal('modal-confirm');
}

/* ===== Settings ===== */
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('input-goal').value = state.goal || '';
  openModal('modal-settings');
});
document.getElementById('btn-save-goal').addEventListener('click', () => {
  const val = parseInt(document.getElementById('input-goal').value, 10);
  if (!isNaN(val) && val > 0) {
    state.goal = val;
    saveState();
    renderAll();
    closeModal('modal-settings');
  }
});
document.getElementById('btn-restore-meals').addEventListener('click', () => {
  state.hiddenMeals = [];
  saveState();
  renderAll();
  closeModal('modal-settings');
});

document.getElementById('btn-reset-day').addEventListener('click', () => {
  showConfirm('Reset all food entries for today?', () => {
    state.meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    for (const m of state.customMeals) state.meals[m.id] = [];
    saveState();
    renderAll();
    closeModal('modal-settings');
  });
});

/* ===== Add Food Modal ===== */
let currentMeal = 'breakfast';
let pendingFood  = null;
let scannerInstance = null;
let scannerActive   = false;

// Event delegation — works for both hardcoded and dynamically added meal cards
document.addEventListener('click', e => {
  const btn = e.target.closest('.add-btn');
  if (!btn) return;
  currentMeal = btn.dataset.meal;
  const cm = state.customMeals.find(m => m.id === currentMeal);
  const title = cm ? cm.name : (currentMeal.charAt(0).toUpperCase() + currentMeal.slice(1));
  document.getElementById('modal-add-title').textContent = 'Add to ' + title;
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('food-search-input').value = '';
  document.getElementById('barcode-result').classList.add('hidden');
  switchTab('search');
  openModal('modal-add');
});

/* ===== Hide built-in meal ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-hide-meal]');
  if (!btn) return;
  const id = btn.dataset.hideMeal;
  if (!state.hiddenMeals.includes(id)) state.hiddenMeals.push(id);
  saveState();
  renderAll();
});

/* ===== Delete custom meal ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-delete-meal]');
  if (!btn) return;
  const id = btn.dataset.deleteMeal;
  const meal = state.customMeals.find(m => m.id === id);
  if (!meal) return;
  showConfirm(`Remove "${meal.name}"?`, () => {
    state.customMeals = state.customMeals.filter(m => m.id !== id);
    delete state.meals[id];
    saveState();
    renderAll();
  });
});

/* ===== Custom Meal Creation ===== */
document.getElementById('add-custom-meal-btn').addEventListener('click', () => {
  // Populate emoji grid
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  MEAL_EMOJIS.forEach(em => {
    const span = document.createElement('button');
    span.className = 'emoji-opt';
    span.textContent = em;
    span.addEventListener('click', () => {
      grid.querySelectorAll('.emoji-opt').forEach(s => s.classList.remove('chosen'));
      span.classList.add('chosen');
    });
    grid.appendChild(span);
  });
  // Default selection
  grid.querySelector('.emoji-opt').classList.add('chosen');
  document.getElementById('new-meal-name').value = '';
  openModal('modal-new-meal');
});

document.getElementById('btn-create-meal').addEventListener('click', () => {
  const name = document.getElementById('new-meal-name').value.trim();
  if (!name) { alert('Please enter a meal name.'); return; }

  const chosen = document.getElementById('emoji-grid').querySelector('.emoji-opt.chosen');
  const emoji  = chosen ? chosen.textContent : '🥘';
  const id     = 'custom-' + Date.now();

  state.customMeals.push({ id, name, emoji });
  state.meals[id] = [];
  saveState();
  renderAll();
  closeModal('modal-new-meal');
});

document.querySelector('[data-close="modal-add"]').addEventListener('click', stopScanner);
document.getElementById('modal-add').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-add')) stopScanner();
});

/* ===== Tabs ===== */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => {
    const active = p.id === 'tab-' + tab;
    p.classList.toggle('active', active);
    p.classList.toggle('hidden', !active);
  });
  if (tab === 'barcode') startScanner(); else stopScanner();
}

/* ===== Food Search ===== */
document.getElementById('btn-search').addEventListener('click', doSearch);
document.getElementById('food-search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const query = document.getElementById('food-search-input').value.trim();
  if (!query) return;

  const container = document.getElementById('search-results');
  container.innerHTML = '<div class="loading">Searching…</div>';

  // Try USDA first (generic English foods with per-item portions)
  let items = [];
  try {
    items = await searchUSDA(query);
  } catch (_) {}

  // Fall back to Open Food Facts (English / US filtered) if USDA returns nothing
  if (items.length === 0) {
    try {
      items = await searchOFF(query);
    } catch (_) {}
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="no-results">No results found. Try the Manual tab.</div>';
    return;
  }

  container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'result-item';
    const calsPer = Math.round((item.cal100 * (item.portions[0]?.grams ?? 100)) / 100);
    div.innerHTML = `
      <div>
        <div class="result-name">${escHtml(item.name)}</div>
        ${item.brand ? `<div class="result-brand">${escHtml(item.brand)}</div>` : ''}
        <div class="result-brand">per ${escHtml(item.portions[0]?.label ?? '100g')}</div>
      </div>
      <div class="result-cals">${calsPer} kcal</div>
    `;
    div.addEventListener('click', () => openQtyModal(item));
    container.appendChild(div);
  });
}

/* --- USDA FoodData Central --- */
async function searchUSDA(query) {
  // DEMO_KEY allows ~30 req/hr. Free account at https://fdc.nal.usda.gov/api-guide.html for more.
  const url = 'https://api.nal.usda.gov/fdc/v1/foods/search'
    + `?query=${encodeURIComponent(query)}`
    + '&dataType=Foundation,SR%20Legacy'
    + '&pageSize=20'
    + '&api_key=DEMO_KEY';

  const res  = await fetch(url);
  const data = await res.json();

  return (data.foods || [])
    .map(buildUSDAItem)
    .filter(Boolean)
    .slice(0, 15);
}

function buildUSDAItem(food) {
  const nm = {};
  for (const n of (food.foodNutrients || [])) nm[n.nutrientId] = n.value;

  const cal100  = nm[1008] || 0;
  const pro100  = nm[1003] || 0;
  const carb100 = nm[1005] || 0;
  const fat100  = nm[1004] || 0;
  if (!cal100) return null;

  // Build portion options from USDA foodPortions
  const portions = (food.foodPortions || [])
    .filter(p => p.gramWeight)
    .map(p => ({
      label: p.portionDescription
        || (p.amount && p.modifier ? `${p.amount} ${p.modifier}` : null)
        || `${p.gramWeight}g`,
      grams: p.gramWeight
    }));

  portions.push({ label: '100g', grams: 100 });
  portions.push({ label: 'Custom (g)', grams: null });

  return {
    name: toTitleCase(food.description),
    brand: null,
    cal100, pro100, carb100, fat100,
    portions
  };
}

/* --- Open Food Facts (English fallback) --- */
async function searchOFF(query) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl'
    + `?search_terms=${encodeURIComponent(query)}`
    + '&search_simple=1&action=process&json=1'
    + '&lc=en&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states'
    + '&page_size=20'
    + '&fields=product_name,brands,nutriments,serving_size,serving_quantity';

  const res  = await fetch(url);
  const data = await res.json();

  return (data.products || [])
    .map(buildOFFItem)
    .filter(Boolean)
    .slice(0, 15);
}

function buildOFFItem(p) {
  const nm = p.nutriments || {};
  const cal100  = nm['energy-kcal_100g'];
  const pro100  = nm['proteins_100g']       || 0;
  const carb100 = nm['carbohydrates_100g']  || 0;
  const fat100  = nm['fat_100g']            || 0;
  if (!cal100 || !p.product_name) return null;

  const portions = [];

  // Add serving size if we know the gram weight
  const servingG = parseFloat(p.serving_quantity);
  if (p.serving_size && servingG > 0) {
    portions.push({ label: `1 serving (${p.serving_size})`, grams: servingG });
  }
  portions.push({ label: '100g', grams: 100 });
  portions.push({ label: 'Custom (g)', grams: null });

  return {
    name:  p.product_name,
    brand: p.brands ? p.brands.split(',')[0].trim() : null,
    cal100, pro100, carb100, fat100,
    portions
  };
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/* ===== Barcode Scanner ===== */
async function startScanner() {
  if (scannerActive) return;
  const container = document.getElementById('scanner-container');
  container.innerHTML = '';
  document.getElementById('barcode-result').classList.add('hidden');

  try {
    scannerInstance = new Html5Qrcode('scanner-container');
    await scannerInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 130 } },
      onBarcodeScanned, () => {}
    );
    scannerActive = true;
  } catch (_) {
    container.innerHTML = '<div class="no-results" style="padding:30px 20px">Camera access denied or unavailable.<br>Use Search or Manual instead.</div>';
  }
}

async function stopScanner() {
  if (!scannerActive || !scannerInstance) return;
  try { await scannerInstance.stop(); scannerInstance.clear(); } catch (_) {}
  scannerActive   = false;
  scannerInstance = null;
}

async function onBarcodeScanned(barcode) {
  if (!scannerActive) return;
  await stopScanner();

  const resultEl = document.getElementById('barcode-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="loading">Looking up barcode…</div>';

  try {
    const url  = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 1 || !data.product) {
      resultEl.innerHTML = `<div class="no-results">Product not found (${barcode}).</div>`;
      return;
    }

    const item = buildOFFItem(data.product);
    if (!item) {
      resultEl.innerHTML = '<div class="no-results">No nutrition data for this product.</div>';
      return;
    }

    const calsPer = Math.round((item.cal100 * (item.portions[0]?.grams ?? 100)) / 100);
    resultEl.innerHTML = `
      <h3>${escHtml(item.name)}</h3>
      ${item.brand ? `<p>${escHtml(item.brand)}</p>` : ''}
      <div class="barcode-result-cals">${calsPer} kcal <span style="font-size:.75rem;font-weight:400;color:var(--text-muted)">per ${escHtml(item.portions[0]?.label ?? '100g')}</span></div>
    `;

    const addBtn = document.createElement('button');
    addBtn.className = 'primary-btn full-width';
    addBtn.style.marginTop = '12px';
    addBtn.textContent = 'Add to Meal';
    addBtn.addEventListener('click', () => openQtyModal(item));
    resultEl.appendChild(addBtn);
  } catch (_) {
    resultEl.innerHTML = '<div class="no-results">Lookup failed. Check your connection.</div>';
  }
}

/* ===== Manual Entry ===== */
document.getElementById('btn-add-manual').addEventListener('click', () => {
  const name     = document.getElementById('manual-name').value.trim();
  const calories = parseFloat(document.getElementById('manual-calories').value);
  if (!name || isNaN(calories) || calories < 0) {
    alert('Please enter a food name and valid calorie amount.');
    return;
  }
  const protein = parseFloat(document.getElementById('manual-protein').value) || 0;
  const carbs   = parseFloat(document.getElementById('manual-carbs').value)   || 0;
  const fat     = parseFloat(document.getElementById('manual-fat').value)     || 0;

  addFoodToMeal({ name, calories, protein, carbs, fat });
  ['manual-name','manual-calories','manual-protein','manual-carbs','manual-fat']
    .forEach(id => { document.getElementById(id).value = ''; });
  closeModal('modal-add');
});

/* ===== Quantity Modal ===== */
function openQtyModal(item) {
  pendingFood = item;
  document.getElementById('qty-food-name').textContent = item.name;

  // Populate portion select
  const sel = document.getElementById('qty-portion');
  sel.innerHTML = '';
  item.portions.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.grams != null
      ? `${p.label}  (${Math.round((item.cal100 * p.grams) / 100)} kcal)`
      : p.label;
    sel.appendChild(opt);
  });

  document.getElementById('qty-servings').value = '1';
  document.getElementById('qty-custom-g').value = '100';
  updateQtyCustomVisibility();
  updateQtyPreview();
  openModal('modal-qty');
}

function selectedPortion() {
  if (!pendingFood) return null;
  const idx = parseInt(document.getElementById('qty-portion').value, 10);
  return pendingFood.portions[idx] || null;
}

function updateQtyCustomVisibility() {
  const p = selectedPortion();
  document.getElementById('qty-custom-wrap').classList.toggle('hidden', !!(p && p.grams != null));
}

function updateQtyPreview() {
  if (!pendingFood) return;
  const p        = selectedPortion();
  const grams    = p && p.grams != null
    ? p.grams
    : (parseFloat(document.getElementById('qty-custom-g').value) || 100);
  const servings = parseFloat(document.getElementById('qty-servings').value) || 1;
  const total    = (grams * servings) / 100;

  const cals    = pendingFood.cal100  * total;
  const protein = pendingFood.pro100  * total;
  const carbs   = pendingFood.carb100 * total;
  const fat     = pendingFood.fat100  * total;

  document.getElementById('qty-preview').innerHTML = `
    <div class="preview-cals">${Math.round(cals)} kcal</div>
    <div class="preview-macros">P ${protein.toFixed(1)}g  ·  C ${carbs.toFixed(1)}g  ·  F ${fat.toFixed(1)}g</div>
  `;
}

document.getElementById('qty-portion').addEventListener('change', () => {
  updateQtyCustomVisibility();
  updateQtyPreview();
});
document.getElementById('qty-servings').addEventListener('input', updateQtyPreview);
document.getElementById('qty-custom-g').addEventListener('input', updateQtyPreview);

document.getElementById('btn-confirm-add').addEventListener('click', () => {
  if (!pendingFood) return;
  const p       = selectedPortion();
  const grams   = p && p.grams != null
    ? p.grams
    : (parseFloat(document.getElementById('qty-custom-g').value) || 100);
  const servings = parseFloat(document.getElementById('qty-servings').value) || 1;
  const total    = (grams * servings) / 100;

  addFoodToMeal({
    name:     pendingFood.name,
    calories: pendingFood.cal100  * total,
    protein:  pendingFood.pro100  * total,
    carbs:    pendingFood.carb100 * total,
    fat:      pendingFood.fat100  * total
  });
  closeModal('modal-qty');
  closeModal('modal-add');
  pendingFood = null;
});

/* ===== Add food to meal ===== */
function addFoodToMeal(food) {
  state.meals[currentMeal].push(food);
  saveState();
  renderAll();
}

/* ===== Remove food ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('.remove-btn');
  if (!btn) return;
  const { meal, idx } = btn.dataset;
  state.meals[meal].splice(parseInt(idx, 10), 1);
  saveState();
  renderAll();
});

/* ===== Init ===== */
loadState();
renderAll();
initOnboarding();

/* ===== Onboarding ===== */
function initOnboarding() {
  if (localStorage.getItem(OB_KEY) && state.goal) return;
  document.getElementById('onboarding').classList.remove('hidden');
}

// Step navigation
document.getElementById('ob-next').addEventListener('click', () => setObStep(1));
document.getElementById('ob-back').addEventListener('click', () => setObStep(0));

function setObStep(n) {
  document.querySelectorAll('.ob-step').forEach((el, i) =>
    el.classList.toggle('active', i === n));
  document.querySelectorAll('.ob-dot').forEach((el, i) =>
    el.classList.toggle('ob-dot--active', i === n));
  if (n === 1) document.getElementById('ob-goal-input').focus();
}

// Live health warning
const OB_CAUTION_THRESHOLD = 1500; // amber
const OB_DANGER_THRESHOLD  = 1200; // red

document.getElementById('ob-goal-input').addEventListener('input', updateObWarning);

function updateObWarning() {
  const val    = parseInt(document.getElementById('ob-goal-input').value, 10);
  const warnEl = document.getElementById('ob-warning');

  if (!val || val >= OB_CAUTION_THRESHOLD) {
    warnEl.className = 'ob-warning hidden';
    warnEl.innerHTML = '';
    return;
  }

  if (val < OB_DANGER_THRESHOLD) {
    warnEl.className = 'ob-warning ob-warning--danger';
    warnEl.innerHTML = `
      <strong>⚕️ Very low calorie goal</strong><br>
      ${val < 800
        ? 'A goal below 800 kcal is classified as a <strong>Very Low Calorie Diet (VLCD)</strong> and carries serious health risks including muscle loss, nutritional deficiencies and metabolic changes. This level should <strong>only be followed under direct medical supervision</strong>.'
        : 'A goal below 1,200 kcal/day is below the recommended minimum for most adults (1,200 kcal for women, 1,500 kcal for men). Sustained restriction at this level can lead to nutritional deficiencies and other health complications.'
      }
      <br><br>Please speak to your <strong>doctor or a registered dietitian</strong> before committing to a calorie goal this low.`;
  } else {
    warnEl.className = 'ob-warning ob-warning--caution';
    warnEl.innerHTML = `
      <strong>⚠️ Below recommended minimum</strong><br>
      Most health guidelines recommend a minimum of <strong>1,200 kcal/day for women</strong> and <strong>1,500 kcal/day for men</strong>. Consider whether a slightly higher goal might be more sustainable. If you are unsure, please consult your doctor or a dietitian.`;
  }
}

// Finish onboarding
document.getElementById('ob-finish').addEventListener('click', () => {
  const val = parseInt(document.getElementById('ob-goal-input').value, 10);
  if (!val || val < 500 || val > 9999) {
    document.getElementById('ob-goal-input').focus();
    document.getElementById('ob-goal-input').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('ob-goal-input').style.borderColor = '', 1500);
    return;
  }
  state.goal = val;
  saveState();
  localStorage.setItem(OB_KEY, '1');
  document.getElementById('onboarding').classList.add('hidden');
  renderAll();
});
