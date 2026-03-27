/**
 * Bloque EDS "pokemon-card".
 *
 * Estructura esperada del bloque (filas/celdas generadas por /api/pokemon):
 *  Fila 0: [nombre]
 *  Fila 1: [id, image_url]
 *  Fila 2: [tipo1, tipo2, ...]
 *  Fila 3: [altura, peso]
 *  Filas 4-N: [stat_name, stat_value]
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 5) return;

  // Fila 0: nombre
  const name = rows[0]?.children[0]?.textContent?.trim() || '';

  // Fila 1: id + imagen
  const idCell = rows[1]?.children[0]?.textContent?.trim() || '';
  const imageUrl = rows[1]?.children[1]?.textContent?.trim() || '';

  // Fila 2: tipos
  const types = [...rows[2].children].map((c) => c.textContent.trim()).filter(Boolean);

  // Fila 3: altura + peso
  const height = rows[3]?.children[0]?.textContent?.trim() || '';
  const weight = rows[3]?.children[1]?.textContent?.trim() || '';

  // Filas 4+: stats
  const stats = [];
  for (let i = 4; i < rows.length; i += 1) {
    const statName = rows[i]?.children[0]?.textContent?.trim() || '';
    const value = parseInt(rows[i]?.children[1]?.textContent?.trim(), 10) || 0;
    if (statName) stats.push({ name: statName, value });
  }

  // Construir el HTML decorado
  const typeBadges = types
    .map((t) => `<span class="pokemon-card-type-badge">${t}</span>`)
    .join('');

  const statBars = stats
    .map((s) => {
      const pct = ((s.value / 255) * 100).toFixed(1);
      return `<div class="pokemon-card-stat">
        <span class="pokemon-card-stat-name">${s.name}</span>
        <div class="pokemon-card-stat-bar">
          <div class="pokemon-card-stat-fill" style="width:${pct}%"></div>
        </div>
        <span class="pokemon-card-stat-value">${s.value}</span>
      </div>`;
    })
    .join('');

  block.innerHTML = `
    <div class="pokemon-card-layout">
      <div class="pokemon-card-media">
        <img src="${imageUrl}" alt="${name}" loading="eager">
        <div class="pokemon-card-types">${typeBadges}</div>
      </div>
      <div class="pokemon-card-info">
        <h2 class="pokemon-card-name">${name}</h2>
        <p class="pokemon-card-id">#${idCell}</p>
        <p class="pokemon-card-measures">
          <strong>Altura:</strong> ${height} m &nbsp;|&nbsp; <strong>Peso:</strong> ${weight} kg
        </p>
        <div class="pokemon-card-stats">${statBars}</div>
      </div>
    </div>`;
}
