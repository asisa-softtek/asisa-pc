import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_TOTAL_BY_TAB = { professionals: 30, centers: 50 };

let provinciasCache = null;
let especialidadesCache = null;
const allProvinceCache = new Map(); // provSlug → deduped flat list

function getProvincias() {
  if (!provinciasCache) {
    provinciasCache = JSON.parse(readFileSync(join(process.cwd(), 'data/provincias.json'), 'utf8'));
  }
  return provinciasCache;
}

function getEspecialidades() {
  if (!especialidadesCache) {
    especialidadesCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/especialidades.json'), 'utf8'));
  }
  return especialidadesCache;
}

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function buildDetailUrl(p) {
  const nameSlug = toSlug(p.providerName || '');
  if (String(p.doctorType) === '1') {
    const coll = p.professional?.collegiateCode;
    const id = coll && coll !== 0 ? coll : (p.providerCode || p.providerLocalicationCode);
    return `/cuadro-medico/d/${nameSlug}-${id}`;
  }
  return `/cuadro-medico/c/${nameSlug}`;
}

function isProfessional(p) {
  return String(p.doctorType) === '1';
}

function isCenter(p) {
  return !isProfessional(p) && ['3', '4', '8', '2', '9'].includes(String(p.providerType));
}

function mapProvider(p) {
  const addr = p.address || {};
  const tuotempo = p.tuotempo || {};
  return {
    name: p.providerName || '',
    speciality: p.specialityInfo?.specialityDescription || '',
    providerType: p.providerType ?? null,
    doctorType: p.doctorType ?? null,
    businessGroup: !!p.businessGroup,
    parentDescription: p.parentDescription || '',
    address: [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim(),
    postalCode: addr.postalCode || '',
    city: addr.cityDescription || '',
    phone: p.contact?.phone || '',
    lat: addr.latitude || 0,
    lon: addr.longitude || 0,
    onlineAppointment: !!(p.onlineAppointment || tuotempo.onlineAppointment),
    videoConsultation: !!p.videoConsultation,
    ePrescription: !!p.electronicPrescription,
    languages: (p.languages || []).map((l) => l.languageDescription).filter(Boolean),
    collegiateCode: p.professional?.collegiateCode || p.collegiateCode || '',
    providerLocalicationCode: p.providerLocalicationCode || null,
    providerCode: p.providerCode || null,
    detailUrl: buildDetailUrl(p),
  };
}

function loadAllProvincePro(provinceSlug) {
  if (allProvinceCache.has(provinceSlug)) return allProvinceCache.get(provinceSlug);
  const dir = join(process.cwd(), `data/providers/${provinceSlug}`);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const seen = new Map();
  files.forEach((f) => {
    try {
      const arr = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      arr.forEach((p) => {
        const key = `${p.providerCode || ''}|${p.providerLocalicationCode || ''}`;
        if (!seen.has(key)) seen.set(key, p);
      });
    } catch {
      // skip malformed
    }
  });
  const list = [...seen.values()];
  allProvinceCache.set(provinceSlug, list);
  return list;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const {
    provinceSlug,
    specSlug,
    tab = 'professionals',
    page = '1',
    limit: limitParam,
  } = req.query;

  if (!provinceSlug) {
    return res.status(400).json({ error: 'provinceSlug is required' });
  }

  if (!['professionals', 'centers'].includes(tab)) {
    return res.status(400).json({ error: 'tab must be professionals or centers' });
  }

  // Resolve province
  const provincia = getProvincias().find((p) => p.slug === provinceSlug);
  if (!provincia) return res.status(404).json({ error: `Province not found: ${provinceSlug}` });

  // Resolve speciality (optional)
  if (specSlug) {
    const especialidad = getEspecialidades().find((e) => e.slug === specSlug);
    if (!especialidad) return res.status(404).json({ error: `Speciality not found: ${specSlug}` });
  }

  const limit = Math.min(parseInt(limitParam, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  try {
    let raw;
    if (specSlug) {
      const cachePath = join(process.cwd(), `data/providers/${provinceSlug}/${specSlug}.json`);
      if (!existsSync(cachePath)) {
        return res.status(404).json({ error: `No data for ${provinceSlug}/${specSlug}` });
      }
      raw = JSON.parse(readFileSync(cachePath, 'utf8'));
    } else {
      raw = loadAllProvincePro(provinceSlug);
      if (!raw) return res.status(404).json({ error: `No data for ${provinceSlug}` });
    }

    // Filter by tab, then cap the displayable list per business rule
    // (profesionales muestra hasta 30, centros hasta 50)
    const filteredAll = raw.filter((p) => (tab === 'professionals' ? isProfessional(p) : isCenter(p)));
    const cap = MAX_TOTAL_BY_TAB[tab];
    const filtered = filteredAll.slice(0, cap);

    // Counts per tab (capped, so the tab label refleja lo navegable)
    const totalProfessionals = Math.min(raw.filter(isProfessional).length, MAX_TOTAL_BY_TAB.professionals);
    const totalCenters = Math.min(raw.filter(isCenter).length, MAX_TOTAL_BY_TAB.centers);

    // Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (pageNum - 1) * limit;
    const results = filtered.slice(offset, offset + limit).map(mapProvider);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      provinceSlug,
      specSlug: specSlug || null,
      tab,
      page: pageNum,
      limit,
      total,
      totalPages,
      totalProfessionals,
      totalCenters,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
