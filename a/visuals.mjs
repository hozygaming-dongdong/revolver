const paths = {
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
  empty: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="7" fill="#06090b" stroke-width="1"/>',
  supply: '<path d="M3 7l9-4 9 4v13H3zM3 7h18M9 7v13m6-13v13M5 3l3 4m8-4 3 4"/>',
  breach: '<path d="M3 5l7 7-7 7m10-14 7 7-7 7" stroke-width="3"/>',
  exit: '<path d="M15 3h6v18h-6M11 12h10m-4-4 4 4-4 4M9 8l-3 4 5 3-2 6M6 12l-4 6M9 8l4 4"/><circle cx="11" cy="4" r="2"/>',
  coin: '<ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 7v9c0 5 16 5 16 0V7M4 12c0 5 16 5 16 0"/>',
  chips: '<circle cx="12" cy="12" r="10" fill="#702c23" stroke="#f4d6a3"/><circle cx="12" cy="12" r="6" stroke="#f4d6a3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3M16 8l3-3" stroke="#f4d6a3" stroke-width="2.3"/>',
  skull: '<path d="M6 17c-3-3-4-5-3-8C4 1 20 1 21 9c1 3 0 5-3 8v4H6zM9 18v3m6-3v3"/><circle cx="8" cy="11" r="2" fill="currentColor"/><circle cx="16" cy="11" r="2" fill="currentColor"/><path d="M11 15h2"/>',
  check: '<path d="M4 12l5 5L20 6" stroke-width="3"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8l6 8m0-8-6 8"/>',
  radio: '<path d="M8 16h8V8H8zM10 4h4m-8 6c-3 2-3 5 0 7m12-7c3 2 3 5 0 7M12 16v5m-4 0h8"/>',
  bullet: '<path d="M8 20V9l4-7 4 7v11zM8 9h8M7 20h10"/>',
  spin: '<path d="M20 8A8 8 0 0 0 6 5L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  fire: '<path d="M14 2c0 7 7 8 5 15-1 7-15 6-15-2 0-4 3-6 5-8-1 4 1 6 3 6 3-3 0-7 2-11z"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
};

export const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.target}</svg>`;
let serial = 0;

export function cylinder(chambers, { added = -1, large = false, pointer = false } = {}) {
  const id = `c${serial++}`;
  const holes = chambers.map((loaded, i) => {
    const angle = i * Math.PI / 3 - Math.PI / 2;
    const x = 150 + Math.cos(angle) * 88, y = 150 + Math.sin(angle) * 88;
    return `<g data-slot="${i}" class="chamber ${loaded ? 'loaded' : ''} ${i === added ? 'added' : ''}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><circle r="37" fill="#15191b" stroke="#b6a88a" stroke-width="2.4"/><circle class="hole" r="32" fill="url(#${id}hole)"/><g class="cartridge" opacity="${loaded ? 1 : 0}"><circle r="31" fill="url(#${id}brass)" stroke="#f9cc6b" stroke-width="1.2"/><circle r="25.5" fill="none" stroke="#9e681d" stroke-width="1.3"/><circle r="11" fill="url(#${id}primer)" stroke="#704912" stroke-width="1.5"/><path d="M-15-19q15-9 30 0M-15 19q15 9 30 0" fill="none" stroke="#9b6a26" stroke-width="1" opacity=".7"/></g><circle class="selection" r="36" fill="none" stroke-width="4"/></g>`;
  }).join('');
  const bolts = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6;
    return `<circle cx="${150 + Math.cos(a) * 132}" cy="${150 + Math.sin(a) * 132}" r="2.7" fill="#151718" stroke="#978a70" stroke-width=".7"/>`;
  }).join('');
  return `<div class="dial ${large ? 'large' : ''}" role="img" aria-label="Cylinder: ${chambers.filter(Boolean).length} loaded, ${chambers.filter(v => !v).length} empty">${pointer ? '<span class="pin" aria-hidden="true"></span>' : ''}<div class="rotor"><svg viewBox="0 0 300 300" aria-hidden="true"><defs><radialGradient id="${id}steel" cx="30%" cy="20%" r="90%"><stop stop-color="#b3b0a8"/><stop offset=".25" stop-color="#4c5050"/><stop offset=".55" stop-color="#262c2e"/><stop offset=".8" stop-color="#6e6b63"/><stop offset="1" stop-color="#171b1c"/></radialGradient><radialGradient id="${id}hole"><stop stop-color="#020405"/><stop offset=".75" stop-color="#080c0d"/><stop offset="1" stop-color="#262927"/></radialGradient><linearGradient id="${id}brass" x2=".8" y2="1"><stop stop-color="#fff0a8"/><stop offset=".23" stop-color="#c48a2e"/><stop offset=".5" stop-color="#f7c363"/><stop offset=".76" stop-color="#a76b21"/><stop offset="1" stop-color="#e4b45f"/></linearGradient><radialGradient id="${id}primer" cx="30%" cy="25%"><stop stop-color="#ffdf8f"/><stop offset="1" stop-color="#aa6c25"/></radialGradient></defs><circle cx="150" cy="150" r="146" fill="#0b0e10" stroke="#6d5941" stroke-width="2"/><circle cx="150" cy="150" r="141" fill="url(#${id}steel)" stroke="#c3b49a" stroke-width="2"/><circle cx="150" cy="150" r="137" fill="none" stroke="#211e1a" stroke-width="1"/>${bolts}${holes}<circle cx="150" cy="150" r="28" fill="url(#${id}steel)" stroke="#c9b391" stroke-width="3"/><circle cx="150" cy="150" r="21" fill="#333738" stroke="#171a1a" stroke-width="2"/><path d="M137 163l26-26" stroke="#0c1011" stroke-width="6"/><path d="M137 161l24-24" stroke="#8b8d82" stroke-width="1.6"/></svg></div></div>`;
}
