





















import { sinTraslado } from './anclas.js';

const COLOR_BARRA = '#F6F2EA';

export function iniciarMenu(opciones = {}) {
  const nav = typeof opciones.contenedor === 'string'
    ? document.querySelector(opciones.contenedor)
    : (opciones.contenedor || document.getElementById('menu') || document.querySelector('[data-menu]'));
  if (!nav) return null;
  if (nav._menu) return nav._menu;

  const boton = nav.querySelector('[data-menu-abrir]');
  const panel = nav.querySelector('[data-menu-panel]');
  const enlaces = [...nav.querySelectorAll('[data-menu-enlace]')];

  const idDe = (enlace) => {
    const href = enlace.getAttribute('href') || '';
    try { return href.startsWith('#') ? decodeURIComponent(href.slice(1)) : ''; } catch (error) { return ''; }
  };

   
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

   
  let corte = parseInt(getComputedStyle(nav).getPropertyValue('--menu-corte'), 10);
  if (!corte || Number.isNaN(corte)) corte = 960;
  const consultaAncha = window.matchMedia(`(min-width: ${corte}px)`);
  const consultaReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const consultaRaton = window.matchMedia('(hover: hover) and (pointer: fine)');
  const ancha = () => consultaAncha.matches;

   
  const metaTema = opciones.fijarColorBarra === false ? null : document.querySelector('meta[name="theme-color"]');
  let visible = false;
  function fijarColorBarra() {
    if (metaTema && visible && metaTema.getAttribute('content') !== COLOR_BARRA) {
      metaTema.setAttribute('content', COLOR_BARRA);
    }
  }

  document.addEventListener('ambiente:cambio', fijarColorBarra);

   
  function mostrar(inmediata) {
    if (visible) return;
    visible = true;
    if (inmediata) nav.classList.add('menu--inmediata');
    nav.classList.add('menu--visible');
    fijarColorBarra();
    if (inmediata) {

      requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove('menu--inmediata')));
    }
  }
  const alAbrirSobre = () => {

    setTimeout(() => mostrar(false), opciones.retraso ?? 420);
  };
  const sobreCerrado = document.body.classList.contains('bloqueado');
  if (sobreCerrado) document.addEventListener('sobre:abierto', alAbrirSobre, { once: true });
  else mostrar(true);

   
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

  function acomodarAcordeon() {
    const activo = grupoDeId(activaActual);
    grupos.forEach((g) => fijarGrupo(g, g === activo));
  }

   
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
    boton.hidden = false;
    boton.addEventListener('click', () => (panelAbierto() ? cerrarPanel(false) : abrirPanel()));
  }

   
  grupos.forEach((g) => {
    if (!g.desplegar) return;
    g.desplegar.hidden = false;
    g.desplegar.addEventListener('click', () => {
      if (abierto(g)) cerrarGrupo(g, false);
      else abrirGrupo(g);
    });


    g.el.addEventListener('mouseenter', () => {
      if (!ancha() || !consultaRaton.matches) return;
      abrirGrupo(g);
    });
    g.el.addEventListener('mouseleave', () => {
      if (!ancha() || !consultaRaton.matches) return;
      clearTimeout(g.temporizador);
      g.temporizador = setTimeout(() => cerrarGrupo(g, false), 220);
    });

    g.el.addEventListener('focusout', (evento) => {
      if (!ancha()) return;
      if (evento.relatedTarget && g.el.contains(evento.relatedTarget)) return;

      setTimeout(() => { if (!g.el.contains(document.activeElement)) cerrarGrupo(g, false); }, 0);
    });
  });

  function acomodar() {
    cerrarPanel(false);
    grupos.forEach((g) => fijarGrupo(g, false));
  }
  acomodar();


  nav.addEventListener('focusout', () => {
    if (ancha() || !panelAbierto()) return;
    setTimeout(() => {
      const activo = document.activeElement;
      if (panel && !panel.contains(activo) && activo !== boton) cerrarPanel(false);
    }, 0);
  });


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
        } else if (boton && objetivo === boton) {


          evento.preventDefault();
          if (!panelAbierto()) abrirPanel();
          const lista = panel ? focables(panel) : [];
          (paso > 0 ? lista[0] : lista[lista.length - 1])?.focus();
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



  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || (evento.target instanceof Node && nav.contains(evento.target))) return;
    if (ancha()) { const abiertoAhora = grupoAbierto(); if (abiertoAhora) cerrarGrupo(abiertoAhora, true); }
    else if (panelAbierto()) cerrarPanel(true);
  });

   
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


  function alDesplazar() {
    if (panelAbierto() && Math.abs(window.scrollY - yAlAbrir) > 60) cerrarPanel(false);
  }
  window.addEventListener('scroll', alDesplazar, { passive: true });

   
  let viaje = '';
  let temporizadorViaje = 0;
  const tieneCaja = (el) => el.getClientRects().length > 0;
  function irA(destino) {


    const pestana = document.querySelector(`[role="tab"][aria-controls="${destino.id}"]`);
    if (pestana && pestana.getAttribute('aria-selected') !== 'true') pestana.click();

    const blanco = tieneCaja(destino) ? destino : (destino.closest('section') || destino);
    sinTraslado(blanco, () => blanco.scrollIntoView({ behavior: consultaReducido.matches ? 'auto' : 'smooth', block: 'start' }));
    if (!blanco.hasAttribute('tabindex')) blanco.setAttribute('tabindex', '-1');
    try { blanco.focus({ preventScroll: true }); } catch (error) {   }
    document.dispatchEvent(new CustomEvent('menu:navegar', { detail: { id: destino.id } }));
  }
  function alPulsarEnlace(evento) {
    if (evento.defaultPrevented || evento.button > 0 || evento.metaKey || evento.ctrlKey) return;
    const enlace = evento.target.closest('a[href^="#"]');
    if (!enlace || !nav.contains(enlace)) return;
    const id = idDe(enlace);
    const destino = id ? document.getElementById(id) : null;


    if (!ancha()) {
      const g = grupoDe(enlace);
      if (g && g.cabeza === enlace) {
        evento.preventDefault();
        if (abierto(g)) cerrarGrupo(g, false); else abrirGrupo(g);
        return;
      }
    }


    if (ancha() && !consultaRaton.matches) {
      const g = grupoDe(enlace);
      if (g && g.cabeza === enlace && !abierto(g)) { evento.preventDefault(); abrirGrupo(g); return; }
    }
    cerrarPanel(false);
    if (ancha()) cerrarGrupos(false);
    if (!destino) return;
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

  



  const porId = new Map();
  enlaces.forEach((enlace) => { const id = idDe(enlace); if (id) porId.set(id, enlace); });

  const apagan = opciones.apagan || ['portada', 'atardecer', 'cierre'];

  const cruzando = new Map();
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

   
  const alCambiarAncho = () => { acomodar(); };
  consultaAncha.addEventListener?.('change', alCambiarAncho);

  const api = {
    mostrar: () => mostrar(true),
    abrir: abrirPanel,
    cerrar() { cerrarPanel(false); grupos.forEach((g) => cerrarGrupo(g, false)); },

    abrirGrupo: (id) => abrirGrupo(grupos.find((g) => g.id === id || g.el.dataset.menuGrupo === id)),
    activar,

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
