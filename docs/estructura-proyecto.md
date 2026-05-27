# Estructura del proyecto `asisa-pc` — qué hace cada fichero

> Documento de referencia. Describe, fichero por fichero, qué papel juega cada
> uno dentro de la arquitectura **AEM Author + Edge Delivery Services (EDS) +
> Vercel** que sirve el Cuadro Médico de ASISA. Para el "por qué" de la
> arquitectura ver [`byom.md`](byom.md).

---

## 0. Entornos y URLs base

Tres orígenes que conviven; cada pieza del proyecto es visible en uno o más.

| Entorno | URL base | Qué se ve |
|---------|----------|-----------|
| **EDS Live** (público) | `https://main--asisa-pc--asisa-softtek.aem.live` | Lo que ve el usuario final. Sirve el HTML procesado + bloques + datos. |
| **EDS Preview** (autenticado) | `https://main--asisa-pc--asisa-softtek.aem.page` | Mismo flujo pero contra el bus `preview`. Útil para probar antes de publicar. |
| **Vercel** (overlay + APIs + clientlibs proxy) | `https://asisa-pc.vercel.app` | Plantillas BYOM, endpoints `/api/*`, proxy `/etc.clientlibs/*`, sitemaps. |
| **AEM Author** | `https://author-p133185-e1320482.adobeaemcloud.com` | Editor de Marketing para plantillas y contenido estático. |
| **Admin HLX** (API ops) | `https://admin.hlx.page` | Endpoints de gestión: `/preview`, `/live`, `/code`, `/status`, `/config`. |

> En los ejemplos de las siguientes secciones se usan estas abreviaturas:
> `<LIVE>` = `https://main--asisa-pc--asisa-softtek.aem.live`,
> `<VERCEL>` = `https://asisa-pc.vercel.app`,
> `<ADMIN>` = `https://admin.hlx.page`.

---

## 1. Configuración raíz del site EDS

| Fichero | Descripción |
|---------|-------------|
| [fstab.yaml](../fstab.yaml) | Mountpoints de EDS. `/`: monta AEM Author como **primary source** (`/bin/franklin.delivery/asisa-softtek/asisa-pc/main`, sufijo `.html`). `/sitemap*.xml`: monta los XML generados por Vercel como contenido tipo `markup`. |
| [helix-query.yaml](../helix-query.yaml) | Configuración del **query index** de EDS. Indexa todas las páginas excepto `*.json`, extrae `lastModified` y `<meta name=robots>`, escribe `/query-index.json`. |
| [helix-sitemap.yaml](../helix-sitemap.yaml) | Generador del `sitemap.xml` por defecto que EDS construye a partir del query index. Convive con los sitemaps de Vercel (que cubren las URLs dinámicas del cuadro médico). |
| [paths.json](../paths.json) | Mapping de rutas: `/content/site-pc/` → `/`. Permite que las páginas guardadas en AEM bajo `/content/site-pc/<path>` se publiquen como `/<path>`. |
| [head.html](../head.html) | `<head>` global inyectado en TODAS las páginas. Incluye CSP, scripts principales (`aem.js`, `scripts.js`), `styles.css` local y las **3 clientlibs CSS** de ASISA (`clientlib-generic`, `clientlib-iconslib`, `clientlib-site`) servidas por proxy desde Vercel. |
| [404.html](../404.html) | Página de error custom. Botón "volver" si hay referer same-origin y envío de evento RUM. |
| [.hlxignore](../.hlxignore) | Excluye de la publicación EDS dotfiles, markdown, package.json, etc. |
| [tools/sidekick/config.json](../tools/sidekick/config.json) | Configuración del **Sidekick** (toolbar de edición). Apunta al AEM Author. |

**Dónde verlo en vivo:**
- `head.html` aplicado → ver el `<head>` de cualquier página: `<LIVE>/cuadro-medico` (View Source).
- `sitemap.xml` generado por EDS: `<LIVE>/sitemap.xml`.
- `query-index.json` resultado: `<LIVE>/query-index.json`.
- 404 personalizado: `<LIVE>/esto-no-existe`.

---

## 2. Configuración Vercel

| Fichero | Descripción |
|---------|-------------|
| [vercel.json](../vercel.json) | Rewrites y headers. **Rewrites clave**: `/markup/*` → `/api/markup` (overlay BYOM), `/sitemap.xml` → `/api/sitemap`, 5 sitemaps del cuadro médico → `/api/sitemap-cuadro-medico?type=...`, `/etc.clientlibs/*` → **proxy** a `https://www.asisa.es/etc.clientlibs/*`. **Headers**: CORS abierto en `/etc.clientlibs/*`. |
| [.vercel/project.json](../.vercel/project.json) | IDs internos del proyecto Vercel (`projectId`, `orgId`). |
| [.vercel/README.txt](../.vercel/README.txt) | README estándar de Vercel CLI. |

