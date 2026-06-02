import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let masterCache = null;

export function fetchEspecialidadesMaster() {
  if (!masterCache) {
    masterCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/especialidades.json'), 'utf8'));
  }
  return masterCache;
}

export function fetchEspecialidad(slug) {
  const meta = fetchEspecialidadesMaster().find((e) => e.slug === slug);
  if (!meta) return null;
  const detailPath = join(process.cwd(), `data/cuadro-medico/especialidades/${slug}.json`);
  if (!existsSync(detailPath)) return { ...meta, provincias: [] };
  const detail = JSON.parse(readFileSync(detailPath, 'utf8'));
  return { ...meta, provincias: detail.provincias };
}

export default function handler(req, res) {
  const { slug } = req.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (!slug) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(fetchEspecialidadesMaster());
  }

  const detail = fetchEspecialidad(slug);
  if (!detail) return res.status(404).json({ error: `Especialidad no encontrada: ${slug}` });

  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json(detail);
}
