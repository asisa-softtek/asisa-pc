import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let indexCache = null;
const providersListCache = new Map();
const ASISA_HOST = 'https://www.asisa.es';

const SEO_TO_MEDICAL_SPECIALTY = {
  alergologia: 'RespiratoryTherapy',
  'analisis-de-sangre': 'LaboratoryScience',
  'cirugia-vascular': 'Cardiovascular',
  gastroenterologia: 'Gastroenterologic',
  cardiologos: 'Cardiovascular',
  'cirugia-maxilofacial': 'Surgical',
  'cirugia-plastica': 'PlasticSurgery',
  'cirujanos-toracicos': 'Surgical',
  dermatologos: 'Dermatology',
  endocrinos: 'Endocrine',
  fisioterapia: 'Physiotherapy',
  geriatria: 'Geriatric',
  obstetricia: 'Obstetric',
  hematologia: 'Hematologic',
  logopedas: 'SpeechPathology',
  rehabilitacion: 'Physiotherapy',
  'medicos-de-cabecera': 'PrimaryCare',
  'medicina-interna': 'PrimaryCare',
  'medicina-nuclear': 'Radiography',
  nefrologia: 'Renal',
  neumologia: 'Pulmonary',
  neurocirujanos: 'Neurologic',
  neurologos: 'Neurologic',
  oftalmologos: 'Optometric',
  oncologia: 'Oncologic',
  'oncologia-radioterapica': 'Oncologic',
  electromiograma: 'Neurologic',
  otorrinolaringologos: 'Otolaryngologic',
  pediatras: 'Pediatric',
  podologia: 'Podiatric',
  psicologia: 'Psychiatric',
  psiquiatra: 'Psychiatric',
  'reproduccion-asistida': 'Gynecologic',
  reumatologia: 'Rheumatologic',
  traumatologos: 'Musculoskeletal',
  urologos: 'Urologic',
  'gastroenterologos-infantiles': 'Pediatric',
  'cardiologia-pediatrica': 'Pediatric',
  'cirugia-de-mohs': 'Dermatology',
  proctologo: 'Surgical',
  'dermatologos-infantiles': 'Pediatric',
  dermatoscopia: 'Dermatology',
  ecografia: 'Radiography',
  'endocrino-pediatrico': 'Pediatric',
  endoscopia: 'Gastroenterologic',
  mamografia: 'Radiography',
  'neurologo-infantil': 'Pediatric',
  'oftalmologia-infantil': 'Pediatric',
  ortopantomografia: 'Radiography',
  'pet-tac': 'Radiography',
  'preparacion-al-parto': 'Midwifery',
  'resonancia-magnetica': 'Radiography',
  'traumatologo-infantil': 'Pediatric',
  endodoncia: 'Dentistry',
  'estetica-dental': 'Dentistry',
  'implantes-dentales': 'Dentistry',
  dentistas: 'Dentistry',
  odontopediatra: 'Dentistry',
};

const LANGUAGE_CODE_MAP = {
  espanol: 'es',
  castellano: 'es',
  ingles: 'en',
  frances: 'fr',
  aleman: 'de',
  italiano: 'it',
  portugues: 'pt',
  catalan: 'ca',
  euskera: 'eu',
  gallego: 'gl',
};

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
  const fields = [
    'addressType',
    'addressDescription',
    'addressNumber',
    'postalCode',
    'provinceCode',
    'cityDescription',
    'latitude',
    'longitude',
  ];
  const isMeaningful = (v) => v !== undefined && v !== null && v !== '' && v !== 0;
  return fields.reduce((acc, field) => {
    const detailValue = detailAddr?.[field];
    const listValue = listAddr?.[field];
    if (isMeaningful(detailValue)) {
      acc[field] = detailValue;
    } else if (isMeaningful(listValue)) {
      acc[field] = listValue;
    } else {
      acc[field] = detailValue ?? '';
    }
    return acc;
  }, {});
}

function toSlug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token) || token === '-') return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join('');
}

function formatDoctorSchemaName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `${titleCase(parts[0])}, ${titleCase(parts[1])}`;
  }
  return titleCase(raw);
}

function toMedicalSpecialty(specSlug, speciality) {
  const value = SEO_TO_MEDICAL_SPECIALTY[toSlug(specSlug)]
    || SEO_TO_MEDICAL_SPECIALTY[toSlug(speciality)];
  return value ? `https://schema.org/${value}` : null;
}

function mapLanguageToCode(language) {
  const key = toSlug(language);
  return LANGUAGE_CODE_MAP[key] || key || null;
}

function formatAddressRegion(provinceSlug, provinceCode) {
  if (provinceSlug) return titleCase(String(provinceSlug).replace(/-/g, ' '));
  return provinceCode || '';
}

