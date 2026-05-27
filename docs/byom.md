
# BYOM (Bring Your Own Markup) en asisa-pc

> Documento operativo para el equipo de Softtek.
> Cubre el por qué, el cómo y los callejones sin salida que hemos pisado al
> conectar AEM Author + EDS + Vercel para servir URLs dinámicas del
> Cuadro Médico.

---

## 1. Resumen

El Cuadro Médico tiene URLs dinámicas:

| Patrón | Significado | Volumen aprox. |
|--------|-------------|----------------|
| `/cuadro-medico/p/<provincia>` | Listado de médicos en una provincia | ~50 |
| `/cuadro-medico/p/<provincia>/pe/<especialidad>` | Filtrado por especialidad en la provincia | ~50 × 180 ≈ 9 000 |
| `/cuadro-medico/d/<slug-doctor>-<providerCode>` | Ficha de un profesional | ~11 000 |
| `/cuadro-medico/e/<especialidad>` | Listado por especialidad (todas las provincias) | ~180 |

Crear una página de AEM Author por cada URL es inviable. En lugar de eso
usamos **BYOM**: EDS sirve HTML procedente de una API en Vercel
(`https://asisa-pc.vercel.app/markup`) y solo guarda **plantillas** en
AEM (`/cuadro-medico/provincia`, `/cuadro-medico/doctor`,
`/cuadro-medico/especialidad`).

EDS hace de capa intermedia: cachea el preview/live, sirve `aem.live`
desde su CDN, y los bloques JS leen `window.location.pathname` para
pintar el contenido específico de cada URL.

---

## 2. Arquitectura

```
                                                      ┌─────────────────────────────────┐
                                                      │ AEM Author                      │
                                                      │ /content/site-pc/...            │
                                                      │ (plantillas + páginas estáticas)│
                                                      └────────────┬────────────────────┘
                                                                   │ primary source
                                                                   ▼
 Usuario ──► main--asisa-pc--asisa-softtek.aem.live ──► EDS preview/live cache
                                                                   ▲
                                                                   │ overlay (BYOM)
                                                      ┌────────────┴────────────────────┐
                                                      │ Vercel /api/markup              │
                                                      │  /cuadro-medico/p|d|e/* → HTML  │
                                                      │  resto                 → 404    │
                                                      └─────────────────────────────────┘

 En cliente, una vez cargado el HTML:

   Bloques JS (asisa-pc.vercel.app/blocks/*.js servidos por EDS)
        │
        └─► fetch CORS a https://asisa-pc.vercel.app/api/{providers,doctor,...}
                                       │
                                       └─► lee data/providers/<prov>/<spec>.json (repo)
```

Piezas:

- **AEM Author** — solo guarda las **plantillas** (`/cuadro-medico/provincia`,
  `/cuadro-medico/doctor`, `/cuadro-medico/especialidad`) y el contenido
  no dinámico (home, landings, fragmentos). EDS extrae markup vía
  `/bin/franklin.delivery/asisa-softtek/asisa-pc/main/<path>.html`.
- **EDS (admin.hlx.page + aem.live + aem.page)** — orquesta. Tiene un
  config service propio que define `content.source` (AEM) y
  `content.overlay` (Vercel). Cachea preview y live.
- **Vercel (`asisa-pc.vercel.app`)** —
  - `/api/markup` devuelve plantillas HTML para `/cuadro-medico/p|d|e/*`
    y **404 para todo lo demás** (así EDS hace fallback a AEM).
  - `/api/providers`, `/api/doctor`, `/api/provincias`,
    `/api/especialidades`, `/api/specialities`, `/api/providers-detail`
    leen los JSONs de `data/` y los exponen a los bloques.
- **GitHub `asisa-softtek/asisa-pc`** — fuente de verdad para
  `fstab.yaml`, `helix-sitemap.yaml`, `helix-query.yaml`, `scripts/`,
  `blocks/`, `styles/` y los datos cacheados de `data/`.

---

## 3. Setup inicial (one-time, técnica de las 3 POSTs)

> Esto se hace **una vez por entorno**. Si todo está OK, **no hace falta
> repetirlo**. Se necesita el token de la cuenta técnica (ver §8).

