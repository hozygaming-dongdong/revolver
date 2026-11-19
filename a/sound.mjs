export function soundscape() {
  let context, master, muted = false;
  const start = () => {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.6;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
  };
  const tone = (frequency, duration, gain = 0.1, type = 'sine', end = frequency) => {
    if (!context || muted) return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), t = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(t); oscillator.stop(t + duration);
  };
  const noise = (duration, gain, frequency) => {
    if (!context || muted) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; envelope.gain.value = gain;
    source.connect(filter).connect(envelope).connect(master); source.start();
  };
  return {
    start,
    toggle() { start(); muted = !muted; master.gain.value = muted ? 0 : 0.6; return muted; },
    tick() { noise(0.028, 0.18, 2600); tone(760, 0.025, 0.025, 'triangle', 330); },
    load() { noise(0.1, 0.2, 3100); tone(1300, 0.14, 0.05, 'triangle', 690); },
    tension() { tone(78, 2.6, 0.09, 'sine', 39); },
    fire() { noise(0.4, 0.7, 1800); tone(130, 0.4, 0.32, 'triangle', 26); },
    empty() { noise(0.07, 0.4, 4000); tone(55, 0.65, 0.24, 'sine', 23); },
    travel() { noise(0.5, 0.15, 500); tone(95, 0.35, 0.06, 'triangle', 40); },
    win() { tone(440, 0.7, 0.05); setTimeout(() => tone(554, 0.65, 0.05), 100); setTimeout(() => tone(660, 1, 0.05), 200); },
  };
}
