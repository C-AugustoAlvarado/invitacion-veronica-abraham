// Arranque de la invitación. Cada módulo se carga por separado: si uno
// falla, los demás siguen y la página nunca se queda trabada.
import { CONFIG } from './config.js';
import { iniciarMotor } from './motor.js';

async function cargar(ruta, funcion, ...args) {
  try {
    const modulo = await import(ruta);
    if (typeof modulo[funcion] !== 'function') throw new Error(`${ruta} no exporta ${funcion}`);
    return await modulo[funcion](...args);
  } catch (error) {
    console.error(`[invitación] no se pudo iniciar ${funcion}:`, error);
    return null;
  }
}

const leer = (ruta) => ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), CONFIG);

/* ── Datos de config.js que van a la página ── */
function aplicarDatos() {
  document.querySelectorAll('[data-enlace]').forEach((el) => {
    const url = leer(el.dataset.enlace);
    if (url) el.href = url;
  });
  document.querySelectorAll('[data-config]').forEach((el) => {
    const texto = leer(el.dataset.config);
    if (texto) el.textContent = texto;
  });

  // Foto de «Nuestra historia» (opcional): sustituye la escena ilustrada
  const foto = document.querySelector('[data-foto="historia"]');
  if (foto && CONFIG.historia?.foto) {
    foto.src = CONFIG.historia.foto;
    foto.alt = CONFIG.historia.alt || 'Verónica y Abraham';
    foto.hidden = false;
    foto.closest('.historia__cielo')?.classList.add('con-foto');
    foto.closest('figure')?.removeAttribute('aria-hidden');
  }

  // Contacto de la wedding planner
  const medios = document.querySelector('[data-planner]');
  if (medios) {
    const p = CONFIG.planner || {};
    const botones = [];
    const soloDigitos = (p.telefono || '').replace(/\D/g, '');
    if (soloDigitos) {
      botones.push(`<a class="boton boton--lleno" href="https://wa.me/${soloDigitos}" target="_blank" rel="noopener">WhatsApp</a>`);
      botones.push(`<a class="boton boton--linea" href="tel:+${soloDigitos}">Llamar</a>`);
    }
    if (p.correo) botones.push(`<a class="boton boton--linea" href="mailto:${encodeURIComponent(p.correo).replace('%40', '@')}">Correo</a>`);
    if (p.instagram) {
      const usuario = p.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      botones.push(`<a class="boton boton--linea" href="https://www.instagram.com/${encodeURIComponent(usuario)}/" target="_blank" rel="noopener">Instagram</a>`);
    }
    if (botones.length) medios.innerHTML = botones.join('');
  }
}

/* ── Anclas internas: desplazamiento suave sin secuestrar el scroll ── */
function enlacesInternos() {
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (evento) => {
    if (evento.defaultPrevented) return;
    const enlace = evento.target.closest('a[href^="#"]');
    if (!enlace) return;
    const destino = document.getElementById(enlace.getAttribute('href').slice(1));
    if (!destino) return;
    evento.preventDefault();
    destino.scrollIntoView({ behavior: reducido.matches ? 'auto' : 'smooth', block: 'start' });
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  });
}

/* Recuerdos de la pestaña (sessionStorage): al recargar, o al volver de Maps a una
   pestaña que el teléfono descartó, no se repite el sobre ni el raspadito.
   En modo privado el almacén puede fallar: entonces simplemente no se recuerda. */
const CLAVE_ABIERTA = 'boda:abierta';
const CLAVE_FECHA = 'boda:fecha-revelada';
const recordar = (clave) => {
  try { window.sessionStorage.setItem(clave, '1'); } catch (error) { /* modo privado */ }
};
const recordado = (clave) => {
  try { return window.sessionStorage.getItem(clave) === '1'; } catch (error) { return false; }
};

/* Si la tarjeta para raspar no pudo montarse (o la fecha ya se raspó en esta pestaña),
   la fecha ya se lee: se da por revelada para que aparezcan la cuenta regresiva y el
   calendario. */
function revelarSinRaspar() {
  const tarjeta = document.querySelector('[data-raspar]');
  const ambito = tarjeta?.closest('[data-raspar-ambito], section');
  if (!ambito || ambito.dataset.rasparEstado === 'revelado') return;
  ambito.dataset.rasparEstado = 'revelado';
  tarjeta.classList.add('raspar--revelada');
  const boton = ambito.querySelector('[data-raspar-boton]');
  if (boton) boton.hidden = true;
  document.dispatchEvent(new CustomEvent('raspar:revelado'));
}

