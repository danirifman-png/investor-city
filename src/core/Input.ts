/**
 * Keyboard + virtual joystick state shared by the player and the camera.
 * Movement is a vector in [-1, 1]² where +y is "forward" (away from camera).
 */
export class Input {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  /** Mobile run toggle. */
  runToggle = false;
  /** Set false while menus or text fields have focus. */
  enabled = true;
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(code: string): boolean {
    return this.enabled && this.keys.has(code);
  }

  /** True once per key press (cleared every frame by `endFrame`). */
  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }

  endFrame(): void {
    this.pressed.clear();
  }

  setJoystick(x: number, y: number): void {
    this.joy.x = x;
    this.joy.y = y;
  }

  /** Movement intent: keyboard and joystick combined. */
  move(): { x: number; y: number; magnitude: number } {
    if (!this.enabled) return { x: 0, y: 0, magnitude: 0 };
    let x = this.joy.x;
    let y = this.joy.y;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, magnitude: Math.min(1, len) };
  }

  /** Running: Shift on keyboard, the run toggle, or the joystick pushed to the rim. */
  running(): boolean {
    const joyMag = Math.hypot(this.joy.x, this.joy.y);
    return this.down('ShiftLeft') || this.down('ShiftRight') || this.runToggle || joyMag > 0.92;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  // toggles and sliders keep focus after a click; they must not swallow WASD
  if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'submit', 'color'].includes((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.isContentEditable;
}
