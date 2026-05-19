import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let indexCache = null;
const providersListCache = new Map();

function getIndex() {
  if (!indexCache) {
    indexCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/doctores-index.json'), 'utf8'));
  }
  return indexCache;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function findInProvidersList(provinceSlug, specSlug, providerCode, providerLocalicationCode) {
  const cacheKey = `${provinceSlug}|${specSlug}`;
  if (!providersListCache.has(cacheKey)) {
    const listPath = join(process.cwd(), `data/providers/${provinceSlug}/${specSlug}.json`);
    providersListCache.set(cacheKey, existsSync(listPath) ? readJson(listPath) || [] : []);
  }
  const list = providersListCache.get(cacheKey);
  return list.find((p) => p.providerCode === providerCode
    && p.providerLocalicationCode === providerLocalicationCode) || null;
}

function mergeAddress(detailAddr, listAddr) {
  const out = {};
  const fields = ['addressType', 'addressDescription', 'addressNumber', 'postalCode', 'provinceCode', 'cityDescription', 'latitude', 'longitude'];
  const isMeaningful = (v) => v !== undefined && v !== null && v !== '' && v !== 0;
  for (const f of fields) {
    const d = detailAddr?.[f];
    const l = listAddr?.[f];
    out[f] = isMeaningful(d) ? d : (isMeaningful(l) ? l : (d ?? ''));
  }
  return out;
}

function buildLocation(loc, listEntry, detailBase) {
  const addr = mergeAddress(detailBase?.address, listEntry?.address);
  const tuotempo = detailBase?.tuotempo || listEntry?.tuotempo || {};
  const speciality = detailBase?.specialityInfo?.specialityDescription
    || listEntry?.specialityInfo?.specialityDescription
    || '';

  return {
    providerCode: loc.providerCode,
    providerLocalicationCode: loc.providerLocalicationCode,
    specSlug: loc.specSlug,
    provinceSlug: loc.provinceSlug,
    speciality,
    parentDescription: listEntry?.parentDescription || '',
    businessGroup: !!(listEntry?.businessGroup),
    address: [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim(),
    postalCode: addr.postalCode || '',
    city: addr.cityDescription || '',
    provinceCode: addr.provinceCode || '',
    phone: detailBase?.contact?.phone || listEntry?.contact?.phone || '',
    lat: addr.latitude || 0,
    lon: addr.longitude || 0,
    onlineAppointment: !!(detailBase?.onlineAppointment || listEntry?.onlineAppointment || tuotempo.onlineAppointment),
    videoConsultation: !!(detailBase?.videoConsultation || listEntry?.videoConsultation),
    ePrescription: !!(detailBase?.electronicPrescription || listEntry?.electronicPrescription),
    tuotempo: {
      presential: !!tuotempo.presentialAppointment,
      online: !!tuotempo.onlineAppointment,
      video: !!tuotempo.videoAppointment,
      phone: !!tuotempo.phoneAppointment,
      asisaLive: !!tuotempo.asisaLiveAppointment,
    },
  };
}

function pickRepresentative(locations) {
  // Prefer a location whose detail file exists & has data; otherwise first.
  for (const l of locations) {
    if (l._hasDetail) return l;
  }
  return locations[0];
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const entry = getIndex()[key];
  if (!entry) return res.status(404).json({ error: `Doctor not found: ${key}` });

  try {
    const locations = [];
    let collegiateCode = entry.collegiateCode || '';
    let languages = [];

    for (const loc of entry.locations) {
      const detailPath = join(process.cwd(), `data/provider-details/${loc.providerLocalicationCode}.json`);
      const detailEntries = existsSync(detailPath) ? readJson(detailPath) : null;
      const detailBase = Array.isArray(detailEntries) && detailEntries.length ? detailEntries[0] : null;
      const listEntry = findInProvidersList(loc.provinceSlug, loc.specSlug, loc.providerCode, loc.providerLocalicationCode);

      const built = buildLocation(loc, listEntry, detailBase);
      built._hasDetail = !!detailBase;
      locations.push(built);

      if (!collegiateCode) {
        collegiateCode = listEntry?.professional?.collegiateCode
          || detailBase?.collegiateCode
          || '';
      }
      if (!languages.length) {
        const src = listEntry?.languages?.length ? listEntry.languages : (detailBase?.languages || []);
        languages = [...new Set(src.map((l) => l.languageDescription).filter(Boolean))];
      }
    }

    if (!locations.length) return res.status(404).json({ error: `No locations for: ${key}` });

    const rep = pickRepresentative(locations);
    const specialities = [...new Set(locations.map((l) => l.speciality).filter(Boolean))].sort();

    // Strip internal flag
    locations.forEach((l) => { delete l._hasDetail; });

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      key,
      name: entry.name,
      collegiateCode,
      languages,
      specialities,
      // Representative fields kept at top-level for backwards compat with otros-medicos / spec-localizacion blocks
      specSlug: rep.specSlug,
      provinceSlug: rep.provinceSlug,
      parentDescription: rep.parentDescription,
      address: rep.address,
      postalCode: rep.postalCode,
      city: rep.city,
      provinceCode: rep.provinceCode,
      phone: rep.phone,
      lat: rep.lat,
      lon: rep.lon,
      onlineAppointment: rep.onlineAppointment,
      videoConsultation: rep.videoConsultation,
      ePrescription: rep.ePrescription,
      businessGroup: rep.businessGroup,
      tuotempo: rep.tuotempo,
      locations,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
