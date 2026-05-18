/**
 * Bloque "cuadro-medico-otras-especialidades"
 *
 * Chips de especialidades disponibles en la provincia actual.
 * La especialidad activa se resalta. Sin parámetros AEM — lee la URL:
 *   /cuadro-medico/p/{provSlug}/pe/{specSlug}
 */

function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug: peIdx !== -1 ? parts[peIdx + 1] : null,
  };
}

export default function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!provSlug) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-otras-espec-loading">Cargando especialidades…</p>';

  Promise.all([
    fetch(`https://asisa-pc.vercel.app/api/provincias?slug=${provSlug}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('https://asisa-pc.vercel.app/api/especialidades').then((r) => r.json()),
  ])
    .then(([provincia, allEspec]) => {
      const provSpecs = new Set(provincia.especialidades || []);
      const specs = allEspec.filter((e) => provSpecs.has(e.slug));

      block.innerHTML = `
        <h2 class="cm-otras-espec-title">Otras especialidades en ${provincia.displayName}</h2>
        <ul class="cm-otras-espec-list">
          ${specs.map((e) => {
    const active = e.slug === specSlug ? ' cm-otras-espec-chip--active' : '';
    return `<li class="cm-otras-espec-item"><a class="cm-otras-espec-chip${active}" href="/cuadro-medico/p/${provSlug}/pe/${e.slug}">${e.name}</a></li>`;
  }).join('')}
        </ul>`;
    })
    .catch(() => { block.innerHTML = ''; });
}
