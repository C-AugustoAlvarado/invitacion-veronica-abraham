// Menú superior: barra fija con accesos rápidos a las secciones.
// El HTML (src/menu.html) ya funciona solo, con anclas normales; aquí se le
// añade lo que necesita JavaScript: aparecer cuando se abre el sobre, el panel
// de celular, el desplegable de «Recomendaciones» con teclado, el resaltado de
// la sección activa y el desplazamiento suave. Se comunica solo con eventos en
// document: escucha 'sobre:abierto' y 'ambiente:cambio' (DISENO.md §4).

// Color de la barra para meta theme-color: mientras el menú esté a la vista, lo
// que toca el borde superior de la pantalla es marfil, no el cielo del ambiente.
const COLOR_BARRA = '#F6F2EA';

export function iniciarMenu(opciones = {}) {
  const nav = typeof opciones.contenedor === 'string'
    ? document.querySelector(opciones.contenedor)
    : (opciones.contenedor || document.getElementById('menu') || document.querySelector('[data-menu]'));
  if (!nav) return null;
  if (nav._menu) return nav._menu;   // idempotente

  const boton = nav.querySelector('[data-menu-abrir]');
  const panel = nav.querySelector('[data-menu-panel]');
  const grupo = nav.querySelector('[data-menu-grupo]');       // <details> de Recomendaciones
  const resumen = grupo ? grupo.querySelector('summary') : null;
  const sub = grupo ? grupo.querySelector('[data-menu-sub]') : null;
  const enlaces = [...nav.querySelectorAll('[data-menu-enlace]')];

  const consultaAncha = window.matchMedia('(min-width: 860px)');
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaRaton = window.matchMedia('(hover: hover) and (pointer: fine)');
  const ancha = () => consultaAncha.matches;

  const idDe = (enlace) => {
    const href = enlace.getAttribute('href') || '';
    return href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
  };

  /* ── Barra del navegador del color del menú ── */
  const metaTema = opciones.fijarColorBarra === false ? null : document.querySelector('meta[name="theme-color"]');
  let visible = false;
  function fijarColorBarra() {
    if (metaTema && visible && metaTema.getAttribute('content') !== COLOR_BARRA) {
      metaTema.setAttribute('content', COLOR_BARRA);
    }
  }
  // El motor escribe el color del ambiente justo antes de avisar: se vuelve a pisar
  document.addEventListener('ambiente:cambio', fijarColorBarra);

  /* ── Aparecer: con el sobre cerrado se espera a 'sobre:abierto' ── */
  function mostrar(inmediata) {
    if (visible) return;
    visible = true;
    if (inmediata) nav.classList.add('menu--inmediata');
    nav.classList.add('menu--visible');
    fijarColorBarra();
    if (inmediata) {
      // Dos cuadros después se devuelve la transición, para las animaciones siguientes
      requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove('menu--inmediata')));
    }
  }
  const alAbrirSobre = () => {
    // La portada se revela primero; la barra baja un instante después
    setTimeout(() => mostrar(false), opciones.retraso ?? 420);
  };
  const sobreCerrado = document.body.classList.contains('bloqueado');
  if (sobreCerrado) document.addEventListener('sobre:abierto', alAbrirSobre, { once: true });
  else mostrar(true);

  /* ── Panel de celular ── */
  let yAlAbrir = 0;
  const panelAbierto = () => nav.classList.contains('menu--abierto');
  function abrirPanel() {
    if (!boton || ancha() || panelAbierto()) return;
    nav.classList.add('menu--abierto');
    boton.setAttribute('aria-expanded', 'true');
    yAlAbrir = window.scrollY;
  }
  function cerrarPanel(enfocarBoton) {
    if (!panelAbierto()) return;
    nav.classList.remove('menu--abierto');
    if (boton) {
      boton.setAttribute('aria-expanded', 'false');
      if (enfocarBoton) boton.focus();
    }
  }
  if (boton) {
    boton.hidden = false;   // solo sirve con JavaScript
    boton.addEventListener('click', () => (panelAbierto() ? cerrarPanel(false) : abrirPanel()));
  }

  /* ── Desplegable «Recomendaciones» ──
     En celular vive abierto dentro del panel (acordeón); en escritorio es un
     desplegable cerrado que se abre con clic, teclado o al pasar el ratón. */
  let temporizadorRaton = 0;
  const enlacesSub = sub ? [...sub.querySelectorAll('a')] : [];
  function abrirGrupo() { if (grupo && !grupo.open) grupo.open = true; }
  function cerrarGrupo(enfocarResumen) {
    if (!grupo || !grupo.open || !ancha()) return;
    grupo.open = false;
    if (enfocarResumen && resumen) resumen.focus();
  }
  function acomodarGrupo() {
    if (!grupo) return;
    grupo.open = !ancha();   // celular: a la vista; escritorio: cerrado hasta que se pida
    cerrarPanel(false);
  }
  acomodarGrupo();

  if (grupo && resumen) {
    // Ratón de escritorio: se abre al pasar y se cierra al salir, con un respiro
    grupo.addEventListener('mouseenter', () => {
      if (!ancha() || !consultaRaton.matches) return;
      clearTimeout(temporizadorRaton);
      abrirGrupo();
    });
    grupo.addEventListener('mouseleave', () => {
      if (!ancha() || !consultaRaton.matches) return;
      clearTimeout(temporizadorRaton);
      temporizadorRaton = setTimeout(() => cerrarGrupo(false), 220);
    });
    // Si el ratón ya lo abrió, el clic no lo vuelve a cerrar (e.detail 0 = teclado)
    resumen.addEventListener('click', (evento) => {
      if (ancha() && consultaRaton.matches && evento.detail > 0 && grupo.open) evento.preventDefault();
    });
    // Al cerrarse por fuera (Esc, toque fuera) se olvida el resaltado del teclado
    grupo.addEventListener('focusout', (evento) => {
      if (!ancha()) return;
      if (evento.relatedTarget && grupo.contains(evento.relatedTarget)) return;
      // Esperar: el foco puede ir a parar dentro del mismo grupo (Safari lo avisa tarde)
      setTimeout(() => { if (!grupo.contains(document.activeElement)) cerrarGrupo(false); }, 0);
    });
  }

  // En celular el panel se cierra si el foco se va con Tab fuera de él
  nav.addEventListener('focusout', () => {
    if (ancha() || !panelAbierto()) return;
    setTimeout(() => {
      const activo = document.activeElement;
      if (!panel.contains(activo) && activo !== boton) cerrarPanel(false);
    }, 0);
  });

  /* ── Teclado ── */
  const focables = () => {
    const ambito = ancha() ? sub : panel;
    if (!ambito) return [];
    return [...ambito.querySelectorAll('a[href], summary')].filter((el) => el.offsetParent !== null || ancha());
  };
  function moverFoco(paso, desde) {
    const lista = focables();
    if (!lista.length) return;
    let i = lista.indexOf(desde);
    if (paso === 'inicio') i = 0;
    else if (paso === 'fin') i = lista.length - 1;
    else i = (i + paso + lista.length) % lista.length;
    lista[i].focus();
  }
  nav.addEventListener('keydown', (evento) => {
    const objetivo = evento.target;
    switch (evento.key) {
      case 'Escape':
        if (ancha() && grupo && grupo.open) { evento.preventDefault(); cerrarGrupo(true); }
        else if (panelAbierto()) { evento.preventDefault(); cerrarPanel(true); }
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const paso = evento.key === 'ArrowDown' ? 1 : -1;
        if (ancha()) {
          if (!grupo || !grupo.contains(objetivo)) return;
          evento.preventDefault();
          if (!grupo.open) { abrirGrupo(); enlacesSub[paso > 0 ? 0 : enlacesSub.length - 1]?.focus(); return; }
          if (objetivo === resumen) { enlacesSub[paso > 0 ? 0 : enlacesSub.length - 1]?.focus(); return; }
          moverFoco(paso, objetivo);
        } else if (panelAbierto() && panel && panel.contains(objetivo)) {
          evento.preventDefault();
          moverFoco(paso, objetivo);
        }
        break;
      }
      case 'Home':
      case 'End': {
        const dentro = ancha() ? (grupo && grupo.open && grupo.contains(objetivo)) : (panelAbierto() && panel && panel.contains(objetivo));
        if (!dentro) return;
        evento.preventDefault();
        moverFoco(evento.key === 'Home' ? 'inicio' : 'fin', objetivo);
        break;
      }
      default:
    }
  });

  /* ── Tocar fuera cierra ── */
  function alTocarFuera(evento) {
    const objetivo = evento.target;
    if (ancha()) {
      if (grupo && grupo.open && !grupo.contains(objetivo)) cerrarGrupo(false);
    } else if (panelAbierto()) {
      const dentro = objetivo instanceof Element && objetivo.closest('[data-menu-panel], [data-menu-abrir]');
      if (!dentro) cerrarPanel(false);
    }
  }
  document.addEventListener('pointerdown', alTocarFuera, true);

  // Si el invitado se pone a bajar con el panel abierto, el panel se retira
  function alDesplazar() {
    if (panelAbierto() && Math.abs(window.scrollY - yAlAbrir) > 60) cerrarPanel(false);
  }
  window.addEventListener('scroll', alDesplazar, { passive: true });

  /* ── Enlaces: desplazamiento suave, cierre y resaltado inmediato ── */
  let viaje = '';            // id al que se va; el observador espera a que el scroll se asiente
  let temporizadorViaje = 0;
  const tieneCaja = (el) => el.getClientRects().length > 0;
  function irA(destino) {
    // Un apartado dentro de pestañas (#hospedaje, #maquillaje, #donde-ir) puede estar
    // oculto o no ser el elegido: se pulsa su pestaña antes de desplazarse hasta él
    const pestana = document.querySelector(`[role="tab"][aria-controls="${destino.id}"]`);
    if (pestana && pestana.getAttribute('aria-selected') !== 'true') pestana.click();
    // Si sigue sin caja, se va hasta la sección que lo contiene
    const blanco = tieneCaja(destino) ? destino : (destino.closest('section') || destino);
    blanco.scrollIntoView({ behavior: consultaReducido.matches ? 'auto' : 'smooth', block: 'start' });
    if (!blanco.hasAttribute('tabindex')) blanco.setAttribute('tabindex', '-1');
    try { blanco.focus({ preventScroll: true }); } catch (error) { /* navegador viejo */ }
    document.dispatchEvent(new CustomEvent('menu:navegar', { detail: { id: destino.id } }));
  }
  function alPulsarEnlace(evento) {
    if (evento.defaultPrevented || evento.button > 0 || evento.metaKey || evento.ctrlKey) return;
    const enlace = evento.target.closest('a[href^="#"]');
    if (!enlace || !nav.contains(enlace)) return;
    const id = idDe(enlace);
    const destino = id ? document.getElementById(id) : null;
    cerrarPanel(false);
    cerrarGrupo(false);
    if (!destino) return;   // sin destino, el ancla sigue su curso normal
    evento.preventDefault();
    viaje = id;
    activar(id);
    irA(destino);
    clearTimeout(temporizadorViaje);
    temporizadorViaje = setTimeout(terminarViaje, 1200);
  }
  function terminarViaje() {
    viaje = '';
    elegirActiva();
  }
  nav.addEventListener('click', alPulsarEnlace);
  const alAsentarse = () => {
    if (!viaje) return;
    clearTimeout(temporizadorViaje);
    temporizadorViaje = setTimeout(terminarViaje, 160);
  };
  window.addEventListener('scroll', alAsentarse, { passive: true });

  /* ── Sección activa ──
     Una franja a la altura del 38–50 % de la ventana: la sección que la cruza
     es la activa. Las subsecciones (#hospedaje…) encienden también a su padre. */
  const porId = new Map();   // id → enlace
  enlaces.forEach((enlace) => { const id = idDe(enlace); if (id) porId.set(id, enlace); });
  const padres = new Map();  // id de subsección → id del padre (data-menu-padre)
  enlaces.forEach((enlace) => { if (enlace.dataset.menuPadre) padres.set(idDe(enlace), enlace.dataset.menuPadre); });
  // Secciones que no tienen entrada pero marcan dónde se está (apagan el resaltado)
  const SIN_ENTRADA = ['portada', 'atardecer', 'vestimenta', 'regalos', 'cierre'];

  const cruzando = new Map();   // elemento → true mientras cruza la franja
  let observados = new Set();
  let activaActual = '';

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) cruzando.set(entrada.target, true);
      else cruzando.delete(entrada.target);
    }
    if (!viaje) elegirActiva();
  }, { rootMargin: '-38% 0px -50% 0px', threshold: 0 });

  function elegirActiva() {
    const candidatos = [...cruzando.keys()];
    if (!candidatos.length) return;
    // La última en el documento: la que viene entrando por abajo
    candidatos.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    activar(candidatos[candidatos.length - 1].id);
  }

  function activar(id) {
    if (id === activaActual) return;
    activaActual = id;
    const padre = padres.get(id) || '';
    for (const [clave, enlace] of porId) {
      const activo = clave === id || (padre && clave === padre);
      enlace.classList.toggle('es-activo', activo);
      if (activo) enlace.setAttribute('aria-current', 'location');
      else enlace.removeAttribute('aria-current');
    }
    if (resumen) {
      const esDelGrupo = enlacesSub.some((enlace) => idDe(enlace) === id || idDe(enlace) === padre)
        || id === (grupo && grupo.dataset.menuGrupoId) || id === 'recomendaciones';
      resumen.classList.toggle('es-activo', esDelGrupo);
    }
  }

  function observarSecciones() {
    const ids = [...porId.keys(), ...padres.values(), ...SIN_ENTRADA];
    const nuevos = new Set();
    ids.forEach((id) => { const el = document.getElementById(id); if (el) nuevos.add(el); });
    observados.forEach((el) => { if (!nuevos.has(el)) { observador.unobserve(el); cruzando.delete(el); } });
    nuevos.forEach((el) => { if (!observados.has(el)) observador.observe(el); });
    observados = nuevos;
  }
  observarSecciones();

  /* ── Cambios de tamaño ── */
  const alCambiarAncho = () => { acomodarGrupo(); };
  consultaAncha.addEventListener?.('change', alCambiarAncho);

  const api = {
    mostrar: () => mostrar(true),
    abrir: abrirPanel,
    cerrar() { cerrarPanel(false); cerrarGrupo(false); },
    activar,
    // Vuelve a buscar las secciones (por si un módulo las montó después)
    actualizar: observarSecciones,
    destruir() {
      clearTimeout(temporizadorRaton);
      clearTimeout(temporizadorViaje);
      document.removeEventListener('sobre:abierto', alAbrirSobre);
      document.removeEventListener('ambiente:cambio', fijarColorBarra);
      document.removeEventListener('pointerdown', alTocarFuera, true);
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('scroll', alAsentarse);
      consultaAncha.removeEventListener?.('change', alCambiarAncho);
      observador.disconnect();
      nav._menu = null;
    }
  };
  nav._menu = api;
  return api;
}
