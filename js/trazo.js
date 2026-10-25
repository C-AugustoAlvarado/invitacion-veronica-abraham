// Fotos con trazo — js/trazo.js
// Abraham: «las fotos que sean dibujadas y si le das click que haya una
// transición muy sutil y muestre la foto real».
//
// Dos modos, con el mismo botón accesible (aria-pressed) y el mismo cruce de ~700 ms:
//
// 1 · PRECALCULADO (el de la página). El dibujo a lápiz se calculó una sola vez con
//     scripts/trazos.mjs (que usa dibujarEn() de aquí) y se sirve como imagen
//     (<nombre>-trazo.avif/.jpg). En el teléfono no hay canvas ni cálculo: el módulo
//     solo gestiona el toque/teclado, la pista y el caso en que el dibujo no cargue.
//     Marcas en el HTML (src/historia.html):
//       <button class="trazo__boton" aria-pressed="false">
//         <picture class="polaroid__foto-real"><img …foto…></picture>
//         <picture class="polaroid__trazo" aria-hidden="true"><img …dibujo…></picture>
//         <span class="trazo__pista">Toca para ver la foto</span>
//       </button>
//     También vale <img data-trazo-src="dibujo.avif"> dentro del botón: el módulo crea
//     la capa del dibujo (<img class="trazo__precalculado">).
//
// 2 · CANVAS (demo/trazo.html y cualquier <img data-trazo-foto> sin dibujo precalculado).
//     Se lee la foto en un <canvas> pequeño, se desatura, se buscan los bordes
//     (diferencia de desenfoques + Sobel), se pasan por un umbral suave y se pintan como
//     lápiz sobre papel marfil, con un lavado muy ligero en olivo y un grano de papel.
//     El trabajo se reparte en pasos de ~8 ms. Sin JavaScript (o si el lienzo se
//     «ensucia» por CORS) se ve la foto.
//
// Uso:  const trazo = iniciarTrazo({ intensidad: 'media' });
//       trazo.procesar(img);  trazo.mostrar(img, true);  trazo.destruir();
// Para scripts (Node + navegador) y demos:  dibujarEn(lienzo, img, ajustes, { ancho, alto })
// Marcas del modo canvas:  <img data-trazo-foto>  ·  data-trazo-intensidad="suave|media|fuerte"
// Eventos en document:  trazo:listo  { img, lienzo, dibujo, ms, ancho, alto, precalculado }
//                       trazo:cambio { img, foto: boolean }
//                       trazo:omitido { img, motivo }
// Solo se animan transform y opacity (css/trazo.css). Tokens en base.css.

const PAPEL = [246, 242, 234];          // --marfil
export const TINTAS = {
  olivo: { linea: [58, 60, 50], lavado: [166, 168, 132] },   // grafito cálido · --olivo-claro apagado
  sepia: { linea: [66, 56, 46], lavado: [184, 166, 136] }
};

// Tres intensidades afinadas en demo/trazo.html (escena de tonos continuos y la
// acuarela). «media» es la de la página. Se exportan para la demo y el script.
//   tau/epsilon/phi: XDoG (resta de desenfoques y umbral suave) · bordeDesde/Hasta,
//   pesoBorde: Sobel · lavado: tono general · sombreado/sombraDesde: trama a lápiz en
//   las sombras · grano: papel · ondulacion: pulso de la mano · radios: desenfoques ·
//   opacidad: fuerza máxima de la línea
export const INTENSIDADES = {
  suave:  { tau: 0.995, epsilon: -0.002, phi: 20, bordeDesde: 0.07, bordeHasta: 0.32, pesoBorde: 0.80, pesoXdog: 0.75, lavado: 0.18, sombreado: 0.12, sombraDesde: 0.56, grano: 7, ondulacion: 1.4, radioFino: 1.0, radioAncho: 2.4, opacidad: 0.76 },
  media:  { tau: 0.99,  epsilon: -0.001, phi: 26, bordeDesde: 0.06, bordeHasta: 0.28, pesoBorde: 0.90, pesoXdog: 0.85, lavado: 0.30, sombreado: 0.26, sombraDesde: 0.50, grano: 9, ondulacion: 1.6, radioFino: 1.0, radioAncho: 2.6, opacidad: 0.84 },
  fuerte: { tau: 0.985, epsilon: 0.001,  phi: 36, bordeDesde: 0.045, bordeHasta: 0.24, pesoBorde: 1.00, pesoXdog: 1.00, lavado: 0.36, sombreado: 0.40, sombraDesde: 0.42, grano: 11, ondulacion: 1.9, radioFino: 1.0, radioAncho: 3.0, opacidad: 0.9 }
};

