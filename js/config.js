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

  // Fotos de los novios: poner los archivos en assets/fotos/ y llenar `src`.
  // Mientras `src` esté vacío, la galería muestra un marco ilustrado.
  fotos: [
    // Fotos que mandaron los novios el 22-oct-2026 (recortadas a 4:5). Cada una tiene su AVIF
    // (640 px), su JPEG de respaldo (448 px) y, cuando exista, su versión «trazo» (dibujo a lápiz
    // precalculado: <nombre>-trazo.avif/.jpg) que se muestra primero; al tocar aparece la foto.
    // Los pies son PROPUESTA: solo lugares evidentes, sin fechas inventadas.
    { src: 'assets/fotos/01-juntos.jpg', avif: 'assets/fotos/01-juntos.avif', alt: 'Verónica y Abraham sonriendo, muy juntos', pie: 'Juntos' },
    { src: 'assets/fotos/02-morelia.jpg', avif: 'assets/fotos/02-morelia.avif', alt: 'Caminando abrazados por una calzada arbolada', pie: 'De paseo' },
    { src: 'assets/fotos/03-espana.jpg', avif: 'assets/fotos/03-espana.avif', alt: 'Sentados en una banca de azulejos en España', pie: 'España' },
    { src: 'assets/fotos/04-paris.jpg', avif: 'assets/fotos/04-paris.avif', alt: 'Frente al Louvre, en París', pie: 'París' },
    { src: 'assets/fotos/05-arco.jpg', avif: 'assets/fotos/05-arco.avif', alt: 'Un beso frente al Arco del Triunfo', pie: 'Arco del Triunfo' },
    { src: 'assets/fotos/06-eiffel.jpg', avif: 'assets/fotos/06-eiffel.avif', alt: 'Bajo la Torre Eiffel', pie: 'Torre Eiffel' },
    { src: 'assets/fotos/07-risas.jpg', avif: 'assets/fotos/07-risas.avif', alt: 'Riendo juntos en una cena', pie: 'Entre risas' },
    { src: 'assets/fotos/08-navidad.jpg', avif: 'assets/fotos/08-navidad.avif', alt: 'Junto al árbol de Navidad, ella muestra el anillo', pie: 'Navidad' }
  ],

  // Música opcional: si hay archivo, aparece el botón de sonido.
  musica: { archivo: '' }
};
