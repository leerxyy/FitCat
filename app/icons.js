const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><path d="M4 18h16M8 6h7M8 10h5"/>',
  leaf: '<path d="M20 3c-9-1-16 2-16 9a7 7 0 0 0 7 7c7 0 10-7 9-16Z"/><path d="m3 21 11-11M8 16v-5M8 16h5"/>',
  chart: '<path d="M4 3v17h17M8 15v-4M13 15V6M18 15V9"/>',
  library: '<rect x="3" y="3" width="6" height="18" rx="1.5"/><rect x="12" y="3" width="6" height="18" rx="1.5" transform="rotate(-10 12 12)"/><path d="M5 7h2M14 7l2-.3M5 17h2"/>',
  settings: '<path d="m9 3-.5 2-2 .9-1.9-.5-2 3.4L4 10.5v2.2l-1.4 1.7 2 3.4 2-.4 2 .9L9 21h4l.5-2.7 2-.9 2 .4 2-3.4-1.5-1.7v-2.2l1.5-1.7-2-3.4-2 .5-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  upRight: '<path d="M6 18 18 6M6 6h12v12"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13Z"/>',
  bowl: '<path d="M3 10h18a9 9 0 0 1-18 0ZM8 21h8M8 6l1-3M13 6l1-3M18 6l1-3"/>',
  apple: '<path d="M12 6c0-3 2-4 4-4M12 6C9 3 3 5 3 11c0 4 3 10 6 10 1.5 0 2-1 3-1s1.5 1 3 1c3 0 6-6 6-10 0-6-6-8-9-5Z"/>',
  drop: '<path d="M12 3C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-12Z"/><path d="M8 15a4 4 0 0 0 3 4"/>',
  walk: '<circle cx="14" cy="3.5" r="1.7"/><path d="m7 21 3-6 3 3v4M16 13l-3-3-2 4-3-2-3 2M10 10l2-4 3 1 2 4h3"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/>',
  heart: '<path d="m12 21-8.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 8.5 7Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  spark: '<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7 8a7 7 0 0 1 10 0l-5 5ZM12 7v3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01"/>',
  play: '<path d="m9 4 12 8-12 8Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  coffee: '<path d="M3 8h14v7a6 6 0 0 1-12 0V8M17 9h2a3 3 0 0 1 0 6h-2M7 2v3M12 2v3M2 22h18"/>',
};
export function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`; }
export function brandMark(cls = '') { return `<svg class="brand-mark ${cls}" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="21.5" stroke="currentColor" stroke-width=".9" opacity=".65"/><path d="M14 12h11a7 7 0 0 1 0 14h-8m0-14v24m-4 0h9m2-10 10 10h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }

export function foodArt(kind = 'bowl', photoId = null) {
  if (['toast', 'bowl', 'yogurt', 'chicken', 'oats', 'lentils'].includes(photoId)) return `<img class="food-art recipe-photo" src="assets/recipe-${photoId}.webp" width="1536" height="1024" alt="" loading="lazy" decoding="async">`;
  const base = '<ellipse cx="160" cy="154" rx="102" ry="35" fill="#243d31" opacity=".1"/><circle cx="160" cy="125" r="88" fill="#faf8f0"/><circle cx="160" cy="125" r="74" fill="#e6e4d7"/>';
  const filling = kind === 'toast'
    ? '<g transform="rotate(-14 160 125)"><rect x="102" y="67" width="116" height="115" rx="24" fill="#a96d3f"/><rect x="108" y="72" width="104" height="102" rx="20" fill="#d3a774"/><path d="M119 91q45-26 79 7l-6 53q-38 25-74-8Z" fill="#78905b"/><path d="m128 93 52 63m-37-68 49 55m-65-27 40 46" stroke="#b5c087" stroke-width="6" stroke-linecap="round"/><path d="M133 114c-6-32 54-43 61-7 12 14-5 40-27 36-33 6-50-15-34-29Z" fill="#fffaf0"/><circle cx="168" cy="117" r="18" fill="#e5a44d"/></g><circle cx="102" cy="153" r="13" fill="#b76c50"/><circle cx="218" cy="94" r="11" fill="#b76c50"/>'
    : kind === 'yogurt'
      ? '<circle cx="160" cy="125" r="68" fill="#fffdf8"/><path d="M118 107q38-30 83 7m-82 25q43 24 79-5" stroke="#e6ded2" stroke-width="5" fill="none" stroke-linecap="round"/><g fill="#586375"><circle cx="131" cy="98" r="10"/><circle cx="149" cy="91" r="9"/><circle cx="118" cy="114" r="8"/><circle cx="146" cy="112" r="9"/></g><g fill="#a65c59"><circle cx="182" cy="144" r="12"/><circle cx="197" cy="132" r="10"/><circle cx="194" cy="157" r="9"/></g><g fill="#bda078"><ellipse cx="177" cy="95" rx="6" ry="11" transform="rotate(40 177 95)"/><ellipse cx="135" cy="155" rx="6" ry="11" transform="rotate(-30 135 155)"/><ellipse cx="156" cy="160" rx="5" ry="9"/></g>'
      : '<g fill="#8a9c67"><ellipse cx="120" cy="97" rx="15" ry="26" transform="rotate(-35 120 97)"/><ellipse cx="111" cy="125" rx="14" ry="25" transform="rotate(-65 111 125)"/><ellipse cx="133" cy="144" rx="15" ry="26" transform="rotate(20 133 144)"/></g><path d="m150 78 54 30-27 51-51-29Z" fill="#d69074"/><path d="m154 90 38 22m-44-9 38 22m-43-9 36 21" stroke="#edb49a" stroke-width="4"/><g fill="#b9ad84"><circle cx="182" cy="167" r="6"/><circle cx="194" cy="162" r="6"/><circle cx="201" cy="150" r="6"/><circle cx="171" cy="174" r="6"/><circle cx="187" cy="179" r="6"/></g><g fill="#748866"><circle cx="198" cy="84" r="14"/><circle cx="213" cy="101" r="14"/></g><g fill="#b8c294"><circle cx="198" cy="84" r="9"/><circle cx="213" cy="101" r="9"/></g>';
  return `<svg class="food-art" viewBox="0 0 320 225" fill="none" aria-hidden="true">${base}${filling}<path d="M263 72v104m-8-103v32m16-32v32m-16 0h16" stroke="#a6a397" stroke-width="4" stroke-linecap="round"/></svg>`;
}
