import { View, div, image } from "gpui-kit";
import { theme } from "herdr";

// Ornament lights on the tree: [x, y, color, twinkle period ms], in tree.svg coordinates.
const LIGHTS = [
  [56, 56, "#e5484d", 1300], [84, 50, "#f5d27a", 1700], [70, 38, "#8cc4ec", 2100],
  [46, 92, "#f5d27a", 1500], [64, 82, "#e5484d", 1900], [92, 88, "#8cc4ec", 1100],
  [80, 100, "#dfa0d4", 2300], [34, 130, "#e5484d", 1600], [54, 122, "#8cc4ec", 2000],
  [78, 126, "#f5d27a", 1200], [100, 122, "#e5484d", 1800], [112, 136, "#dfa0d4", 1400],
  [64, 140, "#f5d27a", 2200],
];

// Snowflakes drifting in place: [x, y, size, sway period ms]. (A loop swings back, so they sway rather than fall.)
const SNOW = [
  [14, 20, 10, 5200], [40, 120, 8, 6800], [222, 30, 11, 6000], [244, 110, 8, 7400],
  [24, 70, 7, 8200], [232, 168, 9, 5600], [16, 170, 8, 6400], [210, 76, 7, 7000],
];


// Top fade: from the sidebar gray (#eef1f4) above into the tree pink (#f9e3eb).
// div().bg() takes one solid color, so thin strips stack into a gradient.
const FADE_FROM = [0xee, 0xf1, 0xf4], FADE_TO = [0xf9, 0xe3, 0xeb];
const FADE_H = 104, FADE_STEP = 2;
const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");
const FADE = Array.from({ length: FADE_H / FADE_STEP }, (_, i) => {
  const k = i / (FADE_H / FADE_STEP - 1);
  const e = k * k * (3 - 2 * k); // smoothstep
  return "#" + FADE_FROM.map((a, j) => hex2(a + (FADE_TO[j] - a) * e)).join("");
});

export default class XmasTree extends View {
  init() {
    this.width = 268;
    this.height = 200;
  }

  render() {
    const t = theme();
    const treeW = 140, treeH = 170;
    const left = Math.max(0, (this.width - treeW) / 2);
    const top = Math.max(0, this.height - treeH - 15); // tree at the bottom, the fade above

    const tree = div().absolute().left(left).top(top).w(treeW).h(treeH)
      // Soft glow behind the star.
      .child(div().absolute().left(treeW / 2 - 14).top(3).size(28).rounded(14).bg("#f5d27a")
        .opacity(0.25).loop("opacity", { from: 0.08, to: 0.4, period: 1800 }))
      .child(image("mods/xmas-tree/tree.svg").absolute().left(0).top(0).w(treeW).h(treeH))
      .children(LIGHTS.map(([x, y, c, p]) =>
        div().absolute().left(x - 3.5).top(y - 3.5).size(7).rounded(3.5).bg(c)
          .loop("opacity", { from: 0.25, to: 1, period: p })));

    const snow = SNOW.map(([x, y, size, p]) =>
      div().absolute().top(y).text_size(size).text_color("#e79ab3").child("❄")
        .left(x).loop("left", { from: x - 6, to: x + 6, period: p })
        .opacity(0.7).loop("opacity", { from: 0.3, to: 0.9, period: p * 0.7 }));

    return div().id("xmas-tree-root").relative().size_full().overflow_hidden().bg("#f9e3eb") // pink tree area
      .on_size_change((size, cx) => {
        if (size.width !== this.width || size.height !== this.height) {
          this.width = size.width;
          this.height = size.height;
          cx.notify();
        }
      })
      .children(FADE.map((c, i) => div().absolute().left(0).top(i * FADE_STEP).w_full().h(FADE_STEP).bg(c)))
      .children(snow)
      .child(tree);
  }
}
