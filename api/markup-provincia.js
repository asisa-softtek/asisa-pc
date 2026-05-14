export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<!DOCTYPE html>
<html>
<head><title>Cuadro Médico por Provincia</title></head>
<body>
<main>
<div>
<div class="cuadro-medico"><div><div></div></div></div>
<div class="cuadro-medico-top-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-provincias"><div><div></div></div></div>
</div>
</main>
</body>
</html>`);
}
