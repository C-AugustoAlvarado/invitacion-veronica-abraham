// Pétalos: la firma del sitio. Dos lienzos fijos a pantalla completa:
//   · «fondo»  (detrás del contenido): muchos pétalos chicos y nítidos.
//   · «frente» (encima de todo, incluido el sobre): pocos pétalos grandes,
//     desenfocados y muy translúcidos, como profundidad de campo.
// De noche los pétalos se funden hacia chispas doradas y estrellas.
// No importa otros módulos: escucha 'petalos:rafaga' y 'ambiente:cambio'
// en document (DISENO.md §4). No emite eventos.

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const mezclar = (a, b, t) => a + (b - a) * t;
const azar = (a, b) => a + Math.random() * (b - a);
const DOS_PI = Math.PI * 2;

// Paleta del Save the Date. «peso» = qué tan seguido aparece cada color.
const COLORES = [
  { nombre: 'dorado', peso: 0.50, claro: '#F3E2B8', medio: '#E2C288', hondo: '#C99A45', vena: '150, 108, 44' },
  { nombre: 'crema', peso: 0.20, claro: '#FFFBF1', medio: '#F3EBDB', hondo: '#D9C49A', vena: '168, 124, 47' },
  { nombre: 'durazno', peso: 0.23, claro: '#F7E0C4', medio: '#E9C39A', hondo: '#CF9668', vena: '160, 100, 60' },
  { nombre: 'vino', peso: 0.07, claro: '#F2D9CB', medio: '#E0AE9A', hondo: '#B8705F', vena: '156, 61, 46' }
];

// Tres siluetas, todas con curvas bézier en una caja de −0.5 a 0.5.
// La base del pétalo queda abajo (y = 0.5) y la punta arriba.
const FORMAS = [
  // Pétalo de rosa: ancho, con una pequeña muesca en la punta
  (c) => {
    c.moveTo(0, 0.5);
    c.bezierCurveTo(-0.40, 0.32, -0.54, -0.16, -0.22, -0.43);
    c.bezierCurveTo(-0.11, -0.52, -0.03, -0.47, 0, -0.38);
    c.bezierCurveTo(0.03, -0.47, 0.12, -0.52, 0.23, -0.42);
    c.bezierCurveTo(0.53, -0.14, 0.38, 0.32, 0, 0.5);
  },
  // Pétalo esbelto, de punta suave
  (c) => {
    c.moveTo(0.02, 0.5);
    c.bezierCurveTo(-0.30, 0.30, -0.38, -0.20, -0.10, -0.46);
    c.bezierCurveTo(-0.04, -0.51, 0.05, -0.51, 0.10, -0.45);
    c.bezierCurveTo(0.36, -0.16, 0.30, 0.30, 0.02, 0.5);
  },
  // Pétalo ladeado, como si el aire lo hubiera curvado
  (c) => {
    c.moveTo(-0.06, 0.5);
    c.bezierCurveTo(-0.44, 0.22, -0.46, -0.24, -0.12, -0.45);
    c.bezierCurveTo(0.02, -0.53, 0.20, -0.46, 0.32, -0.30);
    c.bezierCurveTo(0.50, -0.04, 0.34, 0.36, -0.06, 0.5);
  }
];

// Niveles de desenfoque: fracción útil del sprite y radio relativo.
const DESENFOQUES = [
  { util: 0.92, radio: 0 },
  { util: 0.80, radio: 0.03 },
  { util: 0.64, radio: 0.04 }
];

let instancia = null;

