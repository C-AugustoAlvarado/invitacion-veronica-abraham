



const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suavizar = (t) => t * t * (3 - 2 * t);


const ORDEN = ['dia', 'dorado', 'ocaso', 'noche'];


const FONDOS = { dia: '#F8F4EB', dorado: '#EBDDC2', ocaso: '#7A4A3A', noche: '#26261F' };

export function iniciarMotor(opciones = {}) {
  const raiz = document.documentElement;

  const fondoAmbiente = document.getElementById('ambiente') || raiz;
  const metaTema = document.querySelector('meta[name="theme-color"]');
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaMovil = window.matchMedia('(max-width: 760px)');
  let reducido = consultaReducido.matches;


  const animaConScroll = !reducido && typeof CSS !== 'undefined'
    && CSS.supports?.('animation-timeline: view()') === true;

  let alto = window.innerHeight;
  let ancho = window.innerWidth;
  let objetivo = window.scrollY;
  let ySuave = objetivo;
  let cuadro = 0;
  let reveladosActivos = false;

  let capas = [];
  let avances = [];
  let ambientes = [];
  let ultimoAmbiente = '';
  let ultimosPesos = '';

   
  function partirTexto(el) {
    if (el.dataset.letrasListo) return;
    el.dataset.letrasListo = '1';
    const original = el.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.appendChild(el.firstChild);

    let i = 0;
    const caminar = (nodo) => {
      for (const hijo of [...nodo.childNodes]) {
        if (hijo.nodeType === Node.TEXT_NODE) {
          const trozos = hijo.textContent.split(/(\s+)/);
          const fragmento = document.createDocumentFragment();
          for (const trozo of trozos) {
            if (!trozo) continue;
            if (/^\s+$/.test(trozo)) {
              fragmento.appendChild(document.createTextNode(' '));
            } else {
              const palabra = document.createElement('span');
              palabra.className = 'palabra';
              palabra.style.setProperty('--i', i++);
              palabra.textContent = trozo;
              fragmento.appendChild(palabra);
            }
          }
          hijo.replaceWith(fragmento);
        } else if (hijo.nodeType === Node.ELEMENT_NODE && hijo.tagName !== 'BR') {

          if (!hijo.children.length && hijo.textContent.trim().length <= 2) {
            hijo.classList.add('palabra');
            hijo.style.setProperty('--i', i++);
          } else {
            caminar(hijo);
          }
        }
      }
    };
    caminar(visual);

    const lectores = document.createElement('span');
    lectores.className = 'solo-lectores';
    lectores.textContent = original;
    el.append(lectores, visual);
  }

   
  function prepararTrazos(el) {
    if (el._formasTrazo) return;
    const formas = el.matches('path, line, polyline, polygon, circle, ellipse, rect')
      ? [el]
      : [...el.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')];
    formas.forEach((forma, i) => {
      if (typeof forma.getTotalLength !== 'function') return;
      let largo = 0;
      try { largo = forma.getTotalLength(); } catch (e) { return; }
      if (!largo) return;
      forma.style.strokeDasharray = `${largo}`;
      forma.style.strokeDashoffset = reducido ? '0' : `${largo}`;
      forma.style.transition = `stroke-dashoffset 1.9s cubic-bezier(.22,.61,.36,1) ${i * 110}ms`;
    });
    el._formasTrazo = formas;
  }
  function dibujarTrazos(el) {
    (el._formasTrazo || []).forEach((forma) => { forma.style.strokeDashoffset = '0'; });
  }

   
  const pendientes = new Set();


  const vigilados = new Map();


  const vigiaDe = (el) => {
    if (el.dataset.revelar !== 'acuarela') return el;
    let padre = el.parentElement;
    while (padre && padre.tagName === 'PICTURE') padre = padre.parentElement;
    return padre || el;
  };

  const observadorRevelar = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      const suficiente = entrada.intersectionRatio >= 0.15
        || entrada.intersectionRect.height >= alto * 0.22;
      if (!suficiente) continue;
      [...(vigilados.get(entrada.target) || [])].forEach(mostrar);
    }
  }, { threshold: [0, 0.15, 0.4], rootMargin: '0px 0px -6% 0px' });





  const precalentables = new Map();
  const observadorPrecalentar = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      (precalentables.get(entrada.target) || []).forEach((img) => { img.loading = 'eager'; });
      precalentables.delete(entrada.target);
      observadorPrecalentar.unobserve(entrada.target);
    }
  }, { rootMargin: '600px 0px' });
  function precalentar(el) {
    if (!(el instanceof HTMLImageElement) || el.loading !== 'lazy' || el.dataset.revelar !== 'acuarela') return;
    const vigia = vigiaDe(el);
    if (!precalentables.has(vigia)) precalentables.set(vigia, new Set());
    precalentables.get(vigia).add(el);
    observadorPrecalentar.observe(vigia);
  }

  function vigilar(el) {
    precalentar(el);
    const vigia = vigiaDe(el);
    if (!vigilados.has(vigia)) vigilados.set(vigia, new Set());
    vigilados.get(vigia).add(el);
    observadorRevelar.observe(vigia);
  }

  function mostrar(el) {
    if (el instanceof HTMLImageElement && el.loading === 'lazy') el.loading = 'eager';
    el.classList.add('es-visible');
    if (el.hasAttribute('data-trazo')) dibujarTrazos(el);
    pendientes.delete(el);
    const vigia = vigiaDe(el);
    const grupo = vigilados.get(vigia);
    if (grupo) {
      grupo.delete(el);
      if (!grupo.size) { vigilados.delete(vigia); observadorRevelar.unobserve(vigia); }
    }
  }

  function prepararRevelados() {
    document.querySelectorAll('[data-revelar-grupo]').forEach((grupo) => {
      [...grupo.querySelectorAll('[data-revelar], [data-letras], [data-trazo]')]
        .forEach((hijo, i) => hijo.style.setProperty('--i', i));
    });
    document.querySelectorAll('[data-letras]').forEach(partirTexto);
    document.querySelectorAll('[data-trazo]').forEach(prepararTrazos);
    document.querySelectorAll('[data-revelar], [data-letras], [data-trazo]').forEach((el) => {
      if (el.classList.contains('es-visible')) return;
      if (el.dataset.revelarRetraso) el.style.setProperty('--retraso', `${el.dataset.revelarRetraso}ms`);
      if (el.hasAttribute('data-parallax') && el.hasAttribute('data-revelar')) {
        console.warn('[motor] data-parallax y data-revelar en el mismo elemento: usa un envoltorio.', el);
      }
      pendientes.add(el);
    });
  }

  function activarRevelados() {
    if (reveladosActivos) return;
    reveladosActivos = true;
    if (reducido) { [...pendientes].forEach(mostrar); return; }
    pendientes.forEach(vigilar);
  }

   
  const observadorVisibles = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      const dato = entrada.target._motor;
      if (dato) dato.visible = entrada.isIntersecting;

      entrada.target.classList.toggle('en-vista', entrada.isIntersecting);
    }
  }, { rootMargin: '30% 0px 30% 0px' });




  function conEspejo(el) {
    if (!el.hasAttribute('data-parallax-espejo')) return false;
    const propia = getComputedStyle(el).scale;
    return !(typeof propia === 'string' && /^-1\b/.test(propia.trim()));
  }

  function medir() {
    alto = window.innerHeight;
    ancho = window.innerWidth;
    const y = window.scrollY;

    capas.forEach((c) => { c.el.style.transform = ''; });
    capas = [...document.querySelectorAll('[data-parallax]')].map((el) => {
      const caja = el.getBoundingClientRect();
      const dato = el._motor || { visible: true };
      Object.assign(dato, {
        el,
        centro: caja.top + y + caja.height / 2,
        velocidad: parseFloat(el.dataset.parallax) || 0,
        vx: parseFloat(el.dataset.parallaxX) || 0,
        giro: parseFloat(el.dataset.parallaxGiro) || 0,
        escala: parseFloat(el.dataset.parallaxEscala) || 0,
        espejo: conEspejo(el),
        ultimo: ''
      });
      if (!el._motor) { el._motor = dato; observadorVisibles.observe(el); }
      return dato;
    });





    avances = [...document.querySelectorAll('[data-progreso]')].filter((el) => (
      !(animaConScroll && el.hasAttribute('data-progreso-css'))
    )).map((el) => {
      const caja = el.getBoundingClientRect();
      return {
        el,
        arriba: caja.top + y,
        altura: caja.height,
        modo: el.dataset.progreso,

        directo: el.hasAttribute('data-progreso-css'),
        ultimo: ''
      };
    });

    ambientes = [];
    document.querySelectorAll('body [data-ambiente]').forEach((el) => {
      const nombres = el.dataset.ambiente.trim().split(/\s+/).filter((n) => ORDEN.includes(n));
      if (!nombres.length) return;
      const caja = el.getBoundingClientRect();
      const arriba = caja.top + y;
      const tramo = caja.height / nombres.length;
      nombres.forEach((nombre, i) => ambientes.push({ nombre, arriba: arriba + tramo * i }));
    });
    ambientes.sort((a, b) => a.arriba - b.arriba);

    pintar(true);
  }

   
  function calcularAmbiente(y) {
    if (!ambientes.length) return;
    const sonda = y + alto * 0.55;

    let k = 0;
    for (let i = 0; i < ambientes.length; i++) if (ambientes[i].arriba <= sonda) k = i;



    const fusionEn = (i) => {
      const antes = ambientes[i].arriba - ambientes[i - 1].arriba;
      const despues = ambientes[i + 1] ? ambientes[i + 1].arriba - ambientes[i].arriba : Infinity;
      return Math.max(1, Math.min(alto * 0.8, antes, despues));
    };

    let desde = ambientes[k].nombre;
    let hacia = desde;
    let t = 0;
    const siguiente = ambientes[k + 1];
    const fusionSig = siguiente ? fusionEn(k + 1) : 0;
    const fusionAnt = k > 0 ? fusionEn(k) : 0;
    if (siguiente && sonda > siguiente.arriba - fusionSig / 2) {
      hacia = siguiente.nombre;
      t = suavizar(limitar((sonda - (siguiente.arriba - fusionSig / 2)) / fusionSig, 0, 1));
    } else if (k > 0 && sonda < ambientes[k].arriba + fusionAnt / 2) {
      desde = ambientes[k - 1].nombre;
      hacia = ambientes[k].nombre;
      t = suavizar(limitar((sonda - (ambientes[k].arriba - fusionAnt / 2)) / fusionAnt, 0, 1));
    }

    const pesos = { dia: 0, dorado: 0, ocaso: 0, noche: 0 };
    pesos[desde] += 1 - t;
    pesos[hacia] += t;


    const iDesde = ORDEN.indexOf(desde);
    const iHacia = ORDEN.indexOf(hacia);
    const baja = Math.min(iDesde, iHacia);
    const altaIdx = Math.max(iDesde, iHacia);
    const pesoAlta = iHacia >= iDesde ? t : 1 - t;
    const opacidad = [1, 0, 0, 0];
    opacidad[baja] = 1;
    if (altaIdx !== baja) opacidad[altaIdx] = pesoAlta;

    const firma = opacidad.map((o) => o.toFixed(3)).join();
    if (firma !== ultimosPesos) {
      ultimosPesos = firma;
      fondoAmbiente.style.setProperty('--amb-dorado', opacidad[1].toFixed(3));
      fondoAmbiente.style.setProperty('--amb-ocaso', opacidad[2].toFixed(3));
      fondoAmbiente.style.setProperty('--amb-noche', opacidad[3].toFixed(3));
      const nombre = t > 0.5 ? hacia : desde;
      if (nombre !== ultimoAmbiente) {
        ultimoAmbiente = nombre;
        raiz.dataset.ambiente = nombre;

        if (metaTema && FONDOS[nombre]) metaTema.setAttribute('content', FONDOS[nombre]);
      }
      document.dispatchEvent(new CustomEvent('ambiente:cambio', { detail: { nombre, pesos } }));
    }
  }

   
  function pintar(forzar) {
    const y = ySuave;
    const centroVentana = y + alto / 2;
    const tope = consultaMovil.matches ? 60 : 130;

    if (!reducido) {
      for (const c of capas) {
        if (!c.visible && !forzar) continue;
        const d = c.centro - centroVentana;
        const ty = tope * Math.tanh((-d * c.velocidad) / tope);
        const tx = c.vx ? tope * Math.tanh((-d * c.vx) / tope) : 0;
        let valor = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
        if (c.giro) valor += ` rotate(${((d / alto) * c.giro).toFixed(3)}deg)`;
        if (c.escala) valor += ` scale(${(1 + c.escala * limitar(0.5 - d / alto, 0, 1)).toFixed(4)})`;

        if (c.espejo) valor = `scaleX(-1) ${valor}`;
        if (valor !== c.ultimo) { c.el.style.transform = valor; c.ultimo = valor; }
      }
    }





    const yReal = window.scrollY;
    for (const a of avances) {
      const recorrido = a.modo === 'centro' ? alto / 2 + a.altura / 2 : alto + a.altura;
      const p = limitar(((a.directo ? yReal : y) + alto - a.arriba) / recorrido, 0, 1);


      const texto = p.toFixed(4);
      if (texto !== a.ultimo || forzar) {
        a.el.style.setProperty('--p', texto);
        a.ultimo = texto;
      }
    }

    calcularAmbiente(y);
  }

  let ultimoCuadro = 0;
  function bucle(ahora) {
    cuadro = 0;
    objetivo = window.scrollY;
    const resto = objetivo - ySuave;


    const tiempo = typeof ahora === 'number' ? ahora : performance.now();
    const dt = ultimoCuadro ? limitar(tiempo - ultimoCuadro, 4, 64) : 16.667;
    ultimoCuadro = tiempo;
    const avance = 1 - Math.pow(1 - 0.14, dt / 16.667);
    ySuave = reducido || Math.abs(resto) < 0.15 ? objetivo : ySuave + resto * avance;
    pintar(false);
    if (ySuave !== objetivo) cuadro = requestAnimationFrame(bucle);
    else ultimoCuadro = 0;
  }
  const pedirCuadro = () => { if (!cuadro) cuadro = requestAnimationFrame(bucle); };

   
  let temporizador = 0;
  function alRedimensionar() {


    const cambioReal = window.innerWidth !== ancho || Math.abs(window.innerHeight - alto) > 140;
    if (!cambioReal) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(medir, 120);
  }
  function alCambiarMovimiento() {
    reducido = consultaReducido.matches;
    if (reducido) capas.forEach((c) => { c.el.style.transform = ''; c.ultimo = ''; });
    pedirCuadro();
  }

  window.addEventListener('scroll', pedirCuadro, { passive: true });
  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(medir, 250));
  window.addEventListener('load', medir);
  consultaReducido.addEventListener?.('change', alCambiarMovimiento);
  if (document.fonts?.ready) document.fonts.ready.then(medir);


  let altoDocumento = 0;
  const observadorAlto = new ResizeObserver(() => {
    const nuevo = document.documentElement.scrollHeight;
    if (Math.abs(nuevo - altoDocumento) < 4) return;
    altoDocumento = nuevo;
    clearTimeout(temporizador);
    temporizador = setTimeout(medir, 120);
  });
  observadorAlto.observe(document.body);

  raiz.classList.add('js');
  prepararRevelados();
  medir();

  const capaNoche = document.querySelector('#ambiente > .amb--noche');
  if (capaNoche && (!capaNoche.offsetWidth || !capaNoche.offsetHeight)) raiz.classList.add('sin-ambiente');
  if (opciones.revelarAlIniciar !== false) activarRevelados();

  return {
    medir,
    activarRevelados,

    actualizar() {
      prepararRevelados();
      if (reveladosActivos) [...pendientes].forEach((el) => (reducido ? mostrar(el) : vigilar(el)));
      medir();
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', pedirCuadro);
      window.removeEventListener('resize', alRedimensionar);
      observadorRevelar.disconnect();
      observadorPrecalentar.disconnect();
      observadorVisibles.disconnect();
      observadorAlto.disconnect();
    }
  };
}
