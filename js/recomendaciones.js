// Secciones con pestañas: #recomendaciones (Hospedaje · Make up) y #que-visitar
// (Dónde comer · Dónde ir · Pátzcuaro). El HTML trae todos los apartados completos
// y cada barra de pestañas con «hidden»: sin este módulo se leen apilados.
// iniciarRecomendaciones() monta TODAS las secciones marcadas con [data-recom] (o
// que contengan [data-recom-pestanas]) y devuelve UN control que las abarca:
// abrir(id) encuentra el apartado en la sección que sea; el hash (#patzcuaro…),
// los enlaces internos (menú) y el evento 'menu:navegar' abren la pestaña correcta.
// Cada cambio emite 'recomendaciones:apartado' { id, seccion }.
// Nada de bucles por cuadro: las entradas son animaciones CSS.

const TECLAS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };

let control = null;      // el control único (se crea la primera vez)
const grupos = [];       // una entrada por sección montada

const porDocumento = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

// Desplaza sin la animación de html { scroll-behavior: smooth }
function saltarA(el) {
  const raizDoc = document.documentElement;
  const previo = raizDoc.style.scrollBehavior;
  raizDoc.style.scrollBehavior = 'auto';
  el.scrollIntoView({ block: 'start' });   // respeta scroll-margin-top
  raizDoc.style.scrollBehavior = previo;
}

