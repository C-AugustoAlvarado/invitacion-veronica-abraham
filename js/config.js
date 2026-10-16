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
    novio: ['Salvador Alvarado Villafuerte', 'Leticia López Ávalos'],
    novia: ['Verónica García Guerrero', 'Félix Calderón Solorio']
  },

  // Texto para compartir el enlace (vista previa en WhatsApp)
  compartir: 'Cuando nos conocimos, entendimos que nos uniría algo más fuerte que el tiempo y la distancia. '
    + 'Hoy damos gracias a Dios por habernos hecho coincidir en el camino y empezar una vida juntos.',

  evento: {
    titulo: 'Boda de Verónica y Abraham',
    inicio: '2027-03-06T16:00:00-06:00',
    fin: '2027-03-07T01:30:00-06:00',
    zona: 'America/Mexico_City',
    lugar: 'Catedral de Morelia, Av. Francisco I. Madero Poniente S/N, Centro Histórico, 58000 Morelia, Michoacán, México',
    detalle: 'Ceremonia: 16:00 hrs en la Catedral de Morelia. '
      + 'Recepción: 17:00 hrs en el Hotel Casa Grande, Portal Matamoros 98, Centro Histórico. '
      + 'Código de vestimenta: etiqueta rigurosa.'
  },

  mapas: {
    ceremonia: 'https://maps.app.goo.gl/AtauCxccpox1PgQT7',   // enlaces que mandaron los novios
    recepcion: 'https://maps.app.goo.gl/oG4wzQVZz8JScBMo7'
  },

  // Confirmación de asistencia: se arma un mensaje de WhatsApp (o correo)
  // que el invitado envía desde su propio teléfono.
  rsvp: {
    whatsapp: '',        // solo dígitos con lada de país, p. ej. '5214431234567'
    correo: '',
    fechaLimite: '',     // texto libre, p. ej. '6 de febrero de 2027'
    maximoPersonas: 6
  },

  regalos: [
    { id: 'palacio', tienda: 'El Palacio de Hierro', etiqueta: 'Número de evento', valor: '406823', enlace: '' },
    { id: 'liverpool', tienda: 'Liverpool', etiqueta: 'Número de evento', valor: '51981696', enlace: '' },
    { id: 'transferencia', tienda: 'Transferencia', etiqueta: 'CLABE', valor: '012180028772723592', titular: '', banco: '' }   // titular y banco: pendientes
  ],

  planner: { nombre: 'Fany Valencia', telefono: '', correo: '', instagram: '' },

  // Fotos de los novios: poner los archivos en assets/fotos/ y llenar `src`.
  // Mientras `src` esté vacío, la galería muestra un marco ilustrado.
  fotos: [
    { src: '', alt: '', pie: 'Donde todo empezó' },
    { src: '', alt: '', pie: 'En caída libre' },
    { src: '', alt: '', pie: 'Chantilly, 16 de junio de 2025' },
    { src: '', alt: '', pie: 'Siempre juntos' },
    { src: '', alt: '', pie: 'Próxima parada: Morelia' }
  ],

  // Música opcional: si hay archivo, aparece el botón de sonido.
  musica: { archivo: '' }
};
