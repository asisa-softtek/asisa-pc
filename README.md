# asisa-pc — Cuadro Médico de ASISA

Sitio del cuadro médico de ASISA construido sobre **Adobe Edge Delivery Services (EDS) + Vercel** (overlay BYOM).

## Stack
- **AEM Author** (`https://author-p133185-e1320482.adobeaemcloud.com`) — autoría de plantillas y contenido estático
- **EDS / aem.live** — CDN y entrega
- **Vercel** (`https://asisa-pc.vercel.app`) — overlay BYOM: genera el HTML de las URLs dinámicas + endpoints JSON
- **GitHub** (`asisa-softtek/asisa-pc`) — fuente de verdad

## Entornos
- **Preview**: https://main--asisa-pc--asisa-softtek.aem.page
- **Live**: https://main--asisa-pc--asisa-softtek.aem.live

## Documentación
- [docs/traspaso-conocimiento.docx](docs/traspaso-conocimiento.docx) — documento completo de handoff con arquitectura, ejemplos, plan de operación
- [docs/estructura-proyecto.md](docs/estructura-proyecto.md) — referencia fichero a fichero
- [docs/byom.md](docs/byom.md) — setup BYOM operativo (3 POSTs, troubleshooting, permisos)

## Operación rápida
```bash
# Refrescar todo en EDS (no necesita token, requireAuth: auto)
node refresh-eds-pages.mjs

# Solo un tipo
node refresh-eds-pages.mjs --doctores
node refresh-eds-pages.mjs --centros
node refresh-eds-pages.mjs --sitemaps

# Repoblar índices tras cambios en helix-query.yaml
node refresh-eds-pages.mjs --reindex

# Deploy a Vercel
vercel deploy --prod --yes --archive=tgz
```

## Licencia
Apache License 2.0 — heredada del aem-boilerplate de Adobe.
