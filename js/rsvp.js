// Confirmación de asistencia.
// El sitio es estático: no hay servidor que reciba el formulario. Se arma un
// mensaje cálido y se abre WhatsApp (o el correo) para que el invitado lo
// envíe desde su propio teléfono. Si todavía no hay teléfono ni correo en
// CONFIG.rsvp, el formulario se puede llenar y avisa que pronto estará listo.

import { CONFIG } from './config.js';

const AVISO_PENDIENTE = 'Muy pronto podrás confirmar por aquí. ¡Gracias por tu cariño!';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

function fechaDelEvento() {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.evento.zona
    }).format(new Date(CONFIG.evento.inicio));
  } catch (e) {
    return '';
  }
}

function primerNombre(nombre) {
  return nombre.trim().split(/\s+/)[0] || '';
}

// «josé luis de la o» → «José Luis de la O»: solo se corrige la inicial de
// cada palabra; lo demás se respeta tal como lo escribió el invitado.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'van', 'von']);
function cuidarNombre(nombre) {
  return nombre.split(' ').map((palabra, i, todas) => {
    const enMedio = i > 0 && i < todas.length - 1;
    if (enMedio && PARTICULAS.has(palabra.toLowerCase())) return palabra.toLowerCase();
    return palabra.charAt(0).toLocaleUpperCase('es-MX') + palabra.slice(1);
  }).join(' ');
}

// Mensaje que el invitado enviará. Texto plano, sin datos inventados.
export function armarMensaje({ nombre, asiste, personas, mensaje }) {
  const { ella, el } = CONFIG.novios;
  const fecha = fechaDelEvento();
  const cuando = fecha ? `, el ${fecha} en Morelia` : '';
  const lineas = [`¡Hola! Soy ${nombre}.`];

  if (asiste) {
    lineas.push(`Con mucho gusto confirmo mi asistencia a la boda de ${ella} y ${el}${cuando}.`);
    lineas.push(personas > 1 ? `Asistiremos ${personas} personas.` : 'Asistiré yo (1 persona).');
  } else {
    lineas.push(`Con mucha pena les aviso que no podré acompañarlos en la boda de ${ella} y ${el}${cuando}.`);
    lineas.push('Les mando un abrazo enorme y todo mi cariño en un día tan especial.');
  }
  if (mensaje) lineas.push(`Mensaje para los novios: «${mensaje}»`);
  if (asiste) lineas.push('¡Nos vemos muy pronto!');

  return lineas.join('\n\n');
}

