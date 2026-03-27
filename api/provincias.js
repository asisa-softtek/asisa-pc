import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const provincias = JSON.parse(readFileSync(join(process.cwd(), 'data/provincias.json'), 'utf8'));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json(provincias);
}