Las tres rutas:

1. `POST /config/asisa-softtek/sites/asisa-pc.json` — sitewide
2. `POST /config/asisa-softtek/sites/asisa-pc/public.json` — mappings de rutas
3. `POST /config/asisa-softtek/sites/asisa-pc/access.json` — roles

### 3.1 Sitewide (BYOM overlay sobre AEM)

```bash
TOKEN='<token-techacct>'   # ver §8

curl -X POST \
  --url https://admin.hlx.page/config/asisa-softtek/sites/asisa-pc.json \
  --header 'Content-Type: application/json' \
  --header "x-auth-token: $TOKEN" \
  --data '{
    "code": {
      "owner": "asisa-softtek",
      "repo": "asisa-pc",
      "source": { "type": "github", "url": "https://github.com/asisa-softtek/asisa-pc" }
    },
    "content": {
      "source": {
        "url": "https://author-p133185-e1320482.adobeaemcloud.com/bin/franklin.delivery/asisa-softtek/asisa-pc/main",
        "type": "markup",
        "suffix": ".html"
      },
      "overlay": {
        "url": "https://asisa-pc.vercel.app/markup",
        "type": "markup"
      }
    }
  }'
```

Qué hace: para CADA request, EDS pide primero a `overlay`. Si devuelve
200, lo usa. Si devuelve 404, va al `source` (AEM).

### 3.2 Public (mappings de rutas dinámicas)

```bash
curl -X POST \
  --url https://admin.hlx.page/config/asisa-softtek/sites/asisa-pc/public.json \
  --header 'Content-Type: application/json' \
  --header "x-auth-token: $TOKEN" \
  --data '{
    "paths": {
      "mappings": [
        "/content/site-pc/:/",
        "/content/site-pc/configuration:/.helix/config.json",
        "/cuadro-medico/p/*:/cuadro-medico/provincia",
        "/cuadro-medico/d/*:/cuadro-medico/doctor",
        "/cuadro-medico/e/*:/cuadro-medico/especialidad"
      ],
      "includes": ["/content/site-pc/"]
    }
  }'
```

Qué hace: cuando EDS busca el **fallback en AEM** para una URL dinámica
que el overlay devolvió 404, sabe qué plantilla AEM cargar. P.ej. si
overlay devuelve 404 para `/cuadro-medico/p/madrid` (caso raro porque el
overlay ya cubre ese patrón), EDS pediría `/cuadro-medico/provincia` a
AEM. Es la red de seguridad.

### 3.3 Access (roles)

```bash
curl -X POST \
  --url https://admin.hlx.page/config/asisa-softtek/sites/asisa-pc/access.json \
  --header 'Content-Type: application/json' \
  --header "x-auth-token: $TOKEN" \
  --data '{
    "admin": {
      "role": {
        "admin": [
          "jorge.lorenzo@ext.softtek.com"
        ],
        "config_admin": [
          "662F1E56661D006D0A495E33@techacct.adobe.com",
          "jorge.lorenzo@ext.softtek.com"
        ]
      },
      "requireAuth": "auto"
    }
  }'
```

Qué hace: `admin` puede previewar / publicar / editar contenido.
`config_admin` puede **además** modificar estos 3 endpoints. Sin
`config_admin`, todos los `POST /config/...` devuelven 401.

### 3.4 Verificación rápida

```bash
curl https://admin.hlx.page/status/asisa-softtek/asisa-pc/main/cuadro-medico/p/madrid
```

Debe devolver, tras un preview, `"sourceLocation": "markup:https://asisa-pc.vercel.app/markup/cuadro-medico/p/madrid"`.
Si devuelve `markup:https://author-...` significa que el overlay NO está
aplicado (revisar §10 troubleshooting).

---

## 4. Cómo funciona en runtime

Cuando alguien entra a `https://main--asisa-pc--asisa-softtek.aem.live/cuadro-medico/p/madrid`:

1. **CDN de EDS** comprueba si ya tiene `/cuadro-medico/p/madrid.md` en el
   *content bus* live. Si sí, lo sirve. Si no, la URL devuelve 404.
