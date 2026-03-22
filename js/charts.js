const COLORS = {
  pass: '#22c55e',
  minor: '#f59e0b',
  fail: '#ef4444',
  brand: '#3b82f6',
  brandMuted: '#bfdbfe',
  region: '#6366f1',
  regionMuted: '#c7d2fe',
  sevA: '#facc15',
  sevB: '#f97316',
  sevC: '#dc2626',
};

// Defect codes loaded from data/defects.json (Vyhláška č. 211/2018 Sb.)
let DEFECT_NAMES = {};

export async function loadDefectNames() {
  try {
    const resp = await fetch('data/defects.json');
    if (resp.ok) DEFECT_NAMES = await resp.json();
  } catch {
    // Non-fatal — defect labels will just show codes
  }
}

/**
 * Look up a defect code description. Tries exact match first,
 * then progressively shorter prefixes.
 * Returns { code, description } separately.
 */
export function defectLookup(code) {
  if (DEFECT_NAMES[code]) return { code, description: DEFECT_NAMES[code] };
  const parts = code.split('.');
  for (let i = parts.length - 1; i >= 2; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (DEFECT_NAMES[prefix]) return { code, description: DEFECT_NAMES[prefix] };
  }
  return { code, description: '' };
}

export function defectLabel(code) {
  const { description } = defectLookup(code);
  if (!description) return code;
  // Truncate for chart labels
  const short = description.length > 50 ? description.slice(0, 47) + '…' : description;
  return `${code} – ${short}`;
}

// Click callbacks
let _brandClickCb = null;
let _regionClickCb = null;

export function onBrandClick(cb) { _brandClickCb = cb; }
export function onRegionClick(cb) { _regionClickCb = cb; }

let chartTime = null;
let chartBrand = null;
let chartRegion = null;
let chartDefects = null;
let chartFuel = null;
let chartModel = null;
let chartOdometer = null;
let chartAge = null;

/**
 * @param {object} filteredStats - aggregated from filtered records (for time/defects)
 * @param {object} fullStats - aggregated from ALL records (for brand/region — always show full list)
 * @param {string|null} activeBrand - highlighted brand (or null)
 * @param {string|null} activeRegion - highlighted region (or null)
 */
export function renderCharts(filteredStats, fullStats, activeBrand = null, activeRegion = null) {
  renderTimeChart(filteredStats.byDate);
  renderBrandChart(fullStats.byBrand, activeBrand);
  renderRegionChart(fullStats.byRegion, activeRegion);
  renderFuelChart(filteredStats.byFuel);
  renderModelChart(filteredStats.byModel);
  renderOdometerChart(filteredStats.byModel);
  renderAgeChart(activeBrand ? filteredStats.byModel : filteredStats.byBrand);
  renderDefectsChart(filteredStats.defects);
}

export function destroyCharts() {
  chartTime?.destroy();
  chartBrand?.destroy();
  chartRegion?.destroy();
  chartDefects?.destroy();
  chartFuel?.destroy();
  chartModel?.destroy();
  chartOdometer?.destroy();
  chartAge?.destroy();
  chartTime = chartBrand = chartRegion = chartDefects = chartFuel = chartModel = chartOdometer = chartAge = null;
}

function renderTimeChart(byDate) {
  const dates = Object.keys(byDate).sort();
  const pass = dates.map(d => byDate[d].pass);
  const minor = dates.map(d => byDate[d].minor);
  const fail = dates.map(d => byDate[d].fail);

  const labels = dates.map(d => {
    const parts = d.split('-');
    return `${parts[2]}.${parts[1]}.`;
  });

  const ctx = document.getElementById('chartTime');
  chartTime?.destroy();
  chartTime = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Způsobilé', data: pass, backgroundColor: COLORS.pass },
        { label: 'S vadami', data: minor, backgroundColor: COLORS.minor },
        { label: 'Nezpůsobilé', data: fail, backgroundColor: COLORS.fail },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.raw.toLocaleString('cs-CZ')}`,
            footer: (items) => {
              const total = items.reduce((s, i) => s + i.raw, 0);
              return `Celkem: ${total.toLocaleString('cs-CZ')}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        }
      }
    }
  });
}

