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

// Common STK defect codes (EU Directive 2014/45/EU + Czech specifics)
const DEFECT_NAMES = {
  '0.1':     'Identifikace vozidla – RZ',
  '0.2':     'Identifikace vozidla – VIN',
  '1.1.1':   'Stav karoserie/rámu',
  '1.1.2':   'Upevnění karoserie/rámu',
  '1.1.3':   'Pant a závěs dveří',
  '1.1.4':   'Podlaha a práh',
  '1.1.6':   'Výfukové potrubí a tlumiče',
  '1.1.6.2.1': 'Výfukový systém – netěsnost',
  '1.1.11':  'Podvozek – podélníky/příčníky',
  '1.1.11.4.1': 'Koroze podélníků/příčníků',
  '1.1.12':  'Jiné části podvozku',
  '1.1.12.2.1': 'Koroze jiných částí podvozku',
  '1.2':     'Výhled z místa řidiče',
  '1.3':     'Stěrače a ostřikovače',
  '1.4':     'Další vybavení',
  '1.6':     'Schodky a plošiny',
  '1.8':     'Sedadla',
  '2.1.1':   'Přední náprava',
  '2.1.1.5.1': 'Manžeta nápravy poškozena',
  '2.1.2':   'Zadní náprava',
  '2.1.3':   'Řízení – vůle/poškození',
  '2.1.3.7.1': 'Manžeta řízení poškozena',
  '2.2':     'Kola a pneumatiky',
  '2.3':     'Odpružení',
  '2.6':     'Čep řízení',
  '3.1':     'Potrubí brzdové soustavy',
  '3.2':     'Bubnové/kotoučové brzdy',
  '3.2.1.2': 'Disk/buben brzdy – opotřebení',
  '3.3':     'Parkovací brzda',
  '3.4':     'Účinnost provozní brzdy',
  '3.4.2.1': 'Rozdíl brzdných sil na nápravě',
  '3.5':     'ABS/ESP',
  '3.7':     'Brzdové obložení',
  '4.1':     'Světlomety (potkávací)',
  '4.1.1':   'Stav a funkce světlometu',
  '4.1.1.2.1': 'Seřízení světlometu',
  '4.1.2':   'Světlomet – přepínání',
  '4.1.3':   'Světlomet – seřízení',
  '4.2':     'Přední obrysové a poziční',
  '4.3':     'Zadní obrysové a poziční',
  '4.4':     'Brzdová světla',
  '4.5':     'Směrová světla',
  '4.7':     'Zadní odrazky',
  '4.7.1.2.1': 'Odrazka – stav/barva',
  '4.9':     'Kontrolky',
  '4.11':    'Spojení světel s vozidlem',
  '4.13':    'Denní svícení (DRL)',
  '5.1':     'Hluk',
  '5.2':     'Emise výfukových plynů',
  '5.3':     'Elektromagnetická kompatibilita',
  '5.3.4.2.1': 'Únik provozních kapalin',
  '6.1':     'Spojovací zařízení (tažné)',
  '6.1.3.5.1': 'Tažné zařízení – koroze',
  '6.2':     'Upevnění nákladu',
  '6.2.3.3.1': 'SPZ – stav/čitelnost',
  '6.2.10.2.1': 'Koroze nosné konstrukce',
  '7.1':     'Bezpečnostní pásy',
  '7.9':     'Airbagy',
  '8.1':     'Hlučnost',
  '8.2':     'Emise',
  '8.2.1.2.1': 'Emise – překročení limitu (nízko)',
  '8.2.1.2.3': 'Emise – OBD závada',
  '8.4':     'Jiné ekologické požadavky',
};

/**
 * Look up a defect code description. Tries exact match first,
 * then progressively shorter prefixes.
 */
export function defectLabel(code) {
  if (DEFECT_NAMES[code]) return `${code} – ${DEFECT_NAMES[code]}`;
  const parts = code.split('.');
  for (let i = parts.length - 1; i >= 2; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (DEFECT_NAMES[prefix]) return `${code} – ${DEFECT_NAMES[prefix]}`;
  }
  return code;
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
  renderOdometerChart(filteredStats.byBrand);
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
  chartTime = chartBrand = chartRegion = chartDefects = chartFuel = chartModel = chartOdometer = null;
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

function renderDefectsChart(defects) {
  const sorted = Object.entries(defects)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  const labels = sorted.map(([code]) => defectLabel(code));
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
        x: {
          stacked: true,
          ticks: { callback: v => v.toLocaleString('cs-CZ') }
        },
        y: {
          stacked: true,
          ticks: {
            autoSkip: false,
            font: { size: 11 }
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

function renderOdometerChart(byBrand) {
  const sorted = Object.entries(byBrand)
    .filter(([, v]) => v.odometerCount > 0)
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
