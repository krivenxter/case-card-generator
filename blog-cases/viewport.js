export function setupViewport(canvas) {
  const area = canvas.parentElement;
  const fit = document.getElementById('zoom-fit');
  const center = document.getElementById('zoom-center');
  let zoom = 1;
  let x = 0;
  let y = 0;
  let size = 0;
  const pointers = new Map();
  let gesture;

  function paint(animate = false) {
    const height = size * 9 / 16 * zoom;
    x = Math.max(-Math.max(0, (size * zoom + area.clientWidth) / 2 - 48),
      Math.min(Math.max(0, (size * zoom + area.clientWidth) / 2 - 48), x));
    y = Math.max(-Math.max(0, (height + area.clientHeight) / 2 - 40),
      Math.min(Math.max(0, (height + area.clientHeight) / 2 - 40), y));
    canvas.classList.toggle('blog-snap', animate);
    canvas.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${zoom})`;
    fit.textContent = Math.round(zoom * 100) + '%';
  }

  function resize() {
    const inset = area.clientWidth < 500 ? 20 : 42;
    size = Math.max(1, Math.min(area.clientWidth - inset, (area.clientHeight - inset) * 16 / 9));
    canvas.style.width = size + 'px';
    paint();
  }

  function scale(next, atX = 0, atY = 0, animate = false) {
    const clamped = Math.max(.35, Math.min(4, next));
    const ratio = clamped / zoom;
    x = atX - (atX - x) * ratio;
    y = atY - (atY - y) * ratio;
    zoom = clamped;
    paint(animate);
  }

  function reset(all) {
    x = 0;
    y = 0;
    if (all) zoom = 1;
    paint(true);
  }

  function point(clientX, clientY) {
    const rect = area.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  function measure() {
    const [a, b] = pointers.values();
    if (!a || !b) return a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  area.addEventListener('pointerdown', (event) => {
    if (![0, 1].includes(event.button) || pointers.size >= 2) return;
    event.preventDefault();
    area.focus({ preventScroll: true });
    area.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, point(event.clientX, event.clientY));
    gesture = measure();
    area.classList.add('blog-panning');
  });
  area.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, point(event.clientX, event.clientY));
    const next = measure();
    x += next.x - gesture.x;
    y += next.y - gesture.y;
    if (next.distance && gesture.distance) scale(zoom * next.distance / gesture.distance, next.x, next.y);
    else paint();
    gesture = next;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    area.addEventListener(type, (event) => {
      pointers.delete(event.pointerId);
      gesture = measure();
      area.classList.toggle('blog-panning', pointers.size > 0);
    });
  }
  area.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey && !matchMedia('(min-width: 851px)').matches) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1;
    if (event.ctrlKey || event.metaKey) {
      const at = point(event.clientX, event.clientY);
      scale(zoom * Math.exp(-event.deltaY * units * .008), at.x, at.y);
    } else {
      x -= (event.shiftKey ? event.deltaY : event.deltaX) * units;
      y -= (event.shiftKey ? 0 : event.deltaY) * units;
      paint();
    }
  }, { passive: false });
  area.addEventListener('dblclick', () => reset(true));
  area.addEventListener('keydown', (event) => {
    const offsets = { ArrowLeft: [-32, 0], ArrowRight: [32, 0], ArrowUp: [0, -32], ArrowDown: [0, 32] };
    if (offsets[event.key]) {
      const [dx, dy] = offsets[event.key];
      x += dx;
      y += dy;
      paint(true);
    } else if (event.key === '+' || event.key === '=') scale(zoom * 1.2, 0, 0, true);
    else if (event.key === '-') scale(zoom / 1.2, 0, 0, true);
    else if (event.key === '0') reset(true);
    else return;
    event.preventDefault();
  });
  fit.addEventListener('click', () => reset(true));
  center.addEventListener('click', () => reset(false));
  document.getElementById('zoom-in').addEventListener('click', () => scale(zoom * 1.2, 0, 0, true));
  document.getElementById('zoom-out').addEventListener('click', () => scale(zoom / 1.2, 0, 0, true));
  new ResizeObserver(resize).observe(area);
  resize();
}
