const BASE = 'https://main--asisa-pc--asisa-softtek.aem.live';

export default function handler(req, res) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE}/sitemap-pokemon.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-provincias.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-municipios.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-provincia-specs.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-municipio-specs.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-general-specs.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-centros.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-cuadro-medico-especialistas.xml</loc>
  </sitemap>
</sitemapindex>`;

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(sitemap);
}
