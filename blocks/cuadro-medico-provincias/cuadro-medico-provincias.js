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
    <h2 class="cm-prov-title">Provincias donde está ASISA</h2>
    <ul class="cm-prov-list"><li class="cm-prov-loading">Cargando provincias…</li></ul>`;

  fetch('https://asisa-pc.vercel.app/api/provincias')
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.cm-prov-list');
      const titleEl = block.querySelector('.cm-prov-title');
      const provs = data.sort((a, b) => a.name.localeCompare(b.name));
      titleEl.textContent = `Provincias donde está ASISA (${provs.length})`;
      list.innerHTML = provs
        .map((p) => `<li class="cm-prov-item"><a href="/cuadro-medico/salud/provincia-de-${toSlug(p.name)}">${p.name}</a></li>`)
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.cm-prov-list');
      list.innerHTML = '<li class="cm-prov-loading">No se pudieron cargar las provincias</li>';
    });
}
