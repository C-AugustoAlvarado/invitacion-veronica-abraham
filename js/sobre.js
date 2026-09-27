// Sobre de bienvenida: lo primero que ve el invitado.
// Un sobre cerrado a pantalla completa con sello de lacre A&V. Al tocar el
// sello, este se parte, la solapa se levanta, la bolsa se desliza y aparece
// la invitación, que ya está debajo. Construye su propio DOM dentro de
// <div id="sobre"></div>. Se comunica solo con eventos en document:
// emite 'petalos:rafaga' y 'sobre:abierto' (DISENO.md §4).

import { CONFIG } from './config.js';

const SVG = 'http://www.w3.org/2000/svg';
const n = (v) => Number(v).toFixed(1);

// Contorno irregular del lacre (viewBox 0 0 200 200), con sus goterones.
const CONTORNO = 'M191.5 100C191.7 104.7 190.3 109.6 189.1 114.1C187.9 118.7 186.4 123.3 184.2 127.4C182.1 131.5 178.4 134.8 176.1 138.8C173.8 142.7 172.6 147.2 170.4 151.1C168.1 155.1 166 159.6 162.6 162.6C159.3 165.7 154.5 167.4 150.4 169.4C146.3 171.4 142 172.6 137.9 174.4C133.9 176.3 130.3 179.1 126.1 180.4C122 181.8 117.4 182 113.1 182.7C108.7 183.3 104.4 184.3 100 184.3C95.6 184.4 91.1 183.8 86.9 183C82.6 182.1 79.1 179.3 74.3 179.1C69.6 178.8 63.8 181.5 58.4 181.7C53 181.9 46 182.6 41.8 180.2C37.5 177.7 35.6 171.4 33.1 166.9C30.6 162.4 28.8 157.6 27 153C25.2 148.5 23.6 144 22.4 139.5C21.2 135 20.7 130.5 19.7 126.1C18.8 121.7 16.7 117.6 16.6 113.2C16.5 108.9 18.4 104.3 19.2 100C19.9 95.7 21.5 92 21.3 87.5C21.2 83.1 18.5 78.1 18.5 73.5C18.6 69 19.9 64.2 21.7 60.1C23.6 56 27 52.6 29.9 49C32.7 45.5 35.4 41.8 38.8 38.8C42.1 35.8 46.4 33.9 50 31.1C53.6 28.4 56.6 24.9 60.3 22.1C64 19.4 67.9 15.9 72.3 14.6C76.6 13.3 81.8 14.8 86.5 14.5C91.1 14.2 95.4 13.3 100 12.7C104.6 12.1 109.6 10.3 114.1 10.9C118.6 11.5 122.9 14.5 127.2 16.4C131.4 18.2 135.8 19.7 139.6 22.2C143.4 24.7 147.1 27.8 149.9 31.4C152.7 34.9 153.6 40.2 156.6 43.4C159.5 46.7 164.4 47.8 167.8 50.8C171.1 53.7 174.4 57.1 176.7 60.9C178.9 64.8 179.1 69.5 181.1 73.7C183 77.8 186.5 81.6 188.2 86C190 90.4 191.4 95.3 191.5 100Z';

const escapar = (texto) => String(texto)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── Definiciones compartidas del lacre (degradados y filtros) ── */
function definiciones() {
  return `
<svg class="sobre__defs" aria-hidden="true" focusable="false" xmlns="${SVG}">
  <defs>
    <radialGradient id="sb-lacre" cx="36%" cy="30%" r="78%">
      <stop offset="0" stop-color="#B9523F"/>
      <stop offset=".42" stop-color="#9C3D2E"/>
      <stop offset=".8" stop-color="#7C2F23"/>
      <stop offset="1" stop-color="#6E2A20"/>
    </radialGradient>
    <linearGradient id="sb-canto" x1="18%" y1="10%" x2="82%" y2="92%">
      <stop offset="0" stop-color="#F0B7A2" stop-opacity=".75"/>
      <stop offset=".35" stop-color="#F0B7A2" stop-opacity="0"/>
      <stop offset=".7" stop-color="#3A120C" stop-opacity="0"/>
      <stop offset="1" stop-color="#3A120C" stop-opacity=".6"/>
    </linearGradient>
    <radialGradient id="sb-cuenco" cx="62%" cy="68%" r="80%">
      <stop offset="0" stop-color="#A44332"/>
      <stop offset=".55" stop-color="#8E3729"/>
      <stop offset="1" stop-color="#6B271D"/>
    </radialGradient>
    <linearGradient id="sb-hundido" x1="20%" y1="12%" x2="80%" y2="90%">
      <stop offset="0" stop-color="#36100A" stop-opacity=".85"/>
      <stop offset=".45" stop-color="#36100A" stop-opacity="0"/>
      <stop offset=".6" stop-color="#F3BCA8" stop-opacity="0"/>
      <stop offset="1" stop-color="#F3BCA8" stop-opacity=".7"/>
    </linearGradient>
    <linearGradient id="sb-grabado" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5F2118"/>
      <stop offset="1" stop-color="#7A2E22"/>
    </linearGradient>
    <filter id="sb-brillo" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <filter id="sb-brillo-fino" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
</svg>`;
}

