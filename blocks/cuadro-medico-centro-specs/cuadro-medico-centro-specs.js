/**
 * Bloque "cuadro-medico-centro-specs"
 *
 * Muestra las especialidades de un centro concreto.
 * Fila 0: [specialities (separated by |), locationSlug]
 */

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function decorate(block) {
  const rows = [...block.children];
  const specsRaw = rows[0]?.children[0]?.textContent?.trim() || '';
  const locationSlug = rows[0]?.children[1]?.textContent?.trim() || '';
  const specs = specsRaw.split('|').filter(Boolean).sort();

  block.innerHTML = `
    <h2 class="cm-cspecs-title">Especialidades disponibles (${specs.length})</h2>
    <ul class="cm-cspecs-list">
      ${specs.map((s) => `<li class="cm-cspecs-item"><a href="/cuadro-medico/salud/${locationSlug}/${toSlug(s)}">${s}</a></li>`).join('')}
    </ul>`;
}
