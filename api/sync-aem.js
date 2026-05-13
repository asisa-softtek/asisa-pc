/* eslint-disable no-console */
export default async function handler(req, res) {
  const { secret, limit = 50, offset = 0 } = req.query;

  const { SYNC_SECRET } = process.env;
  if (SYNC_SECRET && secret !== SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ADMIN_TOKEN = process.env.HLX_ADMIN_API_TOKEN;
  if (!ADMIN_TOKEN) {
    return res.status(500).json({ error: 'HLX_ADMIN_API_TOKEN not configured' });
  }

  const OWNER = 'asisa-softtek';
  const REPO = 'asisa-pc';
  const BRANCH = 'main';

  try {
    const { path: specificPath } = req.query;
    let urlsToProcess = [];
    let totalUrls = 0;
    let nextOffset = null;

    if (specificPath) {
      const cleanPath = specificPath.startsWith('/') ? specificPath : `/${specificPath}`;
      urlsToProcess = [cleanPath];
      totalUrls = 1;
    } else {
      const sitemapResp = await fetch('https://www.asisa.es/sitemap.xml');
      if (!sitemapResp.ok) throw new Error(`Error al leer sitemap: ${sitemapResp.status}`);
      const xml = await sitemapResp.text();

      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
      const cuadroUrls = urls.filter((u) => u.includes('/cuadro-medico/'));
      totalUrls = cuadroUrls.length;

      const start = parseInt(offset, 10);
      const end = start + parseInt(limit, 10);
      urlsToProcess = cuadroUrls.slice(start, end).map((url) => new URL(url).pathname);
      nextOffset = end < cuadroUrls.length ? end : null;
    }

    if (urlsToProcess.length === 0) {
      return res.status(200).json({ message: 'No hay URLs para procesar', total: totalUrls });
    }

    console.log(`Sincronizando ${urlsToProcess.length} URLs...`);

    const results = [];
    const CONCURRENCY = 5;

    for (let i = 0; i < urlsToProcess.length; i += CONCURRENCY) {
      const subBatch = urlsToProcess.slice(i, i + CONCURRENCY);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(subBatch.map(async (path) => {
        try {
          await fetch(`https://admin.hlx.page/preview/${OWNER}/${REPO}/${BRANCH}${path}`, {
            method: 'POST',
            headers: { 'x-auth-token': ADMIN_TOKEN },
          });
          await fetch(`https://admin.hlx.page/live/${OWNER}/${REPO}/${BRANCH}${path}`, {
            method: 'POST',
            headers: { 'x-auth-token': ADMIN_TOKEN },
          });
          results.push({ path, status: 'synced' });
        } catch (e) {
          results.push({ path, error: e.message });
        }
      }));
    }

    return res.status(200).json({
      total: totalUrls,
      processedInThisBatch: results.length,
      nextOffset,
      message: specificPath ? `Sincronización de ${specificPath} completada.` : 'Lote completado con éxito.',
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
