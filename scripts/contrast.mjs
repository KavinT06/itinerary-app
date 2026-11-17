// WCAG 2.x contrast for the Dusk Horizon tokens. sRGB alpha blends for derived surfaces.
const T = {
  night: '#0D1530', night2: '#1A2550', saffron: '#F6B84B', saffronHover: '#F7C366',
  saffronDisabled: '#FCE6C0', budgetChip: '#FDF2DF', paper: '#F6F2EA', surface: '#FFFFFF',
  sunken: '#EFEAE0', ink: '#131A2C', muted: '#575E70', hairline: '#E3DCCF', control: '#8A8476',
  onNight: '#F6F2EA', onNightMuted: '#A9B2CB', warningBg: '#FCEFD2', warningInk: '#7A4A00',
  dangerBg: '#FCE9E6', dangerInk: '#A21F1A', focus: '#3D74F0',
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const blend = (fg, a, bg) => hex(rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a)));
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const D = {
  glow: blend(T.saffron, 0.15, T.night),          // peak of the horizon glow
  badge: blend(T.saffron, 0.20, T.night),         // pill badge fill on the hero
  glass: blend(T.night2, 0.70, T.night),          // hero glass card fill
  navOverNight: blend(T.paper, 0.85, T.night),    // condensed nav, worst case (over the hero)
  navOverSurface: blend(T.paper, 0.85, T.surface),
};
console.log('Derived:', D);

// [label, fg, bg, minimum]  4.5 text, 3 large text / UI, 0 = decorative or reference only
const rows = [
  ['on-night on night (hero text)', T.onNight, T.night, 4.5],
  ['on-night on night-2', T.onNight, T.night2, 4.5],
  ['on-night on glow peak', T.onNight, D.glow, 4.5],
  ['on-night-muted on night (hero subtext, facts)', T.onNightMuted, T.night, 4.5],
  ['on-night-muted on night-2', T.onNightMuted, T.night2, 4.5],
  ['on-night-muted on glow peak', T.onNightMuted, D.glow, 4.5],
  ['saffron on night (h1 key words)', T.saffron, T.night, 4.5],
  ['saffron on night-2', T.saffron, T.night2, 4.5],
  ['saffron on glow peak', T.saffron, D.glow, 4.5],
  ['saffron on badge fill', T.saffron, D.badge, 4.5],
  ['on-night on glass card', T.onNight, D.glass, 4.5],
  ['on-night-muted on glass card', T.onNightMuted, D.glass, 4.5],
  ['ink on paper', T.ink, T.paper, 4.5],
  ['ink on surface', T.ink, T.surface, 4.5],
  ['ink on sunken (AI notice, read-only input)', T.ink, T.sunken, 4.5],
  ['muted on paper', T.muted, T.paper, 4.5],
  ['muted on surface (hints, placeholder)', T.muted, T.surface, 4.5],
  ['muted on sunken', T.muted, T.sunken, 4.5],
  ['night on saffron (primary button)', T.night, T.saffron, 4.5],
  ['ink on saffron', T.ink, T.saffron, 4.5],
  ['night on saffron-hover', T.night, T.saffronHover, 4.5],
  ['ink on saffron-disabled (Please wait Ns)', T.ink, T.saffronDisabled, 4.5],
  ['muted on saffron-disabled (NOT used)', T.muted, T.saffronDisabled, 0],
  ['ink on budget-chip (figure)', T.ink, T.budgetChip, 4.5],
  ['muted on budget-chip (label)', T.muted, T.budgetChip, 4.5],
  ['ink on warning-bg (banner heading, message)', T.ink, T.warningBg, 4.5],
  ['warning-ink on warning-bg (icon, rule)', T.warningInk, T.warningBg, 4.5],
  ['muted on warning-bg (retry hint)', T.muted, T.warningBg, 4.5],
  ['ink on danger-bg', T.ink, T.dangerBg, 4.5],
  ['danger-ink on danger-bg', T.dangerInk, T.dangerBg, 4.5],
  ['muted on danger-bg', T.muted, T.dangerBg, 4.5],
  ['danger-ink on surface (field error, invalid border)', T.dangerInk, T.surface, 4.5],
  ['danger-ink on paper', T.dangerInk, T.paper, 4.5],
  ['warning-ink on surface', T.warningInk, T.surface, 4.5],
  ['ink on condensed nav over night (worst case)', T.ink, D.navOverNight, 4.5],
  ['ink on condensed nav over surface', T.ink, D.navOverSurface, 4.5],
  ['control vs surface (input border)', T.control, T.surface, 3],
  ['control vs paper', T.control, T.paper, 3],
  ['control vs sunken (read-only input)', T.control, T.sunken, 3],
  ['focus vs night', T.focus, T.night, 3],
  ['focus vs night-2', T.focus, T.night2, 3],
  ['focus vs glow peak', T.focus, D.glow, 3],
  ['focus vs paper', T.focus, T.paper, 3],
  ['focus vs surface', T.focus, T.surface, 3],
  ['focus vs sunken', T.focus, T.sunken, 3],
  ['focus vs warning-bg', T.focus, T.warningBg, 3],
  ['focus vs danger-bg', T.focus, T.dangerBg, 3],
  ['focus vs budget-chip', T.focus, T.budgetChip, 3],
  ['focus vs condensed nav over surface', T.focus, D.navOverSurface, 3],
  ['focus vs saffron (why the offset is required)', T.focus, T.saffron, 0],
  ['night ring (timeline dot) vs surface', T.night, T.surface, 3],
  ['night ring (timeline dot) vs paper', T.night, T.paper, 3],
  ['saffron vs surface (fill only, never text)', T.saffron, T.surface, 0],
  ['saffron vs paper (fill only, never text)', T.saffron, T.paper, 0],
  ['hairline vs paper (decorative)', T.hairline, T.paper, 0],
  ['hairline vs surface (decorative)', T.hairline, T.surface, 0],
];
console.log('| Pair | Foreground | Background | Ratio | Needs | Result |');
console.log('|---|---|---|---|---|---|');
for (const [label, fg, bg, min] of rows) {
  const r = ratio(fg, bg);
  const res = min === 0 ? 'n/a' : r >= min ? 'pass' : 'FAIL';
  console.log(`| ${label} | \`${fg}\` | \`${bg}\` | ${r.toFixed(2)}:1 | ${min === 0 ? '-' : min + ':1'} | ${res} |`);
}
