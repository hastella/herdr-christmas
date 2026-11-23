import { View, div, image } from "gpui-kit";
import { theme, checking } from "herdr";

const DIR = "mods/xmas-parade";
const DEER = { w: 56, h: 48 };
const SANTA = { w: 48, h: 56 };
const DOG = { w: 48, h: 48 }; // 12px taller for the Santa hat
const GROUND = 9;

// All three hop the same way.
const HOP = { from: 0, to: -3, period: 440, easing: "ease-in-out" };

const SPEED = 45; // px per second, the same for all three

// Each walks wall to wall on its own. All three share one span and one speed,
// and only their place in the round trip (phase, 0..1) differs, a third apart.
// The gaps then hold forever: they pass each other head-on but never overlap walking the same way.
const WALKERS = [
  { id: "rudolph", sprite: "deer", size: DEER, phase: 0.05 },
  { id: "santa", sprite: "santa", size: SANTA, phase: 0.05 + 1 / 3 },
  { id: "bichon", sprite: "dog", size: DOG, phase: 0.05 + 2 / 3 },
];
const WIDEST = Math.max(...WALKERS.map((w) => w.size.w));

// Gift piles along the ground: [position as a share of the width, file, width, height].
const GIFTS = [
  [0.02, "gift-red", 30, 34], [0.055, "gift-gold", 22, 26], [0.085, "gift-green", 26, 30],
  [0.46, "gift-white", 28, 28], [0.495, "gift-red", 30, 34],
  [0.9, "gift-green", 26, 30], [0.93, "gift-gold", 22, 26], [0.955, "gift-white", 28, 28],
];

export default class XmasParade extends View {
  init(_props, cx) {
    this.width = 0;
    this.height = 72;
    // Each walker has its own position, direction, leg time and timer.
    this.state = Object.fromEntries(WALKERS.map((w) => [w.id, { x: 8, dir: 1, leg: 0, timer: null }]));
    this.t0 = 0; // when the parade started: every position is computed from the time since
  }

  minX() { return 8; }
  // One span for all (a span per sprite width would make the phases drift)
  span() { return Math.max(1, this.width - 16 - WIDEST); }

  // Where a walker is at time t, its direction and distance to the wall (the round trip as a circle of length 2L)
  where(w, t) {
    const L = this.span();
    const p = (((w.phase * 2 * L + SPEED * (t - this.t0) / 1000) % (2 * L)) + 2 * L) % (2 * L);
    return p < L
      ? { x: this.minX() + p, dir: 1, left: L - p, wall: this.minX() + L }
      : { x: this.minX() + 2 * L - p, dir: -1, left: 2 * L - p, wall: this.minX() };
  }

  // Walk from here to the next wall, then turn and go on.
  step(w, cx) {
    const s = this.state[w.id];
    s.timer?.cancel?.();
    const at = this.where(w, Date.now());
    s.dir = at.dir;
    s.leg = (at.left / SPEED) * 1000;
    s.x = at.wall;
    cx.notify();
    if (checking()) return;
    s.timer = cx.timer.after(Math.max(30, s.leg), (cx) => this.step(w, cx));
  }

  // One still frame, no leg swap (swapping frames flickered).
  sprite(name, side, size) {
    return div().relative().w(size.w).h(size.h)
      .child(image(`${DIR}/${name}-${side}0.svg`).absolute().left(0).top(0).w(size.w).h(size.h));
  }

  walker(w, extra) {
    const s = this.state[w.id];
    const side = s.dir > 0 ? "r" : "l";
    const top = this.height - GROUND - w.size.h + 3;
    return div().id(w.id).absolute().left(s.x).top(top)
      .transition("left", { duration: s.leg, easing: "linear" })
      .child(div().relative().top(0).loop("top", HOP)
        .child(this.sprite(w.sprite, side, w.size))
        .when(Boolean(extra), (el) => el.child(extra(side))));
  }

  render() {
    const t = theme();
    const root = div().id("xmas-parade-root").relative().size_full().overflow_hidden().bg("#f9e3eb") // light pink
      .border_t(1).border_color(t.border)
      .on_size_change((size, cx) => {
        const first = this.width === 0;
        if (size.width === this.width && size.height === this.height) return;
        this.width = size.width;
        this.height = size.height;
        if (first) {
          // Stand each at its start first; leaving on the next frame lets the transition show.
          this.t0 = Date.now() + 60;
          for (const w of WALKERS) {
            const at = this.where(w, this.t0);
            Object.assign(this.state[w.id], { x: at.x, dir: at.dir, leg: 0 });
          }
          cx.notify();
          WALKERS.forEach((w) => cx.timer.after(60, (cx) => this.step(w, cx)));
        } else {
          // On resize, re-place from the clock (the gaps stay)
          for (const w of WALKERS) this.step(w, cx);
        }
      });
    if (this.width === 0) return root;

    const ground = div().absolute().left(0).top(this.height - GROUND).w(this.width).h(GROUND)
      .bg("#f2a7bf").rounded_t(4);
    const gifts = GIFTS.map(([share, file, w, h]) =>
      image(`${DIR}/${file}.svg`).absolute()
        .left(Math.round(share * (this.width - w)))
        .top(this.height - GROUND - h + 2).w(w).h(h));
    const sparkles = GIFTS.filter((_, i) => i % 2 === 0).map(([share, , w, h], i) =>
      div().absolute().left(Math.round(share * (this.width - w)) + w - 4).top(this.height - GROUND - h - 6)
        .text_size(9).text_color("#f5d27a").child("✦")
        .loop("opacity", { from: 0, to: 1, period: 1400 + i * 300 }));

    const [rudolph, santa, bichon] = WALKERS;
    return root
      .child(ground)
      .children(gifts)
      .children(sparkles)
      .child(this.walker(rudolph, (side) =>
        // Rudolph's glowing nose: a soft red halo over the nose, on whichever side he faces.
        div().absolute().left(side === "r" ? 54 - 7 : DEER.w - 54 - 7).top(13.5 - 7).size(14).rounded(7)
          .bg("#ff3b3b").loop("opacity", { from: 0.1, to: 0.55, period: 1600 })))
      .child(this.walker(santa))
      .child(this.walker(bichon, (side) =>
        // Santa hat, fixed on the same layer as the body
        image(`${DIR}/dog-hat-${side}.svg`).absolute().left(0).top(0).w(DOG.w).h(DOG.h)));
  }
}
