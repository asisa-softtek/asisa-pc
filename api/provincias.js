import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let listCache = null;

export function fetchProvincias() {
  if (!listCache) {
    listCache = JSON.parse(readFileSync(join(process.cwd(), 'data/provincias.json'), 'utf8'));
  }
  return listCache;
}

export function fetchProvincia(slug) {
  const path = join(process.cwd(), `data/cuadro-medico/provincias/${slug}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export default function handler(req, res) {
  const { slug } = req.query;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (slug) {
    const data = fetchProvincia(slug);
    if (!data) return res.status(404).json({ error: `Provincia no encontrada: ${slug}` });
    return res.status(200).json(data);
  }

  return res.status(200).json(fetchProvincias());
}