/* ── El sello: lacre con borde irregular, cuenco prensado y monograma ── */
function dibujoSello(monograma) {
  const texto = escapar(monograma);
  return `
<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" xmlns="${SVG}">
  <path d="${CONTORNO}" fill="url(#sb-lacre)"/>
  <path d="${CONTORNO}" fill="none" stroke="url(#sb-canto)" stroke-width="3.2"
        transform="translate(100 100) scale(.972) translate(-100 -100)"/>
  <!-- Rodete que dejó la prensa -->
  <circle cx="100" cy="100" r="72" fill="none" stroke="#F0B7A2" stroke-opacity=".16" stroke-width="7"/>
  <!-- Cuenco prensado -->
  <circle cx="100" cy="100" r="66" fill="url(#sb-cuenco)"/>
  <circle cx="100" cy="100" r="66" fill="none" stroke="url(#sb-hundido)" stroke-width="2.6"/>
  <!-- Filete grabado -->
  <circle cx="100.7" cy="100.9" r="57" fill="none" stroke="#F3BCA8" stroke-opacity=".4" stroke-width="1.1"/>
  <circle cx="100" cy="100" r="57" fill="none" stroke="#4A170F" stroke-opacity=".75" stroke-width="1.1"/>
  <!-- Monograma en bajorrelieve: luz abajo a la derecha, sombra arriba a la izquierda -->
  <g font-family="'Dancing Script', 'Snell Roundhand', cursive" font-weight="700" font-size="56"
     text-anchor="middle" letter-spacing="1">
    <text x="101.3" y="119.700" fill="#F6C4B0" fill-opacity=".55">${texto}</text>
    <text x="98.9" y="116.700" fill="#2E0D08" fill-opacity=".8">${texto}</text>
    <text x="100" y="118" fill="url(#sb-grabado)">${texto}</text>
  </g>
  <!-- Brillos del lacre -->
  <ellipse cx="66" cy="44" rx="34" ry="11" transform="rotate(-34 66 44)" fill="#FFE9DF" fill-opacity=".34" filter="url(#sb-brillo)"/>
  <path d="M40 66C47 49 60 36 77 28" fill="none" stroke="#FFF1EA" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round" filter="url(#sb-brillo-fino)"/>
  <ellipse cx="143" cy="159" rx="20" ry="6" transform="rotate(-36 143 159)" fill="#F0B7A2" fill-opacity=".2" filter="url(#sb-brillo)"/>
</svg>`;
}

/* ── Papel: bolsa, solapa y sombra, dibujadas en pixeles de la ventana ── */
function geometria(raiz) {
  const ancho = raiz.clientWidth || window.innerWidth;
  const alto = raiz.clientHeight || window.innerHeight;
  const punta = parseFloat(getComputedStyle(raiz).getPropertyValue('--sobre-punta')) || 56;
  return {
    ancho, alto,
    medio: ancho / 2,
    yPunta: alto * (punta / 100) + 5,   // punta de la solapa
    yValle: alto * (punta / 100) - alto * 0.065   // donde se juntan los dobleces
  };
}

function trazoSolapa({ ancho, medio, yPunta }, margen = 0) {
  // Triángulo con la punta apenas redondeada
  const r = 16;
  const dx = r * (medio / Math.hypot(medio, yPunta));
  const dy = r * (yPunta / Math.hypot(medio, yPunta));
  return `M${n(-margen)} ${n(-margen)}H${n(ancho + margen)}L${n(medio + dx)} ${n(yPunta - dy + margen)}`
    + `Q${n(medio)} ${n(yPunta + margen + 3)} ${n(medio - dx)} ${n(yPunta - dy + margen)}Z`;
}

