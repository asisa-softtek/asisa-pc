/* eslint-disable no-restricted-syntax, no-console */
/**
 * Genera combos de especialidades por localidad:
 *  - data/valid-provincia-specs.json   (provincia/especialidad)
 *  - data/valid-municipio-specs.json   (municipio/especialidad)
 *  - data/valid-specialities.json      (especialidades únicas)
 *
 * Lee data/providers/ y data/valid-localidades.json generados por
 * generate-providers-data.mjs. No hace ninguna llamada a ASISA.
 *
 * Uso: node generate-specialities.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const providersDir = join(__dirname, 'data/providers');

  if (!existsSync(providersDir)) {
    console.error('ERROR: data/providers/ no existe. Ejecuta generate-providers-data.mjs primero.');
    process.exit(1);
  }

  const validLocPath = join(__dirname, 'data/valid-localidades.json');
  const validLocalidades = existsSync(validLocPath)
    ? JSON.parse(readFileSync(validLocPath, 'utf8'))
    : [];

  const provinciaSpecs = new Set();
  const allSpecs = new Set();

  // Leer especialidades disponibles por provincia desde los nombres de fichero en data/providers/
  for (const prov of provincias) {
    const provSlug = toSlug(prov.name);
    const provDir = join(providersDir, provSlug);
    if (!existsSync(provDir)) continue;

    const provSlugFull = `provincia-de-${provSlug}`;
    const files = readdirSync(provDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const specSlug = file.slice(0, -5); // quitar .json
      allSpecs.add(specSlug);
      provinciaSpecs.add(`${provSlugFull}/${specSlug}`);
    }

    console.log(`${prov.name}: ${files.length} especialidades`);
  }

  // Cruzar localidades con especialidades de su provincia
  const municipioSpecs = new Set();
  for (const loc of validLocalidades) {
    const prov = provincias.find((p) => p.provinceCode === loc.provinceCode);
    if (!prov) continue;
    const provSlugFull = `provincia-de-${toSlug(prov.name)}`;
    for (const combo of provinciaSpecs) {
      if (combo.startsWith(`${provSlugFull}/`)) {
        const specSlug = combo.slice(provSlugFull.length + 1);
        municipioSpecs.add(`${loc.slug}/${specSlug}`);
      }
    }
  }

  const provSpecList = [...provinciaSpecs].sort();
  const muniSpecList = [...municipioSpecs].sort();
  const specList = [...allSpecs].sort();

  writeFileSync(join(__dirname, 'data/valid-provincia-specs.json'), JSON.stringify(provSpecList, null, 2), 'utf8');
  writeFileSync(join(__dirname, 'data/valid-municipio-specs.json'), JSON.stringify(muniSpecList, null, 2), 'utf8');
  writeFileSync(join(__dirname, 'data/valid-specialities.json'), JSON.stringify(specList, null, 2), 'utf8');

  console.log('\nGenerados:');
  console.log(`  valid-provincia-specs.json: ${provSpecList.length} combos`);
  console.log(`  valid-municipio-specs.json: ${muniSpecList.length} combos`);
  console.log(`  valid-specialities.json:    ${specList.length} especialidades`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
