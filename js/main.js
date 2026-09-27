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

/* Si la tarjeta para raspar no pudo montarse, la fecha ya se lee: se da por revelada
   para que aparezcan la cuenta regresiva y el calendario. */
function revelarSinRaspar() {
  const ambito = document.querySelector('[data-raspar]')?.closest('[data-raspar-ambito], section');
  if (!ambito || ambito.dataset.rasparEstado === 'revelado') return;
  ambito.dataset.rasparEstado = 'revelado';
  const boton = ambito.querySelector('[data-raspar-boton]');
  if (boton) boton.hidden = true;
  document.dispatchEvent(new CustomEvent('raspar:revelado'));
}

async function iniciar() {
  aplicarDatos();
  enlacesInternos();

  // El motor prepara todo, pero los revelados esperan a que se abra el sobre.
  // Si el motor falla, se aplican las reglas de «sin JavaScript» y todo queda visible.
  let motor;
  try {
    motor = iniciarMotor({ revelarAlIniciar: false });
  } catch (error) {
    console.error('[invitación] no se pudo iniciar el motor:', error);
    document.documentElement.classList.remove('js');
    motor = { activarRevelados() {}, medir() {}, actualizar() {} };
  }
  let abierto = false;
  const alAbrir = () => {
    if (abierto) return;
    abierto = true;
    clearTimeout(window.__seguro);
    document.body.classList.remove('bloqueado');
    document.getElementById('portada')?.classList.add('es-abierta');
    motor.activarRevelados();
    motor.medir();
  };
  document.addEventListener('sobre:abierto', alAbrir, { once: true });

  cargar('./petalos.js', 'iniciarPetalos');

  const sobre = document.getElementById('sobre');
  const omitir = new URLSearchParams(location.search).has('abierta');

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

  if (sobre) {
    sobre.dataset.listo = '1';
    clearTimeout(window.__seguro);
    // Si sobre.js se queda colgado, a los 8 s la invitación se muestra sin sobre.
    const limite = new Promise((resolver) => setTimeout(resolver, 8000, null));
    const resultado = await Promise.race([cargar('./sobre.js', 'iniciarSobre', { omitir }), limite]);
    // Si el sobre no pudo montarse (o se omitió), la invitación se muestra directo.
    if (resultado === null || omitir) { sobre.remove(); alAbrir(); }
  } else {
    alAbrir();
  }

  await Promise.all([
    cargar('./raspar.js', 'iniciarRaspar').then((r) => { if (r === null) revelarSinRaspar(); }),
    cargar('./cuenta.js', 'iniciarCuenta'),
    cargar('./calendario.js', 'iniciarCalendario'),
    cargar('./programa.js', 'iniciarPrograma'),
    cargar('./galeria.js', 'iniciarGaleria'),
    cargar('./copiar.js', 'iniciarCopiar'),
    cargar('./rsvp.js', 'iniciarRsvp')
  ]);

  // Los módulos pudieron agregar contenido: el motor vuelve a buscar y a medir.
  motor.actualizar();
}

iniciar();