**Dónde verlo en vivo:**
- Overlay BYOM funcionando: `<VERCEL>/markup/cuadro-medico/p/madrid` (devuelve HTML de plantilla).
- Proxy de clientlibs: `<VERCEL>/etc.clientlibs/wasisa/clientlibs/clientlib-site.min.css` (sirve el CSS de `www.asisa.es`).
- Sitemap proxeado: `<VERCEL>/sitemap-cuadro-medico-doctores.xml`.

---

## 3. Universal Editor (AEM Author) — modelos de componentes

| Fichero | Descripción |
|---------|-------------|
| [component-definition.json](../component-definition.json) | Registro de componentes visibles en el Universal Editor. Tres grupos: **Default Content** (Text, Title, Image, Button), **Sections** (Section), **Blocks** (Cards, Card, Columns, Fragment, Hero **+ los 10 bloques específicos de cuadro médico**). Cada entrada mapea a un `resourceType` Franklin. |
| [component-filters.json](../component-filters.json) | Reglas de composición: qué componentes pueden ir dentro de qué contenedor (`main` solo permite `section`; `section` permite todos; `cards` solo `card`; etc.). |
| [component-models.json](../component-models.json) | Esquema de campos editables por componente: `page-metadata` (title, description, keywords), `image` (ref + altText), `title` (texto + heading), `button` (link, linkText, linkType), `section` (name, style), `card`, `columns`, `fragment`, `hero`. Los bloques de cuadro médico **no tienen campos**: la lógica vive en sus JS y leen la URL. |
| [models/_button.json](../models/_button.json), [_image.json](../models/_image.json), [_page.json](../models/_page.json), [_section.json](../models/_section.json), [_text.json](../models/_text.json), [_title.json](../models/_title.json) | Modelos individuales por componente básico. Se consolidan en `component-models.json`. |
| [models/_component-definition.json](../models/_component-definition.json), [_component-filters.json](../models/_component-filters.json), [_component-models.json](../models/_component-models.json) | Fragmentos modulares de las definiciones globales. |

**Dónde verlo en vivo:**
- Entrar al AEM Author y abrir una página, p. ej. `/content/site-pc/cuadro-medico/provincia`. Los bloques registrados aparecen en el catálogo del Universal Editor.
- Listado de bloques disponibles en runtime: cualquier página, `View Source`, buscar `class="cuadro-medico"` → solo aparecen los que `component-definition.json` declara.

---

## 4. Endpoints API (Vercel) — `api/`

Todos viven en `api/*.js` y se exponen como funciones serverless. Las rutas finales pueden estar reescritas en [vercel.json](../vercel.json).

| Fichero | Ruta HTTP | Función | Lee de `data/` |
|---------|-----------|---------|----------------|
| [api/markup.js](../api/markup.js) | `/markup/*` | **Overlay BYOM**. Devuelve plantillas HTML para `/cuadro-medico/p/*`, `/d/*`, `/c/*`, `/e/*`. 404 para el resto (EDS cae a AEM). Cada plantilla inyecta clientlibs y un `<main>` con bloques vacíos. | (ninguno) |
| [api/providers.js](../api/providers.js) | `/api/providers?provinceSlug=&specSlug=&tab=professionals\|centers&page=&limit=` | Listado paginado de profesionales/centros con cap de 30 (profesionales) y 50 (centros). Soporta búsqueda por prov+spec, solo prov o solo spec (nacional). | `provincias.json`, `especialidades.json`, `providers/{prov}/{spec}.json` |
| [api/doctor.js](../api/doctor.js) | `/api/doctor?key=<slug-id>` | Ficha completa de profesional: nombre, código colegial, especialidades, todas las ubicaciones donde ejerce. | `doctores-index.json`, `providers/{prov}/{spec}.json`, `provider-details/{locCode}.json` |
| [api/centro.js](../api/centro.js) | `/api/centro?key=<slug>` | Ficha completa de centro: dirección, tel, especialidades con médicos asociados, otros centros similares. | `centros-index.json`, `doctores-index.json`, `providers/{prov}/*`, `provider-details/{locCode}.json` |
| [api/provincias.js](../api/provincias.js) | `/api/provincias[?slug=]` | Lista de provincias o detalle de una (con especialidades disponibles). | `provincias.json`, `cuadro-medico/provincias/{slug}.json` |
| [api/especialidades.js](../api/especialidades.js) | `/api/especialidades[?slug=]` | Lista master de especialidades o detalle (provincias donde está disponible + counts). | `cuadro-medico/especialidades.json`, `cuadro-medico/especialidades/{slug}.json` |
| [api/providers-detail.js](../api/providers-detail.js) | `/api/providers-detail?id=<locCode>` | Detalle consolidado por código de localización. | `provider-details/{id}.json` |
| [api/specialities.js](../api/specialities.js) | `/api/specialities?provinceCode=<code>` | **Proxy en vivo** al autocomplete del backend ASISA (`ursaepre.asisa.es`). No usa caché del repo. | (fetch externo) |
| [api/sitemap.js](../api/sitemap.js) | `/sitemap.xml` | Sitemap index que apunta a los 5 sitemaps temáticos. | (ninguno, hardcoded) |
| [api/sitemap-cuadro-medico.js](../api/sitemap-cuadro-medico.js) | `/sitemap-cuadro-medico-*.xml` | Genera un sitemap XML según `?type=provincias\|provincia-specs\|doctores\|centros\|especialidades`. | Índices del cuadro médico |
| [api/sync-aem.js](../api/sync-aem.js) | `/api/sync-aem?secret=&limit=&offset=&specificPath=` | Sincroniza URLs del sitemap remoto de `www.asisa.es` con el preview+live de EDS. Requiere `SYNC_SECRET` y `HLX_ADMIN_API_TOKEN`. | `https://www.asisa.es/sitemap.xml` |

