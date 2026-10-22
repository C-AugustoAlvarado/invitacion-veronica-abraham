// Avión y paracaídas. Cuando el contador de la portada entra en pantalla, un
// avioncito de línea cruza el cielo de izquierda a derecha, por su puerta saltan
// los dos paracaidistas de «Nuestra historia», caen en caída libre, abren el
// paracaídas y bajan despacio hasta su sitio de siempre, donde el motor sigue
// moviéndolos con el parallax. Dura unos 7 s y se reproduce una vez por visita.
//
// Contrato con el HTML:
//   · src/portada.html → <div class="avion" data-avion> con .avion__nave > svg.avion__cuerpo
//     dentro de .portada__cuenta.avion-cielo (el cielo que cruza el avión).
//   · src/historia.html → dentro de cada .historia__vuelo (data-parallax, lo mueve el
//     motor) un envoltorio .avion-salto[data-avion-salto="a|b"] con la figurita en
//     caída libre (svg.avion-figura) y la campana (.avion-campana > picture/img).
//     La caída se anima en .avion-salto, la apertura en .avion-campana y el vaivén
//     de siempre sigue en la imagen: tres transforms que no se pisan.
//
// Solo se animan transform y opacity (Web Animations API: corre en el compositor
// y no toca el layout). Eventos: 'avion:salto' en document cuando salta cada
// figura, con detail { cual: 'a'|'b', x, y } en px de ventana.
// Con movimiento reducido, sin WAAPI o sin «overflow: clip» (iOS 15, donde las
// secciones recortan en vertical) no hay avión: los paracaídas se funden en su sitio.

let instancia = null;

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// Punto de la puerta del avión dentro de su caja (fracciones del ancho y alto del svg)
const PUERTA = { x: 0.637, y: 0.7 };
// Dónde cuelga la figura dentro del envoltorio del paracaídas (fracción del alto,
// medida desde el centro): coincide con el paracaidista de la ilustración
const FIGURA_DESDE_CENTRO = 0.27;
// Duración de cada salto (ms) y sus hitos (fracciones): caída libre → apertura → descenso
const SALTO_MS = 5400;
const HITO = { caida: 0.167, apertura: 0.296 };

function matrizDe(el) {
  const t = getComputedStyle(el).transform;
  const m = /matrix\(([^)]+)\)/.exec(t || '');
  if (!m) return [1, 0, 0, 1];
  const [a, b, c, d] = m[1].split(',').map(parseFloat);
  const det = a * d - b * c;
  if (!det || !Number.isFinite(det)) return [1, 0, 0, 1];
  // Inversa de la parte lineal: convierte desplazamientos de página a locales
  return [d / det, -b / det, -c / det, a / det];
}
const aplicar = ([a, b, c, d], x, y) => ({ x: a * x + c * y, y: b * x + d * y });

