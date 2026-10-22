// Fotos con trazo — js/trazo.js
// Abraham: «las fotos que sean dibujadas y si le das click que haya una
// transición muy sutil y muestre la foto real». El dibujo se hace con código,
// aquí mismo, a partir de la foto: se lee en un <canvas> pequeño, se desatura,
// se buscan los bordes (diferencia de desenfoques + Sobel), se pasan por un
// umbral suave y se pintan como lápiz sobre papel marfil, con un lavado muy
// ligero en olivo y un grano de papel. El resultado se coloca encima de la
// foto; un botón real (aria-pressed) cruza en ~700 ms hacia la foto y de
// vuelta. Sin JavaScript (o si el lienzo se «ensucia» por CORS) se ve la foto.
//
// Uso:  const trazo = iniciarTrazo({ intensidad: 'media' });
//       trazo.procesar(img);  trazo.destruir();
// Marcas en el HTML:  <img data-trazo-foto>  (o .polaroid__foto con src)
//   data-trazo-intensidad="suave|media|fuerte"   ajuste por imagen
// Eventos en document:  trazo:listo  { img, lienzo, ms, ancho, alto }
//                       trazo:cambio { img, foto: boolean }
//                       trazo:omitido { img, motivo }
// Solo se animan transform y opacity (css/trazo.css). Estilos en base.css.

const PAPEL = [246, 242, 234];          // --marfil
const TINTAS = {
  olivo: { linea: [58, 60, 50], lavado: [166, 168, 132] },   // grafito cálido · --olivo-claro apagado
  sepia: { linea: [66, 56, 46], lavado: [184, 166, 136] }
};

// Tres intensidades afinadas en demo/trazo.html (escena de tonos continuos y la
// acuarela). «media» es la de la página. Se exportan para la demo.
//   tau/epsilon/phi: XDoG (resta de desenfoques y umbral suave) · bordeDesde/Hasta,
//   pesoBorde: Sobel · lavado: tono general · sombreado/sombraDesde: trama a lápiz en
//   las sombras · grano: papel · ondulacion: pulso de la mano · radios: desenfoques ·
//   opacidad: fuerza máxima de la línea
export const INTENSIDADES = {
  suave:  { tau: 0.995, epsilon: -0.002, phi: 20, bordeDesde: 0.07, bordeHasta: 0.32, pesoBorde: 0.80, pesoXdog: 0.75, lavado: 0.18, sombreado: 0.12, sombraDesde: 0.56, grano: 7, ondulacion: 1.4, radioFino: 1.0, radioAncho: 2.4, opacidad: 0.76 },
  media:  { tau: 0.99,  epsilon: -0.001, phi: 26, bordeDesde: 0.06, bordeHasta: 0.28, pesoBorde: 0.90, pesoXdog: 0.85, lavado: 0.30, sombreado: 0.26, sombraDesde: 0.50, grano: 9, ondulacion: 1.6, radioFino: 1.0, radioAncho: 2.6, opacidad: 0.84 },
  fuerte: { tau: 0.985, epsilon: 0.001,  phi: 36, bordeDesde: 0.045, bordeHasta: 0.24, pesoBorde: 1.00, pesoXdog: 1.00, lavado: 0.36, sombreado: 0.40, sombraDesde: 0.42, grano: 11, ondulacion: 1.9, radioFino: 1.0, radioAncho: 3.0, opacidad: 0.9 }
};

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const suavizar = (a, b, x) => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

let instancia = null;

