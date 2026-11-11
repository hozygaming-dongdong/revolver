const revolverAudio = (() => {
  // Layer: source, frequency, duration, level, optional final pitch, start offset.
  const cues = {
    tick: [['noise', 3200, .025, .17], ['triangle', 1780, .023, .085]],
    lock: [['noise', 1250, .056, .26], ['triangle', 660, .061, .14, 430]],
    fire: [['noise', 900, .235, .68], ['sine', 144, .18, .45, 45]],
    empty: [['noise', 2150, .04, .32], ['triangle', 1020, .048, .16, 680]],
    reload: [['noise', 1750, .068, .24], ['triangle', 710, .09, .17, 490], ['sine', 2060, .085, .09, 1720, .028]],
    clear: [['triangle', 392, .21, .23], ['triangle', 523.25, .23, .23, null, .15], ['triangle', 659.25, .39, .27, null, .30]],
  };
  const effectsLevel = .72;
  const musicLevel = .12;
  let context;
  let effectsOutput;
  let musicOutput;
  let noise;
  let effectsMuted = false;
  let musicEnabled = true;

  function unlock() {
    if (effectsMuted && !musicEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      effectsOutput = context.createGain();
      effectsOutput.gain.value = effectsMuted ? 0 : effectsLevel;
      effectsOutput.connect(context.destination);
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * .25), context.sampleRate);
      const samples = noise.getChannelData(0);
      let seed = 139;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 2 ** 31 - 1;
      }
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }

  function toggleMute() {
    effectsMuted = !effectsMuted;
    if (effectsOutput) effectsOutput.gain.setTargetAtTime(effectsMuted ? 0 : effectsLevel, context.currentTime, .005);
    if (!effectsMuted) unlock();
    return effectsMuted;
  }

  function createMusicLoop() {
    const beat = .8;
    const bar = 4 * beat;
    const bassNotes = [73.42, 73.42, 58.27, 65.41];
    const length = bar * bassNotes.length;
    const { sampleRate } = context;
    const loop = context.createBuffer(1, Math.round(length * sampleRate), sampleRate);
    const samples = loop.getChannelData(0);
    const texture = noise.getChannelData(0);
    const tau = 2 * Math.PI;

    for (let i = 0; i < samples.length; i++) {
      const time = i / sampleRate;
      const barTime = time % bar;
      const beatTime = time % beat;
      const beatIndex = Math.floor(time / beat) % 4;
      const phase = tau * bassNotes[Math.floor(time / bar)] * barTime;
      const bassEnvelope = Math.min(1, barTime / .09, (bar - barTime) / .12);
      const pulse = .73 + .27 * Math.exp(-5 * beatTime);
      const bass = (.31 * Math.sin(phase) + .13 * Math.sin(2 * phase) + .055 * Math.sin(3 * phase)
        + .045 * Math.sin(1.5 * phase)) * bassEnvelope * pulse;

      const kickPhase = tau * (48 * beatTime + 1.15 * (1 - Math.exp(-32 * beatTime)));
      const kick = beatIndex % 2 === 0 ? .22 * Math.sin(kickPhase) * Math.exp(-15 * beatTime) : 0;
      const strike = beatTime - beat / 2;
      const metal = beatIndex % 2 === 1 && strike >= 0
        ? (.035 * texture[i % texture.length] + .065 * Math.sin(tau * 552 * strike)) * Math.exp(-21 * strike) : 0;
      const fade = Math.min(1, time / .03, (length - time) / .04);
      samples[i] = (bass + kick + metal) * fade;
    }
    return loop;
  }

  function startMusic() {
    unlock();
    if (!musicEnabled || !context || musicOutput) return;
    musicOutput = context.createGain();
    musicOutput.gain.value = 0;
    musicOutput.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = createMusicLoop();
    source.loop = true;
    source.connect(musicOutput);
    source.start();
    musicOutput.gain.setTargetAtTime(musicLevel, context.currentTime, .045);
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled) startMusic();
    if (musicOutput) {
      const time = context.currentTime;
      musicOutput.gain.cancelScheduledValues(time);
      musicOutput.gain.setTargetAtTime(musicEnabled ? musicLevel : 0, time, .015);
    }
    return musicEnabled;
  }

  function play(cue) {
    if (effectsMuted || context?.state !== 'running') return;
    const now = context.currentTime;
    if (cue === 'fire' && musicEnabled && musicOutput) {
      musicOutput.gain.cancelScheduledValues(now);
      musicOutput.gain.setTargetAtTime(.028, now, .006);
      musicOutput.gain.setTargetAtTime(musicLevel, now + .24, .09);
    }
    for (const [type, frequency, duration, level, endPitch, offset = 0] of cues[cue]) {
      const time = now + offset;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(.001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + .002);
      envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
      envelope.connect(effectsOutput);

      let source;
      if (type === 'noise') {
        source = context.createBufferSource();
        source.buffer = noise;
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = .8;
        source.connect(filter).connect(envelope);
      } else {
        source = context.createOscillator();
        source.type = type;
        source.frequency.setValueAtTime(frequency, time);
        if (endPitch) source.frequency.exponentialRampToValueAtTime(endPitch, time + duration);
        source.connect(envelope);
      }
      source.start(time);
      source.stop(time + duration);
      source.onended = () => envelope.disconnect();
    }
  }

  return { unlock, startMusic, play, toggleMute, toggleMusic };
})();
