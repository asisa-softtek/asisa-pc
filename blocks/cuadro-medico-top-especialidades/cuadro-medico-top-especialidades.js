/**
 * Bloque "cuadro-medico-top-especialidades"
 *
 * Muestra las especialidades más buscadas de ASISA.
 * No necesita datos de entrada — obtiene todas las especialidades de la API.
 */

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
}

export default function decorate(block) {
  block.innerHTML = `
    <h2 class="cm-top-title">Especialidades más buscadas</h2>
    <ul class="cm-top-list"><li class="cm-top-loading">Cargando especialidades…</li></ul>`;

  fetch('https://asisa-pc.vercel.app/api/specialities')
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.cm-top-list');
      const titleEl = block.querySelector('.cm-top-title');
      const specs = data.map((s) => s.specialityDescription).sort();
      titleEl.textContent = `Especialidades más buscadas (${specs.length})`;
      list.innerHTML = specs
        .map((s) => `<li class="cm-top-item"><a href="/cuadro-medico/salud/general/${toSlug(s)}">${s}</a></li>`)
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.cm-top-list');
      list.innerHTML = '<li class="cm-top-loading">No se pudieron cargar las especialidades</li>';
    });
}
