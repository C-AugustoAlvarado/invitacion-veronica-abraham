// Mesa de regalos y botones de copiar.
// 1) Llena las tarjetas de #regalos con CONFIG.regalos. Si un dato viene
//    vacío, la tarjeta conserva su «Por confirmar» (nunca se inventa nada).
// 2) Cualquier botón [data-copiar="texto"] de la página copia ese texto al
//    portapapeles, confirma con «Copiado» y vuelve a su estado a los 2 s.

import { CONFIG } from './config.js';

const SVG = 'http://www.w3.org/2000/svg';
const DURACION_COPIADO = 2000;

let iniciado = false;
let avisos = null;               // región aria-live compartida
const temporizadores = new WeakMap();

/* ── Utilidades ── */
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function crearIcono(clase, trazos, atributos = {}) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (clase) svg.setAttribute('class', clase);
  for (const d of trazos) {
    const trazo = document.createElementNS(SVG, 'path');
    trazo.setAttribute('d', d);
    for (const [nombre, valor] of Object.entries(atributos)) trazo.setAttribute(nombre, valor);
    svg.appendChild(trazo);
  }
  return svg;
}

// Agrupa un dato para leerlo fácil. La CLABE (18 dígitos) se parte en
// banco · plaza · cuenta; los demás números largos, de cuatro en cuatro.
export function agrupar(valor) {
  const texto = String(valor).trim();
  const digitos = texto.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digitos)) return [texto];
  if (digitos.length === 18) {
    return [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 10), digitos.slice(10, 14), digitos.slice(14)];
  }
  if (digitos.length <= 6) return [digitos];
  const grupos = [];
  for (let i = 0; i < digitos.length; i += 4) grupos.push(digitos.slice(i, i + 4));
  // Un último grupo de un solo dígito se lee mal: se une al anterior
  if (grupos.length > 1 && grupos[grupos.length - 1].length === 1) {
    const suelto = grupos.pop();
    grupos[grupos.length - 1] += suelto;
  }
  return grupos;
}

// Lo que va al portapapeles: los números, sin espacios; el texto, tal cual.
function limpiarParaCopiar(valor) {
  const texto = String(valor).trim();
  const digitos = texto.replace(/[\s-]/g, '');
  return /^\d+$/.test(digitos) ? digitos : texto;
}

function esEnlaceSeguro(enlace) {
  return typeof enlace === 'string' && /^https?:\/\//i.test(enlace.trim());
}

/* ── Botón de copiar ── */
export function crearBotonCopiar(texto, descripcion) {
  const boton = crear('button', 'copiar');
  boton.type = 'button';
  boton.dataset.copiar = texto;
  if (descripcion) {
    boton.dataset.copiarNombre = descripcion;
    boton.setAttribute('aria-label', `Copiar ${descripcion}`);
  }
  vestirBoton(boton);
  return boton;
}

// Un botón escrito a mano en el HTML (<button data-copiar="…">Copiar</button>)
// recibe aquí el icono y los dos textos.
function vestirBoton(boton) {
  if (boton.querySelector('.copiar__textos')) return;
  const etiqueta = boton.textContent.trim() || 'Copiar';
  boton.textContent = '';
  boton.classList.add('copiar');
  if (!boton.hasAttribute('type')) boton.type = 'button';

  const icono = crear('span', 'copiar__icono');
  icono.setAttribute('aria-hidden', 'true');
  icono.append(
    crearIcono('copiar__hojas', [
      'M6.300 5.200h7.500c.6 0 1 .4 1 1v8.600c0 .6-.4 1-1 1H6.300c-.6 0-1-.4-1-1V6.200c0-.6.4-1 1-1z',
      'M3.200 12.300V3.300c0-.6.4-1 1-1h7.600'
    ]),
    crearIcono('copiar__palomita', ['M3.400 9.700c1.400 1.200 2.600 2.500 3.700 4 2-4.100 4.500-7.300 7.700-9.900'], { pathLength: '1' })
  );

  const textos = crear('span', 'copiar__textos');
  const accion = crear('span', 'copiar__accion', etiqueta);
  const hecho = crear('span', 'copiar__hecho', 'Copiado');
  hecho.setAttribute('aria-hidden', 'true');
  textos.append(accion, hecho);

  boton.append(icono, textos);
}

function anunciar(mensaje) {
  if (!avisos) {
    avisos = crear('div', 'solo-lectores');
    avisos.setAttribute('role', 'status');
    avisos.setAttribute('aria-live', 'polite');
    avisos.setAttribute('aria-atomic', 'true');
    avisos.dataset.copiarAvisos = '';
    document.body.appendChild(avisos);
  }
  // Se vacía primero para que el lector repita el aviso aunque sea el mismo
  avisos.textContent = '';
  setTimeout(() => { avisos.textContent = mensaje; }, 60);
}

async function escribirEnPortapapeles(texto) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) { /* sin permiso: se intenta el respaldo */ }
  }
  return copiarConRespaldo(texto);
}

// Respaldo para navegadores sin API de portapapeles (o sin permiso)
function copiarConRespaldo(texto) {
  const activo = document.activeElement;
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.tabIndex = -1;
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;';
  document.body.appendChild(area);
  let logrado = false;
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, texto.length);
    logrado = document.execCommand('copy');
  } catch (e) {
    logrado = false;
  }
  area.remove();
  try { activo?.focus?.({ preventScroll: true }); } catch (e) { /* nada */ }
  return logrado;
}

