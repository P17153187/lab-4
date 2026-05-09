/* ===== State ===== */
const TODAY = new Date().toISOString().slice(0, 10);

let state = {
  goal: 2000,
  meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }
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
  } catch (_) {}
}

function saveState() {
  localStorage.setItem('calorie-tracker-' + TODAY, JSON.stringify({ meals: state.meals }));
  localStorage.setItem('calorie-tracker-goal', String(state.goal));
}

/* ===== Render ===== */
const RING_CIRCUMFERENCE = 2 * Math.PI * 50;

function renderAll() {
  const meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
  let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  for (const meal of meals) {
    const items = state.meals[meal];
    const mealCals = items.reduce((s, i) => s + i.calories, 0);
    totalCals += mealCals;
    totalProtein += items.reduce((s, i) => s + (i.protein || 0), 0);
    totalCarbs += items.reduce((s, i) => s + (i.carbs || 0), 0);
    totalFat += items.reduce((s, i) => s + (i.fat || 0), 0);

    document.getElementById('cals-' + meal).textContent = Math.round(mealCals) + ' kcal';

    const list = document.getElementById('list-' + meal);
    list.innerHTML = '';
    for (let idx = 0; idx < items.length; idx++) {
      list.appendChild(buildFoodItem(meal, idx, items[idx]));
    }
  }

  // Summary numbers
  document.getElementById('stat-consumed').textContent = Math.round(totalCals);
  document.getElementById('stat-goal').textContent = state.goal || '—';
  document.getElementById('mac-protein').textContent = totalProtein.toFixed(1) + 'g';
  document.getElementById('mac-carbs').textContent = totalCarbs.toFixed(1) + 'g';
  document.getElementById('mac-fat').textContent = totalFat.toFixed(1) + 'g';

  // Ring
  const ringEl = document.getElementById('ring-fg');
  const remaining = state.goal - totalCals;
  document.getElementById('ring-remaining').textContent = state.goal ? Math.abs(Math.round(remaining)) : '—';

  if (state.goal) {
    const pct = Math.min(totalCals / state.goal, 1);
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    ringEl.style.strokeDashoffset = offset;
    ringEl.classList.toggle('over', remaining < 0);
    document.getElementById('ring-remaining').style.color = remaining < 0 ? 'var(--danger)' : 'var(--text)';
  } else {
    ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }
}

function buildFoodItem(meal, idx, item) {
  const li = document.createElement('li');
  li.className = 'food-item';

  const macroStr = [
    item.protein != null ? `P ${item.protein.toFixed(1)}g` : null,
    item.carbs  != null ? `C ${item.carbs.toFixed(1)}g`   : null,
    item.fat    != null ? `F ${item.fat.toFixed(1)}g`     : null
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Modal helpers ===== */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

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

document.getElementById('btn-reset-day').addEventListener('click', () => {
  if (confirm('Reset all food entries for today?')) {
    state.meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    saveState();
    renderAll();
    closeModal('modal-settings');
  }
});

/* ===== Add Food Modal ===== */
let currentMeal = 'breakfast';
let pendingFood = null;
let scannerInstance = null;
let scannerActive = false;

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentMeal = btn.dataset.meal;
    const title = currentMeal.charAt(0).toUpperCase() + currentMeal.slice(1);
    document.getElementById('modal-add-title').textContent = 'Add to ' + title;
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('food-search-input').value = '';
    document.getElementById('barcode-result').classList.add('hidden');
    switchTab('search');
    openModal('modal-add');
  });
});

// Close add modal — also stop scanner
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
  if (tab === 'barcode') {
    startScanner();
  } else {
    stopScanner();
  }
}

