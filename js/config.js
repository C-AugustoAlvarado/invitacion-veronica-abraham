// Datos del evento. Todo lo que puede cambiar vive aquí.
// Los valores vacíos ('') están pendientes de confirmar con los novios:
// la página muestra «Por confirmar» en su lugar y nunca inventa un dato.

export const CONFIG = {
  // Dirección pública de la invitación, con diagonal al final. Se usa para la
  // vista previa al compartir el enlace (WhatsApp exige dirección completa).
  // Al cambiar de dominio: editar aquí y correr «npm run publicar».
  sitio: 'https://c-augustoalvarado.github.io/invitacion-veronica-abraham/',

  novios: { ella: 'Verónica', el: 'Abraham', monograma: 'A&V' },

  padres: {
    novio: ['Leticia López Ávalos', 'Salvador Alvarado Villafuerte'],   // Abraham pidió a su mamá primero
    novia: ['Verónica García Guerrero', 'Félix Calderón Solorio']
  },

  // Texto para compartir el enlace (vista previa en WhatsApp)
  compartir: 'Cuando nos conocimos, entendimos que nos uniría algo más fuerte que el tiempo y la distancia. '
    + 'Hoy damos gracias a Dios por habernos hecho coincidir en el camino y empezar una vida juntos.',

  evento: {
    titulo: 'Boda de Verónica y Abraham',
    inicio: '2027-03-06T16:00:00-06:00',
    fin: '2027-03-07T02:00:00-06:00',
    zona: 'America/Mexico_City',
    lugar: 'Catedral de Morelia, Av. Francisco I. Madero Poniente S/N, Centro Histórico, 58000 Morelia, Michoacán, México',
    detalle: 'Ceremonia: 16:00 hrs en la Catedral de Morelia. '
      + 'Recepción: 17:00 hrs en el Hotel Casa Grande, Portal Matamoros 98, Centro Histórico. '
      + 'Código de vestimenta: formal.'
  },

  mapas: {
    ceremonia: 'https://maps.app.goo.gl/AtauCxccpox1PgQT7',   // enlaces que mandaron los novios
    recepcion: 'https://maps.app.goo.gl/oG4wzQVZz8JScBMo7'
  },

  // Confirmación de asistencia: se arma un mensaje de WhatsApp (o correo)
  // que el invitado envía desde su propio teléfono.
  rsvp: {
    whatsapp: '524433010331',   // WhatsApp de la wedding planner (+52 443 301 0331), confirmado el 22-oct-2026; solo dígitos con lada de país
    correo: '',
    fechaLimite: '',     // texto libre, p. ej. '6 de febrero de 2027'
    maximoPersonas: 6
  },

  regalos: [
    { id: 'palacio', tienda: 'El Palacio de Hierro', etiqueta: 'Número de evento', valor: '406823', enlace: '' },
    { id: 'transferencia', tienda: 'BBVA', etiqueta: 'CLABE', valor: '012180028772723592', titular: 'Abraham Alvarado López', banco: '' }   // confirmado el 21-oct-2026
  ],

  planner: { nombre: 'Fany Valencia', telefono: '524433010331', correo: '', instagram: '' },   // +52 443 301 0331

  // Valet parking: costo y horario en texto libre (p. ej. '$150 · de 16:00 a 2:00'); vacío = «Por confirmar»
  valet: { detalle: '' },

  // Acuarelas de los novios (una por foto): ver src/historia.html y README. La página solo
  // lee `pie` (data-config="fotos.N.pie", en el mismo orden que los <li> del carrusel);
  // `acuarela`, `respaldo` y `alt` quedan como referencia de lo que lleva escrito cada polaroid.
  fotos: [
    // Acuarelas que mandaron los novios el 24-oct-2026, hechas sobre los recortes 4:5 de sus
    // fotos (originales en Cambios/Acuarelas/ y Cambios/FotosCompartidas/). La página solo
    // muestra la acuarela, en el carrusel de src/historia.html (AVIF 446 px + JPEG de respaldo).
    // España no mandó la suya y quedó fuera. Los pies son PROPUESTA: solo lugares evidentes.
    { acuarela: 'assets/fotos/01-juntos-acuarela.avif', respaldo: 'assets/fotos/01-juntos-acuarela.jpg', alt: 'Verónica y Abraham sonriendo, muy juntos', pie: 'Juntos' },
    { acuarela: 'assets/fotos/02-morelia-acuarela.avif', respaldo: 'assets/fotos/02-morelia-acuarela.jpg', alt: 'Caminando abrazados por una calzada arbolada', pie: 'De paseo' },
    { acuarela: 'assets/fotos/04-paris-acuarela.avif', respaldo: 'assets/fotos/04-paris-acuarela.jpg', alt: 'Frente al Louvre, en París', pie: 'París' },
    { acuarela: 'assets/fotos/05-arco-acuarela.avif', respaldo: 'assets/fotos/05-arco-acuarela.jpg', alt: 'Un beso frente al Arco del Triunfo', pie: 'Arco del Triunfo' },
    { acuarela: 'assets/fotos/06-eiffel-acuarela.avif', respaldo: 'assets/fotos/06-eiffel-acuarela.jpg', alt: 'Bajo la Torre Eiffel', pie: 'Torre Eiffel' },
    { acuarela: 'assets/fotos/07-risas-acuarela.avif', respaldo: 'assets/fotos/07-risas-acuarela.jpg', alt: 'Riendo juntos en una cena', pie: 'Entre risas' },
    { acuarela: 'assets/fotos/08-navidad-acuarela.avif', respaldo: 'assets/fotos/08-navidad-acuarela.jpg', alt: 'Junto al árbol de Navidad, ella muestra el anillo', pie: 'Navidad' }
  ],

  // Música opcional: si hay archivo, aparece el botón de sonido.
  musica: { archivo: '' }
};