**Caches in-memory:** [centro.js](../api/centro.js), [doctor.js](../api/doctor.js), [providers.js](../api/providers.js) y [especialidades.js](../api/especialidades.js) cachean los índices y resultados intermedios en variables module-scope para evitar releer los JSON en cada petición.

**Dónde verlo en vivo (ejemplos reales que se pueden abrir en el navegador):**

```
# Overlay BYOM (lo que EDS pide a Vercel)
<VERCEL>/markup/cuadro-medico/p/madrid
<VERCEL>/markup/cuadro-medico/p/madrid/pe/cardiologia
<VERCEL>/markup/cuadro-medico/d/jose-garcia-perez-1234
<VERCEL>/markup/cuadro-medico/c/hospital-moncloa
<VERCEL>/markup/cuadro-medico/e/cardiologia

# APIs de datos
<VERCEL>/api/provincias                                    # listado
<VERCEL>/api/provincias?slug=madrid                        # detalle
<VERCEL>/api/especialidades                                # master list
<VERCEL>/api/especialidades?slug=cardiologia               # detalle + provincias
<VERCEL>/api/providers?provinceSlug=madrid&specSlug=cardiologia&tab=professionals&page=1&limit=10
<VERCEL>/api/providers?provinceSlug=madrid&tab=centers
<VERCEL>/api/doctor?key=jose-garcia-perez-1234
<VERCEL>/api/centro?key=hospital-moncloa
<VERCEL>/api/providers-detail?id=12345
<VERCEL>/api/specialities?provinceCode=28                  # autocomplete vivo a ASISA

# Sitemaps
<VERCEL>/sitemap.xml
<VERCEL>/sitemap-cuadro-medico-provincias.xml
<VERCEL>/sitemap-cuadro-medico-doctores.xml
```

> Para inspeccionar el JSON cómodamente, usar una extensión "JSON Viewer" en el navegador. Para confirmar qué fuente está usando EDS para una URL: `curl <ADMIN>/status/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid` y mirar el campo `sourceLocation` (debe empezar por `markup:...api/markup...`).

---

## 5. Bloques EDS — `blocks/`

Los bloques son componentes JS+CSS que EDS instancia automáticamente cuando detecta `<div class="<nombre-bloque>">` en el DOM. Cada uno vive en `blocks/<nombre>/<nombre>.{js,css}`. Los CSS son casi todos vacíos: el estilo viene del **design system de ASISA** (`clientlib-site.min.css`).

### 5.1 Bloques boilerplate (heredados de AEM EDS)

| Bloque | Qué hace |
|--------|----------|
| [cards](../blocks/cards/cards.js) | Grid responsive de tarjetas con imagen + cuerpo. Usa filas pre-rellenadas del DOM (modo AEM autor). |
| [columns](../blocks/columns/columns.js) | Distribuye contenido en columnas con flexbox (móvil: stack; ≥900px: horizontal). |
| [header](../blocks/header/header.js) | Carga `/nav` como fragmento. Hamburguesa, dropdowns con ARIA, breakpoint 900px. |
| [footer](../blocks/footer/footer.js) | Carga `/footer` como fragmento (`.plain.html`). |
| [fragment](../blocks/fragment/fragment.js) | Incluye HTML de otra ruta `.plain.html`, rebaseando URLs relativas. Base para header/footer. |
| [hero](../blocks/hero/hero.js) | Banner con h1, imagen de fondo y overlay. |

