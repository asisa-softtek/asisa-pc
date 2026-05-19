/**
 * Bloque "cuadro-medico-otros-medicos".
 *
 * Pinta DOS grupos de chips de otros médicos:
 *   1) Otros médicos de <especialidad> en <provincia>
 *   2) Otros médicos de <especialidad> en <centro>  (si el doctor tiene parentDescription)
 *
 * Lee la URL:  /cuadro-medico/d/{key}
 *
 * UI 100% con clases del design system ASISA:
 *   - .cmp-medical-detail__subtitle           → título de cada grupo
 *   - .cmp-medical-detail__other-specialities → contenedor flex-wrap de chips
 *   - .cmp-tag-template--blank                → chip
 */

const API_BASE = 'https://asisa-pc.vercel.app';

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const dIdx = parts.indexOf('d');
  return dIdx !== -1 ? parts[dIdx + 1] : null;
}

function formatName(raw) {
  if (!raw) return '';
  return raw.toLowerCase().split(/(\s+)/).map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join('');
}

function formatPersonName(raw) {
  if (!raw) return '';
  const [last = '', first = ''] = raw.split(',').map((s) => s.trim());
  const ordered = first ? `${first} ${last}` : last;
  const formatted = formatName(ordered);
  const given = formatted.split(/\s+/)[0] || '';
  const prefix = /a$/i.test(given) ? 'Dra.' : 'Dr.';
  return `${prefix} ${formatted}`;
}

function chip(p) {
  return `<a class="cmp-tag-template cmp-tag-template--blank" href="${p.detailUrl}">
    <span class="cmp-tag-template__text">${formatPersonName(p.name)}</span>
  </a>`;
}

function chipList(title, items) {
  if (!items.length) return '';
  return `<section>
    <h2 class="cmp-medical-detail__subtitle">${title}</h2>
    <div class="cmp-medical-detail__other-specialities">${items.map(chip).join('')}</div>
  </section>`;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p>Cargando…</p>';

  fetch(`${API_BASE}/api/doctor?key=${key}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((doctor) => Promise.all([
      Promise.resolve(doctor),
      fetch(`${API_BASE}/api/provincias?slug=${doctor.provinceSlug}`).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/providers?provinceSlug=${doctor.provinceSlug}&specSlug=${doctor.specSlug}&tab=professionals&limit=50`).then((r) => r.json()),
    ]))
    .then(([doctor, provincia, providersResp]) => {
      const currentUrl = `/cuadro-medico/d/${key}`;
      const allOthers = (providersResp.results || []).filter((p) => p.detailUrl !== currentUrl);
      const specName = formatName(doctor.specialities?.[0] || doctor.specSlug || '');
      const provName = provincia?.displayName || doctor.provinceSlug;
      const centerName = doctor.parentDescription ? formatName(doctor.parentDescription) : '';

      const sameCenter = centerName
        ? allOthers.filter((p) => formatName(p.parentDescription || '') === centerName)
        : [];

      const html = [
        chipList(`Otros médicos de ${specName} en ${provName}`, allOthers.slice(0, 20)),
        centerName ? chipList(`Otros médicos de ${specName} en ${centerName}`, sameCenter.slice(0, 10)) : '',
      ].filter(Boolean).join('');

      if (!html) { block.hidden = true; return; }
      block.innerHTML = html;
    })
    .catch(() => { block.hidden = true; });
}