/* ===== Food Search (Open Food Facts) ===== */
document.getElementById('btn-search').addEventListener('click', doSearch);
document.getElementById('food-search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const query = document.getElementById('food-search-input').value.trim();
  if (!query) return;

  const container = document.getElementById('search-results');
  container.innerHTML = '<div class="loading">Searching…</div>';

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url);
    const data = await res.json();

    const products = (data.products || []).filter(p =>
      p.product_name &&
      p.nutriments &&
      (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal_serving'] || p.nutriments['energy-kcal'])
    );

    if (!products.length) {
      container.innerHTML = '<div class="no-results">No results found. Try the Manual tab.</div>';
      return;
    }

    container.innerHTML = '';
    products.slice(0, 15).forEach(p => {
      const item = buildFoodFromProduct(p);
      if (!item) return;

      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <div>
          <div class="result-name">${escHtml(item.name)}</div>
          ${item.brand ? `<div class="result-brand">${escHtml(item.brand)}</div>` : ''}
          <div class="result-brand">per ${item.servingLabel}</div>
        </div>
        <div class="result-cals">${Math.round(item.caloriesPer)} kcal</div>
      `;
      div.addEventListener('click', () => openQtyModal(item));
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<div class="no-results">Search failed. Check your connection.</div>';
  }
}

function buildFoodFromProduct(p) {
  const nm = p.nutriments;
  const name = p.product_name || 'Unknown';
  const brand = p.brands ? p.brands.split(',')[0].trim() : '';

  // Prefer per-serving, fall back to per-100g
  let caloriesPer, proteinPer, carbsPer, fatPer, servingLabel;
  const serving100 = nm['energy-kcal_100g'];
  const servingS = nm['energy-kcal_serving'];

  if (servingS && p.serving_size) {
    caloriesPer = servingS;
    proteinPer  = nm['proteins_serving'] || 0;
    carbsPer    = nm['carbohydrates_serving'] || 0;
    fatPer      = nm['fat_serving'] || 0;
    servingLabel = p.serving_size;
  } else if (serving100) {
    caloriesPer = serving100;
    proteinPer  = nm['proteins_100g'] || 0;
    carbsPer    = nm['carbohydrates_100g'] || 0;
    fatPer      = nm['fat_100g'] || 0;
    servingLabel = '100g';
  } else {
    return null;
  }

  return { name, brand, caloriesPer, proteinPer, carbsPer, fatPer, servingLabel };
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
      onBarcodeScanned,
      () => {}
    );
    scannerActive = true;
  } catch (err) {
    container.innerHTML = `<div class="no-results" style="padding:30px 20px">Camera access denied or not available.<br>Use the Search or Manual tab instead.</div>`;
  }
}

async function stopScanner() {
  if (!scannerActive || !scannerInstance) return;
  try {
    await scannerInstance.stop();
    scannerInstance.clear();
  } catch (_) {}
  scannerActive = false;
  scannerInstance = null;
}

async function onBarcodeScanned(barcode) {
  if (!scannerActive) return;
  await stopScanner();

  const resultEl = document.getElementById('barcode-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="loading">Looking up barcode…</div>';

  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 1 || !data.product) {
      resultEl.innerHTML = `<div class="no-results">Product not found (${barcode}).<br>Try searching by name instead.</div>`;
      return;
    }

    const item = buildFoodFromProduct(data.product);
    if (!item) {
      resultEl.innerHTML = `<div class="no-results">No nutrition data for this product.</div>`;
      return;
    }

    resultEl.innerHTML = `
      <h3>${escHtml(item.name)}</h3>
      ${item.brand ? `<p>${escHtml(item.brand)}</p>` : ''}
      <p>Per ${escHtml(item.servingLabel)} · P ${item.proteinPer.toFixed(1)}g · C ${item.carbsPer.toFixed(1)}g · F ${item.fatPer.toFixed(1)}g</p>
      <div class="barcode-result-cals">${Math.round(item.caloriesPer)} kcal</div>
    `;

    const addBtn = document.createElement('button');
    addBtn.className = 'primary-btn full-width';
    addBtn.style.marginTop = '12px';
    addBtn.textContent = 'Add to Meal';
    addBtn.addEventListener('click', () => openQtyModal(item));
    resultEl.appendChild(addBtn);

  } catch (err) {
    resultEl.innerHTML = '<div class="no-results">Lookup failed. Check your connection.</div>';
  }
}

/* ===== Manual Entry ===== */
document.getElementById('btn-add-manual').addEventListener('click', () => {
  const name = document.getElementById('manual-name').value.trim();
  const calories = parseFloat(document.getElementById('manual-calories').value);

  if (!name || isNaN(calories) || calories < 0) {
    alert('Please enter a food name and valid calorie amount.');
    return;
  }

  const protein = parseFloat(document.getElementById('manual-protein').value) || 0;
  const carbs   = parseFloat(document.getElementById('manual-carbs').value)   || 0;
  const fat     = parseFloat(document.getElementById('manual-fat').value)     || 0;

  addFoodToMeal({ name, calories, protein, carbs, fat });

  // Clear fields
  ['manual-name','manual-calories','manual-protein','manual-carbs','manual-fat']
    .forEach(id => { document.getElementById(id).value = ''; });
});

/* ===== Quantity Modal ===== */
function openQtyModal(foodItem) {
  pendingFood = foodItem;
  document.getElementById('qty-food-name').textContent = foodItem.name;
  document.getElementById('qty-servings').value = '1';
  document.getElementById('qty-info').innerHTML = `
    Per serving (${escHtml(foodItem.servingLabel || '1 serving')})<br>
    <strong>${Math.round(foodItem.caloriesPer)} kcal</strong>
    · P ${foodItem.proteinPer.toFixed(1)}g
    · C ${foodItem.carbsPer.toFixed(1)}g
    · F ${foodItem.fatPer.toFixed(1)}g
  `;
  openModal('modal-qty');
}

document.getElementById('btn-confirm-add').addEventListener('click', () => {
  if (!pendingFood) return;
  const servings = parseFloat(document.getElementById('qty-servings').value) || 1;
  addFoodToMeal({
    name:     pendingFood.name,
    calories: pendingFood.caloriesPer * servings,
    protein:  pendingFood.proteinPer  * servings,
    carbs:    pendingFood.carbsPer    * servings,
    fat:      pendingFood.fatPer      * servings
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