### 5.2 Bloques específicos del cuadro médico

Todos los bloques de cuadro médico operan en **modo BYOM**: leen `window.location.pathname`, extraen slugs y llaman a las APIs de Vercel.

| Bloque | URL donde aparece | APIs que consume | Función |
|--------|-------------------|------------------|---------|
| [cuadro-medico](../blocks/cuadro-medico/cuadro-medico.js) | `/p/<prov>`, `/p/<prov>/pe/<spec>`, `/e/<spec>` | `providers`, `provincias`, `especialidades` | Motor principal de búsqueda: tabs Profesionales/Centros, paginación, tarjetas con CTA "Pedir cita". Soporta **doble modo** (BYOM o AEM si encuentra filas). |
| [cuadro-medico-provincias](../blocks/cuadro-medico-provincias/cuadro-medico-provincias.js) | Home/landings cuadro médico | `provincias` | Listado de todas las provincias linkando a `/p/<slug>`. |
| [cuadro-medico-top-especialidades](../blocks/cuadro-medico-top-especialidades/cuadro-medico-top-especialidades.js) | Home/landings cuadro médico | `especialidades` | Listado de especialidades más demandadas linkando a `/e/<slug>`. |
| [cuadro-medico-otras-especialidades](../blocks/cuadro-medico-otras-especialidades/cuadro-medico-otras-especialidades.js) | `/p/<prov>/pe/<spec>`, `/e/<spec>` | `provincias`, `especialidades` | Chips con especialidades alternativas (en la provincia actual o top 15 nacionales). |
| [cuadro-medico-otras-provincias](../blocks/cuadro-medico-otras-provincias/cuadro-medico-otras-provincias.js) | `/p/<prov>/pe/<spec>`, `/e/<spec>` | `especialidades?slug=` | Grid de otras provincias con la misma especialidad + counts. Lee specSlug del segmento `pe/` o `e/`. |
| [cuadro-medico-ficha-doctor](../blocks/cuadro-medico-ficha-doctor/cuadro-medico-ficha-doctor.js) | `/d/<key>` | `doctor`, `provincias` | Ficha del profesional: header, primer centro destacado, loop de ubicaciones. |
| [cuadro-medico-otros-medicos](../blocks/cuadro-medico-otros-medicos/cuadro-medico-otros-medicos.js) | `/d/<key>` | `doctor`, `provincias`, `providers` | Dos listas: otros médicos de la especialidad en la provincia y en el mismo centro. |
| [cuadro-medico-ficha-centro](../blocks/cuadro-medico-ficha-centro/cuadro-medico-ficha-centro.js) | `/c/<key>` | `centro`, `provincias` | Ficha del centro: cabecera, acordeones de especialidades con médicos, grid de otros centros con mismas specs. |

### 5.3 JSON auxiliares de bloque

Algunos bloques traen un `_<nombre>.json` con metadata del componente para el Universal Editor: [_cards.json](../blocks/cards/_cards.json), [_columns.json](../blocks/columns/_columns.json), [_fragment.json](../blocks/fragment/_fragment.json), [_hero.json](../blocks/hero/_hero.json).

### 5.4 Dónde verlos en vivo (URLs reales)

| Bloque | Página de ejemplo |
|--------|-------------------|
| `header` / `footer` | Cualquier URL (presentes en todas). `<LIVE>/cuadro-medico` |
| `cards`, `columns`, `hero`, `fragment` | Páginas estáticas autoradas en AEM (home, landings). `<LIVE>/` |
| `cuadro-medico` (motor de búsqueda) | `<LIVE>/cuadro-medico/p/madrid` · `<LIVE>/cuadro-medico/p/madrid/pe/cardiologia` · `<LIVE>/cuadro-medico/e/cardiologia` |
| `cuadro-medico-provincias` | `<LIVE>/cuadro-medico` (home del cuadro médico) |
| `cuadro-medico-top-especialidades` | `<LIVE>/cuadro-medico` |
| `cuadro-medico-otras-especialidades` | `<LIVE>/cuadro-medico/p/madrid/pe/cardiologia` · `<LIVE>/cuadro-medico/e/cardiologia` |
| `cuadro-medico-otras-provincias` | `<LIVE>/cuadro-medico/p/madrid/pe/cardiologia` · `<LIVE>/cuadro-medico/e/cardiologia` |
| `cuadro-medico-ficha-doctor` | `<LIVE>/cuadro-medico/d/<slug-doctor>` (ver `data/cuadro-medico/doctores-index.json` para slugs reales) |
| `cuadro-medico-otros-medicos` | Misma ficha de doctor |
| `cuadro-medico-ficha-centro` | `<LIVE>/cuadro-medico/c/<slug-centro>` (ver `data/cuadro-medico/centros-index.json`) |