export function iniciarAvion(opciones = {}) {
  if (instancia) return instancia;

  const banda = document.querySelector('[data-avion]');
  const nave = banda ? banda.querySelector('.avion__nave') : null;
  const saltos = [...document.querySelectorAll('[data-avion-salto]')]
    .map((el) => ({ el, cual: el.dataset.avionSalto || '', vuelo: el.parentElement, figura: el.querySelector('.avion-figura'), campana: el.querySelector('.avion-campana') }))
    .filter((s) => s.vuelo && s.campana);
  const nada = { reproducir() {}, destruir() {} };
  if (!saltos.length || typeof Element.prototype.animate !== 'function') return nada;

  const velocidad = Number(opciones.velocidad) > 0 ? Number(opciones.velocidad) : 1;
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const recortaEnVertical = !(typeof CSS !== 'undefined' && CSS.supports && CSS.supports('overflow', 'clip'));
  const conAvion = () => !!(banda && nave) && !consultaReducido.matches && !recortaEnVertical;

  let estado = 'espera';   // 'espera' | 'volando' | 'hecho'
  let corrida = 0;         // cada reproducción tiene su número: una vieja no cierra a la nueva
  let animaciones = [];
  let temporizadores = [];
  let observador = null;
  let destruido = false;

  // Los paracaídas esperan escondidos hasta que el contador se vea. Las imágenes
  // llegan con loading="lazy" (constructor): se piden ya, que están a un scroll.
  saltos.forEach((s) => {
    s.el.classList.add('avion-salto--espera');
    s.el.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
  });

  function limpiar() {
    animaciones.forEach((a) => { try { a.cancel(); } catch (e) { /* ya terminó */ } });
    animaciones = [];
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    saltos.forEach((s) => {
      s.el.classList.remove('avion-salto--espera', 'avion-salto--activo');
      s.vuelo.classList.remove('avion-en-vuelo');
      if (s.figura) s.figura.style.display = 'none';
    });
    if (banda) banda.classList.remove('avion--volando');
  }

  function animar(el, cuadros, ajustes) {
    const a = el.animate(cuadros, { fill: 'forwards', ...ajustes });
    a.playbackRate = velocidad;
    animaciones.push(a);
    return a;
  }

  function alTerminar(numero) {
    Promise.all(animaciones.map((a) => a.finished.catch(() => {}))).then(() => {
      if (destruido || numero !== corrida) return;
      limpiar();
      estado = 'hecho';
    });
  }

  /* ── Sin avión: los paracaídas se funden en su sitio ── */
  function fundir() {
    estado = 'volando';
    saltos.forEach((s) => {
      animar(s.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
    });
    alTerminar(++corrida);
  }

  /* ── Coreografía completa ── */
  function volar() {
    estado = 'volando';
    const sx = window.scrollX;
    const sy = window.scrollY;

    banda.classList.add('avion--volando');
    const cajaBanda = banda.getBoundingClientRect();
    const cajaNave = nave.getBoundingClientRect();
    const W = cajaBanda.width || window.innerWidth;
    const anchoNave = cajaNave.width || 92;
    const altoNave = cajaNave.height || 29;
    const x0 = -anchoNave - 8;
    const x1 = W + 8;
    const duracionVuelo = limitar(W / 300, 3.2, 4.6) * 1000;   // ms: lento en celular, más brioso en escritorio
    // Posición de la puerta en la página mientras vuela (sin contar el vaivén)
    const puertaY = cajaNave.top + sy + altoNave * PUERTA.y;
    const puertaXEn = (t) => cajaBanda.left + sx + x0 + (x1 - x0) * (t / duracionVuelo) + anchoNave * PUERTA.x;

    // El avión cruza (translateX) y, dentro, el cuerpo cabecea y ladea un poco
    animar(nave, [
      { transform: `translate3d(${x0.toFixed(1)}px, 0, 0)` },
      { transform: `translate3d(${x1.toFixed(1)}px, 0, 0)` }
    ], { duration: duracionVuelo, easing: 'linear' });
    const cuerpo = nave.querySelector('.avion__cuerpo');
    if (cuerpo) {
      animar(cuerpo, [
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        { transform: 'translate3d(0, -3px, 0) rotate(-1.6deg)' },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        { transform: 'translate3d(0, 3px, 0) rotate(1.4deg)' },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' }
      ], { duration: 1500, iterations: Math.ceil(duracionVuelo / 1500), easing: 'ease-in-out' });
    }

    const bordeIzq = cajaBanda.left + sx;
    const deriva = limitar(0.18 * W, 60, 240);   // lo que planean hacia delante tras saltar

    // Cada uno salta un poco antes de donde aterriza (conserva el impulso del avión) y
    // dentro del tercio central del cruce. Entre un salto y otro pasan al menos 0.8 s:
    // así no bajan encimados y el primero en saltar es el que aterriza más a la izquierda.
    const medidas = saltos.map((s) => {
      const caja = s.vuelo.getBoundingClientRect();
      if (!caja.width || !caja.height) return null;
      const C = { x: caja.left + caja.width / 2 + sx, y: caja.top + caja.height / 2 + sy };
      const saltoX = limitar(C.x - deriva, bordeIzq + 0.22 * W, bordeIzq + 0.78 * W);
      return { s, caja, C, saltoX };
    }).filter(Boolean).sort((p, q) => p.saltoX - q.saltoX);
    const separacion = 0.8 * (x1 - x0) / (duracionVuelo / 1000);   // px que recorre el avión en 0.8 s
    medidas.forEach((m, i) => {
      if (i > 0 && m.saltoX - medidas[i - 1].saltoX < separacion) m.saltoX = medidas[i - 1].saltoX + separacion;
      m.saltoX = Math.min(m.saltoX, bordeIzq + 0.8 * W);
    });

    medidas.forEach(({ s, caja, C, saltoX }) => {
      const inv = matrizDe(s.vuelo);
      // C es el centro dibujado del envoltorio (ya con el parallax del motor) en la página
      const alto = s.el.offsetHeight || caja.height;
      const figura = { x: 0, y: FIGURA_DESDE_CENTRO * alto };   // la figura, respecto al centro

      const tSalto = limitar(((saltoX - bordeIzq) - anchoNave * PUERTA.x - x0) / (x1 - x0), 0.05, 0.95) * duracionVuelo;
      const puerta = { x: puertaXEn(tSalto) + 2, y: puertaY + 6 };
      const caidaTotal = Math.max(C.y + figura.y - puerta.y, 120);

      // Tramos de la caída, en desplazamientos de página desde la puerta
      const avance = Math.min(0.09 * W, 70);                    // conserva algo del impulso del avión
      const caida1 = limitar(0.28 * caidaTotal, 70, 150);        // caída libre
      const tramos = [
        { x: 0, y: 0 },
        { x: avance, y: caida1 },
        { x: avance * 1.25, y: caida1 + 40 }
      ];
      // De página a local: el envoltorio vive dentro de un elemento con transform (parallax)
      const local = (p) => {
        const d = aplicar(inv, puerta.x + p.x - C.x, puerta.y + p.y - C.y);
        return `translate3d(${(d.x - figura.x).toFixed(1)}px, ${(d.y - figura.y).toFixed(1)}px, 0)`;
      };

      s.el.classList.add('avion-salto--activo');
      s.vuelo.classList.add('avion-en-vuelo');
      if (s.figura) s.figura.style.display = 'block';   /* en el HTML va oculta en línea */
      const ajustes = { duration: SALTO_MS, delay: tSalto };

      // 1 · El envoltorio: cae, frena al abrirse el paracaídas y planea hasta su sitio
      animar(s.el, [
        { transform: local(tramos[0]), opacity: 1, offset: 0, easing: 'cubic-bezier(.5, 0, .85, .45)' },
        { transform: local(tramos[1]), opacity: 1, offset: HITO.caida, easing: 'cubic-bezier(.15, .6, .3, 1)' },
        { transform: local(tramos[2]), opacity: 1, offset: HITO.apertura, easing: 'cubic-bezier(.4, .08, .3, 1)' },
        { transform: 'translate3d(0, 0, 0)', opacity: 1, offset: 1 }
      ], ajustes);

      // 2 · La figurita: se lanza de cabeza, gira y, al abrirse la campana, queda de pie y se esfuma
      if (s.figura) {
        animar(s.figura, [
          { transform: 'rotate(12deg)', opacity: 1, offset: 0, easing: 'ease-in' },
          { transform: 'rotate(44deg)', opacity: 1, offset: HITO.caida, easing: 'cubic-bezier(.2, .7, .3, 1)' },
          { transform: 'rotate(6deg)', opacity: 1, offset: 0.212 },
          { transform: 'rotate(-76deg)', opacity: 0, offset: 0.3 },
          { transform: 'rotate(-76deg)', opacity: 0, offset: 1 }
        ], ajustes);
      }

      // 3 · La campana: «pop» elástico desde la espalda y una leve oscilación de más
      animar(s.campana, [
        { transform: 'scale(.08)', opacity: 0, offset: 0 },
        { transform: 'scale(.08)', opacity: 0, offset: HITO.caida },
        { transform: 'scale(.16)', opacity: 1, offset: 0.185, easing: 'cubic-bezier(.34, 1.4, .64, 1)' },
        { transform: 'scale(1.05)', opacity: 1, offset: 0.31, easing: 'ease-in-out' },
        { transform: 'scale(.99)', opacity: 1, offset: 0.37, easing: 'ease-in-out' },
        { transform: 'scale(1)', opacity: 1, offset: 0.42 },
        { transform: 'scale(1)', opacity: 1, offset: 1 }
      ], ajustes);

      // Aviso del salto (px de ventana en ese instante): otro módulo puede soltar hojitas
      temporizadores.push(setTimeout(() => {
        if (destruido) return;
        document.dispatchEvent(new CustomEvent('avion:salto', {
          detail: { cual: s.cual, x: puerta.x - window.scrollX, y: puerta.y - window.scrollY }
        }));
      }, tSalto / velocidad));
    });

    alTerminar(++corrida);
  }

  function reproducir() {
    if (destruido) return;
    if (observador) { observador.disconnect(); observador = null; }
    limpiar();
    saltos.forEach((s) => s.el.classList.add('avion-salto--espera'));
    if (conAvion()) volar(); else fundir();
  }

  /* ── Disparo: cuando se ve el contador o, si el invitado llega directo, el cielo de la historia ── */
  function armar() {
    if (destruido || estado !== 'espera' || opciones.automatico === false) return;
    if (typeof IntersectionObserver !== 'function') { reproducir(); return; }
    // Dispara cuando el contador (o el cielo de la historia) ya entró en la mitad superior
    // de la ventana: antes se perdía mientras el invitado leía el texto de la invitación
    // (lo pidieron los novios el 22-oct-2026)
    observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) reproducir();
    }, { rootMargin: '0px 0px -45% 0px', threshold: 0 });
    // Se vigila la franja misma (va debajo del calendario): el vuelo arranca cuando esa
    // franja llega a la mitad superior de la pantalla, ya pasados los botones del calendario
    if (banda) observador.observe(banda);
    saltos.forEach((s) => observador.observe(s.vuelo));
  }
  // Detrás del sobre el contador puede estar «en pantalla» sin que nadie lo vea
  const alAbrirSobre = () => armar();
  if (document.body.classList.contains('bloqueado')) {
    document.addEventListener('sobre:abierto', alAbrirSobre, { once: true });
  } else {
    armar();
  }

  instancia = {
    reproducir,
    destruir() {
      destruido = true;
      document.removeEventListener('sobre:abierto', alAbrirSobre);
      if (observador) observador.disconnect();
      limpiar();
      instancia = null;
    }
  };
  return instancia;
}