export function iniciarRecomendaciones(opciones = {}) {
  const {
    raiz = null,             // una sola sección (compatibilidad); por omisión, todas
    inicial = '',            // apartado por abrir si la URL no trae ninguno (en su sección)
    actualizarHash = true,   // escribir #apartado al cambiar de pestaña (sin saltar)
    desplazar = true         // al llegar con ancla, acomodar la vista sobre el apartado
  } = opciones;

  /* ── Secciones por montar ── */
  let secciones;
  if (raiz) secciones = [raiz];
  else {
    const conjunto = new Set(document.querySelectorAll('[data-recom]'));
    document.querySelectorAll('[data-recom-pestanas]').forEach((barra) => {
      const seccion = barra.closest('[data-recom], section');
      if (seccion) conjunto.add(seccion);
    });
    secciones = [...conjunto].sort(porDocumento);
  }
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Montar una sección ── */
  function montar(seccion) {
    if (seccion._recomendaciones) return seccion._recomendaciones;   // idempotente
    const barra = seccion.querySelector('[data-recom-pestanas]');
    const pestanas = [...seccion.querySelectorAll('[data-recom-pestana]')];
    const apartados = [...seccion.querySelectorAll('[data-recom-apartado]')];
    if (!barra || !pestanas.length || !apartados.length) return null;

    const ids = apartados.map((a) => a.dataset.recomApartado);
    const pestanaDe = (id) => pestanas.find((p) => p.dataset.recomPestana === id);
    const apartadoDe = (id) => apartados.find((a) => a.dataset.recomApartado === id);
    let activo = '';

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
        apartado.hidden = apartado.dataset.recomApartado !== id;
        apartado.classList.remove('es-entrando');
      }
      if (cambio && animar && !reducido.matches) {
        const apartado = apartadoDe(id);
        void apartado.offsetWidth;   // reinicia la animación aunque se repita la clase
        apartado.classList.add('es-entrando');
        apartado.addEventListener('animationend', () => apartado.classList.remove('es-entrando'), { once: true });
      }
      if (hash) escribirHash(id);
      if (cambio) {
        document.dispatchEvent(new CustomEvent('recomendaciones:apartado', { detail: { id, seccion: seccion.id } }));
      }
      return true;
    }

    /* Pestañas: clic y teclado (el foco viaja con las flechas) */
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

    /* Altura de la barra → scroll-margin-top de los apartados (css/recomendaciones.css) */
    const medir = () => seccion.style.setProperty('--recom-pestanas-alto', `${barra.offsetHeight}px`);
    const observadorAlto = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;

    /* Arranque */
    barra.hidden = false;
    seccion.classList.add('recom--pestanas');
    observadorAlto?.observe(barra);
    medir();

    const grupo = {
      seccion,
      ids,
      abrir,
      apartadoDe,
      activo: () => activo,
      medir,
      destruir() {
        barra.removeEventListener('click', alPulsar);
        barra.removeEventListener('keydown', alTeclear);
        observadorAlto?.disconnect();
        barra.hidden = true;
        seccion.classList.remove('recom--pestanas');
        seccion.style.removeProperty('--recom-pestanas-alto');
        apartados.forEach((a) => { a.hidden = false; a.classList.remove('es-entrando'); });
        delete seccion._recomendaciones;
      }
    };
    seccion._recomendaciones = grupo;
    return grupo;
  }

  /* ── Hash de la URL (cualquier sección) ── */
  const grupoDe = (id) => grupos.find((g) => g.ids.includes(id));
  const leerHash = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (error) { /* ancla mal escrita */ }
    return grupoDe(id) ? id : '';
  };
  function escribirHash(id) {
    if (leerHash() === id) return;
    try { history.replaceState(history.state, '', `#${id}`); } catch (error) { /* sin historial (file://) */ }
  }

  /* ── Control único: escucha el documento una sola vez ── */
  function crearControl() {
    let acomodos = [];

    // Enlaces internos a un apartado (menú, pie): el apartado se destapa ANTES de
    // que quien maneje el clic (js/main.js, js/menu.js) mida y se desplace hacia
    // él. Por eso se escucha en fase de captura y no se evita el comportamiento.
    function alPulsarEnlace(evento) {
      const enlace = evento.target.closest('a[href*="#"]');
      if (!enlace) return;
      const destino = enlace.getAttribute('href') || '';
      const id = destino.slice(destino.indexOf('#') + 1);
      grupoDe(id)?.abrir(id, { hash: false });
    }
    function alCambiarHash() {
      const id = leerHash();
      if (!id) return;
      const grupo = grupoDe(id);
      const estabaOculto = grupo.apartadoDe(id)?.hidden;
      grupo.abrir(id, { hash: false });
      // Si el navegador saltó hacia un apartado oculto no llegó a ningún lado
      if (estabaOculto && desplazar) saltarA(grupo.apartadoDe(id));
    }
    // El menú avisa a dónde va (DISENO.md §4); normalmente ya pulsó la pestaña
    function alNavegar(evento) {
      const id = evento.detail?.id;
      if (id) grupoDe(id)?.abrir(id, { hash: false });
    }
    document.addEventListener('click', alPulsarEnlace, true);
    window.addEventListener('hashchange', alCambiarHash);
    document.addEventListener('menu:navegar', alNavegar);

    // Con ancla en la URL el navegador ya saltó cuando los apartados estaban
    // apilados; al quedar uno solo, la vista se acomoda de nuevo sobre él.
    // (Con el sobre cerrado no se nota: js/main.js vuelve a colocar la página al abrirlo.)
    const acomodar = (grupo, id) => {
      if (!desplazar) return;
      acomodos.push(setTimeout(() => saltarA(grupo.apartadoDe(id)), 0));
    };

    return {
      acomodar,
      // Abre el apartado «id» en la sección que lo contenga
      abrir: (id) => !!grupoDe(id)?.abrir(id),
      // Apartado abierto: de una sección (por id o elemento) o de todas ({ seccion: apartado })
      activo(seccion) {
        if (seccion) {
          const grupo = grupos.find((g) => g.seccion === seccion || g.seccion.id === seccion);
          return grupo ? grupo.activo() : '';
        }
        return Object.fromEntries(grupos.map((g) => [g.seccion.id, g.activo()]));
      },
      secciones: () => grupos.map((g) => g.seccion),
      medir: () => grupos.forEach((g) => g.medir()),
      destruir() {
        acomodos.forEach(clearTimeout);
        acomodos = [];
        document.removeEventListener('click', alPulsarEnlace, true);
        window.removeEventListener('hashchange', alCambiarHash);
        document.removeEventListener('menu:navegar', alNavegar);
        grupos.splice(0).forEach((g) => g.destruir());
        control = null;
      }
    };
  }

  /* ── Montaje ── */
  const nuevos = [];
  for (const seccion of secciones) {
    const grupo = montar(seccion);
    if (!grupo) continue;
    if (!grupos.includes(grupo)) { grupos.push(grupo); nuevos.push(grupo); }
  }
  if (!grupos.length) return null;
  grupos.sort((a, b) => porDocumento(a.seccion, b.seccion));
  if (!control) control = crearControl();

  const delHash = leerHash();
  for (const grupo of nuevos) {
    const propio = grupo.ids.includes(delHash) ? delHash : '';
    grupo.abrir(propio || (grupo.ids.includes(inicial) ? inicial : grupo.ids[0]), { hash: false, animar: false });
    if (propio) control.acomodar(grupo, propio);
  }
  return control;
}
