// Original synthesized UI notes. Audio is opt-in, with no downloads or microphone access.
export function createSound() {
  let context;
  let enabled = false;
  const voices = new Set();
  function note(frequency, delay = 0, length = 0.25) {
    if (!enabled || context?.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.055, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(gain).connect(context.destination);
    voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(oscillator); };
    oscillator.start(at);
    oscillator.stop(at + length + 0.01);
  }
  function stop() { for (const voice of voices) { try { voice.stop(); } catch {} } }
  return {
    get enabled() { return enabled; },
    async toggle() {
      if (enabled) { enabled = false; stop(); return false; }
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      try { context ||= new Audio(); await context.resume(); enabled = context.state === 'running'; }
      catch { enabled = false; }
      if (enabled) note(523.25);
      return enabled;
    },
    play(event) {
      const melody = event === 'complete' ? [523.25, 659.25, 783.99, 1046.5] : event === 'station' ? [523.25, 783.99] : [392, 523.25];
      melody.forEach((frequency, index) => note(frequency, index * 0.13, 0.45));
    },
    stop,
  };
}
