export class InputHandler {
  constructor() {
    this.keys         = {};
    this.mouseButtons = {};
    this.mouseDelta   = { x: 0, y: 0 };
    this.isLocked     = false;

    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      // Empêche le scroll natif du navigateur
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    document.addEventListener('keyup',   e => { this.keys[e.code] = false; });
    document.addEventListener('mousedown', e => { this.mouseButtons[e.button] = true; });
    document.addEventListener('mouseup',   e => { this.mouseButtons[e.button] = false; });
    document.addEventListener('mousemove', e => {
      if (this.isLocked) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement !== null;
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  isKeyDown(code)        { return !!this.keys[code]; }
  isMouseButtonDown(btn) { return !!this.mouseButtons[btn]; }

  // Consomme le delta souris accumulé depuis la dernière frame
  consumeMouseDelta() {
    const d = { x: this.mouseDelta.x, y: this.mouseDelta.y };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return d;
  }

  // Retourne true et reset si le bouton vient d'être cliqué
  consumeMouseButton(button) {
    if (this.mouseButtons[button]) {
      this.mouseButtons[button] = false;
      return true;
    }
    return false;
  }
}
