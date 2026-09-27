// Galería «Nuestros momentos»: carrusel de polaroids.
// El desplazamiento horizontal es NATIVO (scroll-snap). Aquí solo se lee su
// posición para enderezar la foto del centro, y se escriben transform y opacity.
// Mientras una foto no tenga `src` en config.js se dibuja un marco ilustrado.

import { CONFIG } from './config.js';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suavizar = (t) => t * t * (3 - 2 * t);
const salida = (t) => 1 - Math.pow(1 - t, 3);

const SVG = 'http://www.w3.org/2000/svg';

// Giro de cada polaroid en reposo (grados). Se repite si hay más fotos.
const GIROS = [-4.2, 3.4, -2.6, 4.8, -3.6, 2.4, -4.6, 3];

// Lavados de acuarela de los marcos ilustrados: tonos de la acuarela del castillo.
const LAVADOS = [
  ['#E9C39A', '#C99A45', '#BBB38E'],
  ['#E2C288', '#C98D62', '#E9C39A'],
  ['#BBB38E', '#E9C39A', '#C99A45'],
  ['#E9C39A', '#8C8A5E', '#E2C288'],
  ['#C98D62', '#E2C288', '#BBB38E']
];

/* ── Utilidades de dibujo ── */
function crear(nombre, atributos = {}, padre) {
  const el = document.createElementNS(SVG, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  if (padre) padre.appendChild(el);
  return el;
}

// Azar con semilla: cada marco sale igual en cada visita.
function azar(semilla) {
  let a = (semilla * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Filtros compartidos por todos los marcos (se insertan una sola vez).
function asegurarFiltros() {
  if (document.getElementById('galeria-filtros')) return;
  const svg = crear('svg', { id: 'galeria-filtros', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `
    <defs>
      <filter id="galeria-acuarela" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".011 .016" numOctaves="3" seed="4" result="ruido"/>
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="95" xChannelSelector="R" yChannelSelector="G" result="mancha"/>
        <feGaussianBlur in="mancha" stdDeviation="2.6" result="suave"/>
        <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="9" result="grano"/>
        <feColorMatrix in="grano" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .7 .5" result="poros"/>
        <feComposite in="suave" in2="poros" operator="in"/>
      </filter>
      <filter id="galeria-tinta" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="3" result="r"/>
        <feDisplacementMap in="SourceGraphic" in2="r" scale="2.4"/>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
}

// Rama de laurel: tallo en arco y hojas a tinta con su lavado corrido.
function dibujarRama(grupoLavado, grupoTinta, cx, cy, radio, desde, hasta, rnd) {
  const pasos = 9;
  const aRad = (g) => (g * Math.PI) / 180;
  const punto = (g, r = radio) => [cx + Math.cos(aRad(g)) * r, cy + Math.sin(aRad(g)) * r];
  const sentido = hasta > desde ? 1 : -1;

  let d = '';
  for (let i = 0; i <= 24; i++) {
    const g = desde + ((hasta - desde) * i) / 24;
    const [x, y] = punto(g, radio + Math.sin(i * 0.9) * 1.2);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  crear('path', { d, fill: 'none', stroke: '#5C5138', 'stroke-width': 1.25, 'stroke-linecap': 'round', opacity: .62 }, grupoTinta);

  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos;
    const g = desde + (hasta - desde) * t;
    const [x, y] = punto(g);
    const tangente = g + 90 * sentido;
    const largo = (30 - t * 12) * (0.88 + rnd() * 0.3);
    const grueso = largo * (0.25 + rnd() * 0.06);
    for (const lado of [-1, 1]) {
      if (i === pasos && lado === 1) continue;
      const giro = tangente + lado * (34 + rnd() * 16);
      const hoja = `M0 0 C ${(largo * .3).toFixed(1)} ${(-grueso).toFixed(1)}, ${(largo * .72).toFixed(1)} ${(-grueso).toFixed(1)}, ${largo.toFixed(1)} 0 `
        + `C ${(largo * .72).toFixed(1)} ${grueso.toFixed(1)}, ${(largo * .3).toFixed(1)} ${grueso.toFixed(1)}, 0 0 Z`;
      // El lavado se sale un poco de la línea, como en la acuarela del castillo
      crear('path', {
        d: hoja,
        fill: rnd() > .4 ? '#8C8A5E' : '#BBB38E',
        opacity: (.3 + rnd() * .22).toFixed(2),
        transform: `translate(${(x + rnd() * 5 - 2.5).toFixed(1)} ${(y + rnd() * 5 - 2.5).toFixed(1)}) rotate(${(giro + rnd() * 6 - 3).toFixed(1)}) scale(1.12)`
      }, grupoLavado);
      crear('path', {
        d: hoja + ` M0 0 L ${(largo * .82).toFixed(1)} 0`,
        fill: 'none', stroke: '#5C5138', 'stroke-width': 1.05, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .66,
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${giro.toFixed(1)})`
      }, grupoTinta);
    }
  }
}

// Marco ilustrado: papel fotográfico con lavado de acuarela y el monograma.
function dibujarMarco(indice, monograma) {
  const rnd = azar(indice + 11);
  const tonos = LAVADOS[indice % LAVADOS.length];
  const svg = crear('svg', { viewBox: '0 0 400 500', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false' });

  const idPapel = `galeria-papel-${indice}`;
  const defs = crear('defs', {}, svg);
  const degradado = crear('linearGradient', { id: idPapel, x1: 0, y1: 0, x2: .4, y2: 1 }, defs);
  crear('stop', { offset: 0, 'stop-color': '#FBF5E8' }, degradado);
  crear('stop', { offset: 1, 'stop-color': '#F0E4CB' }, degradado);
  crear('rect', { width: 400, height: 500, fill: `url(#${idPapel})` }, svg);

  // Manchas grandes de acuarela
  const lavado = crear('g', { filter: 'url(#galeria-acuarela)' }, svg);
  const manchas = [
    { x: 200 + (rnd() - .5) * 90, y: 215 + (rnd() - .5) * 60, rx: 170, ry: 155, c: tonos[0], o: .8 },
    { x: 95 + rnd() * 90, y: 330 + rnd() * 70, rx: 125, ry: 90, c: tonos[1], o: .5 },
    { x: 250 + rnd() * 80, y: 95 + rnd() * 70, rx: 115, ry: 84, c: tonos[2], o: .55 },
    { x: 150 + rnd() * 140, y: 240 + rnd() * 60, rx: 78, ry: 62, c: '#FDFBF5', o: .62 }
  ];
  for (const m of manchas) {
    crear('ellipse', {
      cx: m.x.toFixed(1), cy: m.y.toFixed(1), rx: m.rx, ry: m.ry, fill: m.c, opacity: m.o,
      transform: `rotate(${(rnd() * 50 - 25).toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)})`
    }, lavado);
  }

  // Salpicaduras de pincel
  const gotas = crear('g', {}, svg);
  for (let i = 0; i < 9; i++) {
    crear('circle', {
      cx: (40 + rnd() * 320).toFixed(1), cy: (40 + rnd() * 400).toFixed(1), r: (1.2 + rnd() * 3.2).toFixed(1),
      fill: rnd() > .5 ? '#C99A45' : '#C98D62', opacity: (.22 + rnd() * .3).toFixed(2)
    }, gotas);
  }

  // Corona de laurel a tinta
  const hojasLavado = crear('g', {}, svg);
  const hojasTinta = crear('g', { filter: 'url(#galeria-tinta)' }, svg);
  dibujarRama(hojasLavado, hojasTinta, 200, 218, 116, 102, 246, rnd);
  dibujarRama(hojasLavado, hojasTinta, 200, 218, 116, 78, -66, rnd);
  // Rombo dorado donde se cruzan las ramas
  crear('path', {
    d: 'M200 328 l6 6 l-6 6 l-6 -6 Z', fill: '#C99A45', opacity: .85
  }, svg);

  // Monograma tenue
  const letras = crear('text', {
    x: 200, y: 246, 'text-anchor': 'middle',
    'font-family': "'Dancing Script', 'Snell Roundhand', cursive", 'font-weight': 600, 'font-size': 86,
    fill: '#5C5138', opacity: .5
  }, svg);
  letras.textContent = monograma;

  return svg;
}

/* ═══════════ Módulo ═══════════ */
export function iniciarGaleria(opciones = {}) {
  const seccion = document.querySelector(opciones.selector || '#galeria');
  if (!seccion) return null;
  if (seccion._galeria) return seccion._galeria;

  const carrusel = seccion.querySelector('[data-galeria-carrusel]');
  const pista = seccion.querySelector('[data-galeria-pista]');
  const lista = seccion.querySelector('[data-galeria-lista]');
  if (!carrusel || !pista || !lista) return null;

  const botonAnterior = seccion.querySelector('[data-galeria-anterior]');
  const botonSiguiente = seccion.querySelector('[data-galeria-siguiente]');
  const cajaPuntos = seccion.querySelector('[data-galeria-puntos]');
  const estado = seccion.querySelector('[data-galeria-estado]');

  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaRaton = window.matchMedia('(hover: hover) and (pointer: fine)');
  let reducido = consultaReducido.matches;

  const monograma = CONFIG.novios?.monograma || 'A&V';
  let fotos = Array.isArray(opciones.fotos) ? opciones.fotos : CONFIG.fotos;
  fotos = (Array.isArray(fotos) ? fotos : []).filter(Boolean);
  // Sin datos todavía: tres marcos ilustrados para que el diseño se vea completo
  if (!fotos.length) fotos = [{ src: '', pie: '' }, { src: '', pie: '' }, { src: '', pie: '' }];

  // Al destruir el módulo se sueltan todos sus oyentes
  const control = new AbortController();
  const { signal } = control;
  let destruido = false;

  asegurarFiltros();

  /* ── Construcción de las polaroids ── */
  const tarjetas = [];   // { item, polaroid, brillo, giro, centro, real, foto }
  const puntos = [];
  lista.textContent = '';
  if (cajaPuntos) cajaPuntos.textContent = '';

  function ponerMarco(ventana, indice) {
    ventana.querySelector('img')?.remove();
    ventana.appendChild(dibujarMarco(indice, monograma));
    const leyenda = document.createElement('span');
    leyenda.className = 'galeria__pronto';
    leyenda.textContent = 'Muy pronto';
    ventana.appendChild(leyenda);
  }

  fotos.forEach((foto, i) => {
    const real = typeof foto.src === 'string' && foto.src.trim() !== '';
    const pie = (foto.pie || '').trim();
    const item = document.createElement('li');
    item.className = 'galeria__item';
    item.setAttribute('aria-roledescription', 'diapositiva');
    item.setAttribute('aria-label', `${i + 1} de ${fotos.length}`);

    const polaroid = document.createElement(real ? 'button' : 'div');
    polaroid.className = 'galeria__polaroid';
    const giro = GIROS[i % GIROS.length];
    polaroid.style.setProperty('--giro', `${giro}deg`);

    const ventana = document.createElement('span');
    ventana.className = 'galeria__ventana';

    const tarjeta = { item, polaroid, giro, centro: 0, real, foto, indice: i, brillo: null };

    if (real) {
      polaroid.type = 'button';
      polaroid.setAttribute('aria-label', `Ver en grande: ${pie || foto.alt || `fotografía ${i + 1}`}`);
      // Debajo de la foto queda un lavado cálido mientras carga
      ventana.appendChild(dibujarMarco(i, ''));
      const img = document.createElement('img');
      img.className = 'galeria__foto';
      img.alt = foto.alt || pie || 'Verónica y Abraham';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', () => img.classList.add('es-cargada'), { once: true, signal });
      img.addEventListener('error', () => {
        // Si la foto no llega, el marco ilustrado toma su lugar
        tarjeta.real = false;
        ventana.textContent = '';
        ponerMarco(ventana, i);
        if (tarjeta.brillo) ventana.appendChild(tarjeta.brillo);
        polaroid.setAttribute('aria-label', `${pie || 'Fotografía'}: muy pronto`);
        polaroid.setAttribute('aria-disabled', 'true');
      }, { once: true, signal });
      img.src = foto.src;
      if (img.complete && img.naturalWidth) img.classList.add('es-cargada');
      ventana.appendChild(img);
    } else {
      ponerMarco(ventana, i);
    }

    const brillo = document.createElement('span');
    brillo.className = 'galeria__brillo';
    brillo.setAttribute('aria-hidden', 'true');
    ventana.appendChild(brillo);
    tarjeta.brillo = brillo;

    const textoPie = document.createElement('span');
    textoPie.className = 'galeria__pie';
    textoPie.textContent = pie;

    polaroid.append(ventana, textoPie);
    item.appendChild(polaroid);
    lista.appendChild(item);
    tarjetas.push(tarjeta);

    if (cajaPuntos) {
      const li = document.createElement('li');
      const punto = document.createElement('button');
      punto.type = 'button';
      punto.className = 'galeria__punto';
      punto.setAttribute('aria-label', `Fotografía ${i + 1} de ${fotos.length}${pie ? `: ${pie}` : ''}`);
      punto.addEventListener('click', () => ir(i), { signal });
      li.appendChild(punto);
      cajaPuntos.appendChild(li);
      puntos.push(punto);
    }
  });

  /* ── Estado ── */
  let anchoPista = 0;
  let paso = 1;
  let activa = -1;
  let cuadro = 0;
  let enPantalla = false;
  let apertura = reducido ? 1 : 0;   // 0 = mazo cerrado, 1 = fotos repartidas
  let inicioApertura = 0;
  let viaje = null;                  // desplazamiento animado (inercia del arrastre)
  let arrastre = null;
  let suprimirClic = false;
  let cajaPuntero = null;
  const inclinacion = { x: 0, y: 0, hx: 0, hy: 0 };  // actual y hacia dónde va
  let temporizadorEstado = 0;

  const destinoDe = (i) => tarjetas[i].centro - anchoPista / 2;
  const topeScroll = () => Math.max(0, pista.scrollWidth - pista.clientWidth);

  function medir() {
    anchoPista = pista.clientWidth;
    tarjetas.forEach((t) => { t.centro = t.item.offsetLeft + t.item.offsetWidth / 2; });
    paso = tarjetas.length > 1 ? tarjetas[1].centro - tarjetas[0].centro : (tarjetas[0]?.item.offsetWidth || 1);
    if (paso <= 0) paso = 1;
  }

  function masCercana(x) {
    const centro = x + anchoPista / 2;
    let mejor = 0;
    let distancia = Infinity;
    tarjetas.forEach((t, i) => {
      const d = Math.abs(t.centro - centro);
      if (d < distancia) { distancia = d; mejor = i; }
    });
    return mejor;
  }

  function anunciar() {
    if (!estado || activa < 0) return;
    const t = tarjetas[activa];
    const pie = (t.foto.pie || '').trim();
    const texto = `Fotografía ${activa + 1} de ${tarjetas.length}${pie ? `: ${pie}` : ''}${t.real ? '' : '. Muy pronto.'}`;
    if (estado.textContent !== texto) estado.textContent = texto;
  }

  function marcarActiva(i) {
    if (i === activa) return;
    const primera = activa < 0;
    activa = i;
    tarjetas.forEach((t, k) => t.item.classList.toggle('es-activa', k === i));
    puntos.forEach((p, k) => {
      if (k === i) p.setAttribute('aria-current', 'true');
      else p.removeAttribute('aria-current');
    });
    botonAnterior?.setAttribute('aria-disabled', String(i === 0));
    botonSiguiente?.setAttribute('aria-disabled', String(i === tarjetas.length - 1));
    clearTimeout(temporizadorEstado);
    if (!primera) temporizadorEstado = setTimeout(anunciar, 420);
  }

  /* ── Pintado: solo transform y opacity ── */
  function pintar() {
    const x = pista.scrollLeft;
    const centro = x + anchoPista / 2;
    const cerrado = 1 - apertura;
    const conRaton = consultaRaton.matches && !reducido;

    let mejor = 0;
    let menor = Infinity;

    for (let i = 0; i < tarjetas.length; i++) {
      const t = tarjetas[i];
      const d = (t.centro - centro) / paso;
      const lejos = Math.abs(d);
      if (lejos < menor) { menor = lejos; mejor = i; }
      if (lejos > 3.2 && cerrado === 0) continue;   // fuera de vista: no se toca

      const a = suavizar(limitar(lejos, 0, 1));
      const signo = Math.sign(d);
      // Las vecinas se arriman un poco a la del centro y bajan
      let tx = -signo * a * paso * 0.05;
      let ty = a * 14;
      let giro = t.giro * a;
      let escala = 1 - 0.15 * a;
      let opacidad = 1 - 0.38 * a;

      // Entrada: el mazo se reparte desde detrás de la foto del centro
      // (el fundido lo pone el revelado del contenedor)
      if (cerrado > 0) {
        tx += -d * paso * 0.82 * cerrado;
        giro += t.giro * 1.4 * cerrado * (lejos > 0.05 ? 1 : 0.4);
        ty += 18 * cerrado;
      }

      let valor = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      const peso = 1 - a;   // cuánto manda el puntero sobre esta tarjeta
      if (conRaton && peso > 0.02 && (Math.abs(inclinacion.x) > 0.01 || Math.abs(inclinacion.y) > 0.01)) {
        valor += ` rotateX(${(inclinacion.x * peso).toFixed(3)}deg) rotateY(${(inclinacion.y * peso).toFixed(3)}deg)`;
        const bx = (inclinacion.y / 5) * 34 * peso;
        const by = (-inclinacion.x / 4) * 22 * peso;
        const brillo = `translate3d(${bx.toFixed(2)}%, ${by.toFixed(2)}%, 0)`;
        if (brillo !== t.ultimoBrillo) {
          t.brillo.style.transform = brillo;
          t.brillo.style.opacity = (Math.min(1, Math.hypot(inclinacion.x, inclinacion.y) / 4) * peso).toFixed(3);
          t.ultimoBrillo = brillo;
        }
      } else if (t.ultimoBrillo) {
        t.brillo.style.opacity = '0';
        t.ultimoBrillo = '';
      }
      valor += ` rotate(${giro.toFixed(3)}deg) scale(${escala.toFixed(4)})`;

      if (valor !== t.ultimo) { t.polaroid.style.transform = valor; t.ultimo = valor; }
      const op = opacidad.toFixed(3);
      if (op !== t.ultimaOpacidad) { t.polaroid.style.opacity = op; t.ultimaOpacidad = op; }
    }

    marcarActiva(mejor);
  }

  /* ── Un solo requestAnimationFrame para todo el módulo ── */
  function bucle(ahora) {
    cuadro = 0;
    let seguir = false;

    if (viaje) {
      if (!viaje.inicio) viaje.inicio = ahora;
      const t = limitar((ahora - viaje.inicio) / viaje.duracion, 0, 1);
      pista.scrollLeft = viaje.desde + (viaje.hasta - viaje.desde) * salida(t);
      if (t >= 1) {
        pista.scrollLeft = viaje.hasta;
        viaje = null;
        pista.classList.remove('es-libre');
      } else seguir = true;
    }

    if (apertura < 1 && inicioApertura) {
      const t = limitar((ahora - inicioApertura) / 1500, 0, 1);
      apertura = salida(t);
      if (t < 1) seguir = true; else apertura = 1;
    }

    const dx = inclinacion.hx - inclinacion.x;
    const dy = inclinacion.hy - inclinacion.y;
    if (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004) {
      inclinacion.x += dx * 0.1;
      inclinacion.y += dy * 0.1;
      seguir = true;
    } else {
      inclinacion.x = inclinacion.hx;
      inclinacion.y = inclinacion.hy;
    }

    pintar();
    if (seguir) pedirCuadro();
  }
  function pedirCuadro() {
    if (destruido || cuadro || document.hidden || !enPantalla) return;
    cuadro = requestAnimationFrame(bucle);
  }

  /* ── Navegación ── */
  function ir(indice, instantaneo = false) {
    if (destruido) return;
    const i = limitar(indice, 0, tarjetas.length - 1);
    if (viaje) { viaje = null; pista.classList.remove('es-libre'); }
    const left = limitar(destinoDe(i), 0, topeScroll());
    pista.scrollTo({ left, behavior: instantaneo || reducido ? 'auto' : 'smooth' });
    pedirCuadro();
  }

  function alPulsarFlecha(evento, sentido) {
    if (evento.currentTarget.getAttribute('aria-disabled') === 'true') return;
    ir(activa + sentido);
  }
  botonAnterior?.addEventListener('click', (e) => alPulsarFlecha(e, -1), { signal });
  botonSiguiente?.addEventListener('click', (e) => alPulsarFlecha(e, 1), { signal });

  carrusel.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    let destino = null;
    if (evento.key === 'ArrowLeft') destino = activa - 1;
    else if (evento.key === 'ArrowRight') destino = activa + 1;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = tarjetas.length - 1;
    if (destino === null) return;
    evento.preventDefault();
    ir(destino);
  });

  // Al llegar con el teclado a una foto, se trae al centro
  lista.addEventListener('focusin', (evento) => {
    const item = evento.target.closest?.('.galeria__item');
    const i = tarjetas.findIndex((t) => t.item === item);
    if (i >= 0 && i !== activa && !arrastre) ir(i);
  });

  // Clic: la del centro se abre en grande; una vecina pasa al centro
  lista.addEventListener('click', (evento) => {
    if (suprimirClic) { evento.preventDefault(); evento.stopPropagation(); return; }
    const item = evento.target.closest?.('.galeria__item');
    const i = tarjetas.findIndex((t) => t.item === item);
    if (i < 0) return;
    if (i !== activa) { ir(i); return; }
    if (tarjetas[i].real) abrirVisor(i, tarjetas[i].polaroid);
  });

  /* ── Arrastre con ratón e inercia (en táctil manda el scroll nativo) ── */
  function alBajarPuntero(evento) {
    if (evento.pointerType !== 'mouse' || evento.button !== 0) return;
    arrastre = {
      id: evento.pointerId,
      x0: evento.clientX,
      scroll0: pista.scrollLeft,
      activo: false,
      muestras: [{ x: evento.clientX, t: evento.timeStamp }]
    };
    window.addEventListener('pointermove', alMoverArrastre, { signal });
    window.addEventListener('pointerup', alSoltarArrastre, { signal });
    window.addEventListener('pointercancel', alSoltarArrastre, { signal });
  }
  function alMoverArrastre(evento) {
    if (!arrastre || evento.pointerId !== arrastre.id) return;
    const dx = evento.clientX - arrastre.x0;
    if (!arrastre.activo) {
      if (Math.abs(dx) < 6) return;
      arrastre.activo = true;
      arrastre.x0 = evento.clientX;
      arrastre.scroll0 = pista.scrollLeft;
      viaje = null;
      pista.classList.add('es-libre', 'es-arrastrando');
      try { pista.setPointerCapture(arrastre.id); } catch (e) { /* sin captura también funciona */ }
      inclinacion.hx = 0; inclinacion.hy = 0;
      return;
    }
    evento.preventDefault();
    pista.scrollLeft = limitar(arrastre.scroll0 - dx, 0, topeScroll());
    arrastre.muestras.push({ x: evento.clientX, t: evento.timeStamp });
    if (arrastre.muestras.length > 6) arrastre.muestras.shift();
    pedirCuadro();
  }
  function alSoltarArrastre(evento) {
    if (!arrastre || evento.pointerId !== arrastre.id) return;
    window.removeEventListener('pointermove', alMoverArrastre);
    window.removeEventListener('pointerup', alSoltarArrastre);
    window.removeEventListener('pointercancel', alSoltarArrastre);
    const fue = arrastre;
    arrastre = null;
    if (!fue.activo) return;

    try { pista.releasePointerCapture(fue.id); } catch (e) { /* nada */ }
    pista.classList.remove('es-arrastrando');
    suprimirClic = true;
    setTimeout(() => { suprimirClic = false; }, 0);

    // Velocidad de los últimos instantes (px/ms)
    const recientes = fue.muestras.filter((m) => evento.timeStamp - m.t < 120);
    let velocidad = 0;
    if (recientes.length > 1) {
      const a = recientes[0];
      const b = recientes[recientes.length - 1];
      if (b.t > a.t) velocidad = (b.x - a.x) / (b.t - a.t);
    }
    const desde = pista.scrollLeft;
    const proyectado = desde - limitar(velocidad, -3, 3) * 260;
    let i = masCercana(limitar(proyectado, 0, topeScroll()));
    // Un gesto decidido siempre avanza al menos una foto
    const origen = masCercana(fue.scroll0);
    if (i === origen && Math.abs(velocidad) > 0.35) i = limitar(origen - Math.sign(velocidad), 0, tarjetas.length - 1);
    const hasta = limitar(destinoDe(i), 0, topeScroll());

    if (reducido) {
      pista.scrollLeft = hasta;
      pista.classList.remove('es-libre');
    } else {
      viaje = { desde, hasta, inicio: 0, duracion: limitar(420 + Math.abs(hasta - desde) * 0.9, 420, 1100) };
    }
    pedirCuadro();
  }
  pista.addEventListener('pointerdown', alBajarPuntero, { signal });
  pista.addEventListener('dragstart', (e) => e.preventDefault(), { signal });

  /* ── Inclinación 3D según el puntero (solo escritorio) ── */
  pista.addEventListener('pointerenter', () => { cajaPuntero = pista.getBoundingClientRect(); }, { signal });
  pista.addEventListener('pointermove', (evento) => {
    if (evento.pointerType !== 'mouse' || reducido || !consultaRaton.matches || arrastre?.activo) return;
    if (!cajaPuntero) cajaPuntero = pista.getBoundingClientRect();
    const mitad = (tarjetas[0]?.item.offsetWidth || 320) * 0.75;
    const nx = limitar((evento.clientX - (cajaPuntero.left + cajaPuntero.width / 2)) / mitad, -1, 1);
    const ny = limitar((evento.clientY - (cajaPuntero.top + cajaPuntero.height / 2)) / (mitad * 1.3), -1, 1);
    inclinacion.hy = nx * 5;
    inclinacion.hx = -ny * 4;
    pedirCuadro();
  });
  pista.addEventListener('pointerleave', () => {
    inclinacion.hx = 0; inclinacion.hy = 0; cajaPuntero = null;
    pedirCuadro();
  });

  pista.addEventListener('scroll', () => { cajaPuntero = null; pedirCuadro(); }, { passive: true, signal });
  window.addEventListener('scroll', () => { cajaPuntero = null; }, { passive: true, signal });

  /* ── Visor: la foto en grande ── */
  let visor = null;
  let visorIndice = -1;
  let visorOrigen = null;

  function crearVisor() {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'galeria-visor';
    dialogo.setAttribute('aria-label', 'Fotografía en grande');
    dialogo.innerHTML = `
      <div class="galeria-visor__fondo" data-cerrar></div>
      <div class="galeria-visor__escena" data-cerrar>
        <figure class="galeria-visor__marco">
          <img class="galeria-visor__foto" alt="" decoding="async" draggable="false">
          <figcaption class="galeria-visor__pie"></figcaption>
        </figure>
      </div>
      <button type="button" class="galeria-visor__boton galeria-visor__boton--anterior" aria-label="Fotografía anterior">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="galeria-visor__boton galeria-visor__boton--siguiente" aria-label="Fotografía siguiente">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="galeria-visor__boton galeria-visor__boton--cerrar" aria-label="Cerrar fotografía">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>`;
    const partes = {
      dialogo,
      foto: dialogo.querySelector('.galeria-visor__foto'),
      pie: dialogo.querySelector('.galeria-visor__pie'),
      anterior: dialogo.querySelector('.galeria-visor__boton--anterior'),
      siguiente: dialogo.querySelector('.galeria-visor__boton--siguiente'),
      cerrar: dialogo.querySelector('.galeria-visor__boton--cerrar')
    };
    partes.cerrar.addEventListener('click', cerrarVisor, { signal });
    partes.anterior.addEventListener('click', () => pasarVisor(-1), { signal });
    partes.siguiente.addEventListener('click', () => pasarVisor(1), { signal });
    dialogo.addEventListener('click', (evento) => {
      if (evento.target.hasAttribute?.('data-cerrar')) cerrarVisor();
    });
    // Esc: se cierra con el mismo fundido
    dialogo.addEventListener('cancel', (evento) => { evento.preventDefault(); cerrarVisor(); }, { signal });
    dialogo.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') { evento.preventDefault(); pasarVisor(-1); }
      else if (evento.key === 'ArrowRight') { evento.preventDefault(); pasarVisor(1); }
    });
    dialogo.addEventListener('close', alCerrarVisor, { signal });
    // Sin <dialog> nativo no hay capa superior: se cuelga de body para salir del apilamiento de main
    (typeof dialogo.showModal === 'function' ? seccion : document.body).appendChild(dialogo);
    return partes;
  }

  const reales = () => tarjetas.filter((t) => t.real).map((t) => t.indice);

  function mostrarEnVisor(i) {
    const t = tarjetas[i];
    visorIndice = i;
    const pie = (t.foto.pie || '').trim();
    visor.foto.src = t.foto.src;
    visor.foto.alt = t.foto.alt || pie || 'Verónica y Abraham';
    visor.pie.textContent = pie;
    visor.pie.hidden = !pie;
    const lista = reales();
    const pos = lista.indexOf(i);
    visor.anterior.hidden = pos <= 0;
    visor.siguiente.hidden = pos < 0 || pos >= lista.length - 1;
  }

  function pasarVisor(sentido) {
    const lista = reales();
    const pos = lista.indexOf(visorIndice) + sentido;
    if (pos < 0 || pos >= lista.length) return;
    const destino = lista[pos];
    const enfocado = document.activeElement;
    const cambiar = () => {
      mostrarEnVisor(destino);
      visor.foto.classList.remove('es-cambiando');
      // Si el botón usado desapareció, el foco pasa a «cerrar»
      if (enfocado && enfocado.hidden) visor.cerrar.focus();
    };
    if (reducido) cambiar();
    else {
      visor.foto.classList.add('es-cambiando');
      setTimeout(cambiar, 260);
    }
    ir(destino, true);
  }

  function abrirVisor(i, origen) {
    if (destruido) return;
    if (!visor) visor = crearVisor();
    if (visor.dialogo.hasAttribute('open')) return;
    visorOrigen = origen || null;
    mostrarEnVisor(i);
    document.documentElement.classList.add('galeria-sin-scroll');
    if (typeof visor.dialogo.showModal === 'function') visor.dialogo.showModal();
    else visor.dialogo.setAttribute('open', '');
    visor.cerrar.focus({ preventScroll: true });
    // Doble cuadro: el navegador pinta el estado inicial antes del fundido
    requestAnimationFrame(() => requestAnimationFrame(() => visor.dialogo.classList.add('es-abierto')));
  }

  let temporizadorCierre = 0;
  function cerrarVisor() {
    if (!visor || !visor.dialogo.hasAttribute('open')) return;
    visor.dialogo.classList.remove('es-abierto');
    clearTimeout(temporizadorCierre);
    const terminar = () => {
      if (typeof visor.dialogo.close === 'function') visor.dialogo.close();
      else { visor.dialogo.removeAttribute('open'); alCerrarVisor(); }
    };
    if (reducido) terminar();
    else temporizadorCierre = setTimeout(terminar, 520);
  }
  function alCerrarVisor() {
    visor.dialogo.classList.remove('es-abierto');
    document.documentElement.classList.remove('galeria-sin-scroll');
    // El foco vuelve a la foto que se estaba viendo
    const regreso = tarjetas[visorIndice]?.real ? tarjetas[visorIndice].polaroid : visorOrigen;
    regreso?.focus?.({ preventScroll: true });
    visorOrigen = null;
    pedirCuadro();
  }

  /* ── Visibilidad: todo se pausa fuera de pantalla o con la pestaña oculta ── */
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.target === seccion) {
        enPantalla = entrada.isIntersecting;
        seccion.classList.toggle('es-en-pantalla', enPantalla && !document.hidden);
        if (enPantalla) pedirCuadro();
      } else if (entrada.target === pista && entrada.isIntersecting && !inicioApertura) {
        // Primera vez que se ve el carrusel: el mazo se reparte
        inicioApertura = performance.now() + 120;
        observador.unobserve(pista);
        pedirCuadro();
      }
    }
  }, { threshold: [0, 0.25] });
  observador.observe(seccion);
  observador.observe(pista);

  function alCambiarVisibilidad() {
    seccion.classList.toggle('es-en-pantalla', enPantalla && !document.hidden);
    if (!document.hidden) {
      // El tiempo oculto no cuenta para las animaciones en curso
      if (viaje) viaje.inicio = 0;
      pedirCuadro();
    }
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad, { signal });

  function alCambiarMovimiento() {
    reducido = consultaReducido.matches;
    if (reducido) { apertura = 1; inclinacion.hx = 0; inclinacion.hy = 0; inclinacion.x = 0; inclinacion.y = 0; }
    pedirCuadro();
  }
  consultaReducido.addEventListener?.('change', alCambiarMovimiento);

  // Cambios de tamaño: se vuelve a medir y la activa sigue en el centro
  let anchoAnterior = 0;
  const observadorTamano = new ResizeObserver(() => {
    const nuevo = pista.clientWidth;
    if (nuevo === anchoAnterior) return;
    anchoAnterior = nuevo;
    const i = Math.max(0, activa);
    medir();
    if (!arrastre && !viaje) pista.scrollLeft = limitar(destinoDe(i), 0, topeScroll());
    cajaPuntero = null;
    tarjetas.forEach((t) => { t.ultimo = ''; });
    pintar();
  });
  observadorTamano.observe(pista);
  document.fonts?.ready?.then(() => { medir(); pintar(); });

  /* ── Arranque ── */
  medir();
  anchoAnterior = pista.clientWidth;
  // En celular se empieza por la primera (la segunda asoma e invita a deslizar);
  // en pantallas anchas, por la de en medio, para que haya fotos a ambos lados.
  const pedido = parseInt(opciones.inicio, 10);
  const porDefecto = anchoPista >= 900 ? Math.floor((tarjetas.length - 1) / 2) : 0;
  const inicio = limitar(Number.isFinite(pedido) ? pedido : porDefecto, 0, tarjetas.length - 1);
  pista.scrollLeft = limitar(destinoDe(inicio), 0, topeScroll());
  pintar();
  anunciar();

  const api = {
    ir,
    siguiente: () => ir(activa + 1),
    anterior: () => ir(activa - 1),
    get activa() { return activa; },
    medir() { medir(); pintar(); },
    destruir() {
      destruido = true;
      control.abort();
      cancelAnimationFrame(cuadro);
      clearTimeout(temporizadorEstado);
      clearTimeout(temporizadorCierre);
      observador.disconnect();
      observadorTamano.disconnect();
      consultaReducido.removeEventListener?.('change', alCambiarMovimiento);
      if (visor) { visor.dialogo.remove(); visor = null; }
      document.documentElement.classList.remove('galeria-sin-scroll');
      delete seccion._galeria;
    }
  };
  seccion._galeria = api;
  return api;
}
