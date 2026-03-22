import { discoverDatasets, discoverLatestDate } from './discovery.js';
import { fetchAllWithProgress } from './parser.js';
import { aggregate } from './aggregator.js';
import { renderCharts, destroyCharts, defectLabel, defectLookup, loadDefectNames, onBrandClick, onRegionClick } from './charts.js';

// DOM elements
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const progressFill = document.getElementById('progressFill');
const chartsGrid = document.getElementById('chartsGrid');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const retryBtn = document.getElementById('retryBtn');
const totalEl = document.getElementById('totalInspections');
const passRateEl = document.getElementById('passRate');
const dateRangeEl = document.getElementById('dateRange');
const defectsTableSection = document.getElementById('defectsTableSection');
const defectsTableBody = document.getElementById('defectsTableBody');
const avgOdometerEl = document.getElementById('avgOdometer');
const filterBar = document.getElementById('filterBar');
const filterText = document.getElementById('filterText');
const clearFilterBtn = document.getElementById('clearFilter');

let currentDays = 7;
let currentRecords = [];  // Raw records kept for re-filtering
let fullStats = null;     // Aggregated from ALL records (unfiltered)
let activeBrandFilter = null;
let activeRegionFilter = null;

// Range selector buttons
document.getElementById('rangeSelector').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  const days = parseInt(e.target.dataset.days, 10);
  if (days === currentDays) return;

  currentDays = days;
  document.querySelectorAll('.range-selector button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  loadDashboard(days);
});

retryBtn.addEventListener('click', () => loadDashboard(currentDays));
clearFilterBtn.addEventListener('click', () => applyFilter(null, null));

onBrandClick((brand) => {
  const newBrand = brand === activeBrandFilter ? null : brand;
  applyFilter(newBrand, activeRegionFilter);
});

onRegionClick((region) => {
  const newRegion = region === activeRegionFilter ? null : region;
  applyFilter(activeBrandFilter, newRegion);
});

function applyFilter(brand, region) {
  activeBrandFilter = brand;
  activeRegionFilter = region;

  const labels = [brand, region].filter(Boolean);
  if (labels.length > 0) {
    filterBar.hidden = false;
    filterText.textContent = `Filtr: ${labels.join(' + ')}`;
  } else {
    filterBar.hidden = true;
  }

  let records = currentRecords;
  if (brand) records = records.filter(r => r.brand === brand);
  if (region) records = records.filter(r => r.region === region);

  const filteredStats = aggregate(records);
  updateSummaryCards(filteredStats.summary);
  destroyCharts();
  renderCharts(filteredStats, fullStats, activeBrandFilter, activeRegionFilter);
  renderDefectsTable(filteredStats.defects);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateCZ(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)}.${parseInt(m)}.${y}`;
}

function showLoading() {
  loadingEl.hidden = false;
  errorMessage.hidden = true;
  chartsGrid.hidden = true;
  defectsTableSection.hidden = true;
  filterBar.hidden = true;
  progressFill.style.width = '0%';
  loadingText.textContent = 'Vyhledávání datových sad...';
}

function showError(msg) {
  loadingEl.hidden = true;
  errorMessage.hidden = false;
  chartsGrid.hidden = true;
  defectsTableSection.hidden = true;
  errorText.textContent = msg;
}

function showCharts() {
  loadingEl.hidden = true;
  errorMessage.hidden = true;
  chartsGrid.hidden = false;
  defectsTableSection.hidden = false;
}

function updateSummaryCards(summary) {
  totalEl.textContent = summary.total.toLocaleString('cs-CZ');
  passRateEl.textContent = `${(summary.passRate * 100).toFixed(1)} %`;
  const [from, to] = summary.dateRange;
  dateRangeEl.textContent = `${formatDateCZ(from)} – ${formatDateCZ(to)}`;
  avgOdometerEl.textContent = summary.avgOdometer > 0
    ? `${summary.avgOdometer.toLocaleString('cs-CZ')} km`
    : '—';
}

async function loadDashboard(days) {
  showLoading();
  destroyCharts();
  activeBrandFilter = null;
  activeRegionFilter = null;
  currentRecords = [];

  try {
    loadingText.textContent = 'Zjišťování dostupných dat...';
    const latestDate = await discoverLatestDate();
    if (!latestDate) {
      showError('Nepodařilo se zjistit dostupná data z katalogu.');
      return;
    }

    const to = new Date(latestDate + 'T00:00:00');
    const from = new Date(to);
    from.setDate(from.getDate() - days + 1);

    loadingText.textContent = 'Vyhledávání datových sad...';
    const datasets = await discoverDatasets(formatDate(from), formatDate(to));

    if (datasets.length === 0) {
      showError('Pro zvolené období nebyla nalezena žádná data.');
      return;
    }

    loadingText.textContent = `Načítání dat: 0/${datasets.length} dní...`;

    const allRecords = await fetchAllWithProgress(
      datasets,
      (completed, total, cached) => {
        const pct = Math.round((completed / total) * 100);
        progressFill.style.width = `${pct}%`;
        const cacheNote = cached > 0 ? ` (${cached} z cache)` : '';
        loadingText.textContent = `Načítání dat: ${completed}/${total} dní${cacheNote}...`;
      }
    );

    if (allRecords.length === 0) {
      showError('Data se nepodařilo načíst. Zkuste to prosím později.');
      return;
    }

    currentRecords = allRecords;
    fullStats = aggregate(allRecords);

    updateSummaryCards(fullStats.summary);
    renderCharts(fullStats, fullStats, null, null);
    renderDefectsTable(fullStats.defects);
    showCharts();

  } catch (err) {
    console.error('Dashboard error:', err);
    showError(`Chyba při načítání dat: ${err.message}`);
  }
}

let currentDefects = {};
let activeSevFilter = null;

function renderDefectsTable(defects) {
  currentDefects = defects;
  updateDefectsTableRows();
}

function updateDefectsTableRows() {
  const sorted = Object.entries(currentDefects)
    .filter(([, v]) => {
      if (!activeSevFilter) return true;
      return (v[activeSevFilter] || 0) > 0;
    })
    .sort((a, b) => {
      if (activeSevFilter) return (b[1][activeSevFilter] || 0) - (a[1][activeSevFilter] || 0);
      return b[1].count - a[1].count;
    });

  defectsTableBody.innerHTML = sorted.map(([code, v]) => {
    const { description } = defectLookup(code);
    return `<tr>
      <td><strong>${code}</strong></td>
      <td>${description}</td>
      <td>${v.count.toLocaleString('cs-CZ')}</td>
      <td class="sev-a">${v.A || 0}</td>
      <td class="sev-b">${v.B || 0}</td>
      <td class="sev-c">${v.C || 0}</td>
    </tr>`;
  }).join('');
}

// Severity filter for defects table
document.getElementById('sevFilter').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  const sev = e.target.dataset.sev || null;
  activeSevFilter = sev === activeSevFilter ? null : sev;
  document.querySelectorAll('#sevFilter button').forEach(b => b.classList.remove('active'));
  if (activeSevFilter) e.target.classList.add('active');
  updateDefectsTableRows();
});

// Start with default range
loadDefectNames().then(() => loadDashboard(currentDays));