function buildDoctorSchema(data) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    '@id': `${ASISA_HOST}/cuadro-medico/d/${data.key}`,
    name: formatDoctorSchemaName(data.name),
  };

  if (data.collegiateCode) {
    schema.identifier = {
      '@type': 'PropertyValue',
      name: 'collegiateCode',
      value: String(data.collegiateCode),
    };
  }

  const medicalSpecialty = toMedicalSpecialty(data.specSlug, data.specialities?.[0]);
  if (medicalSpecialty) schema.medicalSpecialty = medicalSpecialty;

  if (data.parentDescription) {
    schema.hospitalAffiliation = {
      '@type': 'Hospital',
      name: titleCase(data.parentDescription),
    };
  }

  if (data.phone) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      telephone: data.phone,
      contactType: 'Consultas médicas',
    };
  }

  if (data.address || data.postalCode || data.city || data.provinceSlug || data.provinceCode) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: data.address || '',
      postalCode: data.postalCode || '',
      addressLocality: data.city || '',
      addressRegion: formatAddressRegion(data.provinceSlug, data.provinceCode),
      addressCountry: 'ES',
    };
  }

  if (data.lat && data.lon) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: data.lat,
      longitude: data.lon,
    };
  }

  const knowsLanguage = [...new Set((data.languages || [])
    .map(mapLanguageToCode)
    .filter(Boolean))];
  if (knowsLanguage.length) schema.knowsLanguage = knowsLanguage;

  schema.additionalProperty = [
    {
      '@type': 'PropertyValue',
      name: 'electronicPrescription',
      value: !!data.ePrescription,
    },
    {
      '@type': 'PropertyValue',
      name: 'appointmentRequired',
      value: !!(data.onlineAppointment || data.phone),
    },
    {
      '@type': 'PropertyValue',
      name: 'onlineAppointment',
      value: !!data.onlineAppointment,
    },
    {
      '@type': 'PropertyValue',
      name: 'videoConsultation',
      value: !!data.videoConsultation,
    },
  ];

  return schema;
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
    onlineAppointment: !!(
      detailBase?.onlineAppointment
      || listEntry?.onlineAppointment
      || tuotempo.onlineAppointment
    ),
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
  return locations.find((location) => location.hasDetail) || locations[0];
}

export function fetchDoctor(rawKey) {
  if (!rawKey) return { error: 'key is required', status: 400 };
  const index = getIndex();
  let key = rawKey;
  let entry = index[key];
  // Fallback por slug: si el id numérico cambió tras regenerar el índice (URLs
  // antiguas con providerCode vs nuevas con collegiateCode), buscamos por el
  // prefijo del slug del nombre.
  if (!entry) {
    const slug = key.replace(/-\d+$/, '');
    const match = Object.keys(index).find((k) => k.replace(/-\d+$/, '') === slug);
    if (match) {
      key = match;
      entry = index[match];
    }
  }
  if (!entry) return { error: `Doctor not found: ${rawKey}`, status: 404 };

  const locations = [];
  let collegiateCode = entry.collegiateCode || '';
  let languages = [];

  entry.locations.forEach((loc) => {
    const detailPath = join(
      process.cwd(),
      `data/provider-details/${loc.providerLocalicationCode}.json`,
    );
    const detailEntries = existsSync(detailPath) ? readJson(detailPath) : null;
    const detailBase = Array.isArray(detailEntries)
      && detailEntries.length ? detailEntries[0] : null;
    const listEntry = findInProvidersList(
      loc.provinceSlug,
      loc.specSlug,
      loc.providerCode,
      loc.providerLocalicationCode,
    );

    const built = buildLocation(loc, listEntry, detailBase);
    built.hasDetail = !!detailBase;
    locations.push(built);

    if (!collegiateCode) {
      collegiateCode = listEntry?.professional?.collegiateCode
        || detailBase?.collegiateCode
        || '';
    }
    if (!languages.length) {
      const src = listEntry?.languages?.length
        ? listEntry.languages
        : (detailBase?.languages || []);
      languages = [...new Set(src.map((l) => l.languageDescription).filter(Boolean))];
    }
  });

  if (!locations.length) return { error: `No locations for: ${key}`, status: 404 };

  const rep = pickRepresentative(locations);
  const specialities = [...new Set(locations.map((l) => l.speciality).filter(Boolean))].sort();

  locations.forEach((location) => { delete location.hasDetail; });

  const response = {
    key,
    name: entry.name,
    collegiateCode,
    languages,
    specialities,
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
  };

  response.schema = buildDoctorSchema(response);
  return response;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const data = fetchDoctor(req.query?.key);
    if (data.error) return res.status(data.status).json({ error: data.error });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
