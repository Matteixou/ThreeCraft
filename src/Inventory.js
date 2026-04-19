export const HOTBAR_SIZE = 9;
export const GRID_ROWS   = 3;
export const SLOT_COUNT  = HOTBAR_SIZE * (GRID_ROWS + 1); // 36
export const STACK_MAX   = 64;

export class Inventory {
  constructor() {
    // slots[0..8] = hotbar, slots[9..35] = grid
    this.slots    = new Array(SLOT_COUNT).fill(null); // { type, count }
    this.selected = 0; // hotbar selection index (0-8)
    this.held     = null; // { type, count } being dragged in inventory UI
  }

  add(type, count = 1) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = this.slots[i];
      if (s?.type === type && s.count < STACK_MAX) {
        const n = Math.min(count, STACK_MAX - s.count);
        s.count += n; count -= n;
        if (!count) return true;
      }
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (!this.slots[i]) {
        const n = Math.min(count, STACK_MAX);
        this.slots[i] = { type, count: n }; count -= n;
        if (!count) return true;
      }
    }
    return !count;
  }

  consume(idx, count = 1) {
    const s = this.slots[idx];
    if (!s || s.count < count) return false;
    s.count -= count;
    if (!s.count) this.slots[idx] = null;
    return true;
  }

  getSelected() { return this.slots[this.selected]; }

  scroll(delta) {
    this.selected = (this.selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  // uiIdx: 0-26 = grid slots, 27-35 = hotbar slots
  _uiToSlot(uiIdx) {
    return uiIdx < HOTBAR_SIZE * GRID_ROWS
      ? HOTBAR_SIZE + uiIdx   // grid → slots[9..35]
      : uiIdx - HOTBAR_SIZE * GRID_ROWS; // hotbar → slots[0..8]
  }

  clickSlot(uiIdx) {
    const idx = this._uiToSlot(uiIdx);
    if (this.held) {
      if (!this.slots[idx]) {
        this.slots[idx] = this.held; this.held = null;
      } else if (this.slots[idx].type === this.held.type && this.slots[idx].count < STACK_MAX) {
        const n = Math.min(this.held.count, STACK_MAX - this.slots[idx].count);
        this.slots[idx].count += n; this.held.count -= n;
        if (!this.held.count) this.held = null;
      } else {
        [this.slots[idx], this.held] = [this.held, this.slots[idx]];
      }
    } else if (this.slots[idx]) {
      this.held = this.slots[idx]; this.slots[idx] = null;
    }
  }

  rightClickSlot(uiIdx) {
    const idx = this._uiToSlot(uiIdx);
    if (this.held) {
      if (!this.slots[idx]) {
        this.slots[idx] = { type: this.held.type, count: 1 };
        this.held.count--;
        if (!this.held.count) this.held = null;
      } else if (this.slots[idx].type === this.held.type && this.slots[idx].count < STACK_MAX) {
        this.slots[idx].count++; this.held.count--;
        if (!this.held.count) this.held = null;
      }
    } else if (this.slots[idx]) {
      const half = Math.ceil(this.slots[idx].count / 2);
      this.held = { type: this.slots[idx].type, count: half };
      this.slots[idx].count -= half;
      if (!this.slots[idx].count) this.slots[idx] = null;
    }
  }

  dropHeld() { this.held = null; }
}
