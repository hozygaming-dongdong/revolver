const sealShape = '<path d="M12 2 21 7v10l-9 5-9-5V7z" fill="#53321b"/><path d="M8 8l8 8m0-8-8 8" stroke-width="2.5"/>';
const prizes = {
  0.5: ['Patrol Tag', '#c3bca6', '<path d="M4 6h10l6 6-8 8-8-8z" fill="#3b382f"/><circle cx="8" cy="10" r="1.5"/>'],
  0.75: ['Power Cell', '#b6c6a0', '<rect x="6" y="5" width="12" height="16" rx="2" fill="#354139"/><path d="M9 5V2h6v3m-3 3-3 5h5l-2 5"/>'],
  1: ['Rations', '#cbd5a1', '<path d="m4 8 8-4 8 4v9l-8 4-8-4z" fill="#414733"/><path d="m4 8 8 4 8-4m-8 4v9m-4-15 8 4"/>'],
  1.25: ['Aid Kit', '#a5e0c1', '<rect x="3" y="5" width="18" height="15" rx="3" fill="#274c41"/><path d="M9 5V3h6v2m-3 4v7m-3.5-3.5h7" stroke-width="2"/>'],
  1.5: ['Field Radio', '#a5daef', '<rect x="4" y="7" width="16" height="14" rx="2" fill="#284750"/><path d="M7 7V2m2 10h5m-5 4h5m3-4h.01"/>'],
  2: ['Antidote', '#bcdfc4', '<path d="M9 3h6v4l3 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8l3-4z" fill="#375248"/><path d="M9 7h6m-9 7h12m-7 3h2"/>'],
  2.5: ['Tool Case', '#c0d6ec', '<rect x="3" y="8" width="18" height="12" rx="2" fill="#37445c"/><path d="M8 8V5h8v3M3 13h18m-10-1v3h2v-3"/>'],
  4: ['Supply Crate', '#e8c78a', '<path d="M3 6h18v13H3z" fill="#5e4830"/><path d="M3 9h18M7 6v13M17 6v13m-7-7h4v3h-4z"/>'],
  8: ['Black Box', '#ffe29c', '<path d="m4 7 3-3h10l3 3v13H4z" fill="#70421d"/><path d="M4 8h16M7 12h10v4H7z"/><circle cx="10" cy="14" r=".6" fill="currentColor"/><circle cx="14" cy="14" r=".6" fill="currentColor"/>'],
};

const svg = (shape, css, color) => `<svg class="${css}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${shape}</svg>`;
export const seal = () => svg(sealShape, 'seal-icon', '#ffd588');
export const prizeName = value => prizes[value][0];
export const prizeIcon = value => svg(prizes[value][2], 'loot-icon', prizes[value][1]);
export const prizeMark = (value, cx, cy) => `<g class="loot-mark" aria-hidden="true" transform="translate(${cx-12} ${cy-12})" color="${prizes[value][1]}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${prizes[value][2]}</g>`;
export const sealMark = (cx, cy) => `<g aria-hidden="true" transform="translate(${cx} ${cy}) scale(.65)" fill="none" stroke="#ffd588" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${sealShape}</g>`;
