/* eslint-disable no-restricted-syntax, no-console */
/**
 * Genera los JSONs estáticos de metadata para el cuadro médico a partir
 * de los providers ya cacheados en data/providers/{prov}/{spec}.json.
 *
 * Prerrequisito: haber ejecutado generate-providers-data.mjs (FORCE=true)
 *
 * Genera:
 *  - data/cuadro-medico/provincias/{slug}.json
 *      { slug, displayName, provinceCode, especialidades: ["dermatologia", ...] }
 *
 *  - data/cuadro-medico/especialidades/{slug}.json
 *      { slug, provincias: [{ slug, displayName, count }] }
 *
 *  - data/cuadro-medico/doctores-index.json
 *      { "{name-slug}-{providerCode}": { providerLocalicationCode, name, specSlug, provinceSlug } }
 *
 *  - data/cuadro-medico/centros-index.json
 *      { "{name-slug}": { providerLocalicationCode, name, provinceSlug } }
 *
 * Uso:
 *   node generate-cuadro-medico-specs.mjs
 *   PROVINCE_SLUG=madrid node generate-cuadro-medico-specs.mjs  (solo una provincia)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJson(path) {
  try {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isProfessional(p) {
  return String(p.doctorType) === '1';
}

// Doctor key: groups all centros where the same colegiado practises into one page.
// Falls back to providerCode for entries without collegiateCode.
function buildDoctorKey(p) {
  const coll = p.professional?.collegiateCode;
  const id = coll && coll !== 0 ? coll : p.providerCode;
  return `${toSlug(p.providerName || '')}-${id}`;
}

function buildCentroKey(p) {
  return toSlug(p.providerName || '');
}

function main() {
  const provinciasData = readJson(join(__dirname, 'data/provincias.json'));
  const especialidadesData = readJson(join(__dirname, 'data/cuadro-medico/especialidades.json'));

  if (!provinciasData || !especialidadesData) {
    console.error('Faltan data/provincias.json o data/cuadro-medico/especialidades.json');
    process.exit(1);
  }

  const provinciaBySlug = new Map(provinciasData.map((p) => [p.slug, p]));
  const especialidadBySlug = new Map(especialidadesData.map((e) => [e.slug, e]));

  const provinceFilter = process.env.PROVINCE_SLUG || null;
  const providersDir = join(__dirname, 'data/providers');

  // Acumuladores
  // provincias: slug → Set de specSlugs con count > 0
  const provSpecMap = new Map();
  // especialidades: specSlug → Map de provSlug → count
  const specProvMap = new Map();
  // doctores: key → { providerLocalicationCode, name, specSlug, provinceSlug }
  const doctoresIndex = {};
  // centros: nameSlug → { providerLocalicationCode, name, provinceSlug }
  const centrosIndex = {};

  const provDirs = readdirSync(providersDir).filter((d) => {
    if (provinceFilter) return d === provinceFilter;
    return existsSync(join(providersDir, d));
  });

  let totalFiles = 0;
  let totalProviders = 0;

  for (const provSlug of provDirs) {
    const provDir = join(providersDir, provSlug);
    const stat = existsSync(provDir);
    if (!stat) continue;

    const provincia = provinciaBySlug.get(provSlug);
    if (!provincia) {
      console.warn(`  ⚠ Provincia sin metadata: ${provSlug}`);
      continue;
    }

    const specFiles = readdirSync(provDir).filter((f) => f.endsWith('.json'));

    for (const specFile of specFiles) {
      const specSlug = specFile.replace(/\.json$/, '');
      const filePath = join(provDir, specFile);

      if (!existsSync(filePath) || readFileSync(filePath, 'utf8').length < 10) continue;

      const providers = readJson(filePath);
      if (!providers?.length) continue;

      totalFiles += 1;
      totalProviders += providers.length;

      // Acumular: provincia → especialidades disponibles
      if (!provSpecMap.has(provSlug)) provSpecMap.set(provSlug, new Set());
      provSpecMap.get(provSlug).add(specSlug);

      // Acumular: especialidad → provincias con count
      if (!specProvMap.has(specSlug)) specProvMap.set(specSlug, new Map());
      const current = specProvMap.get(specSlug).get(provSlug) || 0;
      specProvMap.get(specSlug).set(provSlug, current + providers.length);

      // Acumular doctores y centros
      for (const p of providers) {
        if (!p.providerName) continue;

        if (isProfessional(p) && p.providerCode) {
          const key = buildDoctorKey(p);
          if (!doctoresIndex[key]) {
            doctoresIndex[key] = {
              collegiateCode: p.professional?.collegiateCode || null,
              name: p.providerName,
              locations: [],
            };
          }
          const loc = {
            providerCode: p.providerCode,
            providerLocalicationCode: p.providerLocalicationCode,
            specSlug,
            provinceSlug: provSlug,
          };
          const exists = doctoresIndex[key].locations
            .some((l) => l.providerCode === loc.providerCode
              && l.providerLocalicationCode === loc.providerLocalicationCode
              && l.specSlug === loc.specSlug);
          if (!exists) doctoresIndex[key].locations.push(loc);
        } else {
          const key = buildCentroKey(p);
          if (!centrosIndex[key]) {
            centrosIndex[key] = {
              providerLocalicationCode: p.providerLocalicationCode,
              name: p.providerName,
              provinceSlug: provSlug,
            };
          }
        }
      }
    }

    console.log(`  [${provSlug}] ${provSpecMap.get(provSlug)?.size ?? 0} especialidades con datos`);
  }

  // Escribir data/cuadro-medico/provincias/{slug}.json
  const provinciasDir = join(__dirname, 'data/cuadro-medico/provincias');
  ensureDir(provinciasDir);

  let writtenProvincias = 0;
  for (const [provSlug, specSlugs] of provSpecMap) {
    const provincia = provinciaBySlug.get(provSlug);
    if (!provincia) continue;

    const especialidades = [...specSlugs].sort().filter((s) => especialidadBySlug.has(s));

    const out = {
      slug: provSlug,
      displayName: provincia.displayName,
      provinceCode: provincia.provinceCode,
      especialidades,
    };

    writeFileSync(join(provinciasDir, `${provSlug}.json`), JSON.stringify(out, null, 2), 'utf8');
    writtenProvincias += 1;
  }

  // Escribir data/cuadro-medico/especialidades/{slug}.json
  const especDir = join(__dirname, 'data/cuadro-medico/especialidades');
  ensureDir(especDir);

  let writtenEspec = 0;
  for (const [specSlug, provCounts] of specProvMap) {
    const provincias = [...provCounts.entries()]
      .map(([slug, count]) => {
        const prov = provinciaBySlug.get(slug);
        return prov ? { slug, displayName: prov.displayName, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);

    const out = {
      slug: specSlug,
      provincias,
    };

    writeFileSync(join(especDir, `${specSlug}.json`), JSON.stringify(out, null, 2), 'utf8');
    writtenEspec += 1;
  }

  // Escribir doctores-index.json y centros-index.json
  const cmDir = join(__dirname, 'data/cuadro-medico');
  writeFileSync(join(cmDir, 'doctores-index.json'), JSON.stringify(doctoresIndex, null, 2), 'utf8');
  writeFileSync(join(cmDir, 'centros-index.json'), JSON.stringify(centrosIndex, null, 2), 'utf8');

  console.log('\n--- Generados ---');
  console.log(`  Archivos providers leídos:            ${totalFiles}`);
  console.log(`  Providers procesados:                 ${totalProviders}`);
  console.log(`  provincias/{slug}.json:               ${writtenProvincias}`);
  console.log(`  especialidades/{slug}.json:           ${writtenEspec}`);
  console.log(`  doctores-index.json:                  ${Object.keys(doctoresIndex).length} doctores`);
  console.log(`  centros-index.json:                   ${Object.keys(centrosIndex).length} centros`);
}

main();
