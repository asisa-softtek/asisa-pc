/**
 * Bloque "cuadro-medico-localidades"
 *
 * Muestra las localidades (provincias y municipios) donde existe una especialidad.
 * Fila 0: [specSlug, specName]
 */

function slugToLabel(slug) {
  // provincia-de-madrid → Provincia de Madrid
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function decorate(block) {
  const rows = [...block.children];
  const specSlug = rows[0]?.children[0]?.textContent?.trim() || '';
  const specName = rows[0]?.children[1]?.textContent?.trim() || '';

  block.innerHTML = `
    <h2 class="cm-loc-title">Localidades con ${specName}</h2>
    <ul class="cm-loc-list"><li class="cm-loc-loading">Cargando localidades…</li></ul>`;

  fetch(`https://asisa-pc.vercel.app/api/specialities?action=localidades&spec=${encodeURIComponent(specSlug)}`)
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.cm-loc-list');
      const titleEl = block.querySelector('.cm-loc-title');
      const items = [];

      (data.provincias || []).sort().forEach((p) => {
        items.push(`<li class="cm-loc-item"><a href="/cuadro-medico/salud/${p}/${specSlug}">${slugToLabel(p)}</a></li>`);
      });

      (data.municipios || []).sort().forEach((m) => {
        items.push(`<li class="cm-loc-item cm-loc-muni"><a href="/cuadro-medico/salud/${m}/${specSlug}">${slugToLabel(m)}</a></li>`);
      });

      const total = (data.provincias || []).length + (data.municipios || []).length;
      titleEl.textContent = `Localidades con ${specName} (${total})`;
      list.innerHTML = items.join('');
    })
    .catch(() => {
      const list = block.querySelector('.cm-loc-list');
      list.innerHTML = '<li class="cm-loc-loading">No se pudieron cargar las localidades</li>';
    });
}
