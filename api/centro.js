import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

let centrosIndexCache = null;
let doctoresIndexCache = null;
const provinceScanCache = new Map();

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
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function buildAddress(addr = {}) {
  return [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim();
}

/**
 * Scans data/providers/{provinceSlug}/*.json once and returns:
 *  - centros: Map<locCode, { entry, specialities:Map<spec,{ specSlug, subSpecialities:Set, doctors:[], onlineAppointment, videoConsultation, ePrescription, phone }> }>
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
  for (const file of files) {
    const specSlug = file.replace(/\.json$/, '');
    let arr;
    try {
      arr = JSON.parse(readFileSync(join(provDir, file), 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;

    for (const p of arr) {
      const isProfessional = String(p.providerType) === '1';
      const spec = p.specialityInfo?.specialityDescription || '';
      const subSpec = p.specialityInfo?.subSpecialityDescription || '';

      if (!isProfessional) {
        // Centro entry
        const loc = p.providerLocalicationCode;
        if (!loc) continue;
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
        const docKey = `${toSlug(p.providerName)}-${p.providerCode}`;
        const doc = {
          name: p.providerName || '',
          key: docKey,
          specSlug,
          speciality: spec,
          subSpeciality: subSpec,
        };
        if (!doctorsByParent.has(p.parentCode)) doctorsByParent.set(p.parentCode, []);
        doctorsByParent.get(p.parentCode).push(doc);
      }
    }
  }

  // Attach doctors to their centro/speciality
  for (const [loc, c] of centros) {
    const docs = doctorsByParent.get(loc) || [];
    const seenInSpec = new Map(); // spec → Set<docKey>
    for (const d of docs) {
      if (!d.speciality || !c.specialities.has(d.speciality)) continue;
      const set = seenInSpec.get(d.speciality) || new Set();
      if (set.has(d.key)) continue;
      set.add(d.key);
      seenInSpec.set(d.speciality, set);
      c.specialities.get(d.speciality).doctors.push(d);
      if (d.subSpeciality) c.specialities.get(d.speciality).subSpecialities.add(d.subSpeciality);
    }
  }

  const result = { centros, doctorsByParent };
  provinceScanCache.set(provinceSlug, result);
  return result;
}

function buildOtherCentros(provinceData, currentLocCode, currentSpecs, limit = 4) {
  const overlaps = [];
  for (const [loc, c] of provinceData.centros) {
    if (loc === currentLocCode) continue;
    if (c.specialities.size === 0) continue;
    let overlap = 0;
    for (const spec of c.specialities.keys()) if (currentSpecs.has(spec)) overlap += 1;
    if (overlap === 0) continue;
    overlaps.push({ loc, c, overlap });
  }
  overlaps.sort((a, b) => b.overlap - a.overlap || a.c.entry.providerName.localeCompare(b.c.entry.providerName));

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

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const indexEntry = getCentrosIndex()[key];
  if (!indexEntry) return res.status(404).json({ error: `Centro not found: ${key}` });

  const { providerLocalicationCode, name, provinceSlug } = indexEntry;

  try {
    const provinceData = scanProvince(provinceSlug);
    const centroData = provinceData.centros.get(providerLocalicationCode);
    if (!centroData) return res.status(404).json({ error: `Centro has no data: ${key}` });

    const entry = centroData.entry;
    const addr = entry.address || {};
    const docIndex = getDoctoresIndex();

    const specsArray = [];
    for (const [specName, meta] of centroData.specialities) {
      const docs = meta.doctors
        .filter((d) => docIndex[d.key]) // only doctors with published page
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ key: d.key, name: d.name, subSpeciality: d.subSpeciality || '' }));

      specsArray.push({
        speciality: specName,
        specSlug: meta.specSlug,
        phone: meta.phone || entry.contact?.phone || '',
        onlineAppointment: !!meta.onlineAppointment,
        videoConsultation: !!meta.videoConsultation,
        ePrescription: !!meta.ePrescription,
        subSpecialities: [...meta.subSpecialities].sort(),
        doctors: docs,
        observations: '',
      });
    }
    specsArray.sort((a, b) => a.speciality.localeCompare(b.speciality));

    const flatDoctors = [];
    const seenDocs = new Set();
    for (const meta of centroData.specialities.values()) {
      for (const d of meta.doctors) {
        if (!docIndex[d.key] || seenDocs.has(d.key)) continue;
        seenDocs.add(d.key);
        flatDoctors.push({ key: d.key, name: d.name, speciality: d.speciality });
      }
    }
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
      phone: entry.contact?.phone || '',
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

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(detail);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
