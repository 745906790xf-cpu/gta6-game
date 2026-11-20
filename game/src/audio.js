// All sound in Neon Harbor is synthesized with WebAudio: engine hum, sirens,
// punches, gunshots, cash chimes, and a slow generative bass-and-pad loop for
// cruising Port Solace. No audio files, nothing loaded from anywhere.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let chordStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 900;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    unlock() { ensure(); },
    punch() { noiseBurst(0.09, 0.35, 500); },
    shoot() { noiseBurst(0.14, 0.5, 2400); blip(220, 0.08, 'square', 0.12, 60); },
    crash() { noiseBurst(0.3, 0.5, 420); },
    cash() { blip(880, 0.09, 'sine', 0.2); setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 70); },
    pickup() { blip(660, 0.08, 'triangle', 0.2, 990); },
    door() { blip(180, 0.07, 'square', 0.15, 90); },
    sirenWail() { blip(700, 0.35, 'triangle', 0.08, 980); },
    setEngine(on, speedRatio) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.045;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio || 0) * 150, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(on ? 0.05 : 0.0001, ctx.currentTime, 0.1);
        if (!on) {
          const osc = engineOsc;
          setTimeout(() => { try { osc.stop(); } catch (e) { /* already stopped */ } }, 250);
          engineOsc = null;
          engineGain = null;
        }
      }
    },
    setSiren(on, elapsed) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0.03;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
      if (sirenOsc) {
        sirenOsc.frequency.setTargetAtTime(720 + Math.sin(elapsed * 5.2) * 160, ctx.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(on ? 0.03 : 0.0001, ctx.currentTime, 0.1);
        if (!on) {
          const osc = sirenOsc;
          setTimeout(() => { try { osc.stop(); } catch (e) { /* already stopped */ } }, 250);
          sirenOsc = null;
          sirenGain = null;
        }
      }
    },
    updateMusic(dt, inCar, wanted) {
      if (!ctx) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer = inCar ? 0.42 : 0.62;
      const bassLine = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
      const note = bassLine[chordStep % bassLine.length];
      chordStep += 1;
      blip(note, 0.4, 'triangle', wanted > 0 ? 0.16 : 0.11);
      if (chordStep % 4 === 0) blip(note * 4, 0.5, 'sine', 0.05);
      if (wanted >= 3 && chordStep % 2 === 0) blip(note * 6, 0.16, 'square', 0.04);
    },
  };
}
