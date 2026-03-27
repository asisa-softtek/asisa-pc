/* eslint-disable no-console */
const BASE = 'https://main--asisa-pc--asisa-softtek.aem.live';

export default async function handler(req, res) {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
    if (!response.ok) throw new Error(`PokeAPI error: ${response.status}`);

    const data = await response.json();
    const urls = data.results.map((p) => `${BASE}/pokemon/${p.name}`);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url}</loc>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(sitemap);
  } catch (error) {
    console.error('Sitemap pokemon error:', error);
    return res.status(500).send('<error>Error generando sitemap pokemon</error>');
  }
}
