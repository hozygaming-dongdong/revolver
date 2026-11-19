import { JACKPOT_SLOT, jackpotOdds, ordinaryOdds, prizeSlots } from './engine.mjs';
import { prizeMark, prizeName, sealMark } from './loot.mjs';

export const percent = probability => `${(100 * probability).toFixed(3)}%`;
export const multiplierLabel = value => `${value}×`;

export function bountySlot(value, index, selected = false) {
  const radians = (index * 30 - 90) * Math.PI / 180;
  const left = (150 + 113 * Math.cos(radians)).toFixed(2), top = (150 + 113 * Math.sin(radians)).toFixed(2);
  const jackpot = index === JACKPOT_SLOT;
  const respin = value === null;
  const title = respin ? 'Respin · Black Box +2×' : `${prizeName(value)} · ${multiplierLabel(value)}`;
  const icon = respin ? sealMark(-13, -17, 1.08) : `<g transform="translate(0 -7)">${prizeMark(value)}</g>`;
  return `<g transform="translate(${left} ${top})" data-slot="${index}" class="bounty-slot${respin ? ' respin-slot' : jackpot ? ' jackpot-slot' : ''}${selected ? ' selected' : ''}"><title>${title} · ${percent(jackpot ? jackpotOdds(0) : ordinaryOdds)} per spin</title><circle class="socket" r="25"/><circle class="seat" r="22"/>${icon}<text class="slot-value" y="13">${respin ? 'RE-SPIN' : multiplierLabel(value)}</text><circle class="slot-stop" r="25"/></g>`;
}

export function bountyWheel(tokens, jackpot, { selected, compact = false } = {}) {
  const id = compact ? 'mini' : 'bx';
  return `<div class="bounty-dial${compact ? ' compact' : ''}"${compact ? '' : ' id="wheel"'} role="img" aria-label="Twelve chamber bounty cylinder. ${tokens} respin chambers. Black Box ${multiplierLabel(jackpot)}."><span class="pin" aria-hidden="true"></span><div class="rotor" style="transform:rotate(${selected === undefined ? 0 : -selected * 30}deg)"><svg viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="${id}-rim" x2=".8" y2="1"><stop stop-color="#ffe5aa"/><stop offset=".23" stop-color="#5c492e"/><stop offset=".49" stop-color="#d3b984"/><stop offset=".7" stop-color="#4b3b25"/><stop offset="1" stop-color="#a88a52"/></linearGradient><radialGradient id="${id}-steel" cx="37%" cy="31%" r="70%"><stop stop-color="#5a625d"/><stop offset=".46" stop-color="#283237"/><stop offset=".78" stop-color="#384046"/><stop offset=".96" stop-color="#20282c"/><stop offset="1" stop-color="#0a1015"/></radialGradient><radialGradient id="${id}-socket"><stop stop-color="#223936"/><stop offset=".8" stop-color="#132124"/><stop offset="1" stop-color="#050b11"/></radialGradient><radialGradient id="${id}-hub"><stop stop-color="#202c31"/><stop offset=".78" stop-color="#43494a"/><stop offset=".88" stop-color="#11191d"/><stop offset="1" stop-color="#85877d"/></radialGradient></defs><circle cx="150" cy="150" r="148" fill="url(#${id}-rim)"/><circle cx="150" cy="150" r="144" fill="url(#${id}-steel)" stroke="#13191b" stroke-width="3"/><circle cx="150" cy="150" r="140.5" fill="none" stroke="#ad97754d"/><circle cx="150" cy="150" r="89" fill="none" stroke="#aaa2813d"/>${prizeSlots(tokens, jackpot).map((value, i) => bountySlot(value, i, selected === i)).join('')}<circle cx="150" cy="150" r="62" fill="url(#${id}-rim)" stroke="#141b1e" stroke-width="2"/><circle cx="150" cy="150" r="54" fill="url(#${id}-hub)" stroke="#181a18" stroke-width="2"/><circle cx="150" cy="150" r="46" fill="none" stroke="#c7af7355"/><path d="M131 168l38-36m-36 39 38-36" stroke="#131b1d" stroke-width="2.4"/></svg></div></div>`;
}
