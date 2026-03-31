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
    <h2 class="eds-md-prov-title">Localidades con ${specName}</h2>
    <ul class="eds-md-prov-list"><li class="loading"><div class="spinner"></div><p>Cargando provincias…</p></li></ul>`;

  fetch(`https://asisa-pc.vercel.app/api/specialities?action=localidades&spec=${encodeURIComponent(specSlug)}`)
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.eds-md-prov-list');
      const titleEl = block.querySelector('.eds-md-prov-title');
      const items = [];

      (data.provincias || []).sort().forEach((p) => {
        items.push(`<li class="eds-md-prov-item"><a href="/cuadro-medico/salud/${p}/${specSlug}"><span><i class="icon-localizacion"></i></span><p>${slugToLabel(p)}</p></a></li>`);
      });

      (data.municipios || []).sort().forEach((m) => {
        items.push(`<li class="eds-md-prov-item eds-md-prov-muni"><a href="/cuadro-medico/salud/${m}/${specSlug}"><span><i class="icon-localizacion"></i></span><p>${slugToLabel(m)}</p></a></li>`);
      });

      const total = (data.provincias || []).length + (data.municipios || []).length;
      titleEl.textContent = `Localidades con ${specName} (${total})`;
      list.innerHTML = items.join('');
    })
    .catch(() => {
      const list = block.querySelector('.eds-md-prov-list');
      list.innerHTML = '<li class="loading"><p>No se pudieron cargar las localidades</p></li>';
    });
}
