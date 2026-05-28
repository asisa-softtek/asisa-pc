/**
 * Bloque "cuadro-medico-otras-provincias"
 *
 * Grid de cards con otras provincias que tienen la misma especialidad.
 * Sin parámetros AEM — lee la URL:
 *   /cuadro-medico/p/{provSlug}/pe/{specSlug}
 */

function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  const eIdx = parts.indexOf('e');
  let specSlug = peIdx !== -1 ? parts[peIdx + 1] : null;
  if (!specSlug && eIdx !== -1) specSlug = parts[eIdx + 1];
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug,
  };
}

export default function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!specSlug) { block.hidden = true; return; }

  block.innerHTML = '<div class="loading"><div class="spinner"></div> <p>Cargando provincias…</p></div>';

  fetch(`https://asisa-pc.vercel.app/api/especialidades?slug=${specSlug}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      const provincias = (data.provincias || []).filter((p) => p.slug !== provSlug);
      if (!provincias.length) { block.hidden = true; return; }
      const specLower = (data.name || specSlug).toLowerCase();

      block.innerHTML = `
      <div class="eds-mp-other-localities">
        <h2 class="eds-mp-other-localities-title">Otras provincias con ${specLower} ASISA</h2>
        <ul class="eds-mp-other-localities-container">
          ${provincias.map((p) => `
            <li class="eds-mp-other-localities-item">
              <div class="eds-mp-other-localities-block">
                <p class="eds-mp-other-localities-block--locate">${data.name} ${p.displayName}</p>
                <p class="eds-mp-other-localities-block--professional">${p.count} profesionales</p>
              </div>
              <div class="eds-mp-other-localities-link"><a href="/cuadro-medico/p/${p.slug}/pe/${specSlug}" aria-label="Ver ${data.name} en ${p.displayName}"><i class="icon-arrow-right"></i></a></div>
            
            </li>`).join('')}
        </ul>
      </div>`;
    })
    .catch(() => { block.innerHTML = ''; });
}
