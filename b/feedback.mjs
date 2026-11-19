export function soundscape() {
  let context, master, muted = false;
  function start() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      master = context.createGain();
      master.gain.value = muted ? 0 : .65;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
  }
  function tone(from, to, seconds, gain, wave = 'sine', delay = 0) {
    if (!context || muted) return;
    const osc = context.createOscillator(), envelope = context.createGain(), t = context.currentTime+delay;
    osc.type = wave;
    osc.frequency.setValueAtTime(from,t); osc.frequency.exponentialRampToValueAtTime(to,t+seconds);
    envelope.gain.setValueAtTime(gain,t); envelope.gain.exponentialRampToValueAtTime(.0001,t+seconds);
    osc.connect(envelope).connect(master); osc.start(t); osc.stop(t+seconds);
  }
  function noise(seconds, gain, cutoff, type = 'lowpass', delay = 0) {
    if (!context || muted) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate*seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length)**3;
    const source=context.createBufferSource(), filter=context.createBiquadFilter(), amp=context.createGain();
    source.buffer=buffer;
    filter.type=type; filter.frequency.value=cutoff;
    amp.gain.value=gain;
    source.connect(filter).connect(amp).connect(master);
    source.start(context.currentTime+delay);
  }
  return {
    start,
    toggle() { start(); muted = !muted; if (master) master.gain.value = muted ? 0 : .65; return muted; },
    step(i) {
      const heavy = i%2 === 0;
      tone(heavy ? 90 : 113, 43, .18, .20);
      noise(.15, heavy ? .27 : .19, 510);
      noise(.095, .12, 950, 'bandpass', .022);
    },
    open() { noise(.095,.19,970,'bandpass'); tone(510,240,.105,.06,'triangle'); },
    load() { tone(1730,680,.081,.10,'triangle'); noise(.054,.24,2680,'bandpass'); },
    close() { tone(930,260,.108,.11,'triangle'); noise(.08,.25,2300); },
    seal() { tone(1050,665,.1,.06,'triangle'); tone(1560,980,.11,.04,'triangle',.036); },
    tick() { noise(.024,.16,2800); tone(780,335,.023,.026,'triangle'); },
    tension() { tone(67,38,2.45,.085); },
    fire() {
      noise(.082,.82,2500,'highpass');
      noise(.28,.54,1300);
      tone(148,34,.27,.32);
      noise(.30,.17,620,'lowpass',.108);
    },
    empty() { noise(.045,.28,2100,'bandpass'); tone(810,290,.063,.105,'triangle'); tone(88,34,.47,.23,'sawtooth',.13); },
    travel() { noise(.38,.13,600); tone(94,39,.32,.052); },
    win() { tone(440,440,.55,.055); tone(554,554,.60,.048,'sine',.11); tone(660,660,.70,.048,'sine',.22); },
  };
}