const PISTA = { foto: 'Toca para ver la foto', dibujo: 'Toca para ver el dibujo', cargando: 'Cargando la foto…', sinFoto: 'La foto no cargó' };

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const suavizar = (a, b, x) => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ═══════════ El dibujo (independiente del DOM de la página) ═══════════ */

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

// El dibujo, como generador: cada «yield» es un punto donde se puede ceder el hilo.
//   origen: <img> (o canvas) ya decodificado · lienzo: <canvas> destino
//   ajustes: una entrada de INTENSIDADES (+ tono) · m: { W, H, lado, ladoNatural }
// Lanza Error('vacio') si drawImage no pintó nada (foto sin decodificar) y
// SecurityError si el lienzo queda «sucio» (foto de otro origen sin CORS).
export function* pasosTrazo(origen, lienzo, ajustes, m) {
  const { W, H, lado, ladoNatural } = m;
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
    cm.drawImage(origen, 0, 0, medio.width, medio.height);
    yield;
    ctx.drawImage(medio, 0, 0, W, H);
  } else {
    ctx.drawImage(origen, 0, 0, W, H);
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

  // 1b · (opcional) levantar las sombras antes de buscar la línea: en retratos con
  //      fondo oscuro (cena, Navidad) evita que el fondo se vuelva una mancha.
  //      gamma < 1 aclara los medios tonos; 1 = tal cual.
  const gamma = ajustes.gamma ?? 1;
  if (gamma !== 1) {
    for (let i = 0; i < N; i++) L[i] = Math.pow(L[i], gamma);
    yield;
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
  const tinta = TINTAS[ajustes.tono] || TINTAS.olivo;
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

// Dibuja de una vez (sin ceder el hilo) la imagen «origen» sobre «lienzo».
// Para scripts/trazos.mjs y pruebas; en la página se usa el generador por pasos.
//   ajustes: nombre de intensidad ('media') u objeto (se completa con «media»)
//   opciones: { ancho, alto } del dibujo (por defecto, el tamaño natural de la foto)
// Devuelve { ancho, alto }.
export function dibujarEn(lienzo, origen, ajustes = 'media', opciones = {}) {
  const base = typeof ajustes === 'string' ? INTENSIDADES[ajustes] || INTENSIDADES.media : ajustes;
  const completos = Object.assign({ tono: 'olivo' }, INTENSIDADES.media, base);
  const naturalW = origen.naturalWidth || origen.width;
  const naturalH = origen.naturalHeight || origen.height;
  if (!naturalW || !naturalH) throw new Error('la imagen de origen no tiene medidas');
  const W = Math.max(8, Math.round(opciones.ancho || naturalW));
  const H = Math.max(8, Math.round(opciones.alto || naturalH * W / naturalW));
  const m = { W, H, lado: Math.max(W, H), ladoNatural: Math.max(naturalW, naturalH) };
  const pasos = pasosTrazo(origen, lienzo, completos, m);
  let r = pasos.next();
  while (!r.done) r = pasos.next();
  return r.value;
}

/* ═══════════ El módulo de la página ═══════════ */

// La foto real viene sin src (data-src en el <img>, data-srcset en sus <source>): así la
// portada no la descarga. Esto la activa; devuelve true si había algo que activar.
function activarFoto(img) {
  let activo = false;
  const picture = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
  if (picture) {
    picture.querySelectorAll('source[data-srcset]').forEach((s) => { s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); activo = true; });
  }
  if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); activo = true; }
  return activo;
}

let instancia = null;

