/**
 * Bloque "cuadro-medico-especialidades"
 *
 * Muestra las especialidades disponibles en la localidad actual.
 * Fila 0: [provinceCode, locationSlug, locationName]
 */

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
}

export default function decorate(block) {
  const rows = [...block.children];
  const provinceCode = rows[0]?.children[0]?.textContent?.trim() || '';
  const locationSlug = rows[0]?.children[1]?.textContent?.trim() || '';
  const locationName = rows[0]?.children[2]?.textContent?.trim() || '';

  block.innerHTML = `
    
    <h2 class="eds-md-esp-title">Especialidades disponibles en ${locationName}</h2>
    <ul class="eds-md-esp-list"><li class="loading"><div class="spinner"></div><p>Cargando especialidades…</p></li></ul>`;

  fetch(`https://asisa-pc.vercel.app/api/specialities?provinceCode=${provinceCode}`)
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.eds-md-esp-list');
      const titleEl = block.querySelector('.eds-md-esp-title');
      const specs = data.map((s) => s.specialityDescription).sort();
      titleEl.textContent = `Especialidades disponibles en ${locationName} (${specs.length})`;
      list.innerHTML = specs
        .map((s) => `<li class="eds-md-esp-item"><a href="/cuadro-medico/salud/${locationSlug}/${toSlug(s)}"><span><i class="icon-personal-asisa-hombre"></i></span><p>${s}</p></a></li>`)
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.eds-md-esp-list');
      list.innerHTML = '<li class="eds-md-esp-loading">No se pudieron cargar las especialidades</li>';
    });
}
