// Cuenta regresiva hasta CONFIG.evento.inicio. Aparece tras revelar la
// fecha ('raspar:revelado'). Se actualiza una vez por segundo, alineada al
// reloj, y se pausa con la pestaña oculta o fuera de pantalla.

import { CONFIG } from './config.js';

const UNIDADES = [
  { clave: 'dias', singular: 'Día', plural: 'Días' },
  { clave: 'horas', singular: 'Hora', plural: 'Horas' },
  { clave: 'minutos', singular: 'Minuto', plural: 'Minutos' },
  { clave: 'segundos', singular: 'Segundo', plural: 'Segundos' }
];

const MENSAJES = {
  hoy: '¡Hoy es el gran día!',
  despues: 'Gracias por acompañarnos'
};

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function montar(raiz, opciones) {
  raiz.dataset.cuentaListo = '1';
  const inicio = new Date(opciones.inicio || CONFIG.evento.inicio).getTime();
  const fin = new Date(opciones.fin || CONFIG.evento.fin).getTime();
  const ahora = typeof opciones.ahora === 'function' ? opciones.ahora : () => Date.now();
  if (Number.isNaN(inicio)) return { destruir() {} };

  const ambito = raiz.closest('[data-raspar-ambito], section') || document;

  /* ── DOM ── */
  raiz.classList.add('cuenta');
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-label', 'Cuenta regresiva para la boda');
  raiz.textContent = '';

  // Texto para lectores de pantalla: se actualiza cada minuto, sin anunciarse
  const lectura = crear('p', 'solo-lectores');
  // Anuncio puntual: al aparecer y al cambiar de estado, nunca cada segundo
  const anuncio = crear('p', 'solo-lectores');
  anuncio.setAttribute('role', 'status');
  anuncio.setAttribute('aria-live', 'polite');

  const rejilla = crear('div', 'cuenta__rejilla');
  rejilla.setAttribute('aria-hidden', 'true');
  const piezas = UNIDADES.map((unidad, i) => {
    const caja = crear('div', 'cuenta__unidad');
    caja.style.setProperty('--i', i);
    const numero = crear('div', 'cuenta__numero');
    const etiqueta = crear('div', 'cuenta__etiqueta', unidad.plural);
    caja.append(numero, etiqueta);
    rejilla.append(caja);
    return { unidad, numero, etiqueta, digitos: [], texto: '' };
  });

  const mensaje = crear('p', 'cuenta__mensaje');
  mensaje.hidden = true;

  raiz.append(lectura, rejilla, mensaje, anuncio);

  /* ── Estado ── */
  let visible = false;          // ya apareció (tras revelar)
  let enPantalla = true;
  let reloj = 0;
  let estado = '';              // 'cuenta' | 'hoy' | 'despues'
  let ultimoMinuto = '';
  let relojAnuncio = 0;

  function anunciar(texto) {
    clearTimeout(relojAnuncio);
    anuncio.textContent = texto;
    relojAnuncio = setTimeout(() => { anuncio.textContent = ''; }, 6000);
  }

  function ponerNumero(pieza, texto, animar) {
    if (texto === pieza.texto) return;
    const cifras = [...texto];
    // Ajusta la cantidad de casillas (los días pueden tener 1–3 cifras)
    while (pieza.digitos.length < cifras.length) {
      const casilla = crear('span', 'cuenta__digito');
      const cifra = crear('span', 'cuenta__cifra', '');
      casilla.append(cifra);
      pieza.numero.prepend(casilla);
      pieza.digitos.unshift({ casilla, cifra, valor: '' });
    }
    while (pieza.digitos.length > cifras.length) {
      pieza.digitos.shift().casilla.remove();
    }
    cifras.forEach((valor, i) => {
      const d = pieza.digitos[i];
      if (d.valor === valor) return;
      if (animar && d.valor !== '') {
        const sale = d.cifra;
        sale.className = 'cuenta__cifra cuenta__cifra--sale';
        const quitar = () => sale.remove();
        sale.addEventListener('animationend', quitar, { once: true });
        setTimeout(quitar, 900);
        const entra = crear('span', 'cuenta__cifra cuenta__cifra--entra', valor);
        d.casilla.append(entra);
        d.cifra = entra;
      } else {
        d.cifra.textContent = valor;
      }
      d.valor = valor;
    });
    pieza.texto = texto;
  }

  function frase(partes) {
    const trozos = [
      [partes.dias, 'día', 'días'],
      [partes.horas, 'hora', 'horas'],
      [partes.minutos, 'minuto', 'minutos']
    ].filter(([n]) => n > 0).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
    if (!trozos.length) return 'Falta menos de un minuto para la boda.';
    const lista = trozos.length > 1
      ? `${trozos.slice(0, -1).join(', ')} y ${trozos[trozos.length - 1]}`
      : trozos[0];
    const verbo = trozos[0].startsWith('1 ') ? 'Falta' : 'Faltan';
    return `${verbo} ${lista} para la boda.`;
  }

  function cambiarEstado(nuevo) {
    if (nuevo === estado) return false;
    const anterior = estado;
    estado = nuevo;
    if (ambito.dataset) ambito.dataset.cuentaEstado = nuevo;
    const conMensaje = nuevo !== 'cuenta';
    rejilla.hidden = conMensaje;
    mensaje.hidden = !conMensaje;
    if (conMensaje) {
      mensaje.textContent = MENSAJES[nuevo];
      lectura.textContent = '';
      if (visible && anterior) anunciar(MENSAJES[nuevo]);
    }
    return true;
  }

  function pintar(animar) {
    const t = ahora();
    const falta = inicio - t;

    if (falta <= 0) {
      cambiarEstado(t <= fin ? 'hoy' : 'despues');
      return estado;
    }
    cambiarEstado('cuenta');

    const total = Math.floor(falta / 1000);
    const partes = {
      dias: Math.floor(total / 86400),
      horas: Math.floor((total % 86400) / 3600),
      minutos: Math.floor((total % 3600) / 60),
      segundos: total % 60
    };
    for (const pieza of piezas) {
      const n = partes[pieza.unidad.clave];
      ponerNumero(pieza, String(n).padStart(2, '0'), animar);
      const rotulo = n === 1 ? pieza.unidad.singular : pieza.unidad.plural;
      if (pieza.etiqueta.textContent !== rotulo) pieza.etiqueta.textContent = rotulo;
    }

    const minuto = `${partes.dias}:${partes.horas}:${partes.minutos}`;
    if (minuto !== ultimoMinuto) {
      ultimoMinuto = minuto;
      lectura.textContent = frase(partes);
    }
    return estado;
  }

  /* ── Reloj: un tic por segundo, alineado al cambio de segundo ── */
  function activo() { return visible && enPantalla && !document.hidden; }

  function programar() {
    clearTimeout(reloj);
    reloj = 0;
    if (!activo() || estado === 'despues') return;
    const espera = 1000 - (ahora() % 1000) + 8;
    reloj = setTimeout(() => { pintar(true); programar(); }, espera);
  }

  function reanudar() {
    if (!activo()) { clearTimeout(reloj); reloj = 0; return; }
    pintar(false);            // al volver no se anima: solo se pone al día
    programar();
  }

  function aparecer() {
    if (visible) return;
    visible = true;
    pintar(false);
    // Un cuadro de espera para que la transición de entrada sí ocurra
    requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.add('cuenta--visible')));
    anunciar(estado === 'cuenta' ? lectura.textContent : MENSAJES[estado]);
    programar();
  }

  /* ── Observadores y eventos ── */
  const observador = new IntersectionObserver(([entrada]) => {
    enPantalla = entrada.isIntersecting;
    reanudar();
  }, { rootMargin: '10% 0px 10% 0px' });
  observador.observe(raiz);

  const alCambiarVisibilidad = () => reanudar();
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  document.addEventListener('raspar:revelado', aparecer);

  pintar(false);

  // Si no hay tarjeta para raspar, o ya se reveló, aparece de una vez
  const tarjeta = ambito.querySelector('[data-raspar]');
  const yaRevelada = ambito.dataset?.rasparEstado === 'revelado';
  if (!tarjeta || yaRevelada || opciones.visible) aparecer();

  return {
    aparecer,
    destruir() {
      clearTimeout(reloj);
      clearTimeout(relojAnuncio);
      observador.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      document.removeEventListener('raspar:revelado', aparecer);
    }
  };
}

export function iniciarCuenta(opciones = {}) {
  const raices = [...document.querySelectorAll('[data-cuenta]')]
    .filter((el) => !el.dataset.cuentaListo);
  const controles = raices.map((raiz) => montar(raiz, opciones));
  return {
    aparecer() { controles.forEach((c) => c.aparecer?.()); },
    destruir() { controles.forEach((c) => c.destruir()); }
  };
}
