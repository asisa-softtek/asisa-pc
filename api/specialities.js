const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';

export default async function handler(req, res) {
  try {
    const { provinceCode } = req.query;
    const provinceParam = provinceCode ? `&provinceCode=${provinceCode}` : '';
    const resp = await fetch(
      `${ASISA_BASE}/autocomplete/specialities?specialityDescription=&networkCode=1${provinceParam}&maxResultsNumber=500`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': ASISA_API_KEY,
          'Api-Version': '1',
        },
      },
    );

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'ASISA API error' });
    }

    const data = await resp.json();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