function renderBrandChart(byBrand, activeBrand) {
  const sorted = Object.entries(byBrand)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, v]) => v.total);

  // Highlight active brand, mute others
  const bgColors = labels.map(name =>
    activeBrand && name !== activeBrand ? COLORS.brandMuted : COLORS.brand
  );

  const ctx = document.getElementById('chartBrand');
  chartBrand?.destroy();
  chartBrand = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Počet prohlídek',
        data,
        backgroundColor: bgColors,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      onClick: (_event, elements) => {
        if (elements.length > 0 && _brandClickCb) {
          const idx = elements[0].index;
          _brandClickCb(labels[idx]);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const name = labels[item.dataIndex];
              const isActive = name === activeBrand;
              const suffix = isActive
                ? '  (klikněte pro zrušení filtru)'
                : '  (klikněte pro filtr)';
              return `${item.raw.toLocaleString('cs-CZ')} prohlídek${suffix}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  });
}

function renderRegionChart(byRegion, activeRegion) {
  const sorted = Object.entries(byRegion)
    .filter(([name]) => name && name !== 'Neznámý')
    .sort((a, b) => b[1].total - a[1].total);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, v]) => v.total);

  const bgColors = labels.map(name =>
    activeRegion && name !== activeRegion ? COLORS.regionMuted : COLORS.region
  );

  const ctx = document.getElementById('chartRegion');
  chartRegion?.destroy();
  chartRegion = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Počet prohlídek',
        data,
        backgroundColor: bgColors,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      onClick: (_event, elements) => {
        if (elements.length > 0 && _regionClickCb) {
          const idx = elements[0].index;
          _regionClickCb(labels[idx]);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const name = labels[item.dataIndex];
              const isActive = name === activeRegion;
              const suffix = isActive
                ? '  (klikněte pro zrušení filtru)'
                : '  (klikněte pro filtr)';
              return `${item.raw.toLocaleString('cs-CZ')} prohlídek${suffix}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  });
}

function renderAgeChart(byBrand) {
  const sorted = Object.entries(byBrand)
    .filter(([, v]) => (v.ageCount || 0) >= 5)
    .map(([name, v]) => [name, +(v.ageSum / v.ageCount).toFixed(1)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, avg]) => avg);

  const ctx = document.getElementById('chartAge');
  chartAge?.destroy();
  chartAge = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Průměrný věk (roky)',
        data,
        backgroundColor: '#f97316',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.raw.toLocaleString('cs-CZ')} let`
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => v + ' let' }
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

function wrapText(text, maxLen) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line.length + 1 + word.length) > maxLen) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderDefectsChart(defects) {
  const sorted = Object.entries(defects)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  const codes = sorted.map(([code]) => code);
  const labels = codes;
  const dataA = sorted.map(([, v]) => v.A);
  const dataB = sorted.map(([, v]) => v.B);
  const dataC = sorted.map(([, v]) => v.C);

  const ctx = document.getElementById('chartDefects');
  chartDefects?.destroy();
  chartDefects = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Lehká (A)', data: dataA, backgroundColor: COLORS.sevA },
        { label: 'Významná (B)', data: dataB, backgroundColor: COLORS.sevB },
        { label: 'Nebezpečná (C)', data: dataC, backgroundColor: COLORS.sevC },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      interaction: { mode: 'index', axis: 'y', intersect: true },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.92)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          maxWidth: 400,
          callbacks: {
            title: (items) => {
              const code = codes[items[0].dataIndex];
              const { description } = defectLookup(code);
              return wrapText(`${code} – ${description}`, 60);
            },
            label: (item) => `${item.dataset.label}: ${item.raw.toLocaleString('cs-CZ')}`,
            footer: (items) => {
              const total = items.reduce((s, i) => s + i.raw, 0);
              return `Celkem: ${total.toLocaleString('cs-CZ')}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        },
        y: {
          stacked: true,
          ticks: {
            autoSkip: false,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

function renderFuelChart(byFuel) {
  const sorted = Object.entries(byFuel)
    .sort((a, b) => b[1].total - a[1].total);

  const labels = sorted.map(([name]) => name || 'Neznámé');
  const data = sorted.map(([, v]) => v.total);

  const fuelColors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ];
  const bgColors = data.map((_, i) => fuelColors[i % fuelColors.length]);

  const ctx = document.getElementById('chartFuel');
  chartFuel?.destroy();
  chartFuel = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: bgColors }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = item.dataset.data.reduce((s, v) => s + v, 0);
              const pct = ((item.raw / total) * 100).toFixed(1);
              return `${item.label}: ${item.raw.toLocaleString('cs-CZ')} (${pct} %)`;
            }
          }
        }
      }
    }
  });
}

function renderModelChart(byModel) {
  const sorted = Object.entries(byModel)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, v]) => v.total);

  const ctx = document.getElementById('chartModel');
  chartModel?.destroy();
  chartModel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Počet prohlídek',
        data,
        backgroundColor: '#8b5cf6',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.raw.toLocaleString('cs-CZ')} prohlídek`
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

function renderOdometerChart(byModel) {
  const sorted = Object.entries(byModel)
    .filter(([, v]) => v.odometerCount >= 5)
    .map(([name, v]) => [name, Math.round(v.odometerSum / v.odometerCount)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, avg]) => avg);

  const ctx = document.getElementById('chartOdometer');
  chartOdometer?.destroy();
  chartOdometer = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Průměrný nájezd (km)',
        data,
        backgroundColor: '#14b8a6',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.raw.toLocaleString('cs-CZ')} km`
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => v.toLocaleString('cs-CZ') + ' km' }
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: 11 }
          }
        }
      }
    }
  });
}
