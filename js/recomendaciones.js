// Recomendaciones: tres apartados (hospedaje, make up, dónde ir) en pestañas.
// El HTML trae los tres apartados completos y la barra de pestañas con «hidden»:
// sin este módulo se leen apilados. Aquí se destapan las pestañas, se muestra un
// apartado a la vez, se escribe el ancla en la URL sin saltar y se abre el
// apartado que pida la URL (#hospedaje, #maquillaje, #donde-ir), ya sea al
// cargar, al cambiar el hash o al tocar un enlace interno (menú).
// Nada de bucles por cuadro: las entradas son animaciones CSS.

const TECLAS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };

export function iniciarRecomendaciones(opciones = {}) {
  const {
    raiz = document.getElementById('recomendaciones'),
    inicial = '',            // apartado por abrir si la URL no trae ninguno
    actualizarHash = true,   // escribir #apartado al cambiar de pestaña (sin saltar)
    desplazar = true         // al llegar con ancla, acomodar la vista sobre el apartado
  } = opciones;

  if (!raiz) return null;
  if (raiz._recomendaciones) return raiz._recomendaciones;   // idempotente

  const barra = raiz.querySelector('[data-recom-pestanas]');
  const pestanas = [...raiz.querySelectorAll('[data-recom-pestana]')];
  const apartados = [...raiz.querySelectorAll('[data-recom-apartado]')];
  if (!barra || !pestanas.length || !apartados.length) return null;

  const ids = apartados.map((a) => a.dataset.recomApartado);
  const pestanaDe = (id) => pestanas.find((p) => p.dataset.recomPestana === id);
  const apartadoDe = (id) => apartados.find((a) => a.dataset.recomApartado === id);
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activo = '';

  /* ── Hash de la URL ── */
  const leerHash = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (error) { /* ancla mal escrita */ }
    return ids.includes(id) ? id : '';
  };
  const escribirHash = (id) => {
    if (leerHash() === id) return;
    try { history.replaceState(history.state, '', `#${id}`); } catch (error) { /* sin historial (file://) */ }
  };

  /* ── Abrir un apartado ── */
  function abrir(id, { hash = actualizarHash, animar = true } = {}) {
    if (!ids.includes(id)) return false;
    const cambio = id !== activo;
    activo = id;

    for (const pestana of pestanas) {
      const es = pestana.dataset.recomPestana === id;
      pestana.setAttribute('aria-selected', es ? 'true' : 'false');
      pestana.tabIndex = es ? 0 : -1;
    }
    for (const apartado of apartados) {
      const es = apartado.dataset.recomApartado === id;
      apartado.hidden = !es;
      apartado.classList.remove('es-entrando');
    }
    if (cambio && animar && !reducido.matches) {
      const apartado = apartadoDe(id);
      // Reinicia la animación aunque se repita la misma clase
      void apartado.offsetWidth;
      apartado.classList.add('es-entrando');
      apartado.addEventListener('animationend', () => apartado.classList.remove('es-entrando'), { once: true });
    }
    if (hash) escribirHash(id);
    if (cambio) document.dispatchEvent(new CustomEvent('recomendaciones:apartado', { detail: { id } }));
    return true;
  }

  /* ── Acomodar la vista sobre un apartado (respeta scroll-margin-top) ── */
  function irA(id) {
    const apartado = apartadoDe(id);
    if (!apartado) return;
    const raizDoc = document.documentElement;
    const previo = raizDoc.style.scrollBehavior;
    raizDoc.style.scrollBehavior = 'auto';   // html tiene scroll-behavior: smooth
    apartado.scrollIntoView({ block: 'start' });
    raizDoc.style.scrollBehavior = previo;
  }

  /* ── Pestañas: clic y teclado (foco que viaja con las flechas) ── */
  function alPulsar(evento) {
    const pestana = evento.target.closest('[data-recom-pestana]');
    if (!pestana || !barra.contains(pestana)) return;
    abrir(pestana.dataset.recomPestana);
  }
  function alTeclear(evento) {
    const pestana = evento.target.closest('[data-recom-pestana]');
    if (!pestana) return;
    let indice = -1;
    if (evento.key in TECLAS) indice = (ids.indexOf(pestana.dataset.recomPestana) + TECLAS[evento.key] + ids.length) % ids.length;
    else if (evento.key === 'Home') indice = 0;
    else if (evento.key === 'End') indice = ids.length - 1;
    if (indice < 0) return;
    evento.preventDefault();
    abrir(ids[indice]);
    pestanaDe(ids[indice])?.focus();
  }
  barra.addEventListener('click', alPulsar);
  barra.addEventListener('keydown', alTeclear);

  /* ── Enlaces internos a un apartado (menú, pie): el apartado se destapa ANTES
        de que quien maneje el clic (js/main.js) mida y se desplace hacia él.
        Por eso se escucha en fase de captura y no se evita el comportamiento. ── */
  function alPulsarEnlace(evento) {
    const enlace = evento.target.closest('a[href*="#"]');
    if (!enlace) return;
    const destino = enlace.getAttribute('href') || '';
    const id = destino.slice(destino.indexOf('#') + 1);
    if (!ids.includes(id)) return;
    abrir(id, { hash: false });
  }
  document.addEventListener('click', alPulsarEnlace, true);

  function alCambiarHash() {
    const id = leerHash();
    if (!id) return;
    const estabaOculto = apartadoDe(id)?.hidden;
    abrir(id, { hash: false });
    // Si el navegador saltó hacia un apartado oculto no llegó a ningún lado
    if (estabaOculto && desplazar) irA(id);
  }
  window.addEventListener('hashchange', alCambiarHash);

  /* ── Altura de la barra (para scroll-margin-top de los apartados) ── */
  const medir = () => raiz.style.setProperty('--recom-pestanas-alto', `${barra.offsetHeight}px`);
  const observadorAlto = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;

  /* ── Arranque ── */
  barra.hidden = false;
  raiz.classList.add('recom--pestanas');
  observadorAlto?.observe(barra);
  medir();

  const delHash = leerHash();
  abrir(delHash || (ids.includes(inicial) ? inicial : ids[0]), { hash: false, animar: false });
  // Con ancla en la URL el navegador ya saltó cuando los tres apartados estaban
  // apilados; al quedar uno solo, la vista se acomoda de nuevo sobre él.
  // (Con el sobre cerrado no se nota: js/main.js vuelve a colocar la página al abrirlo.)
  let acomodo = 0;
  if (delHash && desplazar) acomodo = setTimeout(() => irA(delHash), 0);

  const api = {
    abrir: (id) => abrir(id),
    activo: () => activo,
    medir,
    destruir() {
      clearTimeout(acomodo);
      barra.removeEventListener('click', alPulsar);
      barra.removeEventListener('keydown', alTeclear);
      document.removeEventListener('click', alPulsarEnlace, true);
      window.removeEventListener('hashchange', alCambiarHash);
      observadorAlto?.disconnect();
      barra.hidden = true;
      raiz.classList.remove('recom--pestanas');
      apartados.forEach((a) => { a.hidden = false; a.classList.remove('es-entrando'); });
      delete raiz._recomendaciones;
    }
  };
  raiz._recomendaciones = api;
  return api;
}
