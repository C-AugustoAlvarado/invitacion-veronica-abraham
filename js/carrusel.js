// Carrusel de polaroids — js/carrusel.js
// Las acuarelas de «Nuestra historia» (src/historia.html) van en una pista horizontal con
// scroll nativo y scroll-snap (css/historia.css). Este módulo solo agrega lo que el CSS no
// puede: pide las imágenes cuando la pista se acerca a la pantalla (van sin src para que la
// portada no las descargue), enciende las dos flechas y las apaga en los extremos, y deja
// recorrer la pista con las teclas ← → cuando tiene el foco. Nunca avanza solo.
//
// Marcas:  <div data-carrusel>
//            <button class="carrusel__flecha carrusel__flecha--izq" hidden>…</button>
//            <ul class="carrusel__pista" tabindex="0"> <li>…<img data-src>…</li> … </ul>
//            <button class="carrusel__flecha carrusel__flecha--der" hidden>…</button>
//          </div>
// Uso:  iniciarCarrusel({ selector: '[data-carrusel]', margen: '600px 0px' })
// En modo básico hace lo mismo menos las flechas (css/basico.css las esconde).
// La alineación la decide el CSS con scroll-snap-align: «center» en celular (la activa al
// centro, las vecinas asoman) y «start» desde 900 px (tres a la vista, pegadas a la
// izquierda); el módulo lee ese valor para calcular a dónde desplazar.

export function iniciarCarrusel(opciones = {}) {
  const raices = [...document.querySelectorAll(opciones.selector || '[data-carrusel]')];
  if (!raices.length) return null;
  const reducido = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const instancias = raices.map((raiz) => montar(raiz)).filter(Boolean);
  return { destruir() { instancias.forEach((i) => i.destruir()); } };

  function montar(raiz) {
    const pista = raiz.querySelector('.carrusel__pista');
    if (!pista) return null;
    const izq = raiz.querySelector('.carrusel__flecha--izq');
    const der = raiz.querySelector('.carrusel__flecha--der');
    const elementos = [...pista.children].filter((el) => el.tagName === 'LI');
    if (!elementos.length) return null;

    /* ── 1 · Las imágenes, diferidas: se piden cuando la pista se acerca ── */
    const activar = () => {
      pista.querySelectorAll('source[data-srcset]').forEach((s) => { s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); });
      pista.querySelectorAll('img[data-src]').forEach((img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
    };
    let observador = null;
    if (typeof IntersectionObserver === 'function') {
      observador = new IntersectionObserver((entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        activar();
        observador.disconnect();
        observador = null;
      }, { rootMargin: opciones.margen || '600px 0px' });
      observador.observe(raiz);
    } else {
      activar();
    }
    // Imprimir o «Guardar como PDF» sin haber bajado hasta aquí: que no salgan vacías
    window.addEventListener('beforeprint', activar);
    const consultaImpresion = typeof matchMedia === 'function' ? matchMedia('print') : null;   // Safari no dispara beforeprint
    const alImprimir = (e) => { if (e.matches) activar(); };
    consultaImpresion?.addEventListener?.('change', alImprimir);

    /* ── 2 · Ir a una polaroid: centrada en la pista, o pegada al inicio si el CSS alinea
          con «start» (escritorio) ── */
    const alineaInicio = () => (getComputedStyle(elementos[0]).scrollSnapAlign || '').includes('start');
    const posicionDe = (el, inicio) => Math.round(inicio ? el.offsetLeft : el.offsetLeft + el.offsetWidth / 2 - pista.clientWidth / 2);
    const indiceActual = () => {
      const inicio = alineaInicio();
      const referencia = pista.scrollLeft + (inicio ? 0 : pista.clientWidth / 2);
      let mejor = 0;
      let distancia = Infinity;
      elementos.forEach((el, i) => {
        const d = Math.abs((inicio ? el.offsetLeft : el.offsetLeft + el.offsetWidth / 2) - referencia);
        if (d < distancia) { distancia = d; mejor = i; }
      });
      return mejor;
    };
    const ir = (indice) => {
      const el = elementos[Math.max(0, Math.min(elementos.length - 1, indice))];
      const destino = posicionDe(el, alineaInicio());
      if (reducido.matches || typeof pista.scrollTo !== 'function') pista.scrollLeft = destino;
      else pista.scrollTo({ left: destino, behavior: 'smooth' });
    };
    const anterior = () => ir(indiceActual() - 1);
    const siguiente = () => ir(indiceActual() + 1);

    /* ── 3 · Flechas: se encienden con el módulo y se apagan en los extremos ── */
    let marco = 0;
    const actualizar = () => {
      marco = 0;
      const maximo = pista.scrollWidth - pista.clientWidth;
      const x = pista.scrollLeft;
      raiz.classList.toggle('carrusel--sin-desborde', maximo <= 2);
      const apagar = (flecha, apagada) => {
        if (!flecha || flecha.disabled === apagada) return;
        // Si la flecha que se apaga tiene el foco (teclado), el foco pasa a la pista: un botón
        // deshabilitado lo suelta y el invitado perdería su lugar
        if (apagada && document.activeElement === flecha) { try { pista.focus({ preventScroll: true }); } catch (error) { pista.focus(); } }
        flecha.disabled = apagada;
      };
      apagar(izq, x <= 2);
      apagar(der, x >= maximo - 2);
    };
    const programar = () => { if (!marco) marco = requestAnimationFrame(actualizar); };
    if (izq) { izq.addEventListener('click', anterior); izq.hidden = false; }
    if (der) { der.addEventListener('click', siguiente); der.hidden = false; }
    pista.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    actualizar();

    /* ── 4 · Teclado sobre la pista (tiene tabindex="0") ── */
    const alTecla = (evento) => {
      if (evento.key === 'ArrowLeft' || evento.key === 'Left') { evento.preventDefault(); anterior(); }
      else if (evento.key === 'ArrowRight' || evento.key === 'Right') { evento.preventDefault(); siguiente(); }
    };
    pista.addEventListener('keydown', alTecla);

    return {
      destruir() {
        observador?.disconnect();
        window.removeEventListener('beforeprint', activar);
        consultaImpresion?.removeEventListener?.('change', alImprimir);
        if (izq) izq.removeEventListener('click', anterior);
        if (der) der.removeEventListener('click', siguiente);
        pista.removeEventListener('scroll', programar);
        pista.removeEventListener('keydown', alTecla);
        window.removeEventListener('resize', programar);
        cancelAnimationFrame(marco);
      }
    };
  }
}
