import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function mapDetail(entries) {
  if (!entries?.length) return null;

  // All entries share the same location — take base data from first
  const base = entries[0];
  const addr = base.address || {};
  const tuotempo = base.tuotempo || {};

  // Consolidate unique specialities across all entries
  const specialities = [...new Set(
    entries
      .map((e) => e.specialityInfo?.specialityDescription)
      .filter(Boolean),
  )].sort();

  // Consolidate languages across entries
  const languages = [...new Set(
    entries.flatMap((e) => (e.languages || []).map((l) => l.languageDescription).filter(Boolean)),
  )];

  return {
    providerLocalicationCode: base.providerLocalicationCode,
    providerCode: base.providerCode || null,
    name: base.providerName || '',
    providerType: base.providerType ?? null,
    doctorType: base.doctorType ?? null,
    businessGroup: !!base.businessGroup,
    specialities,
    address: [addr.addressType, addr.addressDescription, addr.addressNumber].filter(Boolean).join(' ').trim(),
    postalCode: addr.postalCode || '',
    city: addr.cityDescription || '',
    provinceCode: addr.provinceCode || '',
    phone: base.contact?.phone || '',
    lat: addr.latitude || 0,
    lon: addr.longitude || 0,
    onlineAppointment: !!(base.onlineAppointment || tuotempo.onlineAppointment),
    videoConsultation: !!base.videoConsultation,
    ePrescription: !!base.electronicPrescription,
    languages,
    collegiateCode: base.professional?.collegiateCode || base.collegiateCode || '',
  };
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'id (providerLocalicationCode) is required' });
  }

  const filePath = join(process.cwd(), `data/provider-details/${id}.json`);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: `Provider not found: ${id}` });
  }

  try {
    const entries = JSON.parse(readFileSync(filePath, 'utf8'));

    if (!entries?.length) {
      return res.status(404).json({ error: `No data for provider: ${id}` });
    }

    const detail = mapDetail(entries);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(detail);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