export function iniciarTrazo(opciones = {}) {
  if (instancia) return instancia;   // idempotente: una sola instancia por página
  const raizDoc = document.documentElement;
  // Modo básico: nada de cruces. Se piden las fotos reales (su src va diferido en
  // data-src) y css/trazo.css las deja a la vista en lugar del dibujo (.trazo--basico).
  if (raizDoc.classList.contains('basico')) {
    document.querySelectorAll(opciones.selectorBoton || 'button.trazo__boton').forEach((boton) => {
      const foto = boton.querySelector('.polaroid__foto-real img, img[data-src]');
      if (foto && activarFoto(foto)) {
        boton.classList.add('trazo--basico');
        // Sin cruce no hay nada que pulsar: el botón se apaga y la <img> habla por su alt
        boton.disabled = true;
        boton.removeAttribute('aria-pressed');
        boton.removeAttribute('aria-label');
      }
    });
    return null;
  }

  const cfg = {
    raiz: opciones.raiz || document,
    selector: opciones.selector || 'img[data-trazo-foto], img.polaroid__foto',
    selectorBoton: opciones.selectorBoton || 'button.trazo__boton',
    intensidad: INTENSIDADES[opciones.intensidad] ? opciones.intensidad : 'media',
    tono: TINTAS[opciones.tono] ? opciones.tono : 'olivo',
    ladoMaximo: opciones.ladoMaximo || 900,
    ladoMinimo: opciones.ladoMinimo || 320,
    presupuesto: opciones.presupuesto || 8,           // ms de trabajo seguidos antes de ceder el hilo
    observar: opciones.observar !== false,
    pista: Object.assign({}, PISTA, opciones.pista),
    ajustes: opciones.ajustes || null,                 // sobrescribe la intensidad (laboratorio de la demo)
    esperaMaxima: opciones.esperaMaxima || 2500,       // ms que la foto se oculta esperando su dibujo
    duracionCruce: opciones.duracionCruce || 700,      // ms del fundido (css/trazo.css); will-change solo mientras dura
    margenCarga: opciones.margenCarga || '160px 0px',  // la foto real se pide cuando su polaroid está a esta distancia de la pantalla
    margenDibujo: opciones.margenDibujo || '600px 0px', // el dibujo, bastante antes: siempre llega primero
    esperaFoto: opciones.esperaFoto || 1800            // ms que un toque espera a que llegue la foto antes de cruzar igual
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

  /* ── Lo común a los dos modos: el cruce foto ↔ dibujo ── */
  function alternar(ficha, mostrarFoto) {
    const foto = typeof mostrarFoto === 'boolean' ? mostrarFoto : !ficha.foto;
    if (foto === ficha.foto) return;
    ficha.foto = foto;
    const anfitrion = ficha.anfitrion;
    anfitrion.classList.toggle('trazo--foto', foto);
    ficha.boton.setAttribute('aria-pressed', String(foto));
    if (ficha.pista) ficha.pista.textContent = foto ? cfg.pista.dibujo : cfg.pista.foto;
    // will-change solo mientras dura el fundido
    anfitrion.classList.add('trazo--cruzando');
    clearTimeout(ficha.temporizadorCruce);
    ficha.temporizadorCruce = setTimeout(() => anfitrion.classList.remove('trazo--cruzando'), cfg.duracionCruce + 100);
    document.dispatchEvent(new CustomEvent('trazo:cambio', { detail: { img: ficha.img, foto } }));
  }

  /* ═══════════ Modo precalculado ═══════════ */

  // La foto real se pide cuando la polaroid se acerca a la pantalla (o al primer toque)
  const observadorCercania = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        observadorCercania.unobserve(e.target);
        const ficha = fichasBoton.get(e.target);
        if (ficha) pedirFoto(ficha);
      }
    }, { rootMargin: cfg.margenCarga })
    : null;
  const fichasBoton = new WeakMap();   // botón → ficha (para el observador)
  // El dibujo a lápiz tampoco lleva src (data-src): se pide con más anticipación que la
  // foto, para que esté puesto antes de que la polaroid asome
  const observadorDibujo = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        observadorDibujo.unobserve(e.target);
        const ficha = fichasBoton.get(e.target);
        if (ficha && ficha.dibujo) activarFoto(ficha.dibujo);
      }
    }, { rootMargin: cfg.margenDibujo })
    : null;

  // Devuelve una promesa que se cumple cuando la foto real está decodificada (o falló)
  function pedirFoto(ficha) {
    if (ficha.promesaFoto) return ficha.promesaFoto;
    const { img } = ficha;
    activarFoto(img);
    if (observadorCercania && ficha.boton) observadorCercania.unobserve(ficha.boton);
    ficha.promesaFoto = (async () => {
      if (!(img.complete && img.naturalWidth > 0)) {
        await new Promise((resolver) => {
          if (!img.currentSrc && !img.src) return resolver();   // no hay foto que esperar
          img.addEventListener('load', resolver, { once: true });
          img.addEventListener('error', () => { ficha.fotoError = true; resolver(); }, { once: true });
          if (img.complete) resolver();
        });
      }
      if (typeof img.decode === 'function' && img.naturalWidth > 0) { try { await img.decode(); } catch (error) { /* se muestra igual */ } }
      if (!(img.naturalWidth > 0)) ficha.fotoError = true;
      ficha.fotoLista = !ficha.fotoError;
    })();
    return ficha.promesaFoto;
  }

  // ¿Este botón trae su dibujo ya hecho? Devuelve { foto, dibujo } o null.
  function capasDe(boton) {
    if (boton.__trazoCapa) return null;   // botón que montó el modo canvas
    const dibujo = boton.querySelector('.polaroid__trazo img, img.trazo__precalculado');
    const conSrc = boton.querySelector('img[data-trazo-src]');
    const foto = conSrc || [...boton.querySelectorAll('img')]
      .find((img) => img !== dibujo && !img.classList.contains('trazo__precalculado') && !img.closest('.polaroid__trazo'));
    if (!foto) return null;
    if (dibujo) return { foto, dibujo };
    if (conSrc && conSrc.dataset.trazoSrc) return { foto: conSrc, dibujo: null };
    return null;
  }

  function montarPrecalculado(boton) {
    const capas = capasDe(boton);
    if (!capas) return false;
    const { foto } = capas;
    let ficha = fichas.get(foto);
    if (ficha && ficha.montada) return true;
    if (!ficha) { ficha = { img: foto, estado: 'esperando', foto: false, serie: 0 }; fichas.set(foto, ficha); todas.add(ficha); }
    const inicio = performance.now();

    let dibujo = capas.dibujo;
    if (!dibujo) {
      dibujo = document.createElement('img');
      dibujo.className = 'trazo__precalculado';
      dibujo.alt = '';
      dibujo.decoding = 'async';
      dibujo.loading = foto.loading || 'lazy';
      if (foto.width) dibujo.width = foto.width;
      if (foto.height) dibujo.height = foto.height;
      dibujo.src = foto.dataset.trazoSrc;
      foto.after(dibujo);
    }

    let pista = boton.querySelector('.trazo__pista');
    if (!pista) {
      pista = document.createElement('span');
      pista.className = 'trazo__pista';
      boton.appendChild(pista);
    }
    const yaFoto = boton.getAttribute('aria-pressed') === 'true';
    pista.textContent = yaFoto ? cfg.pista.dibujo : cfg.pista.foto;
    boton.setAttribute('aria-pressed', String(yaFoto));
    boton.classList.add('trazo-anfitrion', 'trazo--listo', 'trazo--precalculado');
    boton.classList.toggle('trazo--foto', yaFoto);

    Object.assign(ficha, { boton, anfitrion: boton, dibujo, pista, montada: true, foto: yaFoto, precalculado: true, estado: 'listo', fotoLista: false, promesaFoto: null });
    fichasBoton.set(boton, ficha);

    // El dibujo: si viene diferido (data-src) se pide al acercarse con margen amplio
    if (dibujo && (dibujo.dataset.src || dibujo.parentElement?.querySelector('source[data-srcset]'))) {
      if (observadorDibujo) observadorDibujo.observe(boton); else activarFoto(dibujo);
    }
    // La foto real: ya está (src de verdad) o se pide al acercarse / al tocar
    if (foto.currentSrc || foto.getAttribute('src')) ficha.fotoLista = foto.complete && foto.naturalWidth > 0;
    if (!ficha.fotoLista) {
      if (observadorCercania) observadorCercania.observe(boton);
      else pedirFoto(ficha);
    }
    if (yaFoto) pedirFoto(ficha);

    ficha.alPulsar = () => {
      // Hacia el dibujo, o hacia una foto ya lista: cruce inmediato
      if (ficha.foto || ficha.fotoLista) return alternar(ficha);
      // La foto aún no llegó: se pide y se cruza en cuanto esté (o al vencer la espera)
      if (ficha.esperandoFoto) return;
      ficha.esperandoFoto = true;
      boton.classList.add('trazo--esperando');
      const serie = ++ficha.serie;
      let cruzado = false;
      const cruzar = () => {
        if (cruzado || !ficha.montada || ficha.serie !== serie) return;
        if (ficha.fotoError) {
          // La foto no cargó: se queda el dibujo y el botón lo dice, sin engañar
          cruzado = true;
          ficha.esperandoFoto = false;
          boton.classList.remove('trazo--esperando');
          boton.classList.add('trazo--sin-foto');
          pista.textContent = cfg.pista.sinFoto;
          boton.setAttribute('aria-pressed', 'false');
          return;
        }
        if (!ficha.fotoLista) return;   // todavía no llega: se sigue esperando (la promesa cruzará)
        cruzado = true;
        ficha.esperandoFoto = false;
        boton.classList.remove('trazo--esperando');
        pista.textContent = cfg.pista.foto;
        alternar(ficha, true);
      };
      pedirFoto(ficha).then(cruzar);
      // Si tarda, se avisa en vez de cruzar a una ventana vacía
      setTimeout(() => { if (!cruzado && !ficha.fotoError) pista.textContent = cfg.pista.cargando; }, cfg.esperaFoto);
    };
    boton.addEventListener('click', ficha.alPulsar);

    // Si el dibujo no carga (archivo que falta, red), queda la foto y el botón no engaña
    const sinDibujo = () => {
      if (!ficha.montada || ficha.estado === 'sinDibujo') return;
      ficha.estado = 'sinDibujo';
      boton.classList.add('trazo--sin-dibujo');
      boton.classList.remove('trazo--listo');
      boton.setAttribute('aria-pressed', 'true');
      boton.disabled = true;
      document.dispatchEvent(new CustomEvent('trazo:omitido', { detail: { img: foto, motivo: 'sinDibujo' } }));
    };
    ficha.alFallar = sinDibujo;
    dibujo.addEventListener('error', sinDibujo);
    if (dibujo.complete && dibujo.naturalWidth === 0 && dibujo.currentSrc) sinDibujo();   // ya había fallado antes de que llegara el módulo

    document.dispatchEvent(new CustomEvent('trazo:listo', {
      detail: { img: foto, lienzo: null, dibujo, ms: Math.round(performance.now() - inicio), ancho: dibujo.naturalWidth || dibujo.width, alto: dibujo.naturalHeight || dibujo.height, precalculado: true }
    }));
    return true;
  }

  function desmontarPrecalculado(ficha) {
    const { boton, dibujo } = ficha;
    if (boton) {
      boton.removeEventListener('click', ficha.alPulsar);
      if (observadorCercania) observadorCercania.unobserve(boton);
      fichasBoton.delete(boton);
      boton.classList.remove('trazo-anfitrion', 'trazo--listo', 'trazo--precalculado', 'trazo--foto', 'trazo--cruzando', 'trazo--sin-dibujo', 'trazo--esperando', 'trazo--sin-foto');
      boton.disabled = false;
      boton.setAttribute('aria-pressed', 'false');
    }
    if (dibujo) {
      dibujo.removeEventListener('error', ficha.alFallar);
      if (dibujo.classList.contains('trazo__precalculado')) dibujo.remove();
    }
    clearTimeout(ficha.temporizadorCruce);
    ficha.serie++;
    Object.assign(ficha, { boton: null, anfitrion: null, dibujo: null, pista: null, montada: false, foto: false, esperandoFoto: false, estado: 'sinTrazo' });
  }

  /* ═══════════ Modo canvas: capa del dibujo y botón ═══════════ */

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
  // Una foto que ya vive dentro de un botón precalculado no se dibuja con canvas
  function esPrecalculada(img) {
    const boton = img.closest(cfg.selectorBoton);
    return !!(boton && !boton.__trazoCapa && capasDe(boton));
  }

  function ajustesDe(img, extra) {
    const nombre = INTENSIDADES[img.dataset.trazoIntensidad] ? img.dataset.trazoIntensidad : cfg.intensidad;
    return Object.assign({ tono: cfg.tono }, INTENSIDADES[nombre], cfg.ajustes, extra);
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
    boton.className = 'trazo__boton trazo__boton--capa';
    boton.__trazoCapa = true;
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
    if (ficha.precalculado) return desmontarPrecalculado(ficha);
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
      ficha.anfitrion.classList.remove('trazo--listo', 'trazo--foto', 'trazo--cruzando', 'trazo--preparando', 'trazo-anfitrion', 'trazo-anfitrion--posicionar');
      // Solo si ya no queda otra foto con trazo dentro (el anfitrión puede compartirse)
      if (ficha.anfitrion.querySelector('.trazo__dibujo')) ficha.anfitrion.classList.add('trazo-anfitrion');
    }
    clearTimeout(ficha.temporizadorEspera);
    clearTimeout(ficha.temporizadorCruce);
    // Sin clave ni promesa: si la foto vuelve (deja de estar oculta) se dibuja otra vez
    Object.assign(ficha, { lienzo: null, boton: null, pista: null, montada: false, foto: false, clave: '', promesa: null, estado: motivo || 'sinTrazo' });
    if (motivo) document.dispatchEvent(new CustomEvent('trazo:omitido', { detail: { img: ficha.img, motivo } }));
  }

  /* ═══════════ Procesar una imagen (modo canvas) ═══════════ */

  function claveDe(src, ajustes) {
    return src + '|' + JSON.stringify(ajustes);
  }

  function procesar(img, extra) {
    if (destruido || !(img instanceof HTMLImageElement)) return Promise.resolve(null);
    // Dentro de un botón con dibujo precalculado no hay nada que calcular
    const botonPre = img.closest(cfg.selectorBoton);
    if (botonPre && esPrecalculada(img)) { montarPrecalculado(botonPre); return Promise.resolve(null); }
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
          const dibujar = () => pasosTrazo(img, ficha.lienzo, ajustes, medidas(img));
          try {
            await correr(dibujar(), ficha, serie);
          } catch (error) {
            if (!(error && error.message === 'vacio')) throw error;
            // Segundo intento tras un respiro (la foto termina de decodificarse)
            await new Promise((r) => setTimeout(r, 120));
            if (cancelada()) return null;
            await correr(dibujar(), ficha, serie);
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
          detail: { img, lienzo: ficha.lienzo, dibujo: null, ms, pasoMax: Math.round(ficha.pasoMax || 0), ancho: ficha.lienzo.width, alto: ficha.lienzo.height, precalculado: false }
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
    if (!raiz.querySelectorAll) return;
    // Primero los botones con dibujo precalculado (sus fotos no pasan por el canvas)
    raiz.querySelectorAll(cfg.selectorBoton).forEach((boton) => montarPrecalculado(boton));
    if (raiz instanceof HTMLButtonElement && raiz.matches(cfg.selectorBoton)) montarPrecalculado(raiz);
    raiz.querySelectorAll(cfg.selector).forEach((img) => procesar(img));
    if (raiz instanceof HTMLImageElement && raiz.matches(cfg.selector)) procesar(raiz);
  }

  /* ── Vigilar: fotos que llegan después (fragmentos que se montan tarde, demos) ── */
  let observadorDom = null;
  if (cfg.observar && typeof MutationObserver === 'function') {
    observadorDom = new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        if (cambio.type === 'attributes') {
          const img = cambio.target;
          if (img instanceof HTMLImageElement && img.matches(cfg.selector) && !esPrecalculada(img)) {
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
    mostrar(img, foto) {
      const f = fichas.get(img);
      if (f?.estado !== 'listo') return;
      if (f.precalculado && foto && !f.fotoLista) return pedirFoto(f).then(() => f.montada && alternar(f, true));
      alternar(f, foto);
    },
    // Pide la foto real de una polaroid precalculada sin cruzar (p. ej. para precargar)
    precargar(img) { const f = fichas.get(img); return f?.precalculado ? pedirFoto(f) : Promise.resolve(); },
    estado(img) { return fichas.get(img)?.estado || null; },
    intensidades: Object.keys(INTENSIDADES),
    destruir() {
      destruido = true;
      observadorDom?.disconnect();
      observadorCercania?.disconnect();
      todas.forEach((f) => { f.serie++; desmontar(f); });
      todas.clear();
      cache.clear();
      instancia = null;
    }
  };
  return instancia;
}
