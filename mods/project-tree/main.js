// Agents grouped by project folder: each folder is a header, and every tab (agent) started there sits under it as a tree.
// Spaces that share a folder merge into one project.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, theme, run, pickFolder, setAgentOrder, home } from "herdr";

const ICON = "mods/workspace-chrome";
const TILES = ["#5b7fd6", "#3fa46a", "#8b6cd9", "#2a9d8f", "#e07a4f", "#c2569b", "#5f7891"];
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const norm = (p) => (p ?? "").replace(/[\\/]+$/, "").toLowerCase();
const base = (p) => (p ?? "").replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "~";
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export default class ProjectTree extends View {
  init() {
    try { this.folded = new Set(JSON.parse(localStorage.getItem("folded") ?? "[]")); } catch { this.folded = new Set(); }
    this.hovered = null;
  }

  toggle(key, cx) {
    this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
    localStorage.setItem("folded", JSON.stringify([...this.folded]));
    cx.notify();
  }

  // Spaces grouped by folder; one row per tab.
  projects() {
    const byTab = new Map();
    for (const a of agents()) if (!byTab.has(a.tab) || RANK[a.status] > RANK[byTab.get(a.tab).status]) byTab.set(a.tab, a);
    const groups = new Map();
    const homeKey = norm(home());
    for (const s of spaces()) {
      // A space on another machine is its own project, even at the same path.
      const key = (s.machine ? `${s.machine}:` : "") + (norm(s.folder) || homeKey);
      if (!groups.has(key)) {
        const atHome = !s.machine && key === homeKey;
        const name = s.named ? s.name : atHome ? "home" : base(s.folder);
        groups.set(key, { key, name, folder: s.folder, space: s.id, machine: s.machine, active: false, items: [] });
      }
      const g = groups.get(key);
      if (s.active) g.active = true;
      for (const tab of s.tabs) {
        const a = byTab.get(tab.id);
        g.items.push({ space: s.id, tab, agent: a, status: a?.status ?? null });
      }
    }
    return [...groups.values()];
  }

  status(t, st) {
    if (st === "working") return svg(`${ICON}/spinner.svg`).size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (st === "blocked") return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (st === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    if (st === "done") return div().size(7).mx(3).flex_none().rounded(4).bg(t.done);
    return div().size(7).mx(3).flex_none();
  }

  open(item) {
    if (item.agent) run("pane.focus", { pane: item.agent.pane });
    else { run("space.select", { id: item.space }); run("tab.select", { id: item.tab.id }); }
  }

  header(t, g, open) {
    const n = g.items.length;
    const needs = g.items.some((i) => i.status === "blocked");
    const top = g.items.reduce((m, i) => ((RANK[i.status] ?? 0) > (RANK[m] ?? 0) ? i.status : m), null);
    const hover = this.hovered === g.key;
    const tile = TILES[hash(g.key) % TILES.length];
    return h_flex()
      .id(`pj-${g.key}`)
      .h(32).px(8).mt(4).flex_none().gap(8).items_center().rounded(8)
      .when(g.active, (el) => el.bg(t.selected))
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_hover((on, cx) => { this.hovered = on ? g.key : this.hovered === g.key ? null : this.hovered; cx.notify(); })
      .on_click((_e, cx) => this.toggle(g.key, cx))
      .child(div().size(18).flex_none().rounded(5).bg(tile + "2e").text_color(tile).text_size(10.5).font_bold()
        .flex().items_center().justify_center().child(g.name.slice(0, 1).toUpperCase()))
      .child(div().min_w(0).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(g.name))
      .child(div().flex_none().text_size(11).text_color(t.accent).child(String(n)))
      .child(div().flex_1())
      .when(needs, (el) => el.child(div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5)
        .font_semibold().text_color(t.blocked).flex().items_center().child("Needs you")))
      .when(!needs && !open && top && top !== "idle", (el) => el.child(this.status(t, top)))
      .when(hover, (el) => el.child(div().id(`pj-add-${g.key}`).flex_none().p(2).rounded(4).text_color(t.dim)
        .hover((s) => s.bg(t.raised).text_color(t.foreground))
        .tooltip("New Claude in this folder")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("tab.new", { space: g.space, folder: g.folder, argv: ["claude"] });
        })
        .child(svg(`${ICON}/plus.svg`).size(13))))
      .child(svg(`${ICON}/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim));
  }

  row(t, item, last) {
    const a = item.agent;
    const p = a?.program;
    const pic = p?.icon ? (p.tint ? svg(p.icon).size(14).flex_none().text_color(t.foreground) : image(p.icon).w(14).h(14).flex_none())
      : svg(`${ICON}/terminal.svg`).size(14).flex_none().text_color(t.dim);
    const title = item.tab.named ? item.tab.name : clean(a?.title) || p?.name || `tab ${item.tab.name}`;
    const on = a?.focused || (item.tab.active && spaces().find((s) => s.id === item.space)?.active);
    const quiet = item.status === "idle" && !on;
    return h_flex()
      .id(`pt-${item.tab.id}`)
      .h(28).pl(16).pr(8).flex_none().items_center().rounded(8)
      .when(on, (el) => el.bg(t.raised))
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.open(item))
      // Tree line: the last row ends in a corner, the others run on down.
      .child(div().relative().w(12).h(28).mr(8).flex_none()
        .child(div().absolute().left(0).top(0).w(10).h(14).border_l(1.5).border_b(1.5).rounded_bl(6).border_color(t.input))
        .when(!last, (el) => el.child(div().absolute().left(0).top(14).w(1).h(14).border_l(1.5).border_color(t.input))))
      .child(div().mr(8).child(pic))
      .child(div().flex_1().min_w(0).truncate().text_size(12.8).text_color(quiet ? t.muted : t.foreground).child(title))
      .child(this.status(t, item.status));
  }

  render() {
    const t = theme();
    const groups = this.projects();
    setAgentOrder(groups.flatMap((g) => g.items.filter((i) => i.agent).map((i) => i.agent.address)));
    const total = groups.reduce((n, g) => n + g.items.filter((i) => i.agent).length, 0);
    const rows = groups.flatMap((g) => {
      const open = !this.folded.has(g.key);
      return [this.header(t, g, open), ...(open ? g.items.map((i, k) => this.row(t, i, k === g.items.length - 1)) : [])];
    });
    return v_flex()
      .size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().px(16).h(41).pt(14).pb(5).flex_none().items_center().justify_between()
        .child(h_flex().gap(6).items_center()
          .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Projects"))
          .child(div().text_size(11).text_color(t.dim).child(`· ${total} agents`)))
        .child(div().id("pj-new").p(2).rounded(4).text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip("Add a project folder")
          .on_click((_e, cx) => cx.spawn(async () => {
            const folder = await pickFolder({ prompt: "Project folder" });
            if (folder) run("space.new", { folder, argv: ["claude"] });
          }))
          .child(svg(`${ICON}/folder-plus.svg`).size(14))))
      .child(v_flex().id("pj-list").flex_1().min_h(0).px(8).pb(8).overflow_y_scrollbar().children(rows));
  }
}
