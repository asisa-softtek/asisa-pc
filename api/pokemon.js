/* eslint-disable no-console */
/**
 * Genera HTML compatible con EDS para las páginas de Pokémon.
 *
 * Flujo:
 * 1. Trae la plantilla AEM de /pokemon.plain.html (contenido del autor)
 * 2. Trae los datos del Pokémon de la PokeAPI
 * 3. Inyecta los datos en el bloque "pokemon-card" de la plantilla
 * 4. Devuelve HTML limpio que EDS procesa (secciones, bloques, header/footer)
 *
 * Estructura de filas del bloque pokemon-card:
 *  0: [nombre]
 *  1: [id, image_url]
 *  2: [tipo1, tipo2, ...]
 *  3: [altura, peso]
 *  4-N: [stat_name, stat_value]
 */

const AEM_TEMPLATE_URL = 'https://main--asisa-pc--asisa-softtek.aem.live/pokemon-template.plain.html';

async function getAemTemplate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const resp = await fetch(AEM_TEMPLATE_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0; +https://vercel.com)',
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    return html.trim();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export default async function handler(req, res) {
  let { name } = req.query;

  if (!name) {
    const parts = req.url.split('?')[0].split('/').filter((p) => p !== '' && p !== 'api' && p !== 'pokemon');
    if (parts.length > 0) name = parts[parts.length - 1];
  }

  const pokemonName = name
    ? name.toLowerCase().replace('.html', '').replace('.plain', '').split('.')
      .shift()
    : '';

  if (!pokemonName || pokemonName === 'pokemon') {
    return res.status(200).send('<div class="pokemon-index"><h1>Selecciona un Pokémon</h1></div>');
  }

  try {
    // Fetch en paralelo: PokeAPI + plantilla AEM
    const [pokeResponse, aemTemplate] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`),
      getAemTemplate(),
    ]);

    if (!pokeResponse.ok) {
      return res.status(404).send('<div><h1>Pokémon no encontrado</h1></div>');
    }

    const pokemon = await pokeResponse.json();
    const id = pokemon.id.toString().padStart(3, '0');
    const image = pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default;
    const height = (pokemon.height / 10).toFixed(1);
    const weight = (pokemon.weight / 10).toFixed(1);
    const title = pokemon.name.toUpperCase();
    const types = pokemon.types.map((t) => t.type.name.toUpperCase());

    // Filas del bloque EDS
    const typeCells = types.map((t) => `<div>${t}</div>`).join('');
    const statsRows = pokemon.stats
      .map((s) => `<div><div>${s.stat.name.toUpperCase()}</div><div>${s.base_stat}</div></div>`)
      .join('\n    ');

    const blockRows = `
    <div><div>${title}</div></div>
    <div><div>${id}</div><div>${image}</div></div>
    <div>${typeCells}</div>
    <div><div>${height}</div><div>${weight}</div></div>
    ${statsRows}`;

    // Inyectar datos en la plantilla AEM o generar contenido standalone
    let mainContent;

    if (aemTemplate) {
      // Buscar el bloque pokemon-card en la plantilla y rellenarlo
      const marker = '<div class="pokemon-card">';
      const markerPos = aemTemplate.indexOf(marker);

      if (markerPos !== -1) {
        const openTagEnd = markerPos + marker.length;

        // Encontrar el </div> de cierre balanceando profundidad
        let depth = 1;
        let pos = openTagEnd;
        let closingPos = -1;
        while (pos < aemTemplate.length && depth > 0) {
          const nextOpen = aemTemplate.indexOf('<div', pos);
          const nextClose = aemTemplate.indexOf('</div>', pos);
          if (nextClose === -1) break;
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth += 1;
            pos = nextOpen + 4;
          } else {
            depth -= 1;
            if (depth === 0) closingPos = nextClose;
            pos = nextClose + 6;
          }
        }

        if (closingPos !== -1) {
          mainContent = `${aemTemplate.slice(0, openTagEnd)
            + blockRows
          }\n  ${
            aemTemplate.slice(closingPos)}`;
        } else {
          mainContent = `${aemTemplate}\n<div class="pokemon-card">${blockRows}\n</div>`;
        }
      } else {
        // La plantilla no tiene pokemon-card, añadirlo al final
        mainContent = `${aemTemplate}\n<div class="pokemon-card">${blockRows}\n</div>`;
      }

      // El h1 de la plantilla se mantiene tal cual viene de AEM
    } else {
      // Sin plantilla: contenido standalone
      mainContent = `<div>
  <h1>${title}</h1>
  <div class="pokemon-card">${blockRows}
  </div>
</div>`;
    }

    // Documento HTML completo para que EDS extraiga el <main>
    const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} | Pokédex Asisa</title>
  <link rel="stylesheet" href="https://www.asisa.es/etc.clientlibs/wasisa/clientlibs/clientlib-generic.min.css" type="text/css">
  <link rel="stylesheet" href="https://www.asisa.es/etc.clientlibs/wasisa/clientlibs/clientlib-site.min.css" type="text/css">
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).send(finalHtml.trim());
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).send(`<div>Error interno: ${error.message}</div>`);
  }
}
