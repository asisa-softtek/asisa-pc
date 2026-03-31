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
    <h2 class="eds-md-esp-top-title">Especialidades más buscadas</h2>
    <ul class="eds-md-esp-top-list"><li class="loading"><div class="spinner"></div><p>Cargando especialidades…</p></li></ul>`;

  fetch('https://asisa-pc.vercel.app/api/specialities')
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.eds-md-esp-top-list');
      const titleEl = block.querySelector('.eds-md-esp-top-title');
      const specs = data.map((s) => s.specialityDescription).sort();
      titleEl.textContent = `Especialidades más buscadas (${specs.length})`;
      list.innerHTML = specs
        .map((s) => `<li class="eds-md-esp-top-item"><a href="/cuadro-medico/salud/general/${toSlug(s)}"><span><i class="icon-ventajas"></i></span><p>${s}</p></a></li>`)
        
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.eds-md-esp-top-list');
      list.innerHTML = '<li class="loading"><p>No se pudieron cargar las localidades</p></li>';
    });
}