2. Para meterlo en el content bus, alguien tuvo que hacer
   `POST /preview/.../cuadro-medico/p/madrid` y luego
   `POST /live/.../cuadro-medico/p/madrid`. En ese preview:
   1. EDS consulta el **overlay** primero:
      `GET https://asisa-pc.vercel.app/markup/cuadro-medico/p/madrid`
   2. Vercel responde 200 con el HTML de plantilla.
   3. EDS guarda ese HTML como markup de la página, lo procesa
      (extrae bloques, secciones), y lo deja listo para servir.
3. Cuando el navegador del usuario recibe el HTML procesado, ejecuta los
   `scripts/aem.js` y `scripts/scripts.js`. Estos detectan los bloques
   `class="cuadro-medico"`, `class="cuadro-medico-otras-especialidades"`,
   etc., y cargan el JS y CSS de cada bloque desde el mismo origen
   (`/blocks/<nombre>/<nombre>.js`).
4. El JS del bloque lee `window.location.pathname`, extrae los slugs y
   hace fetch a `https://asisa-pc.vercel.app/api/*` para traer los datos.

---

## 5. El endpoint Vercel `/markup`

Archivo: [`api/markup.js`](../api/markup.js).
Rewrite en [`vercel.json`](../vercel.json): `/markup/(.*) → /api/markup?path=$1`.

Lógica:

```javascript
if (/^\/cuadro-medico\/p\/.+$/.test(path))  → PROVINCIA_TEMPLATE
if (/^\/cuadro-medico\/d\/.+$/.test(path))  → DOCTOR_TEMPLATE
if (/^\/cuadro-medico\/e\/.+$/.test(path))  → ESPECIALIDAD_TEMPLATE
else                                         → 404 'no overlay for {path}'
```

Cada template devuelve un HTML mínimo con:

- `<link rel="stylesheet">` a `/styles/*.css` y a las clientlibs de
  ASISA (`https://www.asisa.es/etc.clientlibs/wasisa/...`).
- `<script type="module" src="/scripts/aem.js">` + `scripts.js`.
- Un `<main>` con divs vacíos cuyas clases coinciden con los bloques EDS
  (`cuadro-medico`, `cuadro-medico-otras-especialidades`, etc.).
- Un `<script>` inline con `history.replaceState({}, '', '<path>')` para
  que los bloques vean el path real cuando se prueba el markup directo
  en `asisa-pc.vercel.app/markup/...` (en EDS, el path ya es correcto).

Patrones HTML actuales:

| Patrón URL | Bloques |
|------------|---------|
| `/cuadro-medico/p/*` | `cuadro-medico`, `cuadro-medico-otras-especialidades`, `cuadro-medico-otras-provincias` |
| `/cuadro-medico/d/*` | `cuadro-medico-ficha-doctor`, `cuadro-medico-otros-medicos` |
| `/cuadro-medico/c/*` | `cuadro-medico-ficha-centro` |
| `/cuadro-medico/e/*` | `cuadro-medico`, `cuadro-medico-otras-especialidades`, `cuadro-medico-otras-provincias` |

**Importante:** los bloques deben estar registrados en
[`component-definition.json`](../component-definition.json),
[`component-models.json`](../component-models.json) y
[`component-filters.json`](../component-filters.json) para que el
Universal Editor los reconozca.

---

## 6. Bloques EDS y la regla de oro

### 6.1 Estructura mínima

Cada bloque vive en `blocks/<nombre>/`. Ejemplo para
`cuadro-medico-otras-especialidades`:

```
blocks/cuadro-medico-otras-especialidades/
├── cuadro-medico-otras-especialidades.js   # export default function decorate(block) {...}
└── cuadro-medico-otras-especialidades.css  # estilos del bloque
```

EDS los carga automáticamente cuando detecta `<div class="cuadro-medico-otras-especialidades">` en el DOM.

### 6.2 Regla de oro: fetchs absolutos a Vercel

Cuando EDS sirve la página desde `aem.live`, las llamadas relativas
`fetch('/api/...')` apuntarían a `main--asisa-pc--asisa-softtek.aem.live`
(que no tiene endpoints). **Hay que usar URL absoluta de Vercel**:

