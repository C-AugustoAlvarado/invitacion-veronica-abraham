





export function sinTraslado(destino, accion) {
  const tocados = [];
  for (let el = destino; el && el !== document.body; el = el.parentElement) {
    if (!el.hasAttribute('data-revelar')) continue;
    tocados.push([el, el.style.transform, el.style.transition]);
    el.style.transition = 'none';
    el.style.transform = 'none';
  }
  try {
    return accion();
  } finally {



    for (const [el, transform] of tocados) el.style.transform = transform;
    for (const [el] of tocados) void el.offsetWidth;
    for (const [el, , transition] of tocados) el.style.transition = transition;
  }
}