> Para inspeccionar un bloque concreto: abrir la URL, DevTools → buscar el `<div class="<nombre-bloque>">`. El JS del bloque ya se ha ejecutado y los hijos están renderizados.

---

## 6. Scripts front EDS — `scripts/`

| Fichero | Descripción |
|---------|-------------|
| [scripts/aem.js](../scripts/aem.js) | **Boilerplate de Adobe EDS**. Exporta utilidades core: `loadHeader/Footer`, `decorateButtons/Icons/Sections/Blocks/TemplateAndTheme`, `loadSection/Sections`, `loadCSS/Script`, `loadFragment`. Es la "librería" de EDS. No tocar salvo upgrades. |
| [scripts/scripts.js](../scripts/scripts.js) | Orquesta la carga en 3 fases: `loadEager` (primera sección + fuentes críticas, llegar a LCP), `loadLazy` (header, footer, resto de secciones, lazy-styles), `loadDelayed` (importa `delayed.js` a los 3s). |
| [scripts/delayed.js](../scripts/delayed.js) | Hueco para lógica no crítica (analytics, RUM, terceros). Actualmente vacío. |
| [scripts/editor-support.js](../scripts/editor-support.js) | Sólo activo dentro del Universal Editor. Escucha eventos `aue:content-*`, sanitiza con DOMPurify y re-decora bloques para reflejar cambios sin recargar. |
| [scripts/editor-support-rte.js](../scripts/editor-support-rte.js) | Agrupa nodos rich-text consecutivos con el mismo `data-richtext-resource` en un único div editable. Corre antes que los bloques. |
| [scripts/dompurify.min.js](../scripts/dompurify.min.js) | Librería externa de sanitización (XSS), usada por `editor-support.js`. |

**Dónde verlo en vivo:**
- Carga 3-fases (eager/lazy/delayed): DevTools → Network, filtrar por "Doc" y "JS", recargar `<LIVE>/cuadro-medico/p/madrid`. Se ven `aem.js`/`scripts.js` al inicio, `delayed.js` a los ~3s.
- `editor-support.js` solo se activa dentro de AEM Author. Abrir una página en el AEM Author y editar un texto: el cambio se refleja sin recargar.
- Fuentes locales: `<LIVE>/styles/fonts.css` y `<LIVE>/fonts/roboto-regular.woff2`.

---

## 7. Estilos y assets — `styles/`, `fonts/`, `icons/`

| Fichero | Descripción |
|---------|-------------|
| [styles/styles.css](../styles/styles.css) | Stub. Todos los estilos efectivos vienen de las clientlibs de ASISA. |
| [styles/fonts.css](../styles/fonts.css) | Vacío. Las fuentes se cargan vía clientlibs. |
| [styles/lazy-styles.css](../styles/lazy-styles.css) | Reservado para CSS no crítico (cargado post-LCP por `loadLazy`). Vacío. |
| [fonts/roboto-*.woff2](../fonts/) | Roboto Regular, Medium, Bold y Condensed Bold en WOFF2. Disponibles localmente para fallback. |
| [icons/search.svg](../icons/search.svg) | Icono de búsqueda local (el resto de iconografía viene de `clientlib-iconslib`). |
| [favicon.ico](../favicon.ico) | Favicon del site. |

**Dónde verlo en vivo:**
- Estilos efectivos (clientlibs ASISA via proxy): `<VERCEL>/etc.clientlibs/wasisa/clientlibs/clientlib-site.min.css`.
- Fuentes locales: `<LIVE>/fonts/roboto-bold.woff2`.
- Icono local: `<LIVE>/icons/search.svg`.

---

## 8. Scripts CLI de utilidad (raíz)

Pipeline de mantenimiento de datos y publicación. Ejecutables con `node`.

