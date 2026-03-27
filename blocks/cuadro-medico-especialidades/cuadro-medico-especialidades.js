/**
 * Bloque "cuadro-medico-especialidades"
 *
 * Muestra las especialidades disponibles en la localidad actual.
 * Fila 0: [provinceCode, locationSlug, locationName]
 */

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
}

export default function decorate(block) {
  const rows = [...block.children];
  const provinceCode = rows[0]?.children[0]?.textContent?.trim() || '';
  const locationSlug = rows[0]?.children[1]?.textContent?.trim() || '';
  const locationName = rows[0]?.children[2]?.textContent?.trim() || '';

  block.innerHTML = `
    <h2 class="cm-esp-title">Especialidades disponibles en ${locationName}</h2>
    <ul class="cm-esp-list"><li class="cm-esp-loading">Cargando especialidades…</li></ul>`;

  fetch(`https://asisa-pc.vercel.app/api/specialities?provinceCode=${provinceCode}`)
    .then((r) => r.json())
    .then((data) => {
      const list = block.querySelector('.cm-esp-list');
      const titleEl = block.querySelector('.cm-esp-title');
      const specs = data.map((s) => s.specialityDescription).sort();
      titleEl.textContent = `Especialidades disponibles en ${locationName} (${specs.length})`;
      list.innerHTML = specs
        .map((s) => `<li class="cm-esp-item"><a href="/cuadro-medico/salud/${locationSlug}/${toSlug(s)}">${s}</a></li>`)
        .join('');
    })
    .catch(() => {
      const list = block.querySelector('.cm-esp-list');
      list.innerHTML = '<li class="cm-esp-loading">No se pudieron cargar las especialidades</li>';
    });
}
