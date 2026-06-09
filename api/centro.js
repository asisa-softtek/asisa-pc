import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

let centrosIndexCache = null;
let doctoresIndexCache = null;
const provinceScanCache = new Map();
const ASISA_HOST = 'https://www.asisa.es';

function getCentrosIndex() {
  if (!centrosIndexCache) {
    centrosIndexCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/centros-index.json'), 'utf8'));
  }
  return centrosIndexCache;
}

function getDoctoresIndex() {
  if (!doctoresIndexCache) {
    doctoresIndexCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/doctores-index.json'), 'utf8'));
  }
  return doctoresIndexCache;
}

function toSlug(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildAddress(addr = {}) {
  return [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim();
}

/**
 * Scans data/providers/{provinceSlug}/*.json once and returns:
 *  - centros: Map<locCode, { entry, specialities:Map<spec,{
 *      specSlug, subSpecialities:Set, doctors:[], onlineAppointment,
 *      videoConsultation, ePrescription, phone
 *    }> }>
 *  - doctorsByParent: Map<parentLocCode, [{ name, key, specSlug, speciality, subSpeciality }]>
 */
function scanProvince(provinceSlug) {
  if (provinceScanCache.has(provinceSlug)) return provinceScanCache.get(provinceSlug);

  const provDir = join(process.cwd(), `data/providers/${provinceSlug}`);
  const centros = new Map();
  const doctorsByParent = new Map();

  if (!existsSync(provDir)) {
    const empty = { centros, doctorsByParent };
    provinceScanCache.set(provinceSlug, empty);
    return empty;
  }

  const files = readdirSync(provDir).filter((f) => f.endsWith('.json'));
  files.forEach((file) => {
    const specSlug = file.replace(/\.json$/, '');
    let arr;
    try {
      arr = JSON.parse(readFileSync(join(provDir, file), 'utf8'));
    } catch {
      return;
    }
    if (!Array.isArray(arr)) return;

    arr.forEach((p) => {
      const isProfessional = String(p.providerType) === '1';
      const spec = p.specialityInfo?.specialityDescription || '';
      const subSpec = p.specialityInfo?.subSpecialityDescription || '';

      if (!isProfessional) {
        // Centro entry
        const loc = p.providerLocalicationCode;
        if (!loc) return;
        if (!centros.has(loc)) {
          centros.set(loc, { entry: p, specialities: new Map() });
        }
        const c = centros.get(loc);
        if (spec && !c.specialities.has(spec)) {
          c.specialities.set(spec, {
            specSlug,
            subSpecialities: new Set(),
            onlineAppointment: !!p.onlineAppointment,
            videoConsultation: !!p.videoConsultation,
            ePrescription: !!p.electronicPrescription,
            phone: p.contact?.phone || '',
            mobilePhone: p.contact?.mobilePhone || '',
            doctors: [],
          });
        } else if (spec) {
          const meta = c.specialities.get(spec);
          meta.onlineAppointment = meta.onlineAppointment || !!p.onlineAppointment;
          meta.videoConsultation = meta.videoConsultation || !!p.videoConsultation;
          meta.ePrescription = meta.ePrescription || !!p.electronicPrescription;
        }
        if (subSpec && spec) c.specialities.get(spec).subSpecialities.add(subSpec);
      } else if (p.parentCode && p.providerCode) {
        // Doctor with a centro parent
        const coll = p.professional?.collegiateCode;
        const id = coll && coll !== 0 ? coll : p.providerCode;
        const docKey = `${toSlug(p.providerName)}-${id}`;
        const doc = {
          name: p.providerName || '',
          key: docKey,
          specSlug,
          speciality: spec,
          subSpeciality: subSpec,
          gender: p.professional?.gender || '',
        };
        if (!doctorsByParent.has(p.parentCode)) doctorsByParent.set(p.parentCode, []);
        doctorsByParent.get(p.parentCode).push(doc);
      }
    });
  });

  // Attach doctors to their centro/speciality
  Array.from(centros.entries()).forEach(([loc, c]) => {
    const docs = doctorsByParent.get(loc) || [];
    const seenInSpec = new Map(); // spec → Set<docKey>
    docs.forEach((d) => {
      if (!d.speciality || !c.specialities.has(d.speciality)) return;
      const set = seenInSpec.get(d.speciality) || new Set();
      if (set.has(d.key)) return;
      set.add(d.key);
      seenInSpec.set(d.speciality, set);
      c.specialities.get(d.speciality).doctors.push(d);
      if (d.subSpeciality) c.specialities.get(d.speciality).subSpecialities.add(d.subSpeciality);
    });
  });

  const result = { centros, doctorsByParent };
  provinceScanCache.set(provinceSlug, result);
  return result;
}

function buildOtherCentros(provinceData, currentLocCode, currentSpecs, limit = 4) {
  const overlaps = Array.from(provinceData.centros.entries())
    .map(([loc, c]) => {
      if (loc === currentLocCode || c.specialities.size === 0) return null;
      const overlap = Array.from(c.specialities.keys())
        .reduce((acc, spec) => acc + (currentSpecs.has(spec) ? 1 : 0), 0);
      return overlap > 0 ? { loc, c, overlap } : null;
    })
    .filter(Boolean);

  overlaps.sort(
    (a, b) => b.overlap - a.overlap
      || a.c.entry.providerName.localeCompare(b.c.entry.providerName),
  );

  return overlaps.slice(0, limit).map(({ loc, c }) => {
    const e = c.entry;
    const addr = e.address || {};
    const allSpecs = [...c.specialities.keys()];
    const visible = allSpecs.slice(0, 4);
    return {
      key: toSlug(e.providerName),
      providerLocalicationCode: loc,
      name: e.providerName,
      providerType: e.providerType,
      businessGroup: !!e.businessGroup,
      address: buildAddress(addr),
      postalCode: addr.postalCode || '',
      city: addr.cityDescription || '',
      provinceCode: addr.provinceCode || '',
      phone: e.contact?.phone || '',
      lat: addr.latitude || 0,
      lon: addr.longitude || 0,
      specialities: visible,
      specialitiesMore: allSpecs.length - visible.length,
    };
  });
}

function buildDescription(specCount, city, provDisplayName) {
  const place = city ? `${city}` : provDisplayName;
  const where = place ? ` en ${place}` : '';
  const n = specCount || 0;
  return `Centro médico del cuadro de ASISA${where}. Atiende en ${n} especialidad${n === 1 ? '' : 'es'} con acceso directo a especialistas sin necesidad de derivación. Solicita cita online o llama al centro.`;
}

function toSchemaSpecialty(specName) {
  const normalized = toSlug(specName);
  if (normalized.includes('anest')) return 'https://schema.org/Anesthesia';
  if (normalized.includes('cardio')) return 'https://schema.org/Cardiovascular';
  if (normalized.includes('dermat')) return 'https://schema.org/Dermatologic';
  if (normalized.includes('endo')) return 'https://schema.org/Endocrine';
  if (normalized.includes('gine') || normalized.includes('obstet')) return 'https://schema.org/Gynecologic';
  if (normalized.includes('neuro')) return 'https://schema.org/Neurologic';
  if (normalized.includes('onco')) return 'https://schema.org/Oncologic';
  if (normalized.includes('pedia')) return 'https://schema.org/Pediatric';
  if (normalized.includes('psiqu')) return 'https://schema.org/Psychiatric';
  if (normalized.includes('radio')) return 'https://schema.org/Radiography';
  if (normalized.includes('urolog')) return 'https://schema.org/Urologic';
  return null;
}

function buildCentroSchema(detail) {
  const specialtyUrls = [...new Set((detail.specialities || [])
    .map((s) => toSchemaSpecialty(s.speciality))
    .filter(Boolean))];

  const seenPhones = new Set();
  const contactPoint = [];

  if (detail.phone) {
    seenPhones.add(detail.phone);
    contactPoint.push({
      '@type': 'ContactPoint',
      telephone: detail.phone,
      contactType: 'Atencion del centro',
    });
  }

  (detail.specialities || []).forEach((s) => {
    if (!s.phone || seenPhones.has(s.phone)) return;
    seenPhones.add(s.phone);
    contactPoint.push({
      '@type': 'ContactPoint',
      telephone: s.phone,
      contactType: s.speciality,
    });
  });

  const employee = (detail.doctors || []).slice(0, 100).map((d) => ({
    '@type': 'Person',
    name: d.name,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': String(detail.providerType) === '3' ? 'Hospital' : 'MedicalClinic',
    '@id': `${ASISA_HOST}/cuadro-medico/c/${detail.key}`,
    name: detail.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: detail.address,
      addressLocality: detail.city,
      addressRegion: detail.provinceSlug,
      postalCode: detail.postalCode,
      addressCountry: 'ES',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: detail.lat,
      longitude: detail.lon,
    },
    medicalSpecialty: specialtyUrls,
    contactPoint,
    employee,
  };
}

export function fetchCentro(rawKey) {
  if (!rawKey) return { error: 'key is required', status: 400 };
  const idx = getCentrosIndex();
  let key = rawKey;
  let indexEntry = idx[key];
  // Fallback por slug: tolera URLs obsoletas cuyo slug del nombre coincide
  // con un centro presente pero con un sufijo distinto (raro, pero ocurre
  // cuando el centro cambia de localización canónica).
  if (!indexEntry) {
    const match = Object.keys(idx).find((k) => k === rawKey || k.startsWith(`${rawKey}-`));
    if (match) {
      key = match;
      indexEntry = idx[match];
    }
  }
  if (!indexEntry) return { error: `Centro not found: ${rawKey}`, status: 404 };

  const { providerLocalicationCode, name, provinceSlug } = indexEntry;
  try {
    const provinceData = scanProvince(provinceSlug);
    const centroData = provinceData.centros.get(providerLocalicationCode);
    if (!centroData) return { error: `Centro has no data: ${key}`, status: 404 };

    const { entry } = centroData;
    const addr = entry.address || {};
    const docIndex = getDoctoresIndex();

    const specsArray = [];
    Array.from(centroData.specialities.entries()).forEach(([specName, meta]) => {
      const docs = meta.doctors
        .filter((d) => docIndex[d.key]) // only doctors with published page
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ key: d.key, name: d.name, subSpeciality: d.subSpeciality || '' }));

      specsArray.push({
        speciality: specName,
        specSlug: meta.specSlug,
        phone: meta.phone || meta.mobilePhone || entry.contact?.phone || entry.contact?.mobilePhone || '',
        onlineAppointment: !!meta.onlineAppointment,
        videoConsultation: !!meta.videoConsultation,
        ePrescription: !!meta.ePrescription,
        subSpecialities: [...meta.subSpecialities].sort(),
        doctors: docs,
        observations: '',
      });
    });
    specsArray.sort((a, b) => a.speciality.localeCompare(b.speciality));

    const seenDocs = new Set();
    const flatDoctors = Array.from(centroData.specialities.values())
      .flatMap((meta) => meta.doctors)
      .filter((d) => {
        if (!docIndex[d.key] || seenDocs.has(d.key)) return false;
        seenDocs.add(d.key);
        return true;
      })
      .map((d) => ({
        key: d.key,
        name: d.name,
        speciality: d.speciality,
        gender: d.gender || '',
      }));
    flatDoctors.sort((a, b) => a.name.localeCompare(b.name));

    const currentSpecsSet = new Set([...centroData.specialities.keys()]);
    const otherCentros = buildOtherCentros(provinceData, providerLocalicationCode, currentSpecsSet);

    const detail = {
      key,
      providerLocalicationCode,
      name: entry.providerName || name,
      providerType: entry.providerType ?? null,
      businessGroup: !!entry.businessGroup,
      address: buildAddress(addr),
      postalCode: addr.postalCode || '',
      city: addr.cityDescription || '',
      provinceCode: addr.provinceCode || '',
      provinceSlug,
      phone: entry.contact?.phone || entry.contact?.mobilePhone || '',
      lat: addr.latitude || 0,
      lon: addr.longitude || 0,
      onlineAppointment: !!entry.onlineAppointment,
      videoConsultation: !!entry.videoConsultation,
      ePrescription: !!entry.electronicPrescription,
      specialities: specsArray,
      doctors: flatDoctors,
      otherCentros,
      description: buildDescription(specsArray.length, addr.cityDescription, provinceSlug),
    };

    detail.schema = buildCentroSchema(detail);

    return detail;
  } catch (err) {
    return { error: err.message, status: 500 };
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const data = fetchCentro(req.query?.key);
  if (data && data.error) return res.status(data.status).json({ error: data.error });

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(data);
}