/* Modo básico: lo decide el script en línea de <head> (navegador que no puede con la
   experiencia completa, o ?basico), o se llega a él porque el seguro ya mostró la página
   o el motor falló. Sin sobre, sin motor, sin pétalos ni raspadito: el invitado quizá ya
   está leyendo y no se vuelve a ocultar nada. Solo se activa lo que sirve para algo. */
async function iniciarBasico() {
  clearTimeout(window.__seguro);
  if (typeof window.__basico === 'function') window.__basico();
  else {
    document.documentElement.classList.remove('js');
    document.body.classList.remove('bloqueado');
    document.getElementById('sobre')?.remove();
  }
  const [, , rsvp] = await Promise.all([
    cargar('./calendario.js', 'iniciarCalendario'),
    cargar('./copiar.js', 'iniciarCopiar'),
    cargar('./rsvp.js', 'iniciarRsvp')
  ]);
  if (rsvp) document.documentElement.classList.add('funcional');
}

async function iniciar() {
  // Un dato mal escrito en config.js no debe impedir que la página se libere
  try { aplicarDatos(); } catch (error) { console.error('[invitación] no se pudieron aplicar los datos:', error); }
  try { enlacesInternos(); } catch (error) { console.error('[invitación] no se pudieron preparar los enlaces:', error); }

  if (window.__liberado || document.documentElement.classList.contains('basico')) return iniciarBasico();

  // El motor prepara todo, pero los revelados esperan a que se abra el sobre.
  // Si el motor falla, la página pasa a modo básico y todo queda visible.
  let motor;
  try {
    motor = iniciarMotor({ revelarAlIniciar: false });
  } catch (error) {
    console.error('[invitación] no se pudo iniciar el motor:', error);
    return iniciarBasico();
  }

  const sobre = document.getElementById('sobre');
  // Se omite el sobre con ?abierta o si ya se abrió en esta pestaña
  const omitir = new URLSearchParams(location.search).has('abierta')
    || window.__omitir === true || recordado(CLAVE_ABIERTA);

  // Al abrir el sobre la página se coloca ya con el alto final: en la sección
  // del ancla (#rsvp, #fecha…) si la URL trae una, y si no en la portada.
  // Sin sobre no se toca nada: el navegador ya restauró la posición.
  const colocar = () => {
    if (omitir) return;
    let destino = null;
    try {
      if (location.hash.length > 1) destino = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch (error) { /* ancla mal escrita: portada */ }
    const y = destino ? Math.max(0, Math.round(destino.getBoundingClientRect().top + window.pageYOffset)) : 0;
    if (Math.abs(window.pageYOffset - y) < 2) return;
    const raiz = document.documentElement;
    const previo = raiz.style.scrollBehavior;
    raiz.style.scrollBehavior = 'auto';   // html tiene scroll-behavior: smooth
    window.scrollTo(0, y);
    raiz.style.scrollBehavior = previo;
  };

  let abierto = false;
  const alAbrir = () => {
    if (abierto) return;
    abierto = true;
    clearTimeout(window.__seguro);
    recordar(CLAVE_ABIERTA);
    document.body.classList.remove('bloqueado');
    colocar();
    document.getElementById('portada')?.classList.add('es-abierta');
    motor.activarRevelados();
    motor.medir();
  };
  document.addEventListener('sobre:abierto', alAbrir, { once: true });

  // El sobre sirve si está montado, cubre la pantalla y su sello se puede tocar
  let control = null;
  const sobreSirve = () => {
    if (!control || !sobre || !sobre.isConnected) return false;
    // Ventana sin medidas (pestaña que carga en segundo plano): no se puede comprobar
    if (window.innerWidth < 50 || window.innerHeight < 50) return true;
    const caja = sobre.getBoundingClientRect();
    const sello = sobre.querySelector('.sobre__sello');
    const c = sello ? sello.getBoundingClientRect() : null;
    const tocado = c && c.width > 0
      ? document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) : null;
    return caja.width >= window.innerWidth * 0.9 && caja.height >= window.innerHeight * 0.5
      && !!tocado && sobre.contains(tocado);
  };
  // La invitación se muestra sin sobre. destruir() devuelve la página sin emitir el
  // evento, así que se emite aquí: «la invitación ya es visible» (DISENO.md §4).
  const abrirSinSobre = () => {
    if (control && typeof control.destruir === 'function') control.destruir();
    if (sobre && sobre.isConnected) sobre.remove();
    document.dispatchEvent(new CustomEvent('sobre:abierto'));
    alAbrir();
  };

  // Desde aquí main.js responde por la página: el seguro, el botón «Ver la invitación»
  // de la pantalla de espera y el aviso de error del <head> llegan a esta función.
  // Un sobre sano no se toca (lo abre el invitado); uno que no sirve se retira solo.
  let avisarLimite = () => {};
  const limite = new Promise((resolver) => { avisarLimite = resolver; });
  window.__liberar = () => {
    if (abierto) return;
    if (sobreSirve()) { clearTimeout(window.__seguro); return; }
    abrirSinSobre();
    avisarLimite(null);
  };
  clearTimeout(window.__seguro);

  cargar('./petalos.js', 'iniciarPetalos');

  // Con el sobre puesto la página espera en la portada (ancla en la URL o
  // posición restaurada). Sin animación: html tiene scroll-behavior: smooth.
  const alInicio = () => {
    if (abierto || omitir || !sobre || window.scrollY === 0) return;
    const raiz = document.documentElement;
    const previo = raiz.style.scrollBehavior;
    raiz.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    raiz.style.scrollBehavior = previo;
  };
  alInicio();
  window.addEventListener('load', alInicio, { once: true });

  if (sobre && !omitir) {
    // Si sobre.js se queda colgado, a los 5 s la invitación se muestra sin sobre.
    window.__seguro = setTimeout(() => window.__liberar(), 5000);
    control = await Promise.race([cargar('./sobre.js', 'iniciarSobre'), limite]);
    if (!abierto) {
      if (sobreSirve()) {
        sobre.dataset.listo = '1';
        clearTimeout(window.__seguro);
      } else {
        // No pudo montarse, no cubre la pantalla o su sello no se puede tocar
        abrirSinSobre();
      }
    }
  } else {
    abrirSinSobre();
  }

  // La fecha ya raspada en esta pestaña no se vuelve a tapar
  const fechaVista = recordado(CLAVE_FECHA);
  document.addEventListener('raspar:revelado', () => recordar(CLAVE_FECHA));
  if (fechaVista) revelarSinRaspar();

  await Promise.all([
    fechaVista ? null : cargar('./raspar.js', 'iniciarRaspar').then((r) => { if (r === null) revelarSinRaspar(); }),
    cargar('./cuenta.js', 'iniciarCuenta'),
    cargar('./calendario.js', 'iniciarCalendario'),
    cargar('./programa.js', 'iniciarPrograma'),
    cargar('./galeria.js', 'iniciarGaleria'),
    cargar('./copiar.js', 'iniciarCopiar'),
    cargar('./rsvp.js', 'iniciarRsvp')
  ]);

  // Sin sobre y con ancla (p. ej. ?abierta#rsvp): el salto del navegador ocurrió
  // antes de que la página tuviera su alto final. Solo se corrige en una carga
  // nueva y si el invitado sigue a menos de una pantalla del destino.
  if (omitir && location.hash.length > 1) {
    const entrada = performance.getEntriesByType?.('navigation')[0];
    if (!entrada || entrada.type === 'navigate') {
      let destino = null;
      try { destino = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (error) { /* ancla mal escrita */ }
      const distancia = destino ? destino.getBoundingClientRect().top : 0;
      if (destino && Math.abs(distancia) > 2 && Math.abs(distancia) < window.innerHeight) {
        const raiz = document.documentElement;
        const previo = raiz.style.scrollBehavior;
        raiz.style.scrollBehavior = 'auto';
        window.scrollTo(0, Math.round(distancia + window.pageYOffset));
        raiz.style.scrollBehavior = previo;
      }
    }
  }

  // Los módulos pudieron agregar contenido: el motor vuelve a buscar y a medir.
  motor.actualizar();
}

// Pase lo que pase en el arranque, la página no se queda detrás del sobre
iniciar().catch((error) => {
  console.error('[invitación] falló el arranque:', error);
  if (typeof window.__liberar === 'function') window.__liberar();
});
