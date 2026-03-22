import { getCached, putCached } from './cache.js';

const NS_PROHLIDKA = 'istp:opendata:schemas:ProhlidkaSeznam:v1';

/**
 * Fetch a gzipped XML file, decompress, parse, and extract inspection records.
 * Returns: [{ date, region, brand, result, defects: [{kod, zavaznost}] }, ...]
 */
export async function fetchAndParse(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Stahování selhalo: ${response.status} ${url}`);
  }

  // Decompress gzip in browser
  const text = await decompressResponse(response);

  // Parse XML
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Chyba parsování XML: ${parserError.textContent.slice(0, 200)}`);
  }

  return extractRecords(doc);
}

async function decompressResponse(response) {
  // Try DecompressionStream (modern browsers)
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('gzip');
      const decompressed = response.body.pipeThrough(ds);
      return await new Response(decompressed).text();
    } catch {
      // Fall through to arraybuffer approach
    }
  }

  // Fallback: if the server already decompressed (content-encoding handled by browser),
  // the response may already be text
  return await response.text();
}

function extractRecords(doc) {
  const records = [];
  const prohlidky = doc.getElementsByTagNameNS(NS_PROHLIDKA, 'Prohlidka');

  for (const p of prohlidky) {
    const date = getTextNS(p, NS_PROHLIDKA, 'DatumProhlidky');
    const result = getTextNS(p, NS_PROHLIDKA, 'VysledekCelkovy');
    const region = getRegion(p);
    const vozidlo = p.getElementsByTagNameNS(NS_PROHLIDKA, 'Vozidlo')[0];
    const brand = vozidlo ? getTextNS(vozidlo, NS_PROHLIDKA, 'Znacka') : '';
    const model = vozidlo ? getTextNS(vozidlo, NS_PROHLIDKA, 'ObchodniOznaceni') : '';
    const engineType = vozidlo ? getTextNS(vozidlo, NS_PROHLIDKA, 'TypMotoru') : '';
    const emisniCast = p.getElementsByTagNameNS(NS_PROHLIDKA, 'EmisniCast')[0];
    const fuel = emisniCast ? getTextNS(emisniCast, NS_PROHLIDKA, 'ZakladniPalivo') : '';
    const vysledek = p.getElementsByTagNameNS(NS_PROHLIDKA, 'Vysledek')[0];
    const odometer = vysledek ? parseInt(getTextNS(vysledek, NS_PROHLIDKA, 'Odometr'), 10) || 0 : 0;
    const defects = getDefects(p);

    records.push({ date, region, brand, model, engineType, fuel, odometer, result, defects });
  }

  return records;
}

function getRegion(prohlidka) {
  const stanice = prohlidka.getElementsByTagNameNS(NS_PROHLIDKA, 'Stanice')[0];
  if (!stanice) return '';
  return getTextNS(stanice, NS_PROHLIDKA, 'Kraj');
}

function getDefects(prohlidka) {
  const defects = [];
  // Collect defects from TechnickaCast, Vysledek, and TskCast
  const sections = [
    ...prohlidka.getElementsByTagNameNS(NS_PROHLIDKA, 'TechnickaCast'),
    ...prohlidka.getElementsByTagNameNS(NS_PROHLIDKA, 'TskCast'),
  ];

  // Also check Vysledek for its own ZavadaSeznam
  const vysledek = prohlidka.getElementsByTagNameNS(NS_PROHLIDKA, 'Vysledek')[0];
  if (vysledek) sections.push(vysledek);

  for (const section of sections) {
    const zavady = section.getElementsByTagNameNS(NS_PROHLIDKA, 'Zavada');
    for (const z of zavady) {
      const kod = getTextNS(z, NS_PROHLIDKA, 'Kod');
      const zavaznost = getTextNS(z, NS_PROHLIDKA, 'Zavaznost');
      if (kod) {
        defects.push({ kod, zavaznost });
      }
    }
  }

  return defects;
}

function getTextNS(parent, ns, localName) {
  const el = parent.getElementsByTagNameNS(ns, localName)[0];
  return el?.textContent?.trim() ?? '';
}

/**
 * Fetch multiple datasets in parallel with concurrency limit.
 * Calls onProgress(completedCount, totalCount) after each completes.
 * Returns all records concatenated.
 */
/**
 * Fetch multiple datasets in parallel with concurrency limit.
 * Uses IndexedDB cache — already-fetched days are instant.
 * Calls onProgress(completedCount, totalCount, cachedCount) after each completes.
 * Returns all records concatenated.
 */
export async function fetchAllWithProgress(datasets, onProgress, concurrency = 5) {
  const allRecords = [];
  let completed = 0;
  let cachedCount = 0;
  const total = datasets.length;

  // Process in batches
  for (let i = 0; i < total; i += concurrency) {
    const batch = datasets.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (ds) => {
        const cached = await getCached(ds.date);
        if (cached) {
          cachedCount++;
          return cached;
        }
        const records = await fetchAndParse(ds.url);
        await putCached(ds.date, records);
        return records;
      })
    );

    for (const result of results) {
      completed++;
      if (result.status === 'fulfilled') {
        allRecords.push(...result.value);
      }
    }

    onProgress(completed, total, cachedCount);
  }

  return allRecords;
}
