import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const { slug } = req.query;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (slug) {
    const path = join(process.cwd(), `data/cuadro-medico/provincias/${slug}.json`);
    if (!existsSync(path)) return res.status(404).json({ error: `Provincia no encontrada: ${slug}` });
    return res.status(200).json(JSON.parse(readFileSync(path, 'utf8')));
  }

  const provincias = JSON.parse(readFileSync(join(process.cwd(), 'data/provincias.json'), 'utf8'));
  return res.status(200).json(provincias);
}
