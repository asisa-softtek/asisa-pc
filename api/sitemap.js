const BASE = 'https://www.asisa.es';

export function getSitemapIndexXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-provincias.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-provincia-specs.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-doctores.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-centros.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-especialidades.xml</loc>
  </sitemap>
</sitemapindex>`;
}

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(getSitemapIndexXml());
}
