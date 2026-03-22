/**
 * Aggregate parsed inspection records into chart-ready data.
 *
 * Result mapping:
 *   "1" → Způsobilé (pass)
 *   "2" → Způsobilé s vadami (minor defects, still passes)
 *   "3" → Nezpůsobilé (fail)
 */
export function aggregate(records) {
  const byDate = {};
  const byBrand = {};
  const byRegion = {};
  const byFuel = {};
  const byModel = {};
  const defects = {};
  let totalPass = 0;
  let totalMinor = 0;
  let totalFail = 0;
  let odometerSum = 0;
  let odometerCount = 0;

  for (const r of records) {
    // By date
    const dateKey = r.date || 'neznámé';
    if (!byDate[dateKey]) byDate[dateKey] = { total: 0, pass: 0, minor: 0, fail: 0 };
    byDate[dateKey].total++;
    incrementResult(byDate[dateKey], r.result);

    // By brand
    const brand = r.brand || 'Neznámá';
    if (!byBrand[brand]) byBrand[brand] = { total: 0, pass: 0, minor: 0, fail: 0, odometerSum: 0, odometerCount: 0 };
    byBrand[brand].total++;
    incrementResult(byBrand[brand], r.result);
    if (r.odometer > 0) {
      byBrand[brand].odometerSum += r.odometer;
      byBrand[brand].odometerCount++;
    }

    // By region
    const region = r.region || 'Neznámý';
    if (!byRegion[region]) byRegion[region] = { total: 0, pass: 0, minor: 0, fail: 0 };
    byRegion[region].total++;
    incrementResult(byRegion[region], r.result);

    // By fuel type
    if (r.fuel) {
      if (!byFuel[r.fuel]) byFuel[r.fuel] = { total: 0, pass: 0, minor: 0, fail: 0 };
      byFuel[r.fuel].total++;
      incrementResult(byFuel[r.fuel], r.result);
    }

    // By model (brand + model)
    if (r.model) {
      const modelKey = r.brand ? `${r.brand} ${r.model}` : r.model;
      if (!byModel[modelKey]) byModel[modelKey] = { total: 0, pass: 0, minor: 0, fail: 0 };
      byModel[modelKey].total++;
      incrementResult(byModel[modelKey], r.result);
    }

    // Defects
    for (const d of r.defects) {
      if (!defects[d.kod]) defects[d.kod] = { count: 0, A: 0, B: 0, C: 0 };
      defects[d.kod].count++;
      if (d.zavaznost === 'A') defects[d.kod].A++;
      else if (d.zavaznost === 'B') defects[d.kod].B++;
      else if (d.zavaznost === 'C') defects[d.kod].C++;
    }

    // Totals
    if (r.result === '1') totalPass++;
    else if (r.result === '2') totalMinor++;
    else if (r.result === '3') totalFail++;

    if (r.odometer > 0) {
      odometerSum += r.odometer;
      odometerCount++;
    }
  }

  const total = records.length;
  const dates = Object.keys(byDate).sort();
  const passRate = total > 0 ? (totalPass + totalMinor) / total : 0;
  const avgOdometer = odometerCount > 0 ? Math.round(odometerSum / odometerCount) : 0;

  return {
    byDate,
    byBrand,
    byRegion,
    byFuel,
    byModel,
    defects,
    summary: {
      total,
      totalPass,
      totalMinor,
      totalFail,
      passRate,
      avgOdometer,
      dateRange: dates.length > 0 ? [dates[0], dates[dates.length - 1]] : ['—', '—']
    }
  };
}

function incrementResult(obj, result) {
  if (result === '1') obj.pass++;
  else if (result === '2') obj.minor++;
  else if (result === '3') obj.fail++;
}