| Fichero | Función | Outputs |
|---------|---------|---------|
| [generate-providers-data.mjs](../generate-providers-data.mjs) | Descarga el catálogo de proveedores desde la API de ASISA (`/searchPortal`) por provincia y especialidad. Concurrencia 10, paginación 100×página. Flags: `FORCE=true`, `PROVINCE_CODE=28`. | `data/providers/{prov}/{spec}.json` |
| [generate-provider-details.mjs](../generate-provider-details.mjs) | Pre-descarga el **detalle** de cada combinación única `(locCode, docNum)` desde `/providers/details` de ASISA. Concurrencia 25 (bajar a 10 si hay 429). | `data/provider-details/{locCode}.json` |
| [generate-cuadro-medico-specs.mjs](../generate-cuadro-medico-specs.mjs) | Agrega los providers cacheados y construye los índices necesarios para las APIs (especialidades por provincia, provincias por especialidad, índice de doctores por slug-código colegial, índice de centros por slug). | `data/cuadro-medico/provincias/*.json`, `especialidades/*.json`, `doctores-index.json`, `centros-index.json` |
| [create-aem-pages.mjs](../create-aem-pages.mjs) | Crea las páginas plantilla en AEM Author (copy + publish) y refresca EDS. Requiere `AEM_TOKEN`. Flags: `--provincias`, `--especialidades`, `--doctores`, `--centros`, `--all`. | Páginas en AEM + POST a `/preview` y `/live`. |
| [refresh-eds-pages.mjs](../refresh-eds-pages.mjs) | Sólo refresca preview+live en EDS sin tocar AEM. Útil tras cambios de código o plantillas. Flags: `--code`, `--provincias`, `--specs`, `--doctores`, `--centros`, `--especialidades`, `--province=madrid`. Sin flags refresca todo. | POST a `admin.hlx.page/{preview,live,code}` |

**Flujo encadenado:**

```
generate-providers-data.mjs
   ↓ data/providers/
generate-provider-details.mjs
   ↓ data/provider-details/
generate-cuadro-medico-specs.mjs
   ↓ data/cuadro-medico/{provincias,especialidades}/*.json + índices
create-aem-pages.mjs (opcional, primera vez)
   ↓ páginas en AEM
refresh-eds-pages.mjs
   ↓ caché de EDS actualizado
```

**Dónde verlo en vivo:**
- Resultado de `generate-*`: los JSONs commited en el repo, p. ej. [data/cuadro-medico/provincias/madrid.json](../data/cuadro-medico/provincias/madrid.json) o `data/providers/madrid/cardiologia.json`.
- Resultado de `create-aem-pages`: páginas creadas en el AEM Author bajo `/content/site-pc/cuadro-medico/...`. También consultable vía `<ADMIN>/status/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid` (campo `resourcePath`).
- Resultado de `refresh-eds-pages`: la URL pública responde 200 con HTML actualizado: `<LIVE>/cuadro-medico/p/madrid`. Comprobar `Last-Modified` o `<meta property="article:modified_time">`.

---

## 9. GitHub Actions — `.github/workflows/`

| Workflow | Trigger | Función |
|----------|---------|---------|
| [main.yaml](../.github/workflows/main.yaml) | Push a cualquier rama | CI básico: `npm ci` + `npm run lint`. |
| [generate-providers-data.yml](../.github/workflows/generate-providers-data.yml) | Manual (`workflow_dispatch`) con input `force` | Ejecuta `generate-providers-data.mjs`, commitea cambios en `data/`, lanza `refresh-eds-pages.mjs`. Cron diario disponible (`0 1 * * *`) pero **comentado**. |
| [generate-provider-details.yml](../.github/workflows/generate-provider-details.yml) | Manual con input `force` | Ejecuta `generate-provider-details.mjs`. Timeout 360 min (es lento, ~11.000 fetches). Cron comentado (`0 4 * * *`). |

**Dónde verlo en vivo:**
- Estado y ejecuciones: `https://github.com/asisa-softtek/asisa-pc/actions`.
- Cada ejecución que actualiza datos genera un commit auto-firmado tipo `chore: update providers index [skip ci]` → ver historial en `git log -- data/`.

---

## 10. Datos cacheados — `data/`

> **Volúmenes a 2026-05** (medidos sobre el repo actual; crecen con la API de ASISA):

| Path | Contenido | Volumen |
|------|-----------|---------|
| [data/provincias.json](../data/provincias.json) | Catálogo maestro de provincias (name, displayName, slug, provinceCode). | 52 entradas |
| [data/cuadro-medico/especialidades.json](../data/cuadro-medico/especialidades.json) | Master list de especialidades. | 181 entradas |
| [data/cuadro-medico/doctores-index.json](../data/cuadro-medico/doctores-index.json) | Índice slug-doctor → array de ubicaciones (prov, spec, locCode). | ~20.500 keys |
| [data/cuadro-medico/centros-index.json](../data/cuadro-medico/centros-index.json) | Índice slug-centro → array de ubicaciones. | ~6.500 keys |
| `data/cuadro-medico/especialidades/<spec>.json` | Por especialidad: provincias donde se ofrece + count. | ~183 ficheros |
| `data/cuadro-medico/provincias/<prov>.json` | Por provincia: especialidades disponibles + count. | 50 ficheros (Ceuta y Melilla sin datos) |
| `data/providers/<prov>/<spec>.json` | Lista cruda de proveedores por (provincia, especialidad). | ~3.700 ficheros en 52 subdirs |
| `data/provider-details/<locCode>.json` | Detalle por código de localización (tuotempo, idiomas, etc.). | ~33.000 ficheros |

