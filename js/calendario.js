




import { CONFIG } from './config.js';

const NOMBRE_ARCHIVO = 'boda-veronica-y-abraham.ics';


export function aUtc(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}


export function escaparIcs(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}



export function plegarLinea(linea) {
  const codificador = new TextEncoder();
  const trozos = [];
  let actual = '';
  let octetos = 0;
  for (const caracter of linea) {
    const peso = codificador.encode(caracter).length;
    const limite = trozos.length ? 74 : 75;
    if (octetos + peso > limite) {
      trozos.push(actual);
      actual = '';
      octetos = 0;
    }
    actual += caracter;
    octetos += peso;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

export function crearIcs(evento, opciones = {}) {
  const inicio = aUtc(evento.inicio);
  const fin = aUtc(evento.fin);
  const pagina = opciones.pagina || '';
  const detalle = pagina ? `${evento.detalle}\n\nInvitación: ${pagina}` : evento.detalle;
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Veronica y Abraham//Invitacion de boda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:boda-veronica-abraham-${inicio}@invitacion`,
    `DTSTAMP:${aUtc(opciones.sello || new Date())}`,
    `DTSTART:${inicio}`,
    `DTEND:${fin}`,
    `SUMMARY:${escaparIcs(evento.titulo)}`,
    `DESCRIPTION:${escaparIcs(detalle)}`,
    `LOCATION:${escaparIcs(evento.lugar)}`,
    pagina ? `URL:${pagina}` : '',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escaparIcs(`En una semana: ${evento.titulo}`)}`,
    'TRIGGER:-P7D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);
  return lineas.map(plegarLinea).join('\r\n') + '\r\n';
}

export function crearUrlGoogle(evento, opciones = {}) {
  const pagina = opciones.pagina || '';
  const detalle = pagina ? `${evento.detalle}\n\nInvitación: ${pagina}` : evento.detalle;
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.titulo,
    dates: `${aUtc(evento.inicio)}/${aUtc(evento.fin)}`,
    ctz: evento.zona,
    details: detalle,
    location: evento.lugar
  });
  return `https://calendar.google.com/calendar/render?${parametros.toString()}`;
}

function detectarDispositivo() {
  const ua = navigator.userAgent || '';
  const esIos = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const esMac = /Macintosh/.test(ua) && !esIos;




  const esSafariIos = esIos
    && /Version\/\d/.test(ua) && /Safari\//.test(ua)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|LinkedInApp|Snapchat|musical_ly|Bytedance|Twitter|DuckDuckGo/.test(ua);
  return { esIos, esMac, esSafariIos, esApple: esIos || esMac };
}

function montar(raiz, opciones) {
  raiz.dataset.calendarioListo = '1';
  const evento = { ...CONFIG.evento, ...(opciones.evento || {}) };
  const principal = raiz.querySelector('[data-calendario-principal]');
  const enlaceGoogle = raiz.querySelector('[data-calendario-google]');
  const enlaceIcs = raiz.querySelector('[data-calendario-ics]');
  const aviso = raiz.querySelector('[data-calendario-aviso]');


  const pagina = opciones.pagina
    ?? (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : '');

  const urlGoogle = crearUrlGoogle(evento, { pagina });
  let urlArchivo = '';
  let relojAviso = 0;

  function avisar(texto) {
    if (!aviso) return;
    clearTimeout(relojAviso);
    aviso.textContent = texto;
    relojAviso = setTimeout(() => { aviso.textContent = ''; }, 7000);
  }

  function descargarIcs() {
    if (detectarDispositivo().esIos) {



      window.location.href = new URL(`../assets/${NOMBRE_ARCHIVO}`, import.meta.url).href;
      avisar('Si no se abrió tu calendario, usa la opción de Google Calendar.');
      return;
    }
    const ics = crearIcs(evento, { pagina });
    if (urlArchivo) URL.revokeObjectURL(urlArchivo);
    urlArchivo = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = urlArchivo;
    a.download = NOMBRE_ARCHIVO;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    avisar('Descargamos el evento: ábrelo para guardarlo en tu calendario.');
  }

  function abrirGoogle() {
    let ventana = null;
    try { ventana = window.open(urlGoogle, '_blank'); } catch (e) {   }
    if (ventana) {
      try { ventana.opener = null; } catch (e) {   }
      avisar('Abrimos Google Calendar en otra pestaña.');
    } else {

      window.location.href = urlGoogle;
    }
  }

  if (enlaceGoogle) {
    enlaceGoogle.href = urlGoogle;
    enlaceGoogle.target = '_blank';
    enlaceGoogle.rel = 'noopener';
    enlaceGoogle.setAttribute('aria-label', 'Agregar a Google Calendar (se abre en otra pestaña)');
    enlaceGoogle.addEventListener('click', () => avisar('Abrimos Google Calendar en otra pestaña.'));
  }
  if (enlaceIcs) {

    enlaceIcs.setAttribute('aria-label', 'Apple / Outlook: descargar el evento (.ics)');
    enlaceIcs.addEventListener('click', (e) => { e.preventDefault(); descargarIcs(); });
  }
  if (principal) {

    principal.href = urlGoogle;
    principal.setAttribute('role', 'button');
    principal.addEventListener('click', (e) => {
      e.preventDefault();

      const d = detectarDispositivo();
      if (d.esMac || d.esSafariIos) descargarIcs();
      else abrirGoogle();
    });
    principal.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); principal.click(); }
    });
  }

  return {
    urlGoogle,
    ics: () => crearIcs(evento, { pagina }),
    destruir() {
      clearTimeout(relojAviso);
      if (urlArchivo) URL.revokeObjectURL(urlArchivo);
    }
  };
}

export function iniciarCalendario(opciones = {}) {
  const raices = [...document.querySelectorAll('[data-calendario]')]
    .filter((el) => !el.dataset.calendarioListo);
  const controles = raices.map((raiz) => montar(raiz, opciones));
  return {
    urlGoogle: controles[0]?.urlGoogle || '',
    ics: () => controles[0]?.ics() || '',
    destruir() { controles.forEach((c) => c.destruir()); }
  };
}