```javascript
// ✗ MAL — falla en aem.live
fetch('/api/provincias?slug=madrid')

// ✓ BIEN — funciona en cualquier origen (CORS está habilitado en /api/*)
fetch('https://asisa-pc.vercel.app/api/provincias?slug=madrid')
```

Las APIs de Vercel envían `Access-Control-Allow-Origin: *`.

### 6.3 Leer URL en lugar de datos AEM

Bloques diseñados para BYOM no esperan filas pre-rellenadas en el DOM.
Leen `window.location.pathname` y fetchean:

```javascript
function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug: peIdx !== -1 ? parts[peIdx + 1] : null,
  };
}

export default async function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!provSlug) { block.hidden = true; return; }
  // ...
}
```

El bloque `cuadro-medico` ([`blocks/cuadro-medico/cuadro-medico.js`](../blocks/cuadro-medico/cuadro-medico.js))
hace además **doble modo**: si encuentra filas pre-rellenadas usa esas
(modo AEM autor clásico); si no, fetchea por URL (modo BYOM).

### 6.4 Estilos: variables CSS de ASISA

Los CSS de los bloques usan variables (`--color-acento-azul-oscuro-500`,
`--font-size-base`, `--spacing-xl`...) definidas en las clientlibs de
asisa.es. Si la página se renderiza sin esas clientlibs, las variables
no tienen valor y la página sale "en blanco" (sin colores, tamaños ni
espaciado). El endpoint `/api/markup` ya las incluye en el `<head>`.

---

## 7. Publicar contenido en EDS

Tres "buses" en EDS:

| Bus | Qué guarda | Cómo se refresca |
|-----|------------|------------------|
| **code** | Ficheros del repo (`.js`, `.css`, `fstab.yaml`...) | `POST /code/asisa-softtek/asisa-pc/main[/<path>]` |
| **preview** | Markup pre-procesado de cada URL | `POST /preview/asisa-softtek/asisa-pc/main/<path>` |
| **live** | Markup público (CDN) | `POST /live/asisa-softtek/asisa-pc/main/<path>` |

### 7.1 Flujos típicos

| Tras cambiar... | Qué refrescar |
|----------------|---------------|
| JS o CSS de un bloque, ficheros en `scripts/`, `styles/`, `data/` | `POST /code` (basta una vez para todo el repo) |
| `fstab.yaml` | `POST /code/.../fstab.yaml` |
| Plantilla del endpoint `/api/markup` | `POST /preview` + `POST /live` para CADA URL afectada (porque EDS cachea el HTML resultante) |
| Datos en AEM autor (`/cuadro-medico/provincia`) | `POST /preview` + `POST /live` del path AEM |

### 7.2 Script de refresco masivo

[`refresh-eds-pages.mjs`](../refresh-eds-pages.mjs) recorre los JSON de
`data/provincias.json`, `data/cuadro-medico/doctores-index.json`, etc. y
dispara preview + live para cada URL. Flags:

```bash
node refresh-eds-pages.mjs --provincias            # solo /cuadro-medico/p/*
node refresh-eds-pages.mjs --doctores              # solo /cuadro-medico/d/*
node refresh-eds-pages.mjs --especialidades        # solo /cuadro-medico/e/*
node refresh-eds-pages.mjs                         # todo
node refresh-eds-pages.mjs --code                  # solo /code (refresh del repo)
node refresh-eds-pages.mjs --province=madrid       # acotar a una provincia
```

No requiere token si las URLs son de bus público (caso actual; con
`requireAuth: "auto"` el preview/live anónimo funciona).

---

## 8. Permisos (admin vs config_admin)

EDS distingue dos roles **en el access.json del site**:

| Rol | Puede |
|-----|-------|
| `admin` | preview, publish, code refresh, leer status, sidekick |
| `config_admin` | TODO lo de admin **+ modificar `/config/.../*.json`** |

Tu cuenta personal (`jorge.lorenzo@ext.softtek.com` /
`284B22876891DB480A495C5D@AdobeID`) está en `admin`. La cuenta técnica
`662F1E56661D006D0A495E33@techacct.adobe.com` está en `config_admin`.

### 8.1 Cómo conseguir el token de techacct