// Destino del mensaje según lo que haya en la configuración
function armarDestino(rsvp, texto) {
  const telefono = String(rsvp.whatsapp ?? '').replace(/\D/g, '');
  if (telefono) {
    return {
      medio: 'whatsapp',
      url: `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
    };
  }
  const correo = String(rsvp.correo ?? '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    const asunto = `Confirmación de asistencia — Boda de ${CONFIG.novios.ella} y ${CONFIG.novios.el}`;
    return {
      medio: 'correo',
      url: `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`
    };
  }
  return null;
}

/* ── Inicio ──
   opciones.rsvp: valores que sustituyen a los de CONFIG.rsvp (para pruebas). */
export function iniciarRsvp(opciones = {}) {
  const seccion = document.getElementById('rsvp');
  const formulario = (seccion || document).querySelector('[data-rsvp-formulario]');
  if (!formulario) return null;
  if (formulario._rsvp) return formulario._rsvp;

  const rsvp = { ...CONFIG.rsvp, ...(opciones.rsvp || {}) };
  const maximo = Math.max(1, parseInt(rsvp.maximoPersonas, 10) || 1);
  const ambito = seccion || document;
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

  const tarjeta = ambito.querySelector('[data-rsvp-tarjeta]') || formulario.parentElement;
  const gracias = ambito.querySelector('[data-rsvp-gracias]');
  const aviso = formulario.querySelector('[data-rsvp-aviso]');
  const campoNombre = formulario.elements.namedItem('nombre');
  const campoMensaje = formulario.elements.namedItem('mensaje');
  const radios = [...formulario.querySelectorAll('input[name="asiste"]')];
  const grupoAsiste = formulario.querySelector('[data-rsvp-campo="asiste"]');
  const bloquePersonas = formulario.querySelector('[data-rsvp-personas]');
  const botonMenos = formulario.querySelector('[data-rsvp-menos]');
  const botonMas = formulario.querySelector('[data-rsvp-mas]');
  const numero = formulario.querySelector('[data-rsvp-numero]');
  const cuentaTexto = formulario.querySelector('[data-rsvp-cuenta-texto]');
  const valorPersonas = formulario.querySelector('[data-rsvp-personas-valor]');

  let personas = 1;

  /* ── Fecha límite ── */
  const limite = ambito.querySelector('[data-rsvp-limite]');
  const fechaLimite = String(rsvp.fechaLimite ?? '').trim();
  if (limite) {
    const hueco = limite.querySelector('[data-rsvp-fecha]');
    if (fechaLimite && hueco) hueco.textContent = fechaLimite;
    limite.hidden = !fechaLimite;
  }

  /* ── Número de personas ── */
  function pintarPersonas(direccion) {
    if (numero) {
      numero.textContent = String(personas);
      if (direccion) {
        numero.classList.remove('es-sube', 'es-baja');
        void numero.offsetWidth;
        numero.classList.add(direccion > 0 ? 'es-sube' : 'es-baja');
      }
    }
    if (cuentaTexto) cuentaTexto.textContent = personas === 1 ? '1 persona' : `${personas} personas`;
    if (valorPersonas) valorPersonas.value = String(personas);
    if (botonMenos) botonMenos.disabled = personas <= 1;
    if (botonMas) botonMas.disabled = personas >= maximo;
  }
  function cambiarPersonas(paso) {
    const nuevo = limitar(personas + paso, 1, maximo);
    if (nuevo === personas) return;
    personas = nuevo;
    pintarPersonas(paso);
  }
  botonMenos?.addEventListener('click', () => cambiarPersonas(-1));
  botonMas?.addEventListener('click', () => cambiarPersonas(1));

  function asistencia() {
    const elegido = radios.find((radio) => radio.checked);
    return elegido ? elegido.value : '';
  }
  function alElegirAsistencia() {
    const asiste = asistencia() === 'si';
    if (bloquePersonas) bloquePersonas.hidden = !(asiste && maximo > 1);
    limpiarError('asiste');
    limpiarAviso();
  }
  radios.forEach((radio) => radio.addEventListener('change', alElegirAsistencia));

  /* ── Validación ── */
  function elementoDeError(campo) {
    return formulario.querySelector(`[data-rsvp-error="${campo}"]`);
  }
  function marcarError(campo, texto) {
    const error = elementoDeError(campo);
    if (error) error.textContent = texto;
    if (campo === 'nombre') campoNombre?.setAttribute('aria-invalid', 'true');
    if (campo === 'asiste') grupoAsiste?.setAttribute('aria-invalid', 'true');
  }
  function limpiarError(campo) {
    const error = elementoDeError(campo);
    if (error) error.textContent = '';
    if (campo === 'nombre') campoNombre?.removeAttribute('aria-invalid');
    if (campo === 'asiste') grupoAsiste?.removeAttribute('aria-invalid');
  }
  function limpiarAviso() {
    if (aviso) aviso.textContent = '';
  }

  function validar() {
    let primero = null;
    const nombre = (campoNombre?.value || '').replace(/\s+/g, ' ').trim();

    if (!nombre) {
      marcarError('nombre', 'Cuéntanos tu nombre para saber quién nos acompaña.');
      primero = primero || campoNombre;
    } else if (nombre.length < 3 || !/\p{L}/u.test(nombre)) {
      marcarError('nombre', 'Escribe tu nombre completo, por favor.');
      primero = primero || campoNombre;
    } else {
      limpiarError('nombre');
    }

    if (!asistencia()) {
      marcarError('asiste', 'Elige una opción para saber si podrás acompañarnos.');
      primero = primero || radios[0];
    } else {
      limpiarError('asiste');
    }

    if (primero) {
      primero.focus({ preventScroll: true });
      acercar(primero.closest('[data-rsvp-campo]') || primero);
      return null;
    }
    const asiste = asistencia() === 'si';
    return {
      nombre: cuidarNombre(nombre),
      asiste,
      personas: asiste ? personas : 0,
      mensaje: (campoMensaje?.value || '').replace(/\s+/g, ' ').trim()
    };
  }

  campoNombre?.addEventListener('input', () => {
    if (campoNombre.getAttribute('aria-invalid') === 'true') limpiarError('nombre');
    limpiarAviso();
  });
  campoMensaje?.addEventListener('input', limpiarAviso);

  // Lleva un elemento a la vista solo si quedó fuera (respuesta a una acción
  // del invitado, nunca durante el scroll).
  function acercar(el) {
    if (!el) return;
    const caja = el.getBoundingClientRect();
    const fuera = caja.top < 70 || caja.bottom > window.innerHeight - 30;
    if (!fuera) return false;
    // Una tarjeta más alta que la ventana se alinea arriba; lo demás, al centro
    const bloque = caja.height > window.innerHeight - 100 ? 'start' : 'center';
    el.scrollIntoView({ block: bloque, behavior: reducido.matches ? 'auto' : 'smooth' });
    return true;
  }

  /* ── Envío ── */
  function abrir(destino) {
    try {
      if (destino.medio === 'correo') {
        // Un enlace de verdad: el navegador abre la aplicación de correo
        const enlace = document.createElement('a');
        enlace.href = destino.url;
        enlace.hidden = true;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        return;
      }
      const ventana = window.open(destino.url, '_blank');
      if (ventana) { try { ventana.opener = null; } catch (e) { /* nada */ } }
      else window.location.href = destino.url;
    } catch (e) {
      // Si el navegador bloquea la ventana, queda el enlace del agradecimiento
    }
  }

  function lanzarPetalos(asiste) {
    const caja = tarjeta.getBoundingClientRect();
    document.dispatchEvent(new CustomEvent('petalos:rafaga', {
      detail: {
        x: limitar(caja.left + caja.width / 2, 0, window.innerWidth),
        y: limitar(caja.top + caja.height / 2, 0, window.innerHeight),
        cantidad: asiste ? 46 : 18,
        fuerza: asiste ? 1 : 0.6
      }
    }));
  }

  function mostrarGracias(datos, destino) {
    const nombre = primerNombre(datos.nombre);
    const titulo = gracias.querySelector('[data-rsvp-gracias-titulo]');
    const texto = gracias.querySelector('[data-rsvp-gracias-texto]');
    const paso = gracias.querySelector('[data-rsvp-gracias-paso]');
    const enlace = gracias.querySelector('[data-rsvp-abrir]');

    if (datos.asiste) {
      titulo.textContent = `¡Gracias, ${nombre}!`;
      texto.textContent = datos.personas > 1
        ? `Nos hace muy felices saber que nos acompañarán. Los esperamos a los ${datos.personas} con los brazos abiertos.`
        : 'Nos hace muy felices saber que nos acompañarás. Te esperamos con los brazos abiertos.';
    } else {
      titulo.textContent = `Gracias por avisarnos, ${nombre}`;
      texto.textContent = 'Te vamos a extrañar mucho. Tu cariño nos acompañará ese día, y ya habrá ocasión de brindar juntos.';
    }

    const enWhatsApp = destino.medio === 'whatsapp';
    if (paso) {
      paso.textContent = enWhatsApp
        ? 'Solo falta un paso: envía el mensaje que dejamos listo para ti en WhatsApp.'
        : 'Solo falta un paso: envía el correo que dejamos listo para ti.';
    }
    if (enlace) {
      enlace.href = destino.url;
      enlace.textContent = enWhatsApp ? 'Abrir WhatsApp' : 'Abrir mi correo';
      if (enWhatsApp) { enlace.target = '_blank'; enlace.rel = 'noopener noreferrer'; }
      else { enlace.removeAttribute('target'); enlace.removeAttribute('rel'); }
      enlace.hidden = false;
    }

    const cambiar = () => {
      formulario.classList.remove('es-saliendo');
      formulario.hidden = true;
      gracias.hidden = false;
      tarjeta.classList.add('es-enviada');
      gracias.focus({ preventScroll: true });
      // La ráfaga sale cuando la tarjeta ya llegó a su sitio
      const huboViaje = acercar(tarjeta);
      setTimeout(() => lanzarPetalos(datos.asiste), huboViaje && !reducido.matches ? 700 : 60);
    };

    if (reducido.matches) { cambiar(); return; }
    formulario.classList.add('es-saliendo');
    setTimeout(cambiar, 380);
  }

  // Seguro contra el doble toque: solo se activa cuando de verdad se abre el destino
  let enviando = false;

  function alEnviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    limpiarAviso();
    const datos = validar();
    if (!datos) return;

    const destino = armarDestino(rsvp, armarMensaje(datos));
    if (!destino) {
      // Aún no hay teléfono ni correo: se avisa con cariño y no se envía nada
      if (aviso) {
        aviso.textContent = AVISO_PENDIENTE;
        acercar(aviso);
      }
      return;
    }

    enviando = true;
    abrir(destino);
    mostrarGracias(datos, destino);
    document.dispatchEvent(new CustomEvent('rsvp:enviado', { detail: { asiste: datos.asiste } }));
  }
  formulario.addEventListener('submit', alEnviar);

  /* ── Volver al formulario ── */
  gracias?.querySelector('[data-rsvp-editar]')?.addEventListener('click', () => {
    enviando = false;
    gracias.hidden = true;
    formulario.hidden = false;
    tarjeta.classList.remove('es-enviada');
    campoNombre?.focus({ preventScroll: true });
    acercar(tarjeta);
  });

  /* ── Las chispas solo titilan con la sección en pantalla y la pestaña visible ── */
  if (seccion) {
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

  pintarPersonas(0);
  alElegirAsistencia();

  // El formulario ya responde: se muestra en lugar del enlace directo (css/rsvp.css)
  (seccion || formulario.closest('section'))?.classList.add('es-funcional');

  formulario._rsvp = { armarMensaje, validar };
  return formulario._rsvp;
}