async function alCopiar(boton) {
  const texto = boton.dataset.copiar;
  if (!texto) return;
  vestirBoton(boton);

  const logrado = await escribirEnPortapapeles(texto);
  const nombre = boton.dataset.copiarNombre;

  clearTimeout(temporizadores.get(boton));
  boton.classList.remove('es-copiado', 'es-fallido');

  if (logrado) {
    // Reinicia el dibujo de la palomita si se copia dos veces seguidas
    void boton.offsetWidth;
    boton.classList.add('es-copiado');
    anunciar(nombre ? `Copiado: ${nombre}` : 'Copiado');
  } else {
    boton.classList.add('es-fallido');
    anunciar('No pudimos copiarlo. Mantén presionado el número para copiarlo a mano.');
  }

  temporizadores.set(boton, setTimeout(() => {
    boton.classList.remove('es-copiado', 'es-fallido');
  }, DURACION_COPIADO));
}

function alHacerClic(evento) {
  const boton = evento.target.closest?.('[data-copiar]');
  if (!boton || boton.disabled) return;
  evento.preventDefault();
  alCopiar(boton);
}

/* ── Tarjetas de la mesa de regalos ── */
function llenarRegalos(regalos) {
  const seccion = document.getElementById('regalos');
  if (!seccion || !Array.isArray(regalos)) return;

  for (const regalo of regalos) {
    if (!regalo?.id) continue;
    const tarjeta = seccion.querySelector(`[data-regalo="${CSS.escape(regalo.id)}"]`);
    if (!tarjeta) continue;

    const tienda = tarjeta.querySelector('[data-regalo-tienda]');
    const etiqueta = tarjeta.querySelector('[data-regalo-etiqueta]');
    const dato = tarjeta.querySelector('[data-regalo-dato]');
    const acciones = tarjeta.querySelector('[data-regalo-acciones]');
    if (tienda && regalo.tienda) tienda.textContent = regalo.tienda;
    if (etiqueta && regalo.etiqueta) etiqueta.textContent = regalo.etiqueta;
    if (!dato || !acciones) continue;

    const valor = String(regalo.valor ?? '').trim();
    dato.textContent = '';
    acciones.textContent = '';

    if (!valor) {
      // Pendiente: sin botón de copiar ni datos a medias
      dato.appendChild(crear('p', 'regalo__pendiente', 'Por confirmar'));
      acciones.hidden = true;
      tarjeta.classList.remove('regalo--listo');
      continue;
    }

    tarjeta.classList.add('regalo--listo');

    const grupos = agrupar(valor);
    const parrafo = crear('p', 'regalo__valor');
    // Un dato largo (la CLABE) baja un punto para caber en un solo renglón
    if (grupos.join('').length > 12) parrafo.classList.add('regalo__valor--largo');
    for (const grupo of grupos) parrafo.appendChild(crear('span', 'regalo__grupo', grupo));
    dato.appendChild(parrafo);

    // La transferencia siempre muestra al titular: si falta, se dice («Por confirmar»)
    const titular = String(regalo.titular ?? '').trim() || (regalo.id === 'transferencia' ? 'Por confirmar' : '');
    const detalles = [['Titular', titular], ['Banco', regalo.banco]]
      .filter(([, texto]) => String(texto ?? '').trim());
    if (detalles.length) {
      const lista = crear('dl', 'regalo__detalles');
      for (const [nombre, texto] of detalles) {
        const fila = crear('div', 'regalo__detalle');
        fila.append(crear('dt', '', nombre), crear('dd', '', String(texto).trim()));
        lista.appendChild(fila);
      }
      dato.appendChild(lista);
    }

    const descripcion = `${(regalo.etiqueta || 'dato').toLowerCase() === 'clabe' ? 'CLABE' : (regalo.etiqueta || 'dato').toLowerCase()} de ${regalo.tienda || 'la mesa de regalos'}`;
    acciones.appendChild(crearBotonCopiar(limpiarParaCopiar(valor), descripcion));

    if (esEnlaceSeguro(regalo.enlace)) {
      const enlace = crear('a', 'regalo__enlace');
      enlace.href = regalo.enlace.trim();
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.append(
        crear('span', '', 'Ver mesa'),
        crearIcono('', ['M7.200 4.300H4.300c-.6 0-1 .4-1 1v8.400c0 .6.4 1 1 1h8.400c.6 0 1-.4 1-1v-2.900', 'M10.300 3.300h4.400v4.400', 'M14.500 3.500 8.300 9.700'])
      );
      enlace.appendChild(crear('span', 'solo-lectores', ` de ${regalo.tienda} (se abre en otra pestaña)`));
      acciones.appendChild(enlace);
    }
    acciones.hidden = false;
  }
}

/* ── Las chispas solo titilan con la sección en pantalla y la pestaña visible ── */
function vigilarSeccion(seccion) {
  if (!seccion || seccion.dataset.regalosVigilada) return;
  seccion.dataset.regalosVigilada = '1';
  let enPantalla = false;
  const aplicar = () => seccion.classList.toggle('es-activa', enPantalla && !document.hidden);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
      for (const entrada of entradas) enPantalla = entrada.isIntersecting;
      aplicar();
    }, { rootMargin: '10% 0px 10% 0px' }).observe(seccion);
  }
  document.addEventListener('visibilitychange', aplicar);
}

/* ── Inicio ──
   opciones.regalos: lista que sustituye a CONFIG.regalos (para pruebas). */
export function iniciarCopiar(opciones = {}) {
  llenarRegalos(opciones.regalos || CONFIG.regalos);
  vigilarSeccion(document.getElementById('regalos'));
  document.querySelectorAll('[data-copiar]').forEach(vestirBoton);

  if (!iniciado) {
    iniciado = true;
    // Un solo escucha delegado: también sirve a botones que aparezcan después
    document.addEventListener('click', alHacerClic);
  }
  return { llenarRegalos, crearBotonCopiar, agrupar };
}