function dibujoBolsa(g) {
  const { ancho, alto, medio, yValle } = g;
  const bolsa = `M0 0L${n(medio)} ${n(yValle)}L${n(ancho)} 0V${n(alto)}H0Z`;
  const inferior = `M${n(-2)} ${n(alto + 2)}L${n(medio - 10)} ${n(yValle + 9)}Q${n(medio)} ${n(yValle - 1)} ${n(medio + 10)} ${n(yValle + 9)}L${n(ancho + 2)} ${n(alto + 2)}Z`;
  return `
<svg viewBox="0 0 ${n(ancho)} ${n(alto)}" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="${SVG}">
  <defs>
    <linearGradient id="sb-lado-izq" gradientUnits="userSpaceOnUse" x1="0" y1="${n(alto * 0.5)}" x2="${n(medio)}" y2="${n(alto * 0.62)}">
      <stop offset="0" stop-color="#FAF6EC"/><stop offset="1" stop-color="#EFE6D2"/>
    </linearGradient>
    <linearGradient id="sb-lado-der" gradientUnits="userSpaceOnUse" x1="${n(ancho)}" y1="${n(alto * 0.5)}" x2="${n(medio)}" y2="${n(alto * 0.62)}">
      <stop offset="0" stop-color="#F8F3E7"/><stop offset="1" stop-color="#ECE2CC"/>
    </linearGradient>
    <linearGradient id="sb-inferior" gradientUnits="userSpaceOnUse" x1="0" y1="${n(yValle)}" x2="0" y2="${n(alto)}">
      <stop offset="0" stop-color="#FDFBF5"/><stop offset=".55" stop-color="#F8F3E8"/><stop offset="1" stop-color="#F1E9D8"/>
    </linearGradient>
    <filter id="sb-difuso" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="sb-difuso-fino" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="sb-recorte-bolsa"><path d="${bolsa}"/></clipPath>
  </defs>
  <!-- Sombra de la bolsa sobre el forro -->
  <path d="${bolsa}" transform="translate(0 -7)" fill="#4A3A1E" fill-opacity=".34" filter="url(#sb-difuso)"/>
  <path d="${bolsa}" transform="translate(0 -2)" fill="#4A3A1E" fill-opacity=".3" filter="url(#sb-difuso-fino)"/>
  <!-- Solapas laterales -->
  <path d="M0 0L${n(medio)} ${n(yValle)}V${n(alto)}H0Z" fill="url(#sb-lado-izq)"/>
  <path d="M${n(ancho)} 0L${n(medio)} ${n(yValle)}V${n(alto)}H${n(ancho)}Z" fill="url(#sb-lado-der)"/>
  <!-- Solapa inferior, encima de las laterales -->
  <g clip-path="url(#sb-recorte-bolsa)">
    <path d="${inferior}" transform="translate(0 -6)" fill="#4A3A1E" fill-opacity=".26" filter="url(#sb-difuso)"/>
    <path d="${inferior}" transform="translate(0 -1.5)" fill="#4A3A1E" fill-opacity=".22" filter="url(#sb-difuso-fino)"/>
  </g>
  <path d="${inferior}" fill="url(#sb-inferior)"/>
  <!-- Canto de luz en los dobleces -->
  <path d="M${n(-2)} ${n(alto + 2)}L${n(medio - 10)} ${n(yValle + 9)}Q${n(medio)} ${n(yValle - 1)} ${n(medio + 10)} ${n(yValle + 9)}L${n(ancho + 2)} ${n(alto + 2)}"
        fill="none" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="1.2"/>
  <path d="M0 0L${n(medio)} ${n(yValle)}L${n(ancho)} 0" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1.2"/>
</svg>`;
}

function dibujoSombraSolapa(g) {
  return `
<svg viewBox="0 0 ${n(g.ancho)} ${n(g.alto)}" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="${SVG}">
  <defs>
    <filter id="sb-difuso-solapa" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="sb-difuso-solapa-fino" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="2.5"/></filter>
  </defs>
  <path d="${trazoSolapa(g, 0)}" transform="translate(0 9)" fill="#4A3A1E" fill-opacity=".36" filter="url(#sb-difuso-solapa)"/>
  <path d="${trazoSolapa(g, 0)}" transform="translate(0 2)" fill="#4A3A1E" fill-opacity=".3" filter="url(#sb-difuso-solapa-fino)"/>
</svg>`;
}

