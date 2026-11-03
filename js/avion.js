




















let instancia = null;

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));


const PUERTA = { x: 0.637, y: 0.7 };


const FIGURA_DESDE_CENTRO = 0.27;

const SALTO_MS = 5400;
const HITO = { caida: 0.167, apertura: 0.296 };

function matrizDe(el) {
  const t = getComputedStyle(el).transform;
  const m = /matrix\(([^)]+)\)/.exec(t || '');
  if (!m) return [1, 0, 0, 1];
  const [a, b, c, d] = m[1].split(',').map(parseFloat);
  const det = a * d - b * c;
  if (!det || !Number.isFinite(det)) return [1, 0, 0, 1];

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

  let estado = 'espera';
  let corrida = 0;
  let animaciones = [];
  let temporizadores = [];
  let observador = null;
  let destruido = false;



  saltos.forEach((s) => {
    s.el.classList.add('avion-salto--espera');
    s.el.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
  });

  function limpiar() {
    animaciones.forEach((a) => { try { a.cancel(); } catch (e) {   } });
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

   
  function fundir() {
    estado = 'volando';
    saltos.forEach((s) => {
      animar(s.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
    });
    alTerminar(++corrida);
  }

   
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
    const duracionVuelo = limitar(W / 300, 3.2, 4.6) * 1000;

    const puertaY = cajaNave.top + sy + altoNave * PUERTA.y;
    const puertaXEn = (t) => cajaBanda.left + sx + x0 + (x1 - x0) * (t / duracionVuelo) + anchoNave * PUERTA.x;


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
    const deriva = limitar(0.18 * W, 60, 240);




    const medidas = saltos.map((s) => {
      const caja = s.vuelo.getBoundingClientRect();
      if (!caja.width || !caja.height) return null;
      const C = { x: caja.left + caja.width / 2 + sx, y: caja.top + caja.height / 2 + sy };
      const saltoX = limitar(C.x - deriva, bordeIzq + 0.22 * W, bordeIzq + 0.78 * W);
      return { s, caja, C, saltoX };
    }).filter(Boolean).sort((p, q) => p.saltoX - q.saltoX);
    const separacion = 0.8 * (x1 - x0) / (duracionVuelo / 1000);
    medidas.forEach((m, i) => {
      if (i > 0 && m.saltoX - medidas[i - 1].saltoX < separacion) m.saltoX = medidas[i - 1].saltoX + separacion;
      m.saltoX = Math.min(m.saltoX, bordeIzq + 0.8 * W);
    });

    medidas.forEach(({ s, caja, C, saltoX }) => {
      const inv = matrizDe(s.vuelo);

      const alto = s.el.offsetHeight || caja.height;
      const figura = { x: 0, y: FIGURA_DESDE_CENTRO * alto };

      const tSalto = limitar(((saltoX - bordeIzq) - anchoNave * PUERTA.x - x0) / (x1 - x0), 0.05, 0.95) * duracionVuelo;
      const puerta = { x: puertaXEn(tSalto) + 2, y: puertaY + 6 };
      const caidaTotal = Math.max(C.y + figura.y - puerta.y, 120);


      const avance = Math.min(0.09 * W, 70);
      const caida1 = limitar(0.28 * caidaTotal, 70, 150);
      const tramos = [
        { x: 0, y: 0 },
        { x: avance, y: caida1 },
        { x: avance * 1.25, y: caida1 + 40 }
      ];

      const local = (p) => {
        const d = aplicar(inv, puerta.x + p.x - C.x, puerta.y + p.y - C.y);
        return `translate3d(${(d.x - figura.x).toFixed(1)}px, ${(d.y - figura.y).toFixed(1)}px, 0)`;
      };

      s.el.classList.add('avion-salto--activo');
      s.vuelo.classList.add('avion-en-vuelo');
      if (s.figura) s.figura.style.display = 'block';    
      const ajustes = { duration: SALTO_MS, delay: tSalto };


      animar(s.el, [
        { transform: local(tramos[0]), opacity: 1, offset: 0, easing: 'cubic-bezier(.5, 0, .85, .45)' },
        { transform: local(tramos[1]), opacity: 1, offset: HITO.caida, easing: 'cubic-bezier(.15, .6, .3, 1)' },
        { transform: local(tramos[2]), opacity: 1, offset: HITO.apertura, easing: 'cubic-bezier(.4, .08, .3, 1)' },
        { transform: 'translate3d(0, 0, 0)', opacity: 1, offset: 1 }
      ], ajustes);


      if (s.figura) {
        animar(s.figura, [
          { transform: 'rotate(12deg)', opacity: 1, offset: 0, easing: 'ease-in' },
          { transform: 'rotate(44deg)', opacity: 1, offset: HITO.caida, easing: 'cubic-bezier(.2, .7, .3, 1)' },
          { transform: 'rotate(6deg)', opacity: 1, offset: 0.212 },
          { transform: 'rotate(-76deg)', opacity: 0, offset: 0.3 },
          { transform: 'rotate(-76deg)', opacity: 0, offset: 1 }
        ], ajustes);
      }


      animar(s.campana, [
        { transform: 'scale(.08)', opacity: 0, offset: 0 },
        { transform: 'scale(.08)', opacity: 0, offset: HITO.caida },
        { transform: 'scale(.16)', opacity: 1, offset: 0.185, easing: 'cubic-bezier(.34, 1.4, .64, 1)' },
        { transform: 'scale(1.05)', opacity: 1, offset: 0.31, easing: 'ease-in-out' },
        { transform: 'scale(.99)', opacity: 1, offset: 0.37, easing: 'ease-in-out' },
        { transform: 'scale(1)', opacity: 1, offset: 0.42 },
        { transform: 'scale(1)', opacity: 1, offset: 1 }
      ], ajustes);


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

   
  function armar() {
    if (destruido || estado !== 'espera' || opciones.automatico === false) return;
    if (typeof IntersectionObserver !== 'function') { reproducir(); return; }



    observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) reproducir();
    }, { rootMargin: '0px 0px -45% 0px', threshold: 0 });


    if (banda) observador.observe(banda);
    saltos.forEach((s) => observador.observe(s.vuelo));
  }

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
