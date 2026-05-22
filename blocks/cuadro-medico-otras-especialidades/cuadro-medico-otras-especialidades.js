/**
 * Bloque "cuadro-medico-otras-especialidades"
 *
 * Chips de especialidades disponibles en la provincia actual.
 * Lee la URL: /cuadro-medico/p/{provSlug}/pe/{specSlug}
 *
 * UI 100% con clases del design system ASISA (clientlib-site.min.css):
 *   - .cmp-medical-detail__subtitle           → título
 *   - .cmp-medical-detail__other-specialities → contenedor flex-wrap
 *   - .cmp-tag-template--blank / --blue       → chip
 */

const API_BASE = 'https://asisa-pc.vercel.app';

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

function renderProvincialChips(provincia, specs, provSlug, specSlug) {
  return `
    <h2 class="cmp-medical-detail__subtitle">Otras especialidades en ${provincia.displayName}</h2>
    <div class="cmp-medical-detail__other-specialities">
      ${specs.map((e) => {
    const variant = e.slug === specSlug ? 'cmp-tag-template--blue' : 'cmp-tag-template--blank';
    return `<a class="cmp-tag-template ${variant}" href="/cuadro-medico/p/${provSlug}/pe/${e.slug}"><span class="cmp-tag-template__text">${e.name}</span></a>`;
  }).join('')}
    </div>`;
}

function renderNationalChips(specs, specSlug) {
  const top = specs.slice(0, 15);
  return `
    <h2 class="cmp-medical-detail__subtitle">Otras especialidades del Cuadro médico ASISA</h2>
    <div class="cmp-medical-detail__other-specialities">
      ${top.map((e) => {
    const variant = e.slug === specSlug ? 'cmp-tag-template--blue' : 'cmp-tag-template--blank';
    return `<a class="cmp-tag-template ${variant}" href="/cuadro-medico/e/${e.slug}"><span class="cmp-tag-template__text">${e.name}</span></a>`;
  }).join('')}
    </div>`;
}

export default function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!provSlug && !specSlug) { block.hidden = true; return; }

  block.innerHTML = '<p>Cargando especialidades…</p>';

  if (provSlug) {
    Promise.all([
      fetch(`${API_BASE}/api/provincias?slug=${provSlug}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API_BASE}/api/especialidades`).then((r) => r.json()),
    ])
      .then(([provincia, allEspec]) => {
        const provSpecs = new Set(provincia.especialidades || []);
        const specs = allEspec.filter((e) => provSpecs.has(e.slug));
        if (!specs.length) { block.hidden = true; return; }
        block.innerHTML = renderProvincialChips(provincia, specs, provSlug, specSlug);
      })
      .catch(() => { block.innerHTML = ''; });
  } else {
    fetch(`${API_BASE}/api/especialidades`)
      .then((r) => r.json())
      .then((allEspec) => {
        const specs = (allEspec || []).filter((e) => e.kind !== 'service');
        if (!specs.length) { block.hidden = true; return; }
        block.innerHTML = renderNationalChips(specs, specSlug);
      })
      .catch(() => { block.innerHTML = ''; });
  }
}