1. Entrar en https://developer.adobe.com/console con la cuenta Adobe
   del partner / organización dueña de `asisa-softtek`.
2. Localizar el proyecto que tiene credenciales "AEM Edge Delivery
   Services" o "Adobe Helix Admin API". El `technical account` ID debe
   coincidir con `662F1E56661D006D0A495E33@techacct.adobe.com`.
3. Sección Credentials → OAuth Server-to-Server (o JWT legacy). Bajar:
   - `client_id`
   - `client_secret`
   - `technical_account_id`
   - `organization_id` (IMS org)
   - Si es JWT: `private_key.key`
4. Intercambiar por un access_token contra Adobe IMS. Snippet Node:

   ```javascript
   // npm i jsonwebtoken node-fetch
   import jwt from 'jsonwebtoken';
   import fetch from 'node-fetch';
   import { readFileSync } from 'fs';

   const payload = {
     exp: Math.floor(Date.now() / 1000) + 60 * 60,
     iss: process.env.IMS_ORG_ID,
     sub: process.env.TECH_ACCOUNT_ID,
     'https://ims-na1.adobelogin.com/s/ent_adobeio_sdk': true,
     aud: `https://ims-na1.adobelogin.com/c/${process.env.CLIENT_ID}`,
   };
   const privateKey = readFileSync('./private.key', 'utf8');
   const jwtToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

   const r = await fetch('https://ims-na1.adobelogin.com/ims/exchange/jwt', {
     method: 'POST',
     headers: { 'content-type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
       client_id: process.env.CLIENT_ID,
       client_secret: process.env.CLIENT_SECRET,
       jwt_token: jwtToken,
     }),
   });
   const { access_token } = await r.json();
   console.log(access_token);  // úsalo como x-auth-token
   ```

5. El `access_token` vale durante 24h. Si automatizas, mete el script
   en un GitHub Actions secret.

### 8.2 Atajo (sin techacct)

Si solo necesitas **previewar / publicar** (no tocar config), tu cookie
del navegador en `admin.hlx.page` (logueado con
`jorge.lorenzo@ext.softtek.com`) basta. Sirve para POST a
`/preview`, `/live`, `/code` y para leer `/status` y `/profile`.

---

## 9. Datos: dónde viven y cómo se actualizan

```
data/
├── provincias.json                          # 50 provincias
├── cuadro-medico/
│   ├── doctores-index.json                  # ~11 000 keys de doctor
│   ├── especialidades/                      # 1 json por especialidad
│   └── provincias/                          # 1 json por provincia (lista de specs disponibles)
├── providers/
│   └── <prov-slug>/
│       └── <spec-slug>.json                 # lista de proveedores por prov+spec
└── provider-details/
    └── <providerLocalicationCode>.json      # detalle por localización (tuotempo, etc.)
