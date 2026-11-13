const app = document.querySelector('#app');
const screens = [...document.querySelectorAll('[data-screen]')].filter(node => node !== app);
const stateLabel = document.querySelector('#state-label');
const targetType = document.querySelector('#target-type');
const targetTitle = document.querySelector('#target-title');
const targetCopy = document.querySelector('#target-copy');
const shotResult = document.querySelector('#shot-result');
const targets = { supply: ['SUPPLY TARGET', '補給獵物', '命中後，彈巢會得到新的選擇。'], bounty: ['BOUNTY TARGET', '賞金獵物', '命中後，獎金池會得到新的籌碼。'] };

function show(screen) {
  app.dataset.screen = screen;
  screens.forEach(node => { node.hidden = node.dataset.screen !== screen; });
  stateLabel.textContent = ({ start: 'READY', doors: 'DECIDE', target: 'AIM', shot: 'FIRE', reward: 'DRAW' })[screen];
}

function selectDoor(type) {
  const [label, title, copy] = targets[type];
  targetType.textContent = label;
  targetTitle.textContent = title;
  targetCopy.textContent = copy;
  show('target');
}

function fire() {
  app.classList.add('firing');
  shotResult.querySelector('strong').textContent = '…';
  shotResult.querySelector('small').textContent = '彈巢旋轉中';
  setTimeout(() => {
    app.classList.remove('firing');
    shotResult.querySelector('strong').textContent = 'HIT';
    shotResult.querySelector('small').textContent = '命中目標 · 獎勵已解鎖';
  }, 900);
}

app.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const door = event.target.closest('[data-door]')?.dataset.door;
  if (action === 'start') show('doors');
  if (action === 'aim') show('shot');
  if (action === 'fire') { fire(); setTimeout(() => show('reward'), 1400); }
  if (action === 'next') show('doors');
  if (door) selectDoor(door);
});

show('start');
