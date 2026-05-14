export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<!DOCTYPE html>
<html>
<head><title>Ficha de Médico</title></head>
<body>
<main>
<div>
<div class="cuadro-medico-ficha-doctor"><div><div></div></div></div>
<div class="cuadro-medico-otros-medicos"><div><div></div></div></div>
<div class="cuadro-medico-spec-localizacion"><div><div></div></div></div>
</div>
</main>
</body>
</html>`);
}
