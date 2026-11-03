

















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

    window.addEventListener('beforeprint', activar);
    const consultaImpresion = typeof matchMedia === 'function' ? matchMedia('print') : null;
    const alImprimir = (e) => { if (e.matches) activar(); };
    consultaImpresion?.addEventListener?.('change', alImprimir);

    

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

     
    let marco = 0;
    const actualizar = () => {
      marco = 0;
      const maximo = pista.scrollWidth - pista.clientWidth;
      const x = pista.scrollLeft;
      raiz.classList.toggle('carrusel--sin-desborde', maximo <= 2);
      const apagar = (flecha, apagada) => {
        if (!flecha || flecha.disabled === apagada) return;


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
