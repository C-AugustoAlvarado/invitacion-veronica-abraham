

import { CONFIG } from './config.js';
import { iniciarMotor } from './motor.js';

import { sinTraslado } from './anclas.js';

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

 
function aplicarDatos() {
  document.querySelectorAll('[data-enlace]').forEach((el) => {
    const url = leer(el.dataset.enlace);
    if (url) el.href = url;
  });
  document.querySelectorAll('[data-config]').forEach((el) => {
    const texto = leer(el.dataset.config);
    if (texto) el.textContent = texto;
  });





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

 
function enlacesInternos() {
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (evento) => {
    if (evento.defaultPrevented) return;
    const enlace = evento.target.closest('a[href^="#"]');
    if (!enlace) return;
    const destino = document.getElementById(enlace.getAttribute('href').slice(1));
    if (!destino) return;
    evento.preventDefault();
    sinTraslado(destino, () => destino.scrollIntoView({ behavior: reducido.matches ? 'auto' : 'smooth', block: 'start' }));
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  });
}




const CLAVE_ABIERTA = 'boda:abierta';
const recordar = (clave) => {
  try { window.sessionStorage.setItem(clave, '1'); } catch (error) {   }
};
const recordado = (clave) => {
  try { return window.sessionStorage.getItem(clave) === '1'; } catch (error) { return false; }
};






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
    cargar('./rsvp.js', 'iniciarRsvp'),
    cargar('./carrusel.js', 'iniciarCarrusel')
  ]);
  if (rsvp) document.documentElement.classList.add('funcional');
}

async function iniciar() {

  try { aplicarDatos(); } catch (error) { console.error('[invitación] no se pudieron aplicar los datos:', error); }
  try { enlacesInternos(); } catch (error) { console.error('[invitación] no se pudieron preparar los enlaces:', error); }

  if (window.__liberado || document.documentElement.classList.contains('basico')) return iniciarBasico();



  let motor;
  try {
    motor = iniciarMotor({ revelarAlIniciar: false });
  } catch (error) {
    console.error('[invitación] no se pudo iniciar el motor:', error);
    return iniciarBasico();
  }

  const sobre = document.getElementById('sobre');

  const omitir = new URLSearchParams(location.search).has('abierta')
    || window.__omitir === true || recordado(CLAVE_ABIERTA);




  const colocar = () => {
    if (omitir) return;
    let destino = null;
    try {
      if (location.hash.length > 1) destino = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch (error) {   }
    const raiz = document.documentElement;
    const previo = raiz.style.scrollBehavior;
    raiz.style.scrollBehavior = 'auto';
    if (destino) sinTraslado(destino, () => destino.scrollIntoView({ block: 'start' }));
    else if (window.pageYOffset > 1) window.scrollTo(0, 0);
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


  let control = null;
  const sobreSirve = () => {
    if (!control || !sobre || !sobre.isConnected) return false;

    if (window.innerWidth < 50 || window.innerHeight < 50) return true;
    const caja = sobre.getBoundingClientRect();
    const sello = sobre.querySelector('.sobre__sello');
    const c = sello ? sello.getBoundingClientRect() : null;
    const tocado = c && c.width > 0
      ? document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) : null;
    return caja.width >= window.innerWidth * 0.9 && caja.height >= window.innerHeight * 0.5
      && !!tocado && sobre.contains(tocado);
  };


  const abrirSinSobre = () => {
    if (control && typeof control.destruir === 'function') control.destruir();
    if (sobre && sobre.isConnected) sobre.remove();
    document.dispatchEvent(new CustomEvent('sobre:abierto'));
    alAbrir();
  };




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

  document.addEventListener('avion:salto', (evento) => {
    const d = evento.detail || {};
    document.dispatchEvent(new CustomEvent('petalos:rafaga', { detail: { x: d.x, y: d.y, cantidad: 6, fuerza: 0.6 } }));
  });



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

    window.__seguro = setTimeout(() => window.__liberar(), 5000);
    control = await Promise.race([cargar('./sobre.js', 'iniciarSobre'), limite]);
    if (!abierto) {
      if (sobreSirve()) {
        sobre.dataset.listo = '1';
        clearTimeout(window.__seguro);
      } else {

        abrirSinSobre();
      }
    }
  } else {
    abrirSinSobre();
  }

  await Promise.all([
    cargar('./menu.js', 'iniciarMenu'),
    cargar('./recomendaciones.js', 'iniciarRecomendaciones'),
    cargar('./avion.js', 'iniciarAvion'),
    cargar('./carrusel.js', 'iniciarCarrusel'),
    cargar('./cuenta.js', 'iniciarCuenta'),
    cargar('./calendario.js', 'iniciarCalendario'),
    cargar('./programa.js', 'iniciarPrograma'),
    cargar('./copiar.js', 'iniciarCopiar'),
    cargar('./rsvp.js', 'iniciarRsvp')
  ]);





  if (omitir && location.hash.length > 1) {
    const entrada = performance.getEntriesByType?.('navigation')[0];
    if (!entrada || entrada.type === 'navigate') {
      let destino = null;
      try { destino = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (error) {   }


      const acomodar = () => {
        if (!destino) return;
        sinTraslado(destino, () => {
          const margen = parseFloat(getComputedStyle(destino).scrollMarginTop) || 0;
          if (Math.abs(destino.getBoundingClientRect().top - margen) < 2) return;
          const raiz = document.documentElement;
          const previo = raiz.style.scrollBehavior;
          raiz.style.scrollBehavior = 'auto';
          destino.scrollIntoView({ block: 'start' });
          raiz.style.scrollBehavior = previo;
        });
      };
      acomodar();
      if (document.readyState !== 'complete') window.addEventListener('load', () => setTimeout(acomodar, 0), { once: true });
      else setTimeout(acomodar, 0);
    }
  }






  const suavizar = () => setTimeout(() => document.documentElement.classList.add('scroll-suave'), 250);
  if (document.readyState === 'complete') suavizar();
  else window.addEventListener('load', suavizar, { once: true });


  motor.actualizar();
}


iniciar().catch((error) => {
  console.error('[invitación] falló el arranque:', error);
  if (typeof window.__liberar === 'function') window.__liberar();
});