Todos se regeneran desde la API de ASISA con los scripts de §8.

**Cómo inspeccionarlos:**

Estos JSON **no se sirven directos al navegador**: viven en el repo de GitHub y los leen las funciones serverless de Vercel. Para verlos hay tres opciones:

- En GitHub: `https://github.com/asisa-softtek/asisa-pc/tree/main/data`
- Clonando el repo localmente: `cat data/cuadro-medico/provincias/madrid.json | jq`
- Indirectamente vía API (lo que devuelve está derivado de estos JSON):
  ```
  <VERCEL>/api/provincias?slug=madrid         # ≈ provincias/madrid.json + provincias.json
  <VERCEL>/api/especialidades?slug=cardiologia # ≈ especialidades/cardiologia.json
  ```

---

## 11. Lint, formato y herramientas

| Fichero | Función |
|---------|---------|
| [package.json](../package.json) | Manifest. Scripts: `lint:js`, `lint:css`, `lint`, `lint:fix`. DevDeps: ESLint 8 (Airbnb base), Stylelint 17. Sin runtime deps: el código es ESM puro. |
| [package-lock.json](../package-lock.json) | Lockfile de npm. |
| [.eslintrc.js](../.eslintrc.js) | ESLint con Airbnb base + parser Babel. Reglas custom: exigir extensiones `.js` en imports, linebreaks Unix. |
| [.eslintignore](../.eslintignore) | Excluye `scripts/dompurify.min.js` y similares. |
| [.stylelintrc.json](../.stylelintrc.json) | Stylelint estándar. |
| [.editorconfig](../.editorconfig) | JS: 2 espacios; CSS: 4 espacios. |
| [.prettierrc](../.prettierrc) | 100 cols, semicolons, single quotes, trailing commas. |
| [.renovaterc.json](../.renovaterc.json) | Renovate: auto-merge de devDeps, pin de ESLint a v8 (Airbnb no soporta v9). |
| [.gitignore](../.gitignore) | Excluye `.hlx/`, `node_modules/`, `.vercel`, backups. **Incluye** `CLAUDE.md`, `AGENTS.md`. |

---

## 12. Documentación

| Fichero | Función |
|---------|---------|
| [README.md](../README.md) | README estándar del boilerplate Adobe EDS. URLs preview/live. |
| [CONTRIBUTING.md](../CONTRIBUTING.md), [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md), [LICENSE](../LICENSE) | Boilerplate Adobe. |
| [docs/byom.md](./byom.md) | Documento operativo del setup BYOM (3 POSTs, troubleshooting, permisos). Imprescindible para entender el overlay. |
| [docs/estructura-proyecto.md](./estructura-proyecto.md) | Este documento. |

---

## Mapa rápido de qué tocar para tareas frecuentes

| Quiero… | Edito… |
|---------|--------|
| Cambiar el `<head>` global | [head.html](../head.html) + refrescar preview/live |
| Cambiar el comportamiento de búsqueda | [blocks/cuadro-medico/cuadro-medico.js](../blocks/cuadro-medico/cuadro-medico.js) |
| Cambiar la ficha de un médico | [blocks/cuadro-medico-ficha-doctor/cuadro-medico-ficha-doctor.js](../blocks/cuadro-medico-ficha-doctor/cuadro-medico-ficha-doctor.js) |
| Cambiar la plantilla HTML que ve EDS para `/d/<key>` | [api/markup.js](../api/markup.js) |
| Cambiar qué datos sirve la API de doctores | [api/doctor.js](../api/doctor.js) |
| Añadir un sitemap | [api/sitemap-cuadro-medico.js](../api/sitemap-cuadro-medico.js) + [vercel.json](../vercel.json) + [fstab.yaml](../fstab.yaml) |
| Refrescar todas las URLs tras un cambio | `node refresh-eds-pages.mjs` |
| Regenerar los JSON de datos | Workflow `generate-providers-data` → `generate-provider-details` → ejecutar `generate-cuadro-medico-specs.mjs` |
| Registrar un bloque nuevo en el editor | [component-definition.json](../component-definition.json) + [component-filters.json](../component-filters.json) + [component-models.json](../component-models.json) |

---

## Anexo — Tour guiado por la aplicación en vivo

Recorrido recomendado para ver TODAS las piezas funcionando, de mayor a menor abstracción. Sustituir los slugs por valores reales (mirar `data/cuadro-medico/doctores-index.json` y `centros-index.json` para keys válidas).

