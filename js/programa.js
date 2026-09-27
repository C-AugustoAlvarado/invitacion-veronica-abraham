// Programa de la noche: línea de tiempo con hilo dorado.
// El motor escribe --p en [data-progreso]; aquí solo se mide (alto del hilo,
// alto de la ventana y posición de cada nodo) para que el CSS calcule dónde va
// la punta y qué hitos ya están encendidos. No hay bucle por cuadro: las
// animaciones son CSS y se pausan fuera de pantalla o con la pestaña oculta.

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

export function iniciarPrograma(opciones = {}) {
  const {
    raiz = document.getElementById('programa'),
    punta = 0.6,        // altura de la ventana (0–1) a la que viaja la punta del hilo
    rafaga = true       // pedir unos pétalos cuando la luna del remate aparece
  } = opciones;

  if (!raiz) return null;
  if (raiz._programa) return raiz._programa;   // idempotente

  const linea = raiz.querySelector('.prog-linea');
  if (!linea) return null;
  const hitos = [...linea.querySelectorAll('.prog-hito')];
  const luna = raiz.querySelector('.prog-remate__cielo');

  let altoLinea = 0;
  let altoVentana = 0;
  let anchoVentana = 0;
  let temporizador = 0;

  /* ── Medición (offsetTop: no le afectan los revelados ni el parallax) ── */
  function medir() {
    const nuevoAlto = linea.offsetHeight;
    if (!nuevoAlto) return;
    altoLinea = nuevoAlto;
    altoVentana = window.innerHeight;
    anchoVentana = window.innerWidth;

    linea.style.setProperty('--prog-alto', altoLinea);
    linea.style.setProperty('--prog-vh', altoVentana);
    linea.style.setProperty('--prog-punta', limitar(punta, 0.2, 0.9));

    for (const hito of hitos) {
      const nodo = hito.querySelector('.prog-nodo');
      const y = hito.offsetTop + (nodo ? nodo.offsetTop : 0);
      hito.style.setProperty('--en', (y / altoLinea).toFixed(4));
    }
    linea.classList.add('prog-lista');
  }

  function alRedimensionar() {
    // La barra del navegador móvil cambia el alto al hacer scroll: se ignora,
    // igual que en el motor, para que la punta no salte.
    const cambioReal = window.innerWidth !== anchoVentana
      || Math.abs(window.innerHeight - altoVentana) > 140;
    if (!cambioReal) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(medir, 140);
  }

  const observadorAlto = new ResizeObserver(() => {
    if (Math.abs(linea.offsetHeight - altoLinea) < 2) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(medir, 140);
  });
  observadorAlto.observe(linea);

  /* ── Pausa fuera de pantalla y con la pestaña oculta ── */
  let enPantalla = false;
  const actualizarActividad = () => {
    raiz.classList.toggle('prog-activa', enPantalla && !document.hidden);
  };
  const observadorPantalla = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) enPantalla = entrada.isIntersecting;
    actualizarActividad();
  }, { rootMargin: '10% 0px 10% 0px' });
  observadorPantalla.observe(raiz);

  /* ── La luna del remate pide unos pétalos (una sola vez) ── */
  let observadorLuna = null;
  if (rafaga && luna && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    observadorLuna = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const caja = luna.getBoundingClientRect();
        document.dispatchEvent(new CustomEvent('petalos:rafaga', {
          detail: {
            x: caja.left + caja.width / 2,
            y: caja.top + caja.height * 0.45,
            cantidad: 8,
            fuerza: 0.6
          }
        }));
        observadorLuna.disconnect();
        observadorLuna = null;
      }
    }, { threshold: 0.85 });
    observadorLuna.observe(luna);
  }

  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('orientationchange', medir);
  document.addEventListener('visibilitychange', actualizarActividad);
  if (document.fonts?.ready) document.fonts.ready.then(medir);

  medir();

  const api = {
    medir,
    destruir() {
      clearTimeout(temporizador);
      observadorAlto.disconnect();
      observadorPantalla.disconnect();
      observadorLuna?.disconnect();
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', medir);
      document.removeEventListener('visibilitychange', actualizarActividad);
      linea.classList.remove('prog-lista');
      raiz.classList.remove('prog-activa');
      delete raiz._programa;
    }
  };
  raiz._programa = api;
  return api;
}
