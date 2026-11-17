// On-screen joystick for walking on touch screens.
export function createJoystick(parent, onMove) {
  const base = document.createElement('div');
  base.className = 'joystick';
  const knob = document.createElement('div');
  knob.className = 'knob';
  base.appendChild(knob);
  parent.appendChild(base);
  let id = null, cx = 0, cy = 0;
  const R = 46;
  const set = (dx, dy) => {
    const l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove(dx / R, -dy / R);
  };
  base.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    id = e.pointerId; base.setPointerCapture(id);
    const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    set(e.clientX - cx, e.clientY - cy);
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
  const end = e => { if (e.pointerId === id) { id = null; set(0, 0); } };
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  return base;
}