function dibujoSolapa(g) {
  const { ancho, medio, yPunta } = g;
  // Filete dorado paralelo al canto, como en la papelería fina
  const largo = Math.hypot(medio, yPunta);
  const sep = 13;
  const fx = sep * (largo / yPunta);           // corrimiento horizontal en el borde de arriba
  const fy = yPunta - sep * (largo / medio);   // punta del filete
  return `
<svg viewBox="0 0 ${n(ancho)} ${n(g.alto)}" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="${SVG}">
  <defs>
    <linearGradient id="sb-solapa" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(yPunta)}">
      <stop offset="0" stop-color="#F4EDDD"/><stop offset=".16" stop-color="#FBF8F0"/>
      <stop offset=".7" stop-color="#FCFAF4"/><stop offset="1" stop-color="#F5EFE1"/>
    </linearGradient>
    <linearGradient id="sb-solapa-luz" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${n(ancho)}" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".5"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#5C5138" stop-opacity=".07"/>
    </linearGradient>
  </defs>
  <path d="${trazoSolapa(g)}" fill="url(#sb-solapa)"/>
  <path d="${trazoSolapa(g)}" fill="url(#sb-solapa-luz)"/>
  <path d="M0 0L${n(medio)} ${n(yPunta)}L${n(ancho)} 0" fill="none" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="1.4"/>
  <path d="M${n(fx)} 0L${n(medio)} ${n(fy)}L${n(ancho - fx)} 0" fill="none" stroke="#C99A45" stroke-opacity=".6" stroke-width="1"/>
</svg>`;
}

