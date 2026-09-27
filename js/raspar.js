// Tarjeta para raspar: una lámina dorada en <canvas> cubre la fecha y se
// retira con el dedo, el ratón o el lápiz. Al pasar el umbral se desvanece
// sola, emite 'raspar:revelado' y pide una ráfaga de pétalos.
//
// Sin JavaScript no hay lámina: la fecha se lee directo. Con movimiento
// reducido tampoco se crea: se marca como revelada desde el principio.

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suavizar = (t) => t * t * (3 - 2 * t);

const DPR_MAXIMO = 2;
const UMBRAL = 0.45;            // fracción raspada que dispara el revelado
const PAUSA_MEDICION = 140;     // ms entre mediciones del área raspada
const CLAVE_RECUERDO = 'boda:fecha-revelada';

const GESTO_SVG = `
<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
  <path d="M18.5 25V10.2a3 3 0 0 1 6 0V21.5l9.6 2.1a4.6 4.6 0 0 1 3.6 4.9l-.9 8.3a7 7 0 0 1-7 6.2h-5.600a7 7 0 0 1-5.700-2.900L11.300 30.500a2.800 2.800 0 0 1 4.300-3.600L18.500 30Z"
        fill="#FDFBF5" fill-opacity=".92" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M24.500 21.500V26M13 8.500l-2.200-2.600M18 5.500 17.600 2M27.500 6.800l2-2.900" stroke="currentColor" stroke-width="1.400" stroke-linecap="round"/>
</svg>`;

