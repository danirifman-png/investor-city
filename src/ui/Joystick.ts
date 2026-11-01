import { h } from './dom';

/**
 * Virtual thumbstick for touch screens. Reports a vector in [-1, 1] where
 * +y is "forward". Built to be reused for the player character in phase 2.
 */
export class Joystick {
  readonly el: HTMLDivElement;
  private knob: HTMLDivElement;
  private pointerId: number | null = null;
  private radius = 46;

  constructor(private onChange: (x: number, y: number) => void, label: string) {
    this.knob = h('div', { class: 'joystick-knob' });
    this.el = h('div', { class: 'joystick', role: 'application', 'aria-label': label }, [this.knob]);
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.pointerId = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.move(e);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) this.move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.onChange(0, 0);
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  private move(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // small dead zone so a resting thumb does not drift
    const nx = dx / this.radius;
    const ny = -dy / this.radius;
    const mag = Math.hypot(nx, ny);
    if (mag < 0.12) this.onChange(0, 0);
    else this.onChange(nx, ny);
  }
}
