import { View, div, image } from "gpui-kit";
import { theme } from "herdr";

// A string of lights across the top, glowing softly. Each bulb hangs from the
// low point of one 32 px scallop of wire.
const STEP = 32;
const COLORS = ["#f5d27a", "#ffe08a", "#ffc94d", "#fff1b8", "#f0b429"];

export default class XmasLights extends View {
  init(props) {
    this.width = 0;
    // Copies in different blocks start at different bulbs so the colors don't repeat at the seam.
    this.offset = props?.offset ?? 0;
  }

  bulb(i) {
    const c = COLORS[(i + this.offset) % COLORS.length];
    const x = i * STEP + STEP / 2;
    const period = 2600 + ((i * 7 + this.offset * 3) % 5) * 450;
    return div().absolute().left(x - 7).top(3).w(14).h(18)
      // Halo
      .child(div().absolute().left(0).top(2).size(14).rounded(7).bg(c)
        .opacity(0.2).loop("opacity", { from: 0.05, to: 0.3, period }))
      // Cap
      .child(div().absolute().left(5).top(4).w(4).h(3).rounded(1).bg("#55705f"))
      // Glass
      .child(div().absolute().left(4).top(6).w(6).h(9).rounded(3).bg(c)
        .opacity(0.8).loop("opacity", { from: 0.5, to: 1, period }));
  }

  render() {
    const t = theme();
    const n = Math.ceil(this.width / STEP);
    const idx = Array.from({ length: n }, (_, i) => i);
    return div().id("xmas-lights-root").relative().size_full().overflow_hidden() // background: the layout block's gradient
      .on_size_change((size, cx) => {
        if (size.width !== this.width) { this.width = size.width; cx.notify(); }
      })
      .children(idx.map((i) => image("mods/xmas-lights/wire.svg").absolute().left(i * STEP).top(0).w(STEP).h(14)))
      .children(idx.map((i) => this.bulb(i)));
  }
}