export function iniciarTrazo(opciones = {}) {
  if (instancia) return instancia;   // idempotente: una sola instancia por página
  const raizDoc = document.documentElement;
  if (raizDoc.classList.contains('basico')) return null;   // modo básico: la foto real, sin más

  const cfg = {
    raiz: opciones.raiz || document,
    selector: opciones.selector || 'img[data-trazo-foto], img.polaroid__foto',
    intensidad: INTENSIDADES[opciones.intensidad] ? opciones.intensidad : 'media',
    tono: TINTAS[opciones.tono] ? opciones.tono : 'olivo',
    ladoMaximo: opciones.ladoMaximo || 900,
    ladoMinimo: opciones.ladoMinimo || 320,
    presupuesto: opciones.presupuesto || 8,           // ms de trabajo seguidos antes de ceder el hilo
    observar: opciones.observar !== false,
    pista: Object.assign({ foto: 'Toca para ver la foto', dibujo: 'Toca para ver el dibujo' }, opciones.pista),
    ajustes: opciones.ajustes || null,                 // sobrescribe la intensidad (laboratorio de la demo)
    esperaMaxima: opciones.esperaMaxima || 2500        // ms que la foto se oculta esperando su dibujo
  };

  const fichas = new WeakMap();      // img → ficha
  const cache = new Map();           // src + ajustes → lienzo ya dibujado
  const todas = new Set();           // fichas vivas (para destruir)
  let destruido = false;

  /* ── Ceder el hilo: idle cuando existe; si no, un mensaje (no lo frenan
        los temporizadores de 1 s de las pestañas ocultas) ── */
  const canal = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  const colaMensajes = [];
  if (canal) canal.port1.onmessage = () => { const f = colaMensajes.shift(); if (f) f(); };
  function ceder(fn) {
    if (typeof requestIdleCallback === 'function' && !document.hidden) {
      requestIdleCallback(() => fn(), { timeout: 160 });
    } else if (canal) {
      colaMensajes.push(fn);
      canal.port2.postMessage(0);
    } else {
      setTimeout(fn, 0);
    }
  }

  /* ── Ejecuta un generador por pasos de «presupuesto» ms ── */
  function correr(generador, ficha, serie) {
    return new Promise((resolver, rechazar) => {
      const paso = () => {
        if (destruido || ficha.serie !== serie) return rechazar(new Error('cancelado'));
        const inicio = performance.now();
        try {
          let r = generador.next();
          while (!r.done && performance.now() - inicio < cfg.presupuesto) r = generador.next();
          const duro = performance.now() - inicio;
          if (duro > (ficha.pasoMax || 0)) ficha.pasoMax = duro;   // el paso más largo (diagnóstico)
          if (r.done) return resolver(r.value);
        } catch (error) { return rechazar(error); }
        ceder(paso);
      };
      ceder(paso);
    });
  }

  /* ═══════════ El dibujo ═══════════ */

  // Ruido suave: un lienzo diminuto con valores al azar, ampliado con
  // interpolación. Da la mano temblorosa y el peso variable de la línea.
  function ruidoSuave(ancho, alto, periodo) {
    const pequeno = document.createElement('canvas');
    const cw = Math.max(2, Math.ceil(ancho / periodo));
    const ch = Math.max(2, Math.ceil(alto / periodo));
    pequeno.width = cw; pequeno.height = ch;
    const c1 = pequeno.getContext('2d');
    const d = c1.createImageData(cw, ch);
    let semilla = 1234567;
    for (let i = 0; i < d.data.length; i += 4) {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
      const v = (semilla >> 8) & 255;
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    c1.putImageData(d, 0, 0);
    const grande = document.createElement('canvas');
    grande.width = ancho; grande.height = alto;
    const c2 = grande.getContext('2d');
    c2.imageSmoothingEnabled = true;
    c2.imageSmoothingQuality = 'high';
    c2.drawImage(pequeno, 0, 0, ancho, alto);
    const datos = c2.getImageData(0, 0, ancho, alto).data;
    const salida = new Float32Array(ancho * alto);
    for (let i = 0, j = 0; i < salida.length; i++, j += 4) salida[i] = datos[j] / 255;
    return salida;
  }

  // Desenfoque de caja separable (tres pasadas ≈ gaussiano), por franjas.
  function* desenfocar(origen, destino, ancho, alto, radio, pasadas) {
    const temporal = new Float32Array(ancho * alto);
    let entrada = origen;
    const n = 2 * radio + 1;
    for (let p = 0; p < pasadas; p++) {
      // horizontal: entrada → temporal
      for (let y = 0; y < alto; y++) {
        const fila = y * ancho;
        let suma = 0;
        for (let k = -radio; k <= radio; k++) suma += entrada[fila + limitar(k, 0, ancho - 1)];
        for (let x = 0; x < ancho; x++) {
          temporal[fila + x] = suma / n;
          const sale = entrada[fila + Math.max(0, x - radio)];
          const entra = entrada[fila + Math.min(ancho - 1, x + radio + 1)];
          suma += entra - sale;
        }
        if ((y & 31) === 31) yield;
      }
      // vertical: temporal → destino (por bloques de columnas, para la caché)
      for (let x0 = 0; x0 < ancho; x0 += 16) {
        const x1 = Math.min(ancho, x0 + 16);
        for (let x = x0; x < x1; x++) {
          let suma = 0;
          for (let k = -radio; k <= radio; k++) suma += temporal[limitar(k, 0, alto - 1) * ancho + x];
          for (let y = 0; y < alto; y++) {
            destino[y * ancho + x] = suma / n;
            const sale = temporal[Math.max(0, y - radio) * ancho + x];
            const entra = temporal[Math.min(alto - 1, y + radio + 1) * ancho + x];
            suma += entra - sale;
          }
        }
        yield;
      }
      entrada = destino;
    }
  }

  // Tamaño de trabajo: lo que se ve (×dpr) con un margen, nunca más de ladoMaximo
  // (una línea de lápiz debe medir ~1 px en pantalla: dibujar mucho más grande
  // de lo que se ve la convierte en gris al reducirse)
  function medidas(img) {
    const naturalW = img.naturalWidth, naturalH = img.naturalHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const visible = Math.max(img.offsetWidth, img.offsetHeight) * dpr * 1.15;
    const ladoDeseado = visible > 0 ? Math.max(cfg.ladoMinimo, visible) : cfg.ladoMaximo;
    const ladoNatural = Math.max(naturalW, naturalH);
    const lado = Math.round(Math.min(cfg.ladoMaximo, ladoDeseado, ladoNatural));
    const escala = lado / ladoNatural;
    return { W: Math.max(8, Math.round(naturalW * escala)), H: Math.max(8, Math.round(naturalH * escala)), lado, ladoNatural };
  }

  function* dibujar(img, lienzo, ajustes) {
    const { W, H, lado, ladoNatural } = medidas(img);
    lienzo.width = W; lienzo.height = H;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (ladoNatural > lado * 2.2) {
      // Reducción en dos pasos si la foto es mucho más grande (menos aliasing)
      const medio = document.createElement('canvas');
      medio.width = W * 2; medio.height = H * 2;
      const cm = medio.getContext('2d');
      cm.imageSmoothingQuality = 'high';
      cm.drawImage(img, 0, 0, medio.width, medio.height);
      yield;
      ctx.drawImage(medio, 0, 0, W, H);
    } else {
      ctx.drawImage(img, 0, 0, W, H);
    }
    yield;
    const imagen = ctx.getImageData(0, 0, W, H);   // lanza SecurityError si hay CORS
    const px = imagen.data;
    const N = W * H;
    // Si el navegador aún no había decodificado la foto, drawImage no pinta nada
    let vacio = true;
    for (let i = 3; i < px.length && vacio; i += 4 * 97) if (px[i] !== 0) vacio = false;
    if (vacio) throw new Error('vacio');

    // 1 · gris (luminancia)
    const L = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      L[i] = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255;
      if ((i & 0x7fff) === 0x7fff) yield;
    }

    // 2 · dos desenfoques: fino (quita el ruido del sensor) y ancho (la mancha que
    //     se resta para encontrar la línea). Radios relativos al tamaño de trabajo.
    const k = Math.max(0.6, lado / 800);
    const rFino = Math.max(1, Math.round(ajustes.radioFino * k));
    const rAncho = Math.max(rFino + 1, Math.round(ajustes.radioAncho * k));
    const G1 = new Float32Array(N);
    const G2 = new Float32Array(N);
    yield* desenfocar(L, G1, W, H, rFino, 2);
    yield* desenfocar(L, G2, W, H, rAncho, 3);

    // 3 · ruidos: ondulado (mano) y fino (grano del papel)
    const onda = ruidoSuave(W, H, Math.max(6, Math.round(14 * k)));
    yield;
    const onda2 = ruidoSuave(W, H, Math.max(10, Math.round(26 * k)));
    yield;

    // 4 · composición, por filas
    const { tau, epsilon, phi, bordeDesde, bordeHasta, pesoBorde, pesoXdog, lavado, sombreado, grano } = ajustes;
    const opacidad = ajustes.opacidad ?? 0.84;
    const sombraDesde = ajustes.sombraDesde ?? 0.5;
    const ondulacion = ajustes.ondulacion * k;
    const tinta = TINTAS[ajustes.tono || cfg.tono] || TINTAS.olivo;
    const [pr, pg, pb] = PAPEL;
    const [lr, lg, lb] = tinta.linea;
    const [wr, wg, wb] = tinta.lavado;
    const periodoTrama = Math.max(3, 5 * k);
    let semilla = 987654321;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // la línea se lee en un punto ligeramente desplazado: el pulso de la mano
        const dx = Math.round((onda[i] - 0.5) * 2 * ondulacion);
        const dy = Math.round((onda2[i] - 0.5) * 2 * ondulacion);
        const xs = limitar(x + dx, 1, W - 2);
        const ys = limitar(y + dy, 1, H - 2);
        const j = ys * W + xs;

        // XDoG: diferencia de desenfoques con umbral suave (tanh)
        const d = G1[j] - tau * G2[j];
        let linea = d >= epsilon ? 0 : -Math.tanh(phi * (d - epsilon));

        // Sobel sobre el desenfoque fino: contornos francos
        const a = G1[j - W - 1], b = G1[j - W], c = G1[j - W + 1];
        const dd = G1[j - 1], f = G1[j + 1];
        const g = G1[j + W - 1], h = G1[j + W], ii = G1[j + W + 1];
        const gx = (c + 2 * f + ii) - (a + 2 * dd + g);
        const gy = (g + 2 * h + ii) - (a + 2 * b + c);
        const borde = suavizar(bordeDesde, bordeHasta, Math.sqrt(gx * gx + gy * gy) * 0.25);

        linea = Math.max(linea * pesoXdog, borde * pesoBorde);
        // peso variable del trazo y pequeñas roturas
        semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
        const fino = ((semilla >> 8) & 255) / 255;
        linea *= (0.55 + 0.9 * onda2[i]) * (0.78 + 0.44 * fino);
        if (linea > 1) linea = 1;

        // lavado: tono general muy suave en las zonas oscuras
        const oscuro = 1 - G2[i];
        const lav = suavizar(0.22, 0.95, oscuro) * lavado * (0.8 + 0.4 * onda[i]);

        // sombreado: trama diagonal a lápiz, solo en las sombras hondas
        const som = suavizar(sombraDesde, 0.96, oscuro) * sombreado;
        if (som > 0.003) {
          const fase = (x + y + (onda[i] - 0.5) * 5) / periodoTrama;
          const t = fase - Math.floor(fase);
          const raya = t < 0.42 ? 1 - Math.abs(t - 0.21) / 0.21 : 0;
          const s = raya * som * (0.6 + 0.6 * onda2[i]);
          if (s > linea) linea = Math.min(1, s);
        }

        // papel con grano → lavado → línea
        const g0 = (fino - 0.5) * grano;
        let r = pr + g0, gg = pg + g0, bb = pb + g0;
        r += (wr - r) * lav; gg += (wg - gg) * lav; bb += (wb - bb) * lav;
        const op = linea * opacidad;
        r += (lr - r) * op; gg += (lg - gg) * op; bb += (lb - bb) * op;

        const o = i * 4;
        px[o] = r; px[o + 1] = gg; px[o + 2] = bb; px[o + 3] = 255;
      }
      if ((y & 7) === 7) yield;
    }
    ctx.putImageData(imagen, 0, 0);
    return { ancho: W, alto: H };
  }

  /* ═══════════ DOM: capa del dibujo y botón ═══════════ */

  function anfitrionDe(img) {
    let padre = img.parentElement;
    while (padre && padre.tagName === 'PICTURE') padre = padre.parentElement;
    return padre;
  }
  function referenciaDe(img) {   // tras qué nodo se insertan las capas
    let nodo = img;
    while (nodo.parentElement && nodo.parentElement.tagName === 'PICTURE') nodo = nodo.parentElement;
    return nodo;
  }

  function ajustesDe(img, extra) {
    const nombre = INTENSIDADES[img.dataset.trazoIntensidad] ? img.dataset.trazoIntensidad : cfg.intensidad;
    return Object.assign({}, INTENSIDADES[nombre], cfg.ajustes, extra);
  }

  function montar(ficha) {
    if (ficha.montada) return;
    const { img } = ficha;
    const anfitrion = anfitrionDe(img);
    if (!anfitrion) return;
    ficha.anfitrion = anfitrion;
    anfitrion.classList.add('trazo-anfitrion');
    if (getComputedStyle(anfitrion).position === 'static') anfitrion.classList.add('trazo-anfitrion--posicionar');

    const lienzo = document.createElement('canvas');
    lienzo.className = 'trazo__dibujo';
    lienzo.setAttribute('aria-hidden', 'true');

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'trazo__boton';
    boton.setAttribute('aria-pressed', 'false');
    boton.hidden = true;   // hasta que el dibujo esté listo no hay nada que alternar
    const pista = document.createElement('span');
    pista.className = 'trazo__pista';
    pista.textContent = cfg.pista.foto;
    boton.appendChild(pista);
    boton.addEventListener('click', () => alternar(ficha));

    referenciaDe(img).after(lienzo, boton);
    Object.assign(ficha, { lienzo, boton, pista, montada: true, foto: false });

    // Las capas siguen la caja de la foto (tamaño y posición dentro del anfitrión)
    ficha.observadorTamano = new ResizeObserver(() => acomodar(ficha));
    ficha.observadorTamano.observe(img);
    ficha.observadorTamano.observe(anfitrion);
    acomodar(ficha);
  }

  function acomodar(ficha) {
    const { img, lienzo, boton } = ficha;
    if (!lienzo) return;
    const estilo = getComputedStyle(img);
    const caja = `left:${img.offsetLeft}px;top:${img.offsetTop}px;width:${img.offsetWidth}px;height:${img.offsetHeight}px;`;
    const estiloLienzo = caja + `border-radius:${estilo.borderRadius};object-fit:${estilo.objectFit || 'cover'};object-position:${estilo.objectPosition || '50% 50%'};`;
    if (estiloLienzo === ficha.ultimoEstilo) return;   // nada cambió: no se provoca otro ciclo del ResizeObserver
    ficha.ultimoEstilo = estiloLienzo;
    lienzo.style.cssText = estiloLienzo;
    boton.style.cssText = caja + `border-radius:${estilo.borderRadius};`;
  }

  function desmontar(ficha, motivo) {
    if (ficha.observadorTamano) ficha.observadorTamano.disconnect();
    // El dibujo terminado se conserva por si la misma foto vuelve (sin duplicar memoria)
    if (ficha.lienzo && ficha.clave && ficha.estado === 'listo') {
      if (cache.size >= 12) cache.delete(cache.keys().next().value);
      cache.set(ficha.clave, { lienzo: ficha.lienzo });
    }
    ficha.lienzo?.remove();
    ficha.boton?.remove();
    // La foto pudo taparse antes de montar (trazo--preparando en el anfitrión): se destapa siempre
    const previo = anfitrionDe(ficha.img);
    if (previo && previo !== ficha.anfitrion) previo.classList.remove('trazo--preparando');
    if (ficha.anfitrion) {
      ficha.anfitrion.classList.remove('trazo--listo', 'trazo--foto', 'trazo--preparando', 'trazo-anfitrion', 'trazo-anfitrion--posicionar');
      // Solo si ya no queda otra foto con trazo dentro (el anfitrión puede compartirse)
      if (ficha.anfitrion.querySelector('.trazo__dibujo')) ficha.anfitrion.classList.add('trazo-anfitrion');
    }
    clearTimeout(ficha.temporizadorEspera);
    // Sin clave ni promesa: si la foto vuelve (deja de estar oculta) se dibuja otra vez
    Object.assign(ficha, { lienzo: null, boton: null, pista: null, montada: false, foto: false, clave: '', promesa: null, estado: motivo || 'sinTrazo' });
    if (motivo) document.dispatchEvent(new CustomEvent('trazo:omitido', { detail: { img: ficha.img, motivo } }));
  }

  function alternar(ficha, mostrarFoto) {
    const foto = typeof mostrarFoto === 'boolean' ? mostrarFoto : !ficha.foto;
    if (foto === ficha.foto) return;
    ficha.foto = foto;
    ficha.anfitrion.classList.toggle('trazo--foto', foto);
    ficha.boton.setAttribute('aria-pressed', String(foto));
    ficha.pista.textContent = foto ? cfg.pista.dibujo : cfg.pista.foto;
    document.dispatchEvent(new CustomEvent('trazo:cambio', { detail: { img: ficha.img, foto } }));
  }

  /* ═══════════ Procesar una imagen ═══════════ */

  function claveDe(src, ajustes) {
    return src + '|' + JSON.stringify(ajustes);
  }

  function procesar(img, extra) {
    if (destruido || !(img instanceof HTMLImageElement)) return Promise.resolve(null);
    let ficha = fichas.get(img);
    if (!ficha) { ficha = { img, estado: 'esperando', foto: false, serie: 0 }; fichas.set(img, ficha); todas.add(ficha); }
    const src = img.currentSrc || img.src;
    if (!src || img.hidden) {
      if (ficha.montada) desmontar(ficha);
      ficha.estado = 'esperando';
      return Promise.resolve(null);
    }
    const { forzar, ...sueltos } = extra || {};
    const ajustes = ajustesDe(img, sueltos);
    const clave = claveDe(src, ajustes);
    if (ficha.clave === clave && ficha.promesa && !forzar) return ficha.promesa;

    // Una corrida nueva invalida la anterior (cambió el src o los ajustes)
    const serie = ++ficha.serie;
    Object.assign(ficha, { clave, estado: 'procesando', pasoMax: 0 });
    const cancelada = () => destruido || ficha.serie !== serie;

    // Desde ya la foto espera escondida (si el dibujo tarda de más, se muestra)
    const anfitrionPrevio = anfitrionDe(img);
    if (anfitrionPrevio) {
      anfitrionPrevio.classList.add('trazo--preparando');
      clearTimeout(ficha.temporizadorEspera);
      ficha.temporizadorEspera = setTimeout(() => anfitrionPrevio.classList.remove('trazo--preparando'), cfg.esperaMaxima);
    }

    ficha.promesa = (async () => {
      const inicio = performance.now();
      try {
        if (!(img.complete && img.naturalWidth > 0)) {
          await new Promise((resolver, rechazar) => {
            img.addEventListener('load', resolver, { once: true });
            img.addEventListener('error', () => rechazar(new Error('no cargó')), { once: true });
          });
          if (cancelada()) return null;
        }
        if (img.hidden || !img.isConnected) { ficha.estado = 'esperando'; anfitrionPrevio?.classList.remove('trazo--preparando'); return null; }
        // Decodificada antes de leerla: «complete» no garantiza que drawImage pinte algo
        if (typeof img.decode === 'function') { try { await img.decode(); } catch (error) { /* se intenta igual */ } }
        if (cancelada()) return null;
        montar(ficha);
        // Mientras se dibuja, la foto espera escondida (si tarda de más, se muestra)
        ficha.anfitrion.classList.add('trazo--preparando');
        clearTimeout(ficha.temporizadorEspera);
        ficha.temporizadorEspera = setTimeout(() => ficha.anfitrion?.classList.remove('trazo--preparando'), cfg.esperaMaxima);

        const entrada = forzar ? null : cache.get(clave);
        if (entrada) {
          ficha.lienzo.width = entrada.lienzo.width; ficha.lienzo.height = entrada.lienzo.height;
          ficha.lienzo.getContext('2d').drawImage(entrada.lienzo, 0, 0);
        } else {
          // (se probó createImageBitmap con tamaño para reducir fuera del hilo:
          // en WebKit sale 4 veces más lento, así que la reducción la hace drawImage)
          try {
            await correr(dibujar(img, ficha.lienzo, ajustes), ficha, serie);
          } catch (error) {
            if (!(error && error.message === 'vacio')) throw error;
            // Segundo intento tras un respiro (la foto termina de decodificarse)
            await new Promise((r) => setTimeout(r, 120));
            if (cancelada()) return null;
            await correr(dibujar(img, ficha.lienzo, ajustes), ficha, serie);
          }
          if (cancelada()) return null;
        }
        ficha.clave = clave;   // el lienzo se guarda en la caché al desmontar (sin copiarlo)
        acomodar(ficha);
        clearTimeout(ficha.temporizadorEspera);
        // El dibujo aparece de golpe (sin el fundido de .7 s) y solo entonces se destapa la
        // foto: el invitado nunca ve la foto real antes que el dibujo
        ficha.lienzo.style.transition = 'none';
        ficha.anfitrion.classList.add('trazo--listo');
        void ficha.lienzo.offsetWidth;
        ficha.lienzo.style.transition = '';
        ficha.anfitrion.classList.remove('trazo--preparando');
        ficha.boton.hidden = false;
        ficha.estado = 'listo';
        const ms = Math.round(performance.now() - inicio);
        document.dispatchEvent(new CustomEvent('trazo:listo', {
          detail: { img, lienzo: ficha.lienzo, ms, pasoMax: Math.round(ficha.pasoMax || 0), ancho: ficha.lienzo.width, alto: ficha.lienzo.height }
        }));
        return ficha.lienzo;
      } catch (error) {
        if (cancelada() || (error && error.message === 'cancelado')) return null;
        // Lienzo «sucio» (foto de otro origen sin CORS), decodificación fallida…: queda la foto real
        const motivo = error && error.name === 'SecurityError' ? 'cors' : 'error';
        if (motivo === 'error') console.warn('[trazo] no se pudo dibujar la foto:', error);
        desmontar(ficha, motivo);
        return null;
      }
    })();
    return ficha.promesa;
  }

  function buscar(raiz) {
    const nodos = raiz.querySelectorAll ? raiz.querySelectorAll(cfg.selector) : [];
    nodos.forEach((img) => procesar(img));
    if (raiz instanceof HTMLImageElement && raiz.matches(cfg.selector)) procesar(raiz);
  }

  /* ── Vigilar: fotos que llegan después (main.js pone el src de las polaroids) ── */
  let observadorDom = null;
  if (cfg.observar && typeof MutationObserver === 'function') {
    observadorDom = new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        if (cambio.type === 'attributes') {
          const img = cambio.target;
          if (img instanceof HTMLImageElement && img.matches(cfg.selector)) {
            const ficha = fichas.get(img);
            if (img.hidden || !(img.currentSrc || img.src)) { if (ficha?.montada) desmontar(ficha); ficha && (ficha.estado = 'esperando'); }
            else procesar(img);
          }
        } else {
          cambio.addedNodes.forEach((nodo) => { if (nodo.nodeType === 1) buscar(nodo); });
        }
      }
    });
    observadorDom.observe(cfg.raiz, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'hidden'] });
  }

  buscar(cfg.raiz);

  instancia = {
    procesar,
    // Muestra la foto (true) o el dibujo (false) de una imagen ya lista
    mostrar(img, foto) { const f = fichas.get(img); if (f?.estado === 'listo') alternar(f, foto); },
    estado(img) { return fichas.get(img)?.estado || null; },
    intensidades: Object.keys(INTENSIDADES),
    destruir() {
      destruido = true;
      observadorDom?.disconnect();
      todas.forEach((f) => { f.serie++; desmontar(f); });
      todas.clear();
      cache.clear();
      instancia = null;
    }
  };
  return instancia;
}
