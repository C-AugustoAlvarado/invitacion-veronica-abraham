// Menú superior: barra fija con accesos rápidos a las secciones.
// El HTML (src/menu.html) ya funciona solo, con anclas normales; aquí se le
// añade lo que necesita JavaScript: aparecer cuando se abre el sobre, el panel
// de celular, los desplegables de los grupos (La boda, Recomendaciones, ¿Qué
// visitar?) con ratón y teclado, el resaltado de la sección activa y el
// desplazamiento suave. Se comunica solo con eventos en document: escucha
// 'sobre:abierto' y 'ambiente:cambio', y emite 'menu:navegar' (DISENO.md §4).
//
// Contrato con el HTML:
//   [data-menu]            el <nav>
//   [data-menu-abrir]      botón «Menú» (celular); se le quita «hidden»
//   [data-menu-panel]      panel que cae bajo la barra en celular
//   [data-menu-grupo]      cada grupo con desplegable; dentro:
//     el primer [data-menu-enlace]  cabeza: enlace a la sección del grupo
//     [data-menu-desplegar]         botón con la flecha (aria-expanded); se le quita «hidden»
//     [data-menu-sub]               lista de apartados
//     data-menu-abarca="id id…"     secciones sin entrada propia que encienden al grupo
//   [data-menu-enlace]     todo enlace que resalta y navega con suavidad
//   .es-abierto en el grupo abierto; .es-activo y aria-current en los enlaces activos.

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
  const enlaces = [...nav.querySelectorAll('[data-menu-enlace]')];

  const idDe = (enlace) => {
    const href = enlace.getAttribute('href') || '';
    try { return href.startsWith('#') ? decodeURIComponent(href.slice(1)) : ''; } catch (error) { return ''; }
  };

  /* ── Grupos con desplegable ── */
  const grupos = [...nav.querySelectorAll('[data-menu-grupo]')].map((el) => {
    const cabeza = el.querySelector('[data-menu-enlace]');
    const desplegar = el.querySelector('[data-menu-desplegar]');
    const sub = el.querySelector('[data-menu-sub]');
    const enlacesSub = sub ? [...sub.querySelectorAll('a[href]')] : [];
    return {
      el,
      cabeza,
      desplegar,
      sub,
      enlacesSub,
      id: cabeza ? idDe(cabeza) : '',
      idsSub: enlacesSub.map(idDe).filter(Boolean),
      abarca: (el.dataset.menuAbarca || '').trim().split(/\s+/).filter(Boolean),
      temporizador: 0
    };
  }).filter((g) => g.sub);
  const grupoDe = (el) => grupos.find((g) => g.el === el || g.el.contains(el));
  const grupoDeId = (id) => grupos.find((g) => g.id === id || g.idsSub.includes(id) || g.abarca.includes(id));

  /* ── Punto de corte: se lee de css/menu.css (--menu-corte) para no tenerlo dos veces ── */
  let corte = parseInt(getComputedStyle(nav).getPropertyValue('--menu-corte'), 10);
  if (!corte || Number.isNaN(corte)) corte = 960;
  const consultaAncha = window.matchMedia(`(min-width: ${corte}px)`);
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaRaton = window.matchMedia('(hover: hover) and (pointer: fine)');
  const ancha = () => consultaAncha.matches;

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

  /* ── Grupos: abrir y cerrar (uno abierto cierra a los demás) ── */
  let activaActual = '';
  const abierto = (g) => g.el.classList.contains('es-abierto');
  function fijarGrupo(g, estado) {
    g.el.classList.toggle('es-abierto', estado);
    if (g.desplegar) g.desplegar.setAttribute('aria-expanded', estado ? 'true' : 'false');
  }
  function abrirGrupo(g) {
    if (!g) return;
    clearTimeout(g.temporizador);
    grupos.forEach((otro) => { if (otro !== g && abierto(otro)) fijarGrupo(otro, false); });
    if (!abierto(g)) fijarGrupo(g, true);
  }
  function cerrarGrupo(g, enfocarCabeza) {
    if (!g) return;
    clearTimeout(g.temporizador);
    if (!abierto(g)) return;
    fijarGrupo(g, false);
    if (enfocarCabeza && g.cabeza) g.cabeza.focus();
  }
  const grupoAbierto = () => grupos.find(abierto) || null;
  function cerrarGrupos(enfocarCabeza) {
    grupos.forEach((g) => cerrarGrupo(g, enfocarCabeza && document.activeElement && g.el.contains(document.activeElement)));
  }
  // Acordeón del celular: abierto el grupo de la sección activa, los demás cerrados
  function acomodarAcordeon() {
    const activo = grupoDeId(activaActual);
    grupos.forEach((g) => fijarGrupo(g, g === activo));
  }

  /* ── Panel de celular ── */
  let yAlAbrir = 0;
  const panelAbierto = () => nav.classList.contains('menu--abierto');
  function abrirPanel() {
    if (!boton || ancha() || panelAbierto()) return;
    acomodarAcordeon();
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

  /* ── Botón de la flecha: clic alterna el grupo ── */
  grupos.forEach((g) => {
    if (!g.desplegar) return;
    g.desplegar.hidden = false;   // solo sirve con JavaScript
    g.desplegar.addEventListener('click', () => {
      if (abierto(g)) cerrarGrupo(g, false);
      else abrirGrupo(g);
    });

    // Ratón de escritorio: se abre al pasar y se cierra al salir, con un respiro
    g.el.addEventListener('mouseenter', () => {
      if (!ancha() || !consultaRaton.matches) return;
      abrirGrupo(g);
    });
    g.el.addEventListener('mouseleave', () => {
      if (!ancha() || !consultaRaton.matches) return;
      clearTimeout(g.temporizador);
      g.temporizador = setTimeout(() => cerrarGrupo(g, false), 220);
    });
    // Tab fuera del grupo (escritorio) lo cierra
    g.el.addEventListener('focusout', (evento) => {
      if (!ancha()) return;
      if (evento.relatedTarget && g.el.contains(evento.relatedTarget)) return;
      // Esperar: el foco puede ir a parar dentro del mismo grupo (Safari lo avisa tarde)
      setTimeout(() => { if (!g.el.contains(document.activeElement)) cerrarGrupo(g, false); }, 0);
    });
  });
  // Al cambiar de maquetación, nada queda abierto a medias
  function acomodar() {
    cerrarPanel(false);
    grupos.forEach((g) => fijarGrupo(g, false));
  }
  acomodar();

  // En celular el panel se cierra si el foco se va con Tab fuera de él
  nav.addEventListener('focusout', () => {
    if (ancha() || !panelAbierto()) return;
    setTimeout(() => {
      const activo = document.activeElement;
      if (panel && !panel.contains(activo) && activo !== boton) cerrarPanel(false);
    }, 0);
  });
  // Y si el foco llega a cualquier otro sitio de la página (Safari no enfoca los
  // botones al hacer clic, así que el focusout del grupo no siempre avisa)
  function alEnfocar(evento) {
    const destino = evento.target;
    if (!(destino instanceof Node) || nav.contains(destino)) {
      if (ancha()) { const g = grupoAbierto(); if (g && destino instanceof Node && !g.el.contains(destino)) cerrarGrupo(g, false); }
      return;
    }
    if (ancha()) cerrarGrupos(false);
    else cerrarPanel(false);
  }
  document.addEventListener('focusin', alEnfocar);

  /* ── Teclado ── */
  const focables = (ambito) => {
    if (!ambito) return [];
    return [...ambito.querySelectorAll('a[href], button')].filter((el) => !el.hidden && el.getClientRects().length > 0);
  };
  function moverFoco(lista, paso, desde) {
    if (!lista.length) return;
    let i = lista.indexOf(desde);
    if (paso === 'inicio') i = 0;
    else if (paso === 'fin') i = lista.length - 1;
    else i = (i + paso + lista.length) % lista.length;
    lista[i].focus();
  }
  nav.addEventListener('keydown', (evento) => {
    const objetivo = evento.target;
    const g = grupoDe(objetivo);
    switch (evento.key) {
      case 'Escape':
        if (ancha()) {
          const abiertoAhora = grupoAbierto();
          if (abiertoAhora) { evento.preventDefault(); cerrarGrupo(abiertoAhora, true); }
        } else if (panelAbierto()) { evento.preventDefault(); cerrarPanel(true); }
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const paso = evento.key === 'ArrowDown' ? 1 : -1;
        if (ancha()) {
          if (!g) return;
          evento.preventDefault();
          const enCabeza = objetivo === g.cabeza || objetivo === g.desplegar;
          if (!abierto(g)) abrirGrupo(g);
          if (enCabeza || !g.sub.contains(objetivo)) {
            g.enlacesSub[paso > 0 ? 0 : g.enlacesSub.length - 1]?.focus();
            return;
          }
          moverFoco(g.enlacesSub, paso, objetivo);
        } else if (panelAbierto() && panel && panel.contains(objetivo)) {
          evento.preventDefault();
          moverFoco(focables(panel), paso, objetivo);
        }
        break;
      }
      case 'Home':
      case 'End': {
        let lista = [];
        if (ancha()) { if (g && abierto(g) && g.sub.contains(objetivo)) lista = g.enlacesSub; }
        else if (panelAbierto() && panel && panel.contains(objetivo)) lista = focables(panel);
        if (!lista.length) return;
        evento.preventDefault();
        moverFoco(lista, evento.key === 'Home' ? 'inicio' : 'fin', objetivo);
        break;
      }
      default:
    }
  });

  /* ── Tocar fuera cierra ── */
  function alTocarFuera(evento) {
    const objetivo = evento.target;
    if (ancha()) {
      const abiertoAhora = grupoAbierto();
      if (abiertoAhora && !(objetivo instanceof Node && abiertoAhora.el.contains(objetivo))) cerrarGrupo(abiertoAhora, false);
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
    // Un apartado dentro de pestañas (#hospedaje, #donde-comer…) puede estar oculto
    // o no ser el elegido: se pulsa su pestaña antes de desplazarse hasta él
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
    // En el panel de celular la cabeza de un grupo solo despliega (o pliega) su submenú;
    // navegan los apartados (lo pidieron los novios el 22-oct-2026)
    if (!ancha()) {
      const g = grupoDe(enlace);
      if (g && g.cabeza === enlace) {
        evento.preventDefault();
        if (abierto(g)) cerrarGrupo(g, false); else abrirGrupo(g);
        return;
      }
    }
    // Tableta táctil con la fila completa: sin hover, el primer toque en la cabeza de un
    // grupo cerrado lo despliega; el segundo toque navega
    if (ancha() && !consultaRaton.matches) {
      const g = grupoDe(enlace);
      if (g && g.cabeza === enlace && !abierto(g)) { evento.preventDefault(); abrirGrupo(g); return; }
    }
    cerrarPanel(false);
    if (ancha()) cerrarGrupos(false);
    if (!destino) return;   // sin destino (sección aún no montada), el ancla sigue su curso normal
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
     Una franja a la altura del 38–50 % de la ventana: el destino que la cruza
     es el activo. Un apartado (#itinerario, #hospedaje…) enciende también a la
     cabeza de su grupo; una sección «abarcada» (#vestimenta) solo a la cabeza. */
  const porId = new Map();   // id → enlace
  enlaces.forEach((enlace) => { const id = idDe(enlace); if (id) porId.set(id, enlace); });
  // Secciones que no tienen entrada pero marcan dónde se está (apagan el resaltado)
  const apagan = opciones.apagan || ['portada', 'atardecer', 'cierre'];

  const cruzando = new Map();   // elemento → true mientras cruza la franja
  let observados = new Set();

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
    // El más bajo en la página: el que viene entrando por abajo (o la tarjeta
    // dentro de la sección, que empieza después de ella). A la misma altura
    // (dos tarjetas lado a lado) gana el primero del documento.
    const tops = new Map(candidatos.map((el) => [el, Math.round(el.getBoundingClientRect().top)]));
    candidatos.sort((a, b) => {
      const d = tops.get(a) - tops.get(b);
      if (d) return d;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
    });
    activar(candidatos[candidatos.length - 1].id);
  }

  function activar(id) {
    if (id === activaActual) return;
    activaActual = id;
    const g = grupoDeId(id);
    for (const [clave, enlace] of porId) {
      const activo = clave === id || (!!g && clave === g.id);
      enlace.classList.toggle('es-activo', activo);
      if (activo) enlace.setAttribute('aria-current', 'location');
      else enlace.removeAttribute('aria-current');
    }
    grupos.forEach((otro) => otro.el.classList.toggle('es-activo', otro === g));
  }

  function observarSecciones() {
    const ids = [...porId.keys(), ...apagan];
    grupos.forEach((g) => ids.push(...g.abarca));
    const nuevos = new Set();
    ids.forEach((id) => { const el = document.getElementById(id); if (el) nuevos.add(el); });
    observados.forEach((el) => { if (!nuevos.has(el)) { observador.unobserve(el); cruzando.delete(el); } });
    nuevos.forEach((el) => { if (!observados.has(el)) observador.observe(el); });
    observados = nuevos;
  }
  observarSecciones();

  /* ── Cambios de tamaño ── */
  const alCambiarAncho = () => { acomodar(); };
  consultaAncha.addEventListener?.('change', alCambiarAncho);

  const api = {
    mostrar: () => mostrar(true),
    abrir: abrirPanel,
    cerrar() { cerrarPanel(false); grupos.forEach((g) => cerrarGrupo(g, false)); },
    // Abre el desplegable de un grupo (por el id de su sección: 'boda', 'recomendaciones'…)
    abrirGrupo: (id) => abrirGrupo(grupos.find((g) => g.id === id || g.el.dataset.menuGrupo === id)),
    activar,
    // Vuelve a buscar las secciones (por si un módulo las montó después)
    actualizar: observarSecciones,
    destruir() {
      grupos.forEach((g) => clearTimeout(g.temporizador));
      clearTimeout(temporizadorViaje);
      document.removeEventListener('sobre:abierto', alAbrirSobre);
      document.removeEventListener('ambiente:cambio', fijarColorBarra);
      document.removeEventListener('pointerdown', alTocarFuera, true);
      document.removeEventListener('focusin', alEnfocar);
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