```

Actualización: GitHub Actions en `.github/workflows/` regenera estos
ficheros desde la API de ASISA. Tras un push, hace falta
`POST /code/.../*` (o esperar al hook automático) para que EDS reciba
los datos nuevos. **Los bloques fetchean en runtime**, así que basta
con que el repo esté al día.

---

## 10. Troubleshooting (los callejones que pisamos)

### 10.1 `fstab.yaml` con BYOM sub-path no aplica

**Síntoma:** añadiste `/cuadro-medico/p: { url: ..., type: markup }` al
`fstab.yaml` y EDS sigue resolviendo a la URL de AEM (error 401 con
`html2md`).

**Causa:** una vez que el site tiene `content.source` configurado en el
**config service** (caso actual), los sub-mounts de fstab.yaml se
ignoran. Los docs de aem.live lo dicen: *"a file based setup via
fstab.yaml is not supported"* para overlays.

**Solución:** usar `content.overlay` en `/config/.../asisa-pc.json` (§3.1).

### 10.2 `GET /profile/{org}/{site}` devuelve 401 aunque estás logueado

**Síntoma:** `https://admin.hlx.page/profile` 200, pero
`https://admin.hlx.page/profile/asisa-softtek/asisa-pc` 401.

**Causa:** tu cookie es del login **global** de admin.hlx.page, no del
site. EDS distingue.

**Solución:** entrar primero a
`https://admin.hlx.page/login/asisa-softtek/asisa-pc/main` en el
navegador. Eso completa el SSO con Adobe IMS para ese site específico
y refresca la cookie. Después `/profile/...` debería responder 200.

### 10.3 `POST /config/.../*.json` devuelve 401 aunque eres admin

**Síntoma:** Token válido para preview/code, pero config 401.

**Causa:** tu usuario está en `admin` pero no en `config_admin`.

**Solución:** ver §8 — necesitas el token de la cuenta técnica para
modificar config. Una vez añadido al `config_admin` en `access.json`,
podrás usar tu propia cookie.

### 10.4 La página se ve "en blanco" o sin estilos

**Síntoma:** los bloques cargan datos correctos, pero todo aparece sin
colores ni espaciado.

**Causa:** faltan las clientlibs de asisa.es. Los CSS de los bloques
usan variables (`var(--color-...)`) definidas en
`https://www.asisa.es/etc.clientlibs/wasisa/clientlibs/clientlib-*.min.css`.

**Solución:** asegurar que `api/markup.js` inyecta los `<link>` a esas
clientlibs en el `<head>` (ya lo hace, no quitarlo).

### 10.5 Los bloques muestran "No se pudieron cargar los datos"

**Síntoma:** en `aem.live` los bloques no traen datos; en
`asisa-pc.vercel.app/markup/...` sí.

**Causa:** el bloque usa `fetch('/api/...')` (relativa). En aem.live
eso apunta a `aem.live/api/...` que no existe.

**Solución:** usar `fetch('https://asisa-pc.vercel.app/api/...')` (URL
absoluta a Vercel). Ver §6.2.

### 10.6 Cambias el template en `/api/markup` y EDS sigue sirviendo el viejo

**Síntoma:** modificas la plantilla HTML que devuelve `api/markup.js`,
deployas a Vercel, pero `aem.live` sigue mostrando lo de antes.

**Causa:** EDS cachea el preview/live. Solo refetchea desde el overlay
cuando se hace un nuevo `POST /preview`.

**Solución:**
```bash
curl -X POST https://admin.hlx.page/preview/asisa-softtek/asisa-pc/main/<path>
curl -X POST https://admin.hlx.page/live/asisa-softtek/asisa-pc/main/<path>
```
Para todas las URLs afectadas. Usar `refresh-eds-pages.mjs` para masivo.

### 10.7 Después de cambiar JS/CSS de un bloque no se ve el cambio

**Síntoma:** push a GitHub, pero el navegador sigue sirviendo el JS
viejo.

**Causa:** EDS tiene su propio cache del code bus.

**Solución:** `POST /code/asisa-softtek/asisa-pc/main` (refresca todo) o
limitado al path: `POST /code/.../blocks/cuadro-medico/cuadro-medico.js`.

### 10.8 Preview devuelve "AEM_BACKEND_FETCH_FAILED 401"

**Síntoma:** al previewar una URL de cuadro-medico, error de
autenticación contra AEM Author.

**Causa:** EDS está intentando ir al primary source (AEM) en lugar del
overlay (Vercel). Indica que `content.overlay` no está configurado o
que el path no matchea ningún patrón cubierto por el overlay y `mappings`
en `public.json` apunta a un fichero AEM que no existe.

**Solución:** comprobar `content.overlay` en sidewide config y mappings
en public.json. Si `/api/markup` devuelve 200 para ese path, EDS debería
elegirlo antes de tocar AEM.

---

## 11. Apéndice — referencias

- BYOM oficial: https://www.aem.live/developer/byom
- Admin API: https://www.aem.live/docs/admin.html
- API keys: https://www.aem.live/docs/admin-apikeys
- Sidekick: https://www.aem.live/tools/sidekick/
- Adobe Developer Console (techacct): https://developer.adobe.com/console
- Config actual del site (lectura pública):
  - https://admin.hlx.page/sidekick/asisa-softtek/asisa-pc/main/config.json
- Status de cualquier path: `GET /status/asisa-softtek/asisa-pc/main/<path>`
- Editor de AEM Author: https://author-p133185-e1320482.adobeaemcloud.com