### A. Lo que ve el usuario final (EDS Live)

```
1. Home del cuadro médico
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico
   → Bloques: cuadro-medico-provincias, cuadro-medico-top-especialidades

2. Listado por provincia
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/p/madrid
   → Bloques: cuadro-medico, cuadro-medico-otras-especialidades, cuadro-medico-otras-provincias

3. Listado por provincia + especialidad (caso de mayor volumen)
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/p/madrid/pe/cardiologia
   → Mismos 3 bloques, ya filtrados

4. Listado nacional por especialidad
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/e/cardiologia
   → cuadro-medico, cuadro-medico-otras-especialidades, cuadro-medico-otras-provincias

5. Ficha de profesional
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/d/<slug-doctor>
   → cuadro-medico-ficha-doctor, cuadro-medico-otros-medicos

6. Ficha de centro
   https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/c/<slug-centro>
   → cuadro-medico-ficha-centro

7. Página inexistente
   https://main--asisa-pc--asisa-softtek.aem.live/no-existe
   → 404 personalizado
```

### B. Capa Vercel — overlay, APIs, proxy

```
1. Overlay BYOM (lo que EDS consume)
   https://asisa-pc.vercel.app/markup/cuadro-medico/p/madrid
   → HTML "vacío" con bloques

2. API de datos (lo que consumen los bloques en runtime)
   https://asisa-pc.vercel.app/api/provincias
   https://asisa-pc.vercel.app/api/especialidades?slug=cardiologia
   https://asisa-pc.vercel.app/api/providers?provinceSlug=madrid&specSlug=cardiologia&tab=professionals
   https://asisa-pc.vercel.app/api/doctor?key=<slug>
   https://asisa-pc.vercel.app/api/centro?key=<slug>

3. Sitemaps generados
   https://asisa-pc.vercel.app/sitemap.xml
   https://asisa-pc.vercel.app/sitemap-cuadro-medico-provincias.xml
   https://asisa-pc.vercel.app/sitemap-cuadro-medico-doctores.xml
   https://asisa-pc.vercel.app/sitemap-cuadro-medico-centros.xml
   https://asisa-pc.vercel.app/sitemap-cuadro-medico-especialidades.xml
   https://asisa-pc.vercel.app/sitemap-cuadro-medico-provincia-specs.xml

4. Proxy a clientlibs de asisa.es
   https://asisa-pc.vercel.app/etc.clientlibs/wasisa/clientlibs/clientlib-generic.min.css
   https://asisa-pc.vercel.app/etc.clientlibs/wasisa/clientlibs/clientlib-iconslib.min.css
   https://asisa-pc.vercel.app/etc.clientlibs/wasisa/clientlibs/clientlib-site.min.css

5. Autocomplete vivo a backend ASISA (proxy + filtrado)
   https://asisa-pc.vercel.app/api/specialities?provinceCode=28
```

### C. Operación (Admin HLX y AEM Author)

> Estos comandos NO necesitan token: el access.json del site tiene `requireAuth: "auto"` y EDS acepta preview / live / code / index / status anónimos. Solo `/config/...` y los scripts que tocan AEM Author (`AEM_TOKEN`) requieren credenciales.

```
1. Estado de una URL (qué fuente la sirve)
   curl https://admin.hlx.page/status/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid

2. Refrescar manualmente preview + live
   curl -X POST https://admin.hlx.page/preview/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid
   curl -X POST https://admin.hlx.page/live/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid

3. Refrescar code bus tras cambio de JS/CSS
   curl -X POST https://admin.hlx.page/code/asisa-softtek/asisa-pc/main

4. Repoblar query indexes tras cambio en helix-query.yaml
   curl -X POST https://admin.hlx.page/index/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid

5. AEM Author (Marketing)
   https://author-p133185-e1320482.adobeaemcloud.com/editor.html/content/site-pc/cuadro-medico/provincia.html

6. Sidekick (toolbar de edición)
   Activar la extensión sobre cualquier URL de preview / live.

7. CI/CD
   https://github.com/asisa-softtek/asisa-pc/actions
```

### D. Verificación rápida "todo funciona"

Cuatro checks en menos de un minuto:

```
✓ <VERCEL>/api/provincias                        → JSON con 50 provincias
✓ <VERCEL>/markup/cuadro-medico/p/madrid         → HTML con bloques
✓ <LIVE>/cuadro-medico/p/madrid                  → página completa renderizada
✓ <ADMIN>/status/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid
                                                  → sourceLocation: "markup:.../api/markup..."
```

Si alguno falla, ir a §10 de [byom.md](byom.md) (Troubleshooting).
