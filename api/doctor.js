import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

let indexCache = null;
let providerCodeToLocsCache = null;

function getIndex() {
  if (!indexCache) {
    indexCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/doctores-index.json'), 'utf8'));
  }
  return indexCache;
}

// Builds a map providerCode → [{providerLocalicationCode, parentDescription, address, ...}]
// by scanning the providers/<prov>/<spec>.json files. Used to find OTHER locations
// for the same doctor (when a providerCode appears with multiple providerLocalicationCode).
function getProviderLocations(providerCode) {
  if (!providerCodeToLocsCache) {
    providerCodeToLocsCache = new Map();
    const providersDir = join(process.cwd(), 'data/providers');
    if (existsSync(providersDir)) {
      readdirSync(providersDir).forEach((prov) => {
        const provDir = join(providersDir, prov);
        try {
          readdirSync(provDir).filter((f) => f.endsWith('.json')).forEach((file) => {
            try {
              const arr = JSON.parse(readFileSync(join(provDir, file), 'utf8'));
              arr.forEach((p) => {
                const pc = p.providerCode;
                if (!pc) return;
                if (!providerCodeToLocsCache.has(pc)) providerCodeToLocsCache.set(pc, new Map());
                const byLoc = providerCodeToLocsCache.get(pc);
                const loc = p.providerLocalicationCode;
                if (!byLoc.has(loc)) byLoc.set(loc, { entry: p, prov, spec: file.replace('.json', '') });
              });
            } catch { /* skip malformed */ }
          });
        } catch { /* skip non-directory */ }
      });
    }
  }
  return providerCodeToLocsCache.get(providerCode) || new Map();
}

function mapLocationSummary(p) {
  const addr = p.address || {};
  return {
    providerLocalicationCode: p.providerLocalicationCode || null,
    providerType: p.providerType ?? null,
    doctorType: p.doctorType ?? null,
    businessGroup: !!p.businessGroup,
    parentDescription: p.parentDescription || '',
    name: p.providerName || '',
    speciality: p.specialityInfo?.specialityDescription || '',
    address: [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim(),
    postalCode: addr.postalCode || '',
    city: addr.cityDescription || '',
    phone: p.contact?.phone || '',
    lat: addr.latitude || 0,
    lon: addr.longitude || 0,
    onlineAppointment: !!(p.onlineAppointment || p.tuotempo?.onlineAppointment),
    videoConsultation: !!p.videoConsultation,
    ePrescription: !!p.electronicPrescription,
    languages: (p.languages || []).map((l) => l.languageDescription).filter(Boolean),
  };
}

// Lee el archivo de listado y busca la entrada por providerCode para obtener
// los campos que el endpoint de detalle no devuelve (lat/lon, colegiado, idiomas)
function findInProvidersList(provinceSlug, specSlug, providerCode) {
  const listPath = join(process.cwd(), `data/providers/${provinceSlug}/${specSlug}.json`);
  if (!existsSync(listPath)) return null;
  const list = JSON.parse(readFileSync(listPath, 'utf8'));
  return list.find((p) => p.providerCode === providerCode) || null;
}

function mapDetail(detailEntries, listEntry) {
  if (!detailEntries?.length) return null;
  const base = detailEntries[0];
  const addr = base.address || {};
  const tuotempo = base.tuotempo || {};

  // Coordenadas: vienen del endpoint de listado, no del de detalle
  const lat = listEntry?.address?.latitude || 0;
  const lon = listEntry?.address?.longitude || 0;

  // Colegiado: disponible en ambas fuentes
  const collegiateCode = listEntry?.professional?.collegiateCode
    || base.professional?.collegiateCode
    || base.collegiateCode
    || '';

  // Idiomas: el listado suele tenerlos más completos
  const langSources = listEntry?.languages?.length ? listEntry.languages : detailEntries[0].languages || [];
  const languages = [...new Set(
    langSources.map((l) => l.languageDescription).filter(Boolean),
  )];

  const specialities = [...new Set(
    detailEntries.map((e) => e.specialityInfo?.specialityDescription).filter(Boolean),
  )].sort();

  return {
    providerLocalicationCode: base.providerLocalicationCode,
    providerCode: base.providerCode || null,
    name: base.providerName || '',
    providerType: base.providerType ?? null,
    doctorType: base.doctorType ?? null,
    businessGroup: !!base.businessGroup,
    parentDescription: listEntry?.parentDescription || '',
    specialities,
    address: [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim(),
    postalCode: addr.postalCode || '',
    city: addr.cityDescription || '',
    provinceCode: addr.provinceCode || '',
    phone: base.contact?.phone || '',
    lat,
    lon,
    onlineAppointment: !!(base.onlineAppointment || tuotempo.onlineAppointment),
    videoConsultation: !!base.videoConsultation,
    ePrescription: !!base.electronicPrescription,
    tuotempo: {
      presential: !!tuotempo.presentialAppointment,
      online: !!tuotempo.onlineAppointment,
      video: !!tuotempo.videoAppointment,
      phone: !!tuotempo.phoneAppointment,
      asisaLive: !!tuotempo.asisaLiveAppointment,
    },
    languages,
    collegiateCode,
  };
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const entry = getIndex()[key];
  if (!entry) return res.status(404).json({ error: `Doctor not found: ${key}` });

  const {
    providerLocalicationCode, providerCode, specSlug, provinceSlug,
  } = entry;

  const detailPath = join(process.cwd(), `data/provider-details/${providerLocalicationCode}.json`);
  if (!existsSync(detailPath)) return res.status(404).json({ error: `No detail data for: ${key}` });

  try {
    const detailEntries = JSON.parse(readFileSync(detailPath, 'utf8'));
    const listEntry = findInProvidersList(provinceSlug, specSlug, providerCode);
    const detail = mapDetail(detailEntries, listEntry);
    if (!detail) return res.status(404).json({ error: `Empty detail for: ${key}` });

    // OTHER locations: same providerCode but different providerLocalicationCode.
    // Empty in current data; populates automatically when data is enriched.
    const allLocs = getProviderLocations(providerCode);
    const otherLocations = [...allLocs.values()]
      .filter(({ entry }) => entry.providerLocalicationCode !== providerLocalicationCode)
      .map(({ entry }) => mapLocationSummary(entry));

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      ...detail, specSlug, provinceSlug, key, otherLocations,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