const DESTELLO_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M12 0c.9 7 4.100 10.600 12 12-7.900 1.400-11.100 5-12 12-.9-7-4.100-10.600-12-12C7.900 10.600 11.100 7 12 0Z" fill="currentColor"/>
</svg>`;

// Posición de los destellos dentro de la tarjeta (en % de su caja)
const DESTELLOS = [
  { x: 12, y: 24, t: 16 }, { x: 86, y: 18, t: 20 }, { x: 78, y: 74, t: 14 },
  { x: 17, y: 78, t: 18 }, { x: 50, y: 9, t: 12 }
];

function crearLienzo(ancho, alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(ancho));
  lienzo.height = Math.max(1, Math.round(alto));
  return lienzo;
}

function crearRuido(lado, opacidad) {
  const lienzo = crearLienzo(lado, lado);
  const ctx = lienzo.getContext('2d');
  const datos = ctx.createImageData(lado, lado);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = opacidad;
  }
  ctx.putImageData(datos, 0, 0);
  return lienzo;
}

function textoEspaciado(ctx, texto, cx, y, espacio) {
  const letras = [...texto];
  const anchos = letras.map((l) => ctx.measureText(l).width);
  const total = anchos.reduce((a, b) => a + b, 0) + espacio * (letras.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  letras.forEach((letra, i) => {
    ctx.fillText(letra, x, y);
    x += anchos[i] + espacio;
  });
  return total;
}

/* ── La lámina: oro con degradado, cepillado, grano y patrón de rombos ── */
function dibujarLamina(lienzo, escala, textos) {
  const ctx = lienzo.getContext('2d');
  const w = lienzo.width;
  const h = lienzo.height;
  const u = escala;                       // 1 px de CSS en px del lienzo
  ctx.clearRect(0, 0, w, h);

  // Degradado metálico en diagonal
  const oro = ctx.createLinearGradient(0, 0, w, h * 1.15);
  oro.addColorStop(0, '#B48632');
  oro.addColorStop(0.16, '#DDB969');
  oro.addColorStop(0.3, '#C39440');
  oro.addColorStop(0.47, '#F0DCA8');
  oro.addColorStop(0.6, '#D4AA56');
  oro.addColorStop(0.78, '#A87C2F');
  oro.addColorStop(0.92, '#D9B566');
  oro.addColorStop(1, '#B98A36');
  ctx.fillStyle = oro;
  ctx.fillRect(0, 0, w, h);

  // Cepillado: ruido estirado a lo ancho
  const cepillo = crearRuido(96, 255);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.24;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cepillo, 0, 0, 96, 96, -w * 2, 0, w * 10, h);
  ctx.restore();

  // Grano fino
  const grano = ctx.createPattern(crearRuido(128, 255), 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = grano;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Patrón muy sutil de rombos, con un leve relieve
  const paso = 26 * u;
  const rx = 4.2 * u;
  const ry = 6.4 * u;
  const rombos = (dx, dy, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 0.8 * u);
    ctx.beginPath();
    let fila = 0;
    for (let y = -paso / 2; y < h + paso; y += paso / 2, fila++) {
      const corrimiento = fila % 2 ? paso / 2 : 0;
      for (let x = -paso + corrimiento; x < w + paso; x += paso) {
        ctx.moveTo(x + dx, y - ry + dy);
        ctx.lineTo(x + rx + dx, y + dy);
        ctx.lineTo(x + dx, y + ry + dy);
        ctx.lineTo(x - rx + dx, y + dy);
        ctx.closePath();
      }
    }
    ctx.stroke();
  };
  rombos(0, 0.9 * u, 'rgba(110, 78, 22, .13)');
  rombos(0, 0, 'rgba(255, 246, 214, .2)');

  // Luz al centro y bordes un poco más hondos
  const luz = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.62);
  luz.addColorStop(0, 'rgba(255, 244, 205, .34)');
  luz.addColorStop(0.55, 'rgba(255, 244, 205, .06)');
  luz.addColorStop(1, 'rgba(96, 66, 16, .26)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, w, h);

  // Filete interior doble
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeStyle = 'rgba(255, 247, 220, .55)';
  ctx.strokeRect(7.5 * u, 7.5 * u, w - 15 * u, h - 15 * u);
  ctx.strokeStyle = 'rgba(110, 78, 22, .3)';
  ctx.strokeRect(10.5 * u, 10.5 * u, w - 21 * u, h - 21 * u);

  // Placa central y texto
  const cx = w / 2;
  const cy = h * 0.4;
  const cuerpo = limitar((w / u) * 0.06, 15, 23) * u;
  const tinta = '#4E3A14';
  const relieve = 'rgba(255, 248, 224, .55)';

  const ornamento = (y, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, u);
    const largo = 34 * u;
    ctx.beginPath();
    ctx.moveTo(cx - 9 * u - largo, y); ctx.lineTo(cx - 9 * u, y);
    ctx.moveTo(cx + 9 * u, y); ctx.lineTo(cx + 9 * u + largo, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, y - 4 * u); ctx.lineTo(cx + 4 * u, y);
    ctx.lineTo(cx, y + 4 * u); ctx.lineTo(cx - 4 * u, y);
    ctx.closePath();
    ctx.fill();
  };

  ctx.textBaseline = 'middle';
  // Manuscrita arriba
  ctx.font = `600 ${cuerpo * 1.7}px "Dancing Script", "Snell Roundhand", cursive`;
  ctx.textAlign = 'center';
  ctx.fillStyle = relieve;
  ctx.fillText(textos.manuscrito, cx, cy - cuerpo * 1.25 + u);
  ctx.fillStyle = tinta;
  ctx.fillText(textos.manuscrito, cx, cy - cuerpo * 1.25);

  ornamento(cy + cuerpo * 0.18 + u, relieve);
  ornamento(cy + cuerpo * 0.18, tinta);

  // Versalitas espaciadas
  ctx.font = `600 ${cuerpo * 0.82}px "Cormorant Garamond", Georgia, serif`;
  const rotulo = textos.rotulo.toUpperCase();
  ctx.fillStyle = relieve;
  textoEspaciado(ctx, rotulo, cx, cy + cuerpo * 1.35 + u, cuerpo * 0.3);
  ctx.fillStyle = tinta;
  textoEspaciado(ctx, rotulo, cx, cy + cuerpo * 1.35, cuerpo * 0.3);
}

/* ── Pincel de borde suave ── */
function crearPincel(radio) {
  const lado = Math.ceil(radio * 2);
  const lienzo = crearLienzo(lado, lado);
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(radio, radio, radio * 0.42, radio, radio, radio);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lado, lado);
  return lienzo;
}

function emitir(nombre, detail) {
  document.dispatchEvent(new CustomEvent(nombre, { detail }));
}

function recordado() {
  try { return window.localStorage.getItem(CLAVE_RECUERDO) === '1'; } catch (e) { return false; }
}
function recordar() {
  try { window.localStorage.setItem(CLAVE_RECUERDO, '1'); } catch (e) { /* modo privado */ }
}

function montar(el, opciones) {
  el.dataset.rasparListo = '1';
  const ambito = el.closest('[data-raspar-ambito], section') || el.parentElement || el;
  const boton = ambito.querySelector('[data-raspar-boton]');
  const contenido = el.querySelector('[data-raspar-contenido]') || el;
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const umbral = opciones.umbral ?? UMBRAL;
  const textos = {
    manuscrito: el.dataset.rasparManuscrito || opciones.manuscrito || 'El gran día',
    rotulo: el.dataset.rasparTexto || opciones.texto || 'Raspa aquí'
  };

  let revelado = false;

  function marcarRevelado() {
    revelado = true;
    ambito.dataset.rasparEstado = 'revelado';
    el.classList.remove('raspar--pendiente');
    el.classList.add('raspar--revelada');
  }

  const prueba = document.createElement('canvas');
  const hayLienzo = !!(prueba.getContext && prueba.getContext('2d'));

  // Revelado directo: movimiento reducido, sin canvas o ya visto antes
  if (reducido || !hayLienzo || (opciones.recordar && recordado())) {
    marcarRevelado();
    if (boton) boton.hidden = true;
    setTimeout(() => emitir('raspar:revelado'), 0);
    return { revelar() {}, destruir() {}, get revelado() { return true; } };
  }

  /* ── DOM de la lámina ── */
  ambito.dataset.rasparEstado = 'pendiente';
  el.classList.add('raspar', 'raspar--pendiente');

  const sombra = document.createElement('div');
  sombra.className = 'raspar__sombra';
  sombra.setAttribute('aria-hidden', 'true');

  const lamina = document.createElement('canvas');
  lamina.className = 'raspar__lamina';
  lamina.setAttribute('aria-hidden', 'true');

  const gesto = document.createElement('div');
  gesto.className = 'raspar__gesto';
  gesto.setAttribute('aria-hidden', 'true');
  gesto.innerHTML = GESTO_SVG;

  const destellos = DESTELLOS.map((d, i) => {
    const s = document.createElement('span');
    s.className = 'raspar__destello';
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `left:calc(${d.x}% - ${d.t / 2}px);top:calc(${d.y}% - ${d.t / 2}px);width:${d.t}px;height:${d.t}px;--i:${i}`;
    s.innerHTML = DESTELLO_SVG;
    return s;
  });

  el.append(...destellos, sombra, lamina, gesto);
  if (boton) boton.hidden = false;

  const ctx = lamina.getContext('2d');
  const muestra = crearLienzo(40, 26);
  const ctxMuestra = muestra.getContext('2d', { willReadFrequently: true });

  let escala = 1;
  let base = null;            // la lámina intacta
  let mascara = null;         // lo raspado (opaco = retirado)
  let ctxMascara = null;
  let pincel = null;
  let radio = 0;

  let cuadro = 0;
  let sucio = true;
  let enPantalla = true;
  let brillo = null;          // { inicio, duracion }
  let relojBrillo = 0;
  let barrido = null;         // { inicio, duracion, ultimo }
  let polvo = [];
  let ultimaMedicion = 0;
  let tocada = false;

  function medir() {
    const anchoCss = lamina.clientWidth;
    const altoCss = lamina.clientHeight;
    if (!anchoCss || !altoCss) return false;
    escala = Math.min(window.devicePixelRatio || 1, DPR_MAXIMO);
    const w = Math.round(anchoCss * escala);
    const h = Math.round(altoCss * escala);
    if (base && w === lamina.width && h === lamina.height) return true;

    const anterior = mascara;
    lamina.width = w;
    lamina.height = h;
    base = crearLienzo(w, h);
    dibujarLamina(base, escala, textos);
    mascara = crearLienzo(w, h);
    ctxMascara = mascara.getContext('2d');
    // Se conserva lo ya raspado, escalado al nuevo tamaño
    if (anterior) ctxMascara.drawImage(anterior, 0, 0, w, h);

    radio = limitar(anchoCss * 0.1, 28, 44) * escala;
    pincel = crearPincel(radio);
    sucio = true;
    return true;
  }

  /* ── Trazo ── */
  function sello(x, y, factor = 1) {
    const r = radio * factor;
    ctxMascara.drawImage(pincel, x - r, y - r, r * 2, r * 2);
  }
  function trazo(x0, y0, x1, y1, factor = 1) {
    const distancia = Math.hypot(x1 - x0, y1 - y0);
    const pasos = Math.max(1, Math.ceil(distancia / (radio * factor * 0.3)));
    for (let i = 1; i <= pasos; i++) {
      const t = i / pasos;
      sello(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, factor);
    }
    soltarPolvo(x1, y1, Math.min(4, 1 + Math.floor(distancia / (radio * 0.5))));
    sucio = true;
  }

  /* ── Polvo de oro que cae al raspar ── */
  function soltarPolvo(x, y, cantidad) {
    for (let i = 0; i < cantidad && polvo.length < 90; i++) {
      const angulo = Math.random() * Math.PI * 2;
      const empuje = (0.3 + Math.random() * 1.2) * escala;
      polvo.push({
        x: x + (Math.random() - 0.5) * radio,
        y: y + (Math.random() - 0.5) * radio,
        vx: Math.cos(angulo) * empuje,
        vy: Math.sin(angulo) * empuje - 0.6 * escala,
        t: (0.8 + Math.random() * 1.6) * escala,
        vida: 1,
        mengua: 0.018 + Math.random() * 0.022,
        claro: Math.random() > 0.45
      });
    }
  }

  /* ── Medición del área raspada (muestreo reducido) ── */
  function medirAvance(ahora, forzar) {
    if (!forzar && ahora - ultimaMedicion < PAUSA_MEDICION) return;
    ultimaMedicion = ahora;
    ctxMuestra.clearRect(0, 0, muestra.width, muestra.height);
    ctxMuestra.drawImage(mascara, 0, 0, muestra.width, muestra.height);
    const d = ctxMuestra.getImageData(0, 0, muestra.width, muestra.height).data;
    let libres = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 120) libres++;
    const avance = libres / (d.length / 4);
    if (avance >= umbral) revelar();
  }

  /* ── Pintado: lámina + brillo − máscara + polvo ── */
  function pintar(ahora) {
    const w = lamina.width;
    const h = lamina.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(base, 0, 0);

    if (brillo) {
      const t = (ahora - brillo.inicio) / brillo.duracion;
      if (t >= 1) {
        brillo = null;
        programarBrillo();
      } else {
        const banda = w * 0.34;
        const x = -banda + (w + banda * 2 + h * 0.5) * suavizar(t) - h * 0.25;
        ctx.save();
        ctx.transform(1, 0, -0.45, 1, h * 0.22, 0);
        const g = ctx.createLinearGradient(x - banda / 2, 0, x + banda / 2, 0);
        g.addColorStop(0, 'rgba(255, 252, 238, 0)');
        g.addColorStop(0.5, `rgba(255, 252, 238, ${0.62 * Math.sin(Math.PI * t)})`);
        g.addColorStop(1, 'rgba(255, 252, 238, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - banda / 2, 0, banda, h);
        ctx.restore();
      }
    }

    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mascara, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    if (polvo.length) {
      for (const p of polvo) {
        p.vy += 0.12 * escala;
        p.x += p.vx;
        p.y += p.vy;
        p.vida -= p.mengua;
        if (p.vida <= 0) continue;
        ctx.globalAlpha = limitar(p.vida * 1.2, 0, 1);
        ctx.fillStyle = p.claro ? '#F0DCA8' : '#B98A36';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.t, 0, Math.PI * 2);
        ctx.fill();
      }
      polvo = polvo.filter((p) => p.vida > 0 && p.y < h + 8);
      ctx.globalAlpha = 1;
    }
  }

  function avanzarBarrido(ahora) {
    const w = lamina.width;
    const h = lamina.height;
    const t = limitar((ahora - barrido.inicio) / barrido.duracion, 0, 1);
    const punto = (k) => {
      const e = suavizar(k);
      return {
        x: w * (0.04 + 0.92 * e),
        y: h * (0.5 - 0.33 * Math.cos(e * Math.PI * 5))
      };
    };
    // Varios tramos por cuadro para que la curva no se quiebre
    const tramos = 6;
    for (let i = 1; i <= tramos; i++) {
      const k = barrido.ultimo + ((t - barrido.ultimo) * i) / tramos;
      const a = punto(barrido.ultimo + ((t - barrido.ultimo) * (i - 1)) / tramos);
      const b = punto(k);
      trazo(a.x, a.y, b.x, b.y, 1.7);
    }
    barrido.ultimo = t;
    if (t >= 1) { barrido = null; revelar(); }
  }

  function bucle(ahora) {
    cuadro = 0;
    if (revelado && !polvo.length) return;
    if (barrido) avanzarBarrido(ahora);
    if (sucio || brillo || polvo.length) {
      sucio = false;
      pintar(ahora);
    }
    if ((brillo || polvo.length || barrido || sucio) && !document.hidden && enPantalla) pedirCuadro();
  }
  function pedirCuadro() {
    if (!cuadro && !document.hidden) cuadro = requestAnimationFrame(bucle);
  }

  /* ── Brillo que recorre la lámina de vez en cuando ── */
  function programarBrillo(espera) {
    clearTimeout(relojBrillo);
    if (revelado) return;
    relojBrillo = setTimeout(() => {
      if (revelado) return;
      if (document.hidden || !enPantalla || punteros.size || barrido) { programarBrillo(1500); return; }
      brillo = { inicio: performance.now(), duracion: 1700 };
      pedirCuadro();
    }, espera ?? 4200 + Math.random() * 2600);
  }

  /* ── Punteros ── */
  const punteros = new Map();   // id → { x, y, x0, y0, inicio, recorrido }

  function aLienzo(evento, caja) {
    return {
      x: ((evento.clientX - caja.left) / caja.width) * lamina.width,
      y: ((evento.clientY - caja.top) / caja.height) * lamina.height
    };
  }
  let caja = null;

  function alBajar(evento) {
    if (revelado || (evento.pointerType === 'mouse' && evento.button !== 0)) return;
    evento.preventDefault();
    caja = lamina.getBoundingClientRect();
    try { lamina.setPointerCapture(evento.pointerId); } catch (e) { /* puntero sintético */ }
    const p = aLienzo(evento, caja);
    punteros.set(evento.pointerId, { ...p, inicio: performance.now(), recorrido: 0 });
    if (!tocada) { tocada = true; el.classList.add('raspar--tocada'); }
    if (barrido) return;
    sello(p.x, p.y);
    soltarPolvo(p.x, p.y, 3);
    sucio = true;
    pedirCuadro();
  }

  function alMover(evento) {
    const previo = punteros.get(evento.pointerId);
    if (!previo || revelado || barrido) return;
    evento.preventDefault();
    const eventos = typeof evento.getCoalescedEvents === 'function' ? evento.getCoalescedEvents() : [];
    const lista = eventos.length ? eventos : [evento];
    for (const e of lista) {
      const p = aLienzo(e, caja);
      previo.recorrido += Math.hypot(p.x - previo.x, p.y - previo.y);
      trazo(previo.x, previo.y, p.x, p.y);
      previo.x = p.x;
      previo.y = p.y;
    }
    pedirCuadro();
    medirAvance(performance.now(), false);
  }

  function alSubir(evento) {
    const previo = punteros.get(evento.pointerId);
    if (!previo) return;
    punteros.delete(evento.pointerId);
    try { lamina.releasePointerCapture(evento.pointerId); } catch (e) { /* ya liberado */ }
    if (revelado || barrido) return;
    // Un toque sin arrastre también revela
    const fueToque = evento.type === 'pointerup'
      && previo.recorrido < 10 * escala
      && performance.now() - previo.inicio < 600;
    if (fueToque) iniciarBarrido();
    else medirAvance(performance.now(), true);
  }

  function iniciarBarrido() {
    if (revelado || barrido) return;
    if (!tocada) { tocada = true; el.classList.add('raspar--tocada'); }
    brillo = null;
    barrido = { inicio: performance.now(), duracion: 1250, ultimo: 0 };
    // Si la pestaña no puede animar (oculta), se revela sin barrido
    if (document.hidden) { barrido = null; revelar(); return; }
    pedirCuadro();
  }

  /* ── Revelado ── */
  function revelar() {
    if (revelado) return;
    marcarRevelado();
    clearTimeout(relojBrillo);
    brillo = null;
    barrido = null;
    punteros.clear();
    if (opciones.recordar) recordar();

    lamina.classList.add('raspar__lamina--fuera');

    if (boton) {
      const teniaFoco = document.activeElement === boton;
      boton.classList.add('es-salida');
      boton.disabled = true;
      if (teniaFoco) {
        // El foco pasa a la fecha para que el lector de pantalla la anuncie
        contenido.setAttribute('tabindex', '-1');
        contenido.focus({ preventScroll: true });
      }
      setTimeout(() => { boton.hidden = true; }, 700);
    }

    const centro = el.getBoundingClientRect();
    emitir('raspar:revelado');
    emitir('petalos:rafaga', {
      x: centro.left + centro.width / 2,
      y: centro.top + centro.height / 2,
      cantidad: 40,
      fuerza: 1.2
    });

    pedirCuadro();                       // deja caer el último polvo
    setTimeout(desmontar, 1300);
  }

  function desmontar() {
    cancelAnimationFrame(cuadro);
    cuadro = 0;
    polvo = [];
    clearTimeout(relojBrillo);
    observadorTamano.disconnect();
    observadorPantalla.disconnect();
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    lamina.remove();
    sombra.remove();
    gesto.remove();
    setTimeout(() => destellos.forEach((d) => d.remove()), 2600);
    base = mascara = ctxMascara = pincel = null;
  }

  /* ── Observadores ── */
  const observadorTamano = new ResizeObserver(() => {
    if (revelado) return;
    if (medir()) pedirCuadro();
  });
  const observadorPantalla = new IntersectionObserver(([entrada]) => {
    enPantalla = entrada.isIntersecting;
    el.classList.toggle('raspar--en-pausa', !enPantalla);
    if (enPantalla && !revelado) {
      pedirCuadro();
      if (!brillo && !tocada) programarBrillo(1400);
    }
  }, { threshold: 0.2 });

  function alCambiarVisibilidad() {
    el.classList.toggle('raspar--en-pausa', document.hidden || !enPantalla);
    if (!document.hidden && !revelado) {
      // El reloj de las animaciones se detuvo: se reinician desde ahora
      if (brillo) brillo.inicio = performance.now();
      if (barrido) barrido.inicio = performance.now() - barrido.ultimo * barrido.duracion;
      sucio = true;
      pedirCuadro();
    }
  }

  lamina.addEventListener('pointerdown', alBajar);
  lamina.addEventListener('pointermove', alMover);
  lamina.addEventListener('pointerup', alSubir);
  lamina.addEventListener('pointercancel', alSubir);
  lamina.addEventListener('contextmenu', (e) => e.preventDefault());
  lamina.addEventListener('dragstart', (e) => e.preventDefault());
  if (boton) boton.addEventListener('click', iniciarBarrido);
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  medir();
  observadorTamano.observe(lamina);
  observadorPantalla.observe(el);
  pedirCuadro();
  programarBrillo(2200);

  // Las tipografías pueden llegar después: se redibuja la lámina intacta
  if (document.fonts?.load) {
    Promise.all([
      document.fonts.load('600 20px "Cormorant Garamond"'),
      document.fonts.load('600 30px "Dancing Script"')
    ]).then(() => {
      if (revelado || !base) return;
      dibujarLamina(base, escala, textos);
      sucio = true;
      pedirCuadro();
    }).catch(() => {});
  }

  return {
    revelar: iniciarBarrido,
    destruir() { if (!revelado) { marcarRevelado(); desmontar(); } },
    get revelado() { return revelado; }
  };
}

export function iniciarRaspar(opciones = {}) {
  const elementos = [...document.querySelectorAll('[data-raspar]')]
    .filter((el) => !el.dataset.rasparListo);
  const controles = elementos.map((el) => montar(el, opciones));
  return {
    revelar() { controles.forEach((c) => c.revelar()); },
    destruir() { controles.forEach((c) => c.destruir()); }
  };
}