/* ── Inicio ── */
export function iniciarSobre(opciones = {}) {
  const raiz = typeof opciones.contenedor === 'string'
    ? document.querySelector(opciones.contenedor)
    : (opciones.contenedor || document.getElementById('sobre'));

  const avisar = () => document.dispatchEvent(new CustomEvent('sobre:abierto'));

  // Sin contenedor no hay sobre: la página nunca se queda bloqueada.
  if (!raiz) {
    document.body.classList.remove('bloqueado');
    return null;
  }
  if (raiz._sobre) return raiz._sobre;   // idempotente

  if (opciones.omitir) {
    raiz.remove();
    document.body.classList.remove('bloqueado');
    // En el siguiente turno, para que los demás módulos alcancen a escuchar
    setTimeout(avisar, 0);
    return null;
  }

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { ella, el, monograma } = CONFIG.novios;

  raiz.classList.add('sobre');
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', `Invitación a la boda de ${ella} y ${el}`);
  raiz.innerHTML = `
${definiciones()}
<div class="sobre__escena">
  <div class="sobre__interior" aria-hidden="true">
    <div class="sobre__forro"><div class="sobre__forro-imagen"></div></div>
  </div>
  <div class="sobre__bolsa">
    <div class="sobre__dibujo" data-dibujo="bolsa"></div>
    <div class="sobre__pie">
      <p class="sobre__toca">Toca el sello para abrir</p>
      <p class="sobre__lugar">Morelia, Michoacán</p>
    </div>
  </div>
  <div class="sobre__sombra" data-dibujo="sombra" aria-hidden="true"></div>
  <div class="sobre__solapa">
    <div class="sobre__dibujo" data-dibujo="solapa"></div>
    <div class="sobre__solapa-luz" aria-hidden="true"></div>
    <div class="sobre__nombres">
      <p>${escapar(ella)}<i>&amp;</i>${escapar(el)}</p>
      <span class="sobre__filete" aria-hidden="true"><b></b></span>
    </div>
  </div>
  <div class="sobre__sello-lugar">
    <span class="sobre__sombra-sello" aria-hidden="true"></span>
    <span class="sobre__halo" aria-hidden="true"></span>
    <span class="sobre__halo sobre__halo--eco" aria-hidden="true"></span>
    <span class="sobre__destello" aria-hidden="true"></span>
    <button type="button" class="sobre__sello" aria-label="Abrir la invitación">
      <span class="sobre__prensa">
        <span class="sobre__mitad sobre__mitad--izq">${dibujoSello(monograma)}</span>
        <span class="sobre__mitad sobre__mitad--der">${dibujoSello(monograma)}</span>
      </span>
    </button>
  </div>
</div>
<div class="sobre__grano" aria-hidden="true"></div>`;

  const $ = (selector) => raiz.querySelector(selector);
  const sello = $('.sobre__sello');
  const partes = {
    interior: $('.sobre__interior'),
    forro: $('.sobre__forro'),
    imagen: $('.sobre__forro-imagen'),
    bolsa: $('.sobre__bolsa'),
    pie: $('.sobre__pie'),
    sombra: $('.sobre__sombra'),
    solapa: $('.sobre__solapa'),
    luz: $('.sobre__solapa-luz'),
    nombres: $('.sobre__nombres'),
    lugar: $('.sobre__sello-lugar'),
    prensa: $('.sobre__prensa'),
    izq: $('.sobre__mitad--izq'),
    der: $('.sobre__mitad--der'),
    destello: $('.sobre__destello'),
    sombraSello: $('.sobre__sombra-sello'),
    grano: $('.sobre__grano')
  };

  /* ── Dibujo del papel a la medida de la ventana ── */
  let ultimaMedida = '';
  function dibujar() {
    const g = geometria(raiz);
    const medida = `${g.ancho}x${g.alto}`;
    if (medida === ultimaMedida || !g.ancho || !g.alto) return;
    ultimaMedida = medida;
    $('[data-dibujo="bolsa"]').innerHTML = dibujoBolsa(g);
    $('[data-dibujo="sombra"]').innerHTML = dibujoSombraSolapa(g);
    $('[data-dibujo="solapa"]').innerHTML = dibujoSolapa(g);
  }
  let temporizador = 0;
  const alRedimensionar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(dibujar, 80);
  };

  /* ── Mientras está cerrado: página bloqueada y fuera del teclado ── */
  const apartados = [];
  function apartarPagina() {
    for (const hermano of document.body.children) {
      if (hermano === raiz || hermano.contains(raiz)) continue;
      if (/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(hermano.tagName)) continue;
      if (hermano.inert) continue;
      hermano.inert = true;
      apartados.push(hermano);
    }
  }
  function devolverPagina() {
    apartados.splice(0).forEach((hermano) => { hermano.inert = false; });
  }

  let estado = 'cerrado';   // cerrado → abriendo → abierto
  let animaciones = [];
  let seguro = 0;

  const alCambiarVisibilidad = () => raiz.classList.toggle('sobre--pausa', document.hidden);

  function alTeclear(evento) {
    if (estado !== 'cerrado' || evento.defaultPrevented) return;
    if (evento.key !== 'Enter' && evento.key !== ' ' && evento.key !== 'Spacebar') return;
    if (evento.target === sello) return;   // el botón ya lo resuelve solo
    evento.preventDefault();
    abrir();
  }

  function limpiar() {
    clearTimeout(seguro);
    clearTimeout(temporizador);
    window.removeEventListener('resize', alRedimensionar);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    document.removeEventListener('keydown', alTeclear);
    animaciones.forEach((a) => { try { a.cancel(); } catch (e) { /* ya terminó */ } });
    animaciones = [];
    devolverPagina();
    document.body.classList.remove('bloqueado');
    raiz._sobre = null;
    raiz.remove();
  }

  function terminar() {
    if (estado === 'abierto') return;
    estado = 'abierto';
    const teniaFoco = raiz.contains(document.activeElement);
    limpiar();
    avisar();
    // El foco pasa al título de la portada para que el lector de pantalla anuncie la invitación
    if (teniaFoco) {
      const titulo = document.getElementById('portada-titulo');
      if (titulo) {
        if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
        titulo.style.outline = 'none';
        try { titulo.focus({ preventScroll: true }); } catch (e) { titulo.focus(); }
      }
    }
  }

  const animar = (el, cuadros, tiempos) => {
    const animacion = el.animate(cuadros, { fill: 'forwards', easing: 'linear', ...tiempos });
    animaciones.push(animacion);
    return animacion;
  };

  function abrir() {
    if (estado !== 'cerrado') return;
    estado = 'abriendo';

    const caja = sello.getBoundingClientRect();
    const centro = { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 };
    raiz.classList.add('sobre--abriendo');
    sello.setAttribute('aria-disabled', 'true');

    // Movimiento reducido (o navegador sin Web Animations): fundido simple
    if (reducido || typeof raiz.animate !== 'function') {
      if (typeof raiz.animate !== 'function') { terminar(); return; }
      const fundido = animar(raiz, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease' });
      seguro = setTimeout(terminar, 700);
      fundido.finished.then(terminar, () => {});
      return;
    }

    const SUAVE = 'cubic-bezier(.22, .61, .36, 1)';
    const VAIVEN = 'cubic-bezier(.62, .02, .24, 1)';
    const CAIDA = 'cubic-bezier(.5, 0, .9, .55)';
    const caida = Math.round(caja.height * 1.5);

    // 1) El sello se hunde…
    animar(partes.prensa, [
      { transform: 'scale(1)' },
      { transform: 'scale(.9)', offset: 0.55, easing: SUAVE },
      { transform: 'scale(.97)' }
    ], { duration: 340, easing: SUAVE });

    // …se parte en dos mitades que caen y se desvanecen
    const mitad = (el, lado) => animar(el, [
      { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1, easing: SUAVE },
      { transform: `translate3d(${lado * 9}px, 3px, 0) rotate(${lado * 5}deg)`, opacity: 1, offset: 0.24, easing: CAIDA },
      { transform: `translate3d(${lado * 20}px, ${Math.round(caida * 0.42)}px, 0) rotate(${lado * 15}deg)`, opacity: 0.9, offset: 0.68 },
      { transform: `translate3d(${lado * 30}px, ${caida}px, 0) rotate(${lado * 27}deg)`, opacity: 0 }
    ], { duration: 1150, delay: 300 });
    mitad(partes.izq, -1);
    mitad(partes.der, 1);

    animar(partes.destello, [
      { transform: 'scale(.7)', opacity: 0 },
      { transform: 'scale(1.25)', opacity: 0.85, offset: 0.22 },
      { transform: 'scale(2.7)', opacity: 0 }
    ], { duration: 1000, delay: 270, easing: SUAVE });
    animar(partes.sombraSello, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 320, easing: SUAVE });
    animar(partes.pie, [{ opacity: 1 }, { opacity: 0 }], { duration: 620, delay: 120, easing: SUAVE });

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('petalos:rafaga', {
        detail: { x: centro.x, y: centro.y, cantidad: 26, fuerza: 1 }
      }));
    }, 320);

    // 2) La solapa se levanta girando sobre su borde superior
    animar(partes.solapa, [
      { transform: 'rotateX(0deg)' },
      { transform: 'rotateX(106deg)' }
    ], { duration: 1500, delay: 760, easing: VAIVEN });
    animar(partes.luz, [{ opacity: 0 }, { opacity: 0.2 }], { duration: 1100, delay: 760, easing: 'ease-in' });
    animar(partes.nombres, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 900, easing: SUAVE });
    animar(partes.sombra, [
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: 'translate3d(0, 26px, 0) scale(1.03)', opacity: 0 }
    ], { duration: 900, delay: 760, easing: 'ease-in' });
    // El forro se acomoda mientras queda a la vista
    animar(partes.forro, [
      { transform: 'translate3d(0, 14px, 0) scale(1.07)' },
      { transform: 'translate3d(0, 0, 0) scale(1)' }
    ], { duration: 2000, delay: 760, easing: SUAVE });

    // 3) La bolsa se desliza hacia abajo y el conjunto se desvanece
    animar(partes.bolsa, [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: 'translate3d(0, 62%, 0)' }
    ], { duration: 1150, delay: 1950, easing: VAIVEN });
    animar(partes.forro, [
      { transform: 'translate3d(0, 0, 0) scale(1)' },
      { transform: 'translate3d(0, -28px, 0) scale(1.04)' }
    ], { duration: 1150, delay: 1950, easing: VAIVEN, composite: 'replace' });
    // La acuarela del forro se despide un poco antes, para no encimarse con la portada
    animar(partes.imagen, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 2150, easing: 'ease-in-out' });
    const fundido = animar(raiz, [{ opacity: 1 }, { opacity: 0 }], { duration: 820, delay: 2260, easing: 'ease-in-out' });

    seguro = setTimeout(terminar, 3600);   // por si la pestaña se durmió a media animación
    fundido.finished.then(terminar, () => {});
  }

  /* ── Montaje ── */
  document.body.classList.add('bloqueado');
  apartarPagina();
  dibujar();
  sello.addEventListener('click', abrir);
  document.addEventListener('keydown', alTeclear);
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  window.addEventListener('resize', alRedimensionar, { passive: true });
  alCambiarVisibilidad();

  // El monograma usa la fuente manuscrita de la página: se pide por adelantado
  document.fonts?.load?.('700 62px "Dancing Script"', monograma).catch(() => {});

  if (opciones.enfocar !== false) {
    try { sello.focus({ preventScroll: true }); } catch (e) { sello.focus(); }
  }

  const control = {
    elemento: raiz,
    abrir,
    get estado() { return estado; },
    // Retira el sobre sin animación ni evento
    destruir() { if (estado !== 'abierto') { estado = 'abierto'; limpiar(); } }
  };
  raiz._sobre = control;
  return control;
}
