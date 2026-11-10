// The "time's up" chime, made with WebAudio so no sound file is needed.
import { G } from '../core/state.js';

const NOTES_HZ = [523, 659, 784, 1047]; // C5 E5 G5 C6
let audio = null;

/** Browsers only allow sound after a tap, so call this from a click handler. */
export function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.resume) audio.resume();
  } catch {
    /* no audio on this device */
  }
}

export function chime() {
  if (!G.settings.sound) return;
  try {
    unlockAudio();
    NOTES_HZ.forEach((hz, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + i * 0.15;
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.6);
    });
  } catch {
    /* no audio on this device */
  }
}
