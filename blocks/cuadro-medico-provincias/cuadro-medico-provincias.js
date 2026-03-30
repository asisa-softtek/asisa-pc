/**
 * Bloque "cuadro-medico-provincias"
 *
 * Muestra todas las provincias donde está ASISA.
 * No necesita datos de entrada.
 */

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
}

export default function decorate(block) {
  block.innerHTML = `
    <h2 class="eds-md-prov-title">Provincias donde está ASISA</h2>
    <ul class="eds-md-prov-list"><li class="loading"><div class="spinner"></div><p>Cargando provincias…</p></li></ul>`;

  fetch('https://asisa-pc.vercel.app/api/provincias')
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.eds-md-prov-list');
      const titleEl = block.querySelector('.eds-md-prov-title');
      const provs = data.sort((a, b) => a.name.localeCompare(b.name));
      titleEl.textContent = `Provincias donde está ASISA (${provs.length})`;
      list.innerHTML = provs
        .map((p) => `<li class="eds-md-prov-item"><a href="/cuadro-medico/salud/provincia-de-${toSlug(p.name)}"><span><i class="icon-localizacion"></i></span><p>${p.name}</p></a></li>`)
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.eds-md-prov-list');
      list.innerHTML = '<li class="eds-md-prov-loading">No se pudieron cargar las provincias</li>';
    });
}
