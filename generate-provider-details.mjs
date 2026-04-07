/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Pre-genera ficheros de detalle de cada proveedor único:
 *  - data/provider-details/{providerLocalicationCode}.json
 *
 * Lee todos los data/providers/**\/*.json ya generados,
 * extrae combinaciones únicas de (providerLocalicationCode, documentNumber)
 * y llama al endpoint /providers/details de ASISA por cada una.
 *
 * Uso: node generate-provider-details.mjs
 * Forzar sobreescritura: FORCE=true node generate-provider-details.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';
const CONCURRENCY = 25; // Bajar a 10 si aparecen errores 429
const FORCE = process.env.FORCE === 'true';

async function asisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Ocp-Apim-Subscription-Key': ASISA_API_KEY, 'Api-Version': '1' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return { error: resp.status };
    return { data: await resp.json() };
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
}

async function fetchProviderDetails(providerLocalicationCode, documentNumber) {
  const params = new URLSearchParams({
    networkCode: '1',
    providerLocalicationCode: String(providerLocalicationCode),
    documentNumber: String(documentNumber),
  });
  return asisaFetch(`${ASISA_BASE}/providers/details?${params}`);
}


async function parallelLimit(tasks, limit) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index;
      index += 1;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * Recorre recursivamente un directorio y devuelve todos los ficheros .json
 */
function walkJsonFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonFiles(full));
    else if (entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

async function main() {
  const providersDir = join(__dirname, 'data/providers');
  const detailsDir = join(__dirname, 'data/provider-details');

  if (!existsSync(providersDir)) {
    console.error('ERROR: data/providers/ no existe. Ejecuta generate-localidades.mjs primero.');
    process.exit(1);
  }

  if (!existsSync(detailsDir)) mkdirSync(detailsDir, { recursive: true });

  // 1. Leer todos los ficheros de providers y extraer combos únicos
  console.log('Leyendo ficheros de providers para extraer proveedores únicos...');
  const providerFiles = walkJsonFiles(providersDir);
  console.log(`  ${providerFiles.length} ficheros encontrados`);

  // Map: providerLocalicationCode → documentNumber
  // Usamos providerLocalicationCode como clave única (es específico por ubicación)
  const unique = new Map();

  for (const file of providerFiles) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    for (const p of data) {
      const locCode = p.providerLocalicationCode;
      const docNum = p.contact?.documentNumber || '';
      if (locCode && !unique.has(locCode)) {
        unique.set(locCode, docNum);
      }
    }
  }

  console.log(`  ${unique.size} proveedores únicos encontrados`);
  console.log(`  Se necesitan ${unique.size} llamadas al endpoint /providers/details`);

  // 2. Construir tareas
  const entries = [...unique.entries()];
  let newFiles = 0;
  let cachedFiles = 0;
  let errorFiles = 0;
  let completed = 0;

  const tasks = entries.map(([locCode, docNum]) => async () => {
    const filePath = join(detailsDir, `${locCode}.json`);

    if (!FORCE && existsSync(filePath)) {
      cachedFiles += 1;
      completed += 1;
      return;
    }

    const result = await fetchProviderDetails(locCode, docNum);

    if (result.data) {
      writeFileSync(filePath, JSON.stringify(result.data), 'utf8');
      newFiles += 1;
    } else {
      writeFileSync(filePath, 'null', 'utf8');
      errorFiles += 1;
      console.log(`  ✗ [${result.error}] locCode=${locCode} docNum=${docNum}`);
    }

    completed += 1;
    if (completed % 500 === 0 || completed === entries.length) {
      console.log(`  Progreso: ${completed} / ${entries.length} (nuevos: ${newFiles}, caché: ${cachedFiles}, errores: ${errorFiles})`);
    }
  });

  console.log(`\nIniciando descarga de detalles (CONCURRENCY=${CONCURRENCY}, FORCE=${FORCE})...`);
  await parallelLimit(tasks, CONCURRENCY);

  console.log('\n--- Resumen ---');
  console.log(`  Ficheros nuevos:           ${newFiles}`);
  console.log(`  Ficheros desde caché:      ${cachedFiles}`);
  console.log(`  Errores (guardados null):  ${errorFiles}`);
  console.log(`  Total únicos procesados:   ${entries.length}`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });

