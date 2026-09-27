// Datos del evento. Todo lo que puede cambiar vive aquí.
// Los valores vacíos ('') están pendientes de confirmar con los novios:
// la página muestra «Por confirmar» en su lugar y nunca inventa un dato.

export const CONFIG = {
  // Dirección pública de la invitación, con diagonal al final. Se usa para la
  // vista previa al compartir el enlace (WhatsApp exige dirección completa).
  // Al cambiar de dominio: editar aquí y correr «npm run publicar».
  sitio: 'https://c-augustoalvarado.github.io/invitacion-veronica-abraham/',

  novios: { ella: 'Verónica', el: 'Abraham', monograma: 'A&V' },

  evento: {
    titulo: 'Boda de Verónica y Abraham',
    inicio: '2027-03-06T16:00:00-06:00',
    fin: '2027-03-07T02:00:00-06:00',
    zona: 'America/Mexico_City',
    lugar: 'Catedral de Morelia, Av. Francisco I. Madero Poniente S/N, Centro Histórico, 58000 Morelia, Michoacán, México',
    detalle: 'Ceremonia religiosa: 4:00 p.m. en la Catedral de Morelia. '
      + 'Recepción: Hotel Boutique Casa Grande, Portal Matamoros 98, Centro Histórico. '
      + 'Código de vestimenta: etiqueta rigurosa.'
  },

  mapas: {
    ceremonia: 'https://www.google.com/maps/search/?api=1&query=Catedral%20de%20Morelia%2C%20Morelia%2C%20Michoac%C3%A1n',
    recepcion: 'https://www.google.com/maps/search/?api=1&query=Hotel%20Casa%20Grande%2C%20Portal%20Matamoros%2098%2C%20Morelia'
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
    { id: 'palacio', tienda: 'El Palacio de Hierro', etiqueta: 'Número de evento', valor: '', enlace: '' },
    { id: 'liverpool', tienda: 'Liverpool', etiqueta: 'Número de evento', valor: '', enlace: '' },
    { id: 'transferencia', tienda: 'Transferencia', etiqueta: 'CLABE', valor: '', titular: '', banco: '' }
  ],

  planner: { nombre: 'Fany Valencia', telefono: '', correo: '', instagram: '' },

  // Fotos de los novios: poner los archivos en assets/fotos/ y llenar `src`.
  // Mientras `src` esté vacío, la galería muestra un marco ilustrado.
  fotos: [
    { src: '', alt: '', pie: 'Donde todo empezó' },
    { src: '', alt: '', pie: 'Un salto a la aventura' },
    { src: '', alt: '', pie: 'Chantilly, 16 de junio de 2025' },
    { src: '', alt: '', pie: 'Siempre juntos' },
    { src: '', alt: '', pie: 'Próxima parada: Morelia' }
  ],

  // Música opcional: si hay archivo, aparece el botón de sonido.
  musica: { archivo: '' }
};