export function iniciarPetalos(opciones = {}) {
  if (instancia) return instancia;
  if (typeof document === 'undefined' || !document.body) return apiVacia();

  const ajustes = {
    contenedor: document.body,
    densidad: 1,          // multiplicador de la cantidad de pétalos
    puntero: true,        // en escritorio, el puntero los aparta
    ...opciones
  };

  const raiz = document.documentElement;
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaPuntero = window.matchMedia('(hover: hover) and (pointer: fine)');
  let reducido = consultaReducido.matches;

  /* ── Lienzos ── */
  function crearLienzo(capa) {
    const lienzo = document.createElement('canvas');
    lienzo.className = `petalos-lienzo petalos-lienzo--${capa}`;
    lienzo.setAttribute('aria-hidden', 'true');
    ajustes.contenedor.appendChild(lienzo);
    return lienzo;
  }
  const lienzoFondo = crearLienzo('fondo');
  const lienzoFrente = crearLienzo('frente');
  const ctxFondo = lienzoFondo.getContext('2d');
  const ctxFrente = lienzoFrente.getContext('2d');
  if (!ctxFondo || !ctxFrente) {
    lienzoFondo.remove(); lienzoFrente.remove();
    return apiVacia();
  }

  let ancho = 0;
  let alto = 0;
  let dprFondo = 1;
  let dprFrente = 1;
  let escala = 1;         // los pétalos crecen un poco en pantallas grandes

  /* ── Sprites pre-renderizados ── */
  const admiteFiltro = typeof ctxFondo.filter === 'string';
  let sprites = null;     // sprites[calido][color][forma][desenfoque]
  let spriteChispa = null;
  let spriteEstrella = null;
  let dprSprites = 0;

  function nuevoLienzo(lado) {
    const l = document.createElement('canvas');
    l.width = l.height = Math.max(8, Math.round(lado));
    return l;
  }

  function dibujarPetalo(color, forma, lado, util) {
    const l = nuevoLienzo(lado);
    const c = l.getContext('2d');
    c.translate(lado / 2, lado / 2);
    c.scale(lado * util, lado * util);

    c.beginPath();
    FORMAS[forma](c);
    c.closePath();

    // Lavado principal: más hondo en la base, luminoso hacia la punta
    const lavado = c.createRadialGradient(0, 0.48, 0.02, 0, 0.34, 1.0);
    lavado.addColorStop(0, color.hondo);
    lavado.addColorStop(0.5, color.medio);
    lavado.addColorStop(1, color.claro);
    c.fillStyle = lavado;
    c.fill();

    c.save();
    c.clip();
    // Luz de un lado y sombra del otro: volumen
    const volumen = c.createLinearGradient(-0.45, -0.2, 0.45, 0.2);
    volumen.addColorStop(0, 'rgba(255, 255, 255, .30)');
    volumen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    volumen.addColorStop(1, `rgba(${color.vena}, .20)`);
    c.fillStyle = volumen;
    c.fillRect(-0.6, -0.6, 1.2, 1.2);

    // Vena central y dos laterales, apenas insinuadas
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${color.vena}, .24)`;
    c.lineWidth = 0.012;
    c.beginPath();
    c.moveTo(0, 0.47);
    c.quadraticCurveTo(-0.03, 0.05, 0.01, -0.26);
    c.stroke();
    c.strokeStyle = `rgba(${color.vena}, .10)`;
    c.lineWidth = 0.009;
    c.beginPath();
    c.moveTo(-0.01, 0.30);
    c.quadraticCurveTo(-0.14, 0.10, -0.20, -0.14);
    c.moveTo(0, 0.24);
    c.quadraticCurveTo(0.13, 0.06, 0.19, -0.16);
    c.stroke();
    c.restore();

    // Borde de tinta diluida, como en la acuarela
    c.beginPath();
    FORMAS[forma](c);
    c.closePath();
    c.strokeStyle = `rgba(${color.vena}, .26)`;
    c.lineWidth = 0.016;
    c.stroke();
    return l;
  }

  function desenfocar(origen, radio) {
    const lado = origen.width;
    const l = nuevoLienzo(lado);
    const c = l.getContext('2d');
    if (admiteFiltro) {
      c.filter = `blur(${radio.toFixed(2)}px)`;
      c.drawImage(origen, 0, 0);
      c.filter = 'none';
      return l;
    }
    // Sin ctx.filter (Safari anterior): promedio de copias repartidas en
    // espiral. Solo ocurre una vez, al crear los sprites.
    const copias = 36;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 1 / copias;
    for (let i = 0; i < copias; i++) {
      const r = radio * 1.9 * Math.sqrt((i + 0.5) / copias);
      const a = i * 2.39996;
      c.drawImage(origen, Math.cos(a) * r, Math.sin(a) * r);
    }
    return l;
  }

  function entibiar(origen) {
    const l = nuevoLienzo(origen.width);
    const c = l.getContext('2d');
    c.drawImage(origen, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(226, 132, 78, .34)';
    c.fillRect(0, 0, l.width, l.height);
    return l;
  }

  function crearSprites() {
    dprSprites = dprFondo;
    const ladoNitido = 60 * dprFondo;
    const ladoGrande = 168 * Math.min(dprFondo, 1.5);
    sprites = [[], []];
    COLORES.forEach((color, ic) => {
      sprites[0][ic] = [];
      sprites[1][ic] = [];
      FORMAS.forEach((_, iforma) => {
        const normales = DESENFOQUES.map((nivel, id) => {
          const lado = id === 2 ? ladoGrande : ladoNitido;
          const nitido = dibujarPetalo(color, iforma, lado, nivel.util);
          return nivel.radio ? desenfocar(nitido, lado * nivel.radio) : nitido;
        });
        sprites[0][ic][iforma] = normales;
        sprites[1][ic][iforma] = normales.map(entibiar);
      });
    });

    // Chispa: núcleo de luz cálida con halo
    const ladoChispa = 72 * dprFondo;
    spriteChispa = nuevoLienzo(ladoChispa);
    {
      const c = spriteChispa.getContext('2d');
      const m = ladoChispa / 2;
      const halo = c.createRadialGradient(m, m, 0, m, m, m);
      halo.addColorStop(0, 'rgba(255, 248, 226, 1)');
      halo.addColorStop(0.08, 'rgba(250, 232, 184, .95)');
      halo.addColorStop(0.22, 'rgba(240, 220, 168, .42)');
      halo.addColorStop(0.52, 'rgba(226, 190, 120, .12)');
      halo.addColorStop(1, 'rgba(201, 154, 69, 0)');
      c.fillStyle = halo;
      c.fillRect(0, 0, ladoChispa, ladoChispa);
    }

    // Estrella: punto fino con un destello en cruz
    const ladoEstrella = 40 * dprFondo;
    spriteEstrella = nuevoLienzo(ladoEstrella);
    {
      const c = spriteEstrella.getContext('2d');
      const m = ladoEstrella / 2;
      const luz = c.createRadialGradient(m, m, 0, m, m, m * 0.5);
      luz.addColorStop(0, 'rgba(255, 250, 235, 1)');
      luz.addColorStop(0.25, 'rgba(240, 220, 168, .6)');
      luz.addColorStop(1, 'rgba(240, 220, 168, 0)');
      c.fillStyle = luz;
      c.fillRect(0, 0, ladoEstrella, ladoEstrella);
      c.translate(m, m);
      for (let i = 0; i < 2; i++) {
        const rayo = c.createLinearGradient(-m, 0, m, 0);
        rayo.addColorStop(0, 'rgba(240, 220, 168, 0)');
        rayo.addColorStop(0.3, 'rgba(240, 220, 168, 0)');
        rayo.addColorStop(0.5, 'rgba(255, 246, 220, .5)');
        rayo.addColorStop(0.7, 'rgba(240, 220, 168, 0)');
        rayo.addColorStop(1, 'rgba(240, 220, 168, 0)');
        c.fillStyle = rayo;
        c.fillRect(-m, -ladoEstrella * 0.012, ladoEstrella, ladoEstrella * 0.024);
        c.rotate(Math.PI / 2);
      }
    }
  }

  function elegirColor() {
    let r = Math.random();
    for (let i = 0; i < COLORES.length; i++) {
      r -= COLORES[i].peso;
      if (r <= 0) return i;
    }
    return 0;
  }

  /* ── Partículas ── */
  let fondo = [];       // pétalos detrás del contenido
  let frente = [];      // pétalos grandes desenfocados
  let rafagas = [];     // pétalos temporales (sobre el lienzo de frente)
  let chispas = [];     // luciérnagas doradas (fondo)
  let destellos = [];   // chispas grandes desenfocadas (frente)
  let estrellas = [];   // fijas, arriba
  const MAX_RAFAGA = 160;

  function crearPetalo(capa, repartir) {
    const cerca = capa === 'frente';
    const z = Math.random();
    const p = {
      capa,
      z,
      color: elegirColor(),
      forma: (Math.random() * FORMAS.length) | 0,
      desenfoque: cerca ? 2 : (z < 0.3 ? 1 : 0),
      x: 0,
      y: 0,
      ix: 0,              // impulsos (puntero, ráfaga): se disipan solos
      iy: 0,
      giro: azar(0, DOS_PI),
      vGiro: azar(-0.5, 0.5),
      volteo: azar(0, DOS_PI),
      vVolteo: azar(0.5, 1.5) * (Math.random() < 0.5 ? -1 : 1),
      vaiven: azar(0, DOS_PI),
      vVaiven: azar(0.45, 1.05),
      amplitud: 0,
      tamano: 0,
      alfa: 0,
      caida: 0,
      arrastre: 0,
      temporal: false,
      vida: 0,
      duracion: 0
    };
    if (cerca) {
      p.tamano = azar(54, 116) * (ancho < 700 ? 0.74 : 1) * escala;
      p.alfa = azar(0.2, 0.32);
      p.caida = azar(38, 64);
      p.arrastre = azar(0.62, 1.0);
      p.amplitud = azar(14, 30);
      p.vVolteo *= 0.55;
      p.vGiro *= 0.6;
    } else {
      p.tamano = (11 + z * 17) * escala;
      p.alfa = 0.55 + z * 0.4;
      p.caida = 15 + z * 27;
      p.arrastre = 0.10 + z * 0.36;
      p.amplitud = 9 + z * 20;
    }
    colocar(p, repartir);
    return p;
  }

  // Pone el pétalo en un punto de entrada (o repartido por toda la ventana)
  function colocar(p, repartir, desdeAbajo) {
    const margen = p.tamano;
    if (p.capa === 'frente') {
      // Los pétalos cercanos prefieren las orillas: dejan libre la lectura
      const lado = Math.random() < 0.5 ? -1 : 1;
      const orilla = Math.pow(Math.random(), 1.7);
      p.x = ancho / 2 + lado * (ancho / 2) * (1.04 - orilla * 0.62);
    } else {
      p.x = azar(-margen, ancho + margen);
    }
    if (repartir) p.y = azar(-margen, alto + margen);
    else p.y = desdeAbajo ? alto + margen : -margen;
  }

  function crearChispa(cerca) {
    const z = Math.random();
    return {
      z,
      x: azar(0, ancho),
      y: azar(0, alto),
      tamano: cerca ? azar(80, 160) * (ancho < 700 ? 0.7 : 1) : (16 + z * 30) * escala,
      alfa: cerca ? azar(0.16, 0.28) : 0.62 + z * 0.38,
      sube: cerca ? azar(5, 11) : 4 + z * 11,
      arrastre: cerca ? azar(0.6, 1) : 0.10 + z * 0.34,
      fase: azar(0, DOS_PI),
      ritmo: azar(0.5, 1.5),
      deriva: azar(0, DOS_PI),
      vDeriva: azar(0.18, 0.5),
      paseo: azar(8, 22),
      ix: 0,
      iy: 0
    };
  }

  function crearEstrella() {
    return {
      x: Math.random(),
      y: Math.pow(Math.random(), 1.6) * 0.6,   // más densas hacia arriba
      tamano: azar(9, 20),
      alfa: azar(0.45, 1),
      fase: azar(0, DOS_PI),
      ritmo: azar(0.5, 1.7)
    };
  }

  function ajustarLista(lista, cantidad, crear) {
    while (lista.length < cantidad) lista.push(crear());
    if (lista.length > cantidad) lista.length = cantidad;
    return lista;
  }

  function poblar() {
    // De ~18 en un celular chico a ~60 en un escritorio grande
    const area = ancho * alto;
    const base = mezclar(18, 60, limitar((area - 260000) / (2000000 - 260000), 0, 1));
    const total = Math.round(base * ajustes.densidad);
    const nFrente = Math.max(3, Math.round(total * 0.11));
    const nFondo = Math.max(0, total - nFrente);

    ajustarLista(fondo, nFondo, () => crearPetalo('fondo', true));
    ajustarLista(frente, nFrente, () => crearPetalo('frente', true));
    ajustarLista(chispas, Math.round(total * 1.15), () => crearChispa(false));
    ajustarLista(destellos, Math.max(2, Math.round(total * 0.07)), () => crearChispa(true));
    ajustarLista(estrellas, Math.round(mezclar(12, 30, limitar(ancho / 1600, 0, 1))), crearEstrella);

    for (const p of fondo) if (p.x > ancho + p.tamano || p.y > alto + p.tamano) colocar(p, true);
    for (const p of frente) if (p.x > ancho + p.tamano || p.y > alto + p.tamano) colocar(p, true);
    for (const c of chispas) { if (c.x > ancho) c.x = azar(0, ancho); if (c.y > alto) c.y = azar(0, alto); }
    for (const c of destellos) { if (c.x > ancho) c.x = azar(0, ancho); if (c.y > alto) c.y = azar(0, alto); }
  }

  /* ── Medición ── */
  function medir(forzar) {
    const w = lienzoFondo.clientWidth || window.innerWidth;
    const h = lienzoFondo.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!forzar && w === ancho && h === alto && dpr === dprFondo) return false;
    ancho = w;
    alto = h;
    dprFondo = dpr;
    // El frente es casi todo desenfoque: no necesita toda la resolución
    dprFrente = Math.min(dpr, 1.5);
    escala = limitar(Math.sqrt(ancho / 900), 0.82, 1.3);

    lienzoFondo.width = Math.round(ancho * dprFondo);
    lienzoFondo.height = Math.round(alto * dprFondo);
    lienzoFrente.width = Math.round(ancho * dprFrente);
    lienzoFrente.height = Math.round(alto * dprFrente);

    if (!sprites || dprSprites !== dprFondo) crearSprites();
    poblar();
    return true;
  }

  /* ── Ambiente ── */
  const pesos = { ocaso: 0, noche: 0 };
  const pesosMeta = { ocaso: 0, noche: 0 };
  {
    const estilo = getComputedStyle(document.getElementById('ambiente') || raiz);
    pesosMeta.noche = pesos.noche = limitar(parseFloat(estilo.getPropertyValue('--amb-noche')) || 0, 0, 1);
    pesosMeta.ocaso = pesos.ocaso = limitar(parseFloat(estilo.getPropertyValue('--amb-ocaso')) || 0, 0, 1) * (1 - pesos.noche);
  }
  function alCambiarAmbiente(evento) {
    const p = evento.detail && evento.detail.pesos;
    if (!p) return;
    pesosMeta.noche = limitar(+p.noche || 0, 0, 1);
    pesosMeta.ocaso = limitar(+p.ocaso || 0, 0, 1);
    if (reducido) {
      pesos.noche = pesosMeta.noche;
      pesos.ocaso = pesosMeta.ocaso;
      pedirEstatico();
    }
  }

  /* ── Viento: ráfagas suaves y aleatorias ── */
  const viento = { actual: 0, meta: 6, cambio: 0 };
  function moverViento(t, dt) {
    if (t >= viento.cambio) {
      const enCalma = Math.abs(viento.meta) > 14;
      if (enCalma) {
        viento.meta = azar(-9, 9);              // vuelve la calma
        viento.cambio = t + azar(5, 11);
      } else {
        viento.meta = azar(26, 58) * (Math.random() < 0.5 ? -1 : 1);
        viento.cambio = t + azar(2.2, 4.2);     // sopla unos segundos
      }
    }
    viento.actual += (viento.meta - viento.actual) * (1 - Math.exp(-dt * 0.9));
  }

  /* ── Scroll (velocidad propia: no depende del motor) ── */
  let yScroll = window.scrollY;
  let velScroll = 0;

  /* ── Puntero ── */
  const puntero = { x: 0, y: 0, activo: false };
  function alMoverPuntero(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    puntero.x = e.clientX;
    puntero.y = e.clientY;
    puntero.activo = true;
  }
  function alSalirPuntero() { puntero.activo = false; }

  function apartar(p, radio, fuerza, dt) {
    const dx = p.x - puntero.x;
    const dy = p.y - puntero.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > radio * radio || d2 < 0.01) return;
    const d = Math.sqrt(d2);
    const k = 1 - d / radio;
    const empuje = k * k * fuerza * dt;
    p.ix += (dx / d) * empuje;
    p.iy += (dy / d) * empuje * 0.7;
  }

  /* ── Física ── */
  function moverPetalo(p, dt, dy, agitacion) {
    p.vaiven += p.vVaiven * dt;
    p.volteo += p.vVolteo * dt * (1 + agitacion * 1.6);
    p.giro += (p.vGiro + Math.cos(p.vaiven) * 0.35) * dt;

    // De canto cae más rápido; de cara, el aire lo frena
    const cara = Math.abs(Math.cos(p.volteo));
    const caida = p.caida * (1.22 - cara * 0.42);
    const profundidad = p.capa === 'frente' ? 1.25 : 0.45 + p.z * 0.65;

    const disipa = Math.exp(-dt * (p.temporal ? 1.5 : 2.1));
    p.ix *= disipa;
    p.iy *= disipa;

    p.x += (viento.actual * profundidad + Math.sin(p.vaiven) * p.amplitud + p.ix) * dt;
    p.y += (caida + p.iy) * dt - dy * p.arrastre;
  }

  function reciclar(p) {
    const m = p.tamano * 1.2;
    if (p.y > alto + m) colocar(p, false, false);
    else if (p.y < -m) colocar(p, false, true);
    if (p.x > ancho + m) p.x = -m;
    else if (p.x < -m) p.x = ancho + m;
  }

  function moverChispa(c, t, dt, dy) {
    c.deriva += c.vDeriva * dt;
    const disipa = Math.exp(-dt * 2.1);
    c.ix *= disipa;
    c.iy *= disipa;
    c.x += (Math.sin(c.deriva) * c.paseo + viento.actual * 0.12 + c.ix) * dt;
    c.y += (-c.sube + Math.cos(c.deriva * 0.7) * c.paseo * 0.5 + c.iy) * dt - dy * c.arrastre;
    const m = c.tamano;
    if (c.y < -m) { c.y = alto + m; c.x = azar(0, ancho); }
    else if (c.y > alto + m) { c.y = -m; c.x = azar(0, ancho); }
    if (c.x > ancho + m) c.x = -m;
    else if (c.x < -m) c.x = ancho + m;
  }

  /* ── Dibujo ── */
  function pintarPetalo(ctx, dpr, p, alfa, calido) {
    if (alfa < 0.004) return;
    const nivel = DESENFOQUES[p.desenfoque];
    const lado = (p.tamano / nivel.util) * dpr;
    // Volteo en 3D simulado: un eje se encoge y se invierte
    let v = Math.cos(p.volteo);
    if (v > -0.1 && v < 0.1) v = v < 0 ? -0.1 : 0.1;
    const cos = Math.cos(p.giro);
    const sen = Math.sin(p.giro);
    ctx.setTransform(cos * lado, sen * lado, -sen * lado * v, cos * lado * v, p.x * dpr, p.y * dpr);
    // El envés se ve un poco más apagado
    const a = alfa * (v < 0 ? 0.82 : 1);
    const juego = sprites[0][p.color][p.forma][p.desenfoque];
    ctx.globalAlpha = a;
    ctx.drawImage(juego, -0.5, -0.5, 1, 1);
    if (calido > 0.02) {
      ctx.globalAlpha = a * calido;
      ctx.drawImage(sprites[1][p.color][p.forma][p.desenfoque], -0.5, -0.5, 1, 1);
    }
  }

  function pintarLuz(ctx, dpr, sprite, x, y, tamano, alfa) {
    if (alfa < 0.004) return;
    const lado = tamano * dpr;
    ctx.setTransform(lado, 0, 0, lado, x * dpr, y * dpr);
    ctx.globalAlpha = alfa;
    ctx.drawImage(sprite, -0.5, -0.5, 1, 1);
  }

  // Los pétalos cercanos se atenúan al cruzar la columna de lectura
  function atenuarCentro(x) {
    const d = Math.abs(x - ancho / 2) / (ancho / 2);
    return mezclar(0.55, 1, limitar(d * 1.25, 0, 1));
  }

  function limpiar(ctx, lienzo) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  }

  let frenteSucio = true;
  let fondoSucio = true;

  function cuadroAnimado(t, dt) {
    // Scroll: desplazamiento exacto de este cuadro + velocidad suavizada
    const y = window.scrollY;
    let dy = y - yScroll;
    yScroll = y;
    if (Math.abs(dy) > alto * 1.5) dy = 0;        // salto (ancla): no arrastrar
    const vel = dt > 0 ? dy / dt : 0;
    velScroll += (vel - velScroll) * (1 - Math.exp(-dt * 8));
    const agitacion = limitar(Math.abs(velScroll) / 1800, 0, 1);

    const k = 1 - Math.exp(-dt * 5);
    pesos.noche += (pesosMeta.noche - pesos.noche) * k;
    pesos.ocaso += (pesosMeta.ocaso - pesos.ocaso) * k;
    const noche = pesos.noche < 0.003 ? 0 : pesos.noche;
    const verPetalos = Math.pow(1 - noche, 1.3);
    const calido = limitar(pesos.ocaso + noche * 0.7, 0, 1) * 0.9;

    moverViento(t, dt);
    const conPuntero = puntero.activo && ajustes.puntero && consultaPuntero.matches;

    /* Fondo */
    limpiar(ctxFondo, lienzoFondo);
    if (noche > 0) {
      for (const e of estrellas) {
        const titila = 0.55 + 0.45 * Math.sin(t * e.ritmo + e.fase);
        pintarLuz(ctxFondo, dprFondo, spriteEstrella, e.x * ancho, e.y * alto, e.tamano, e.alfa * titila * noche);
      }
    }
    for (const p of fondo) {
      moverPetalo(p, dt, dy, agitacion);
      if (conPuntero) apartar(p, 150, 900, dt);
      reciclar(p);
      if (verPetalos > 0.004) pintarPetalo(ctxFondo, dprFondo, p, p.alfa * verPetalos, calido);
    }
    for (const c of chispas) {
      moverChispa(c, t, dt, dy);
      if (noche > 0) {
        if (conPuntero) apartar(c, 130, 500, dt);
        // Parpadeo de luciérnaga: se enciende y se apaga despacio
        const pulso = Math.sin(t * c.ritmo + c.fase);
        const brillo = 0.3 + 0.7 * pulso * pulso;
        pintarLuz(ctxFondo, dprFondo, spriteChispa, c.x, c.y, c.tamano * (0.85 + 0.15 * brillo), c.alfa * brillo * noche);
      }
    }

    /* Frente */
    limpiar(ctxFrente, lienzoFrente);
    for (const p of frente) {
      moverPetalo(p, dt, dy, agitacion);
      if (conPuntero) apartar(p, 220, 520, dt);
      reciclar(p);
      if (verPetalos > 0.004) pintarPetalo(ctxFrente, dprFrente, p, p.alfa * verPetalos * atenuarCentro(p.x), calido);
    }
    for (const c of destellos) {
      moverChispa(c, t, dt, dy);
      if (noche > 0) {
        const pulso = 0.6 + 0.4 * Math.sin(t * c.ritmo * 0.6 + c.fase);
        pintarLuz(ctxFrente, dprFrente, spriteChispa, c.x, c.y, c.tamano, c.alfa * pulso * noche * atenuarCentro(c.x));
      }
    }
    for (let i = rafagas.length - 1; i >= 0; i--) {
      const p = rafagas[i];
      p.vida += dt;
      moverPetalo(p, dt, dy, agitacion);
      const m = p.tamano * 1.5;
      const fuera = p.y > alto + m || p.x < -m * 4 || p.x > ancho + m * 4 || p.vida > p.duracion;
      if (fuera) { rafagas.splice(i, 1); continue; }
      const entra = limitar(p.vida / 0.18, 0, 1);
      const sale = limitar((p.duracion - p.vida) / 1.2, 0, 1);
      const tamano = p.tamano;
      p.tamano = tamano * (0.45 + 0.55 * entra);
      pintarPetalo(ctxFrente, dprFrente, p, p.alfa * entra * sale, calido * 0.6);
      p.tamano = tamano;
    }
    fondoSucio = frenteSucio = true;
  }

  // Movimiento reducido: unos pocos pétalos quietos y tenues (o chispas, de noche)
  let estaticoPedido = 0;
  function pedirEstatico() {
    if (estaticoPedido) return;
    estaticoPedido = requestAnimationFrame(() => { estaticoPedido = 0; dibujarEstatico(); });
  }
  function dibujarEstatico() {
    limpiar(ctxFondo, lienzoFondo);
    limpiar(ctxFrente, lienzoFrente);
    const noche = pesos.noche;
    const verPetalos = 1 - noche;
    const calido = limitar(pesos.ocaso + noche * 0.7, 0, 1) * 0.9;
    const cuantos = Math.min(fondo.length, ancho < 700 ? 7 : 12);
    for (let i = 0; i < cuantos; i++) {
      const p = fondo[i];
      pintarPetalo(ctxFondo, dprFondo, p, p.alfa * 0.5 * verPetalos, calido);
    }
    if (noche > 0.01) {
      for (const e of estrellas) pintarLuz(ctxFondo, dprFondo, spriteEstrella, e.x * ancho, e.y * alto, e.tamano, e.alfa * 0.7 * noche);
      for (let i = 0; i < Math.min(chispas.length, 10); i++) {
        const c = chispas[i];
        pintarLuz(ctxFondo, dprFondo, spriteChispa, c.x, c.y, c.tamano, c.alfa * 0.5 * noche);
      }
    }
  }

  /* ── Bucle: un solo requestAnimationFrame ── */
  let cuadro = 0;
  let anterior = 0;
  let pausado = false;
  let destruido = false;
  let relojManual = 0;

  function bucle(ahora) {
    cuadro = 0;
    if (destruido || pausado || reducido || document.hidden) return;
    const dt = anterior ? Math.min((ahora - anterior) / 1000, 0.05) : 0.016;
    anterior = ahora;
    cuadroAnimado(ahora / 1000, dt);
    cuadro = requestAnimationFrame(bucle);
  }

  function arrancar() {
    if (destruido || cuadro) return;
    if (reducido) { pedirEstatico(); return; }
    if (pausado || document.hidden) return;
    anterior = 0;
    yScroll = window.scrollY;
    cuadro = requestAnimationFrame(bucle);
  }

  function detener() {
    if (cuadro) cancelAnimationFrame(cuadro);
    cuadro = 0;
  }

  /* ── Ráfaga ── */
  function rafaga(x, y, cantidad, fuerza) {
    if (destruido || reducido || !sprites) return 0;
    const cx = Number.isFinite(x) ? x : ancho / 2;
    const cy = Number.isFinite(y) ? y : alto * 0.45;
    const n = Math.round(limitar(Number.isFinite(cantidad) ? cantidad : 24, 1, 80));
    const f = limitar(Number.isFinite(fuerza) ? fuerza : 1, 0.2, 3);
    let creados = 0;
    for (let i = 0; i < n && rafagas.length < MAX_RAFAGA; i++) {
      const p = crearPetalo('fondo', true);
      p.capa = 'rafaga';
      p.temporal = true;
      p.desenfoque = Math.random() < 0.22 ? 1 : 0;
      p.z = Math.random();
      p.tamano = (12 + p.z * 17) * escala;
      p.alfa = 0.72 + p.z * 0.24;
      p.caida = 46 + p.z * 50;
      p.arrastre = 0.5 + p.z * 0.4;
      p.amplitud = 16 + p.z * 22;
      p.vVolteo *= 1.7;
      // Abanico hacia arriba, con los extremos un poco más lentos
      const abanico = azar(-1, 1);
      const angulo = -Math.PI / 2 + abanico * 1.25;
      const impulso = azar(230, 640) * f * (1 - Math.abs(abanico) * 0.25);
      p.ix = Math.cos(angulo) * impulso;
      p.iy = Math.sin(angulo) * impulso;
      p.x = cx + Math.cos(angulo) * azar(0, 10);
      p.y = cy + Math.sin(angulo) * azar(0, 10);
      p.vida = -i * 0.012;                       // salen escalonados
      p.duracion = azar(9, 14);
      rafagas.push(p);
      creados++;
    }
    arrancar();
    return creados;
  }

  function alPedirRafaga(evento) {
    const d = evento.detail || {};
    rafaga(d.x, d.y, d.cantidad, d.fuerza);
  }

  /* ── Eventos ── */
  let temporizador = 0;
  function alRedimensionar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (destruido) return;
      if (medir(false) && reducido) pedirEstatico();
    }, 140);
  }
  function alCambiarVisibilidad() {
    if (document.hidden) detener();
    else arrancar();
  }
  function alCambiarMovimiento() {
    reducido = consultaReducido.matches;
    detener();
    if (reducido) {
      rafagas = [];
      pesos.noche = pesosMeta.noche;
      pesos.ocaso = pesosMeta.ocaso;
      pedirEstatico();
    } else {
      arrancar();
    }
  }

  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('orientationchange', alRedimensionar, { passive: true });
  window.addEventListener('pointermove', alMoverPuntero, { passive: true });
  document.documentElement.addEventListener('pointerleave', alSalirPuntero, { passive: true });
  window.addEventListener('blur', alSalirPuntero, { passive: true });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  document.addEventListener('petalos:rafaga', alPedirRafaga);
  document.addEventListener('ambiente:cambio', alCambiarAmbiente);
  if (consultaReducido.addEventListener) consultaReducido.addEventListener('change', alCambiarMovimiento);

  // El lienzo avisa si cambia de tamaño aunque no llegue el evento resize
  const observadorTamano = typeof ResizeObserver === 'function' ? new ResizeObserver(alRedimensionar) : null;
  if (observadorTamano) observadorTamano.observe(lienzoFondo);

  medir(true);
  arrancar();

  instancia = {
    rafaga,
    pausar() {
      pausado = true;
      detener();
    },
    reanudar() {
      pausado = false;
      arrancar();
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      detener();
      if (estaticoPedido) cancelAnimationFrame(estaticoPedido);
      clearTimeout(temporizador);
      if (observadorTamano) observadorTamano.disconnect();
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
      window.removeEventListener('pointermove', alMoverPuntero);
      document.documentElement.removeEventListener('pointerleave', alSalirPuntero);
      window.removeEventListener('blur', alSalirPuntero);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      document.removeEventListener('petalos:rafaga', alPedirRafaga);
      document.removeEventListener('ambiente:cambio', alCambiarAmbiente);
      if (consultaReducido.removeEventListener) consultaReducido.removeEventListener('change', alCambiarMovimiento);
      lienzoFondo.remove();
      lienzoFrente.remove();
      fondo = []; frente = []; rafagas = []; chispas = []; destellos = []; estrellas = [];
      sprites = null;
      instancia = null;
    },
    // Hoja con todos los sprites, para revisarlos de cerca
    muestrario() { return sprites ? { petalos: sprites, chispa: spriteChispa, estrella: spriteEstrella } : null; },
    // Solo para diagnóstico (demo y pruebas): no son parte del contrato.
    // avanzar() simula y pinta sin esperar a requestAnimationFrame.
    avanzar(segundos = 1, paso = 1 / 60) {
      if (destruido || reducido || !sprites) return;
      const pasos = Math.min(3000, Math.round(segundos / paso));
      for (let i = 0; i < pasos; i++) {
        relojManual += paso;
        cuadroAnimado(relojManual, paso);
      }
    },
    estado() {
      return {
        ancho, alto, dprFondo, dprFrente, reducido, pausado,
        animando: !!cuadro,
        fondo: fondo.length, frente: frente.length, rafagas: rafagas.length,
        chispas: chispas.length, estrellas: estrellas.length,
        noche: +pesos.noche.toFixed(3), ocaso: +pesos.ocaso.toFixed(3),
        viento: +viento.actual.toFixed(1), velScroll: Math.round(velScroll)
      };
    }
  };
  return instancia;
}

function apiVacia() {
  return { rafaga() { return 0; }, pausar() {}, reanudar() {}, destruir() {}, avanzar() {}, estado() { return null; } };
}
