import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let masterCache = null;

function getMaster() {
  if (!masterCache) {
    masterCache = JSON.parse(readFileSync(join(process.cwd(), 'data/cuadro-medico/especialidades.json'), 'utf8'));
  }
  return masterCache;
}

export default function handler(req, res) {
  const { slug } = req.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (!slug) {
    // Sin slug → devuelve el listado completo (útil para el bloque de top-especialidades)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(getMaster());
  }

  const meta = getMaster().find((e) => e.slug === slug);
  if (!meta) return res.status(404).json({ error: `Especialidad no encontrada: ${slug}` });

  const detailPath = join(process.cwd(), `data/cuadro-medico/especialidades/${slug}.json`);
  if (!existsSync(detailPath)) return res.status(404).json({ error: `Sin datos para: ${slug}` });

  const detail = JSON.parse(readFileSync(detailPath, 'utf8'));

  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({ ...meta, provincias: detail.provincias });
}
