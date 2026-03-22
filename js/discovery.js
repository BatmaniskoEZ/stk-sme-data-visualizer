const SPARQL_ENDPOINT = 'https://data.gov.cz/sparql';
const SERIES_IRI = 'https://data.gov.cz/zdroj/datové-sady/66003008/9c95ebdba1dc7a2fbcfc5b6c07d25705';

/**
 * Find the most recent available dataset date.
 * Returns: "2026-02-21" (or null if nothing found)
 */
export async function discoverLatestDate() {
  const query = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?start WHERE {
  <${SERIES_IRI}> dcat:seriesMember ?ds .
  ?ds dcterms:temporal ?temporal .
  ?temporal dcat:startDate ?start .
}
ORDER BY DESC(?start)
LIMIT 1
`.trim();

  const json = await runSparql(query);
  const bindings = json.results?.bindings ?? [];
  return bindings.length > 0 ? bindings[0].start.value : null;
}

/**
 * Discover dataset download URLs for a date range via SPARQL.
 * Returns array sorted by date: [{ date: "2026-02-21", url: "https://..." }, ...]
 */
export async function discoverDatasets(fromDate, toDate) {
  const query = `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?start ?downloadURL WHERE {
  <${SERIES_IRI}> dcat:seriesMember ?ds .
  ?ds dcterms:temporal ?temporal .
  ?temporal dcat:startDate ?start .
  ?ds dcat:distribution ?dist .
  ?dist dcat:downloadURL ?downloadURL .
  FILTER(?start >= "${fromDate}"^^xsd:date && ?start <= "${toDate}"^^xsd:date)
}
ORDER BY ASC(?start)
`.trim();

  const json = await runSparql(query);
  const bindings = json.results?.bindings ?? [];

  return bindings.map(b => ({
    date: b.start.value,
    url: b.downloadURL.value
  }));
}

async function runSparql(query) {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/sparql-results+json' }
  });

  if (!response.ok) {
    throw new Error(`SPARQL dotaz selhal: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
