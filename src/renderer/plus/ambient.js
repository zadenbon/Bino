(function () {
  const RP = window.BinoPlus;

  const VERT = 'attribute vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }\n';

  function fragmentSource(octaves) {
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      '#define OCTAVES ' + octaves,
      'uniform vec2 uRes;',
      'uniform float uTime;',
      'uniform vec3 uBands;',
      'uniform vec3 uColA;',
      'uniform vec3 uColB;',
      'uniform vec3 uColC;',
      'uniform float uIntensity;',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(234.34, 435.345));',
      '  p += dot(p, p + 34.23);',
      '  return fract(p.x * p.y);',
      '}',
      'float vnoise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i);',
      '  float b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0));',
      '  float d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);',
      '  for (int i = 0; i < OCTAVES; i++) {',
      '    v += a * vnoise(p);',
      '    p = m * p;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'void main() {',
      '  vec2 uv = gl_FragCoord.xy / uRes;',
      '  float aspect = uRes.x / uRes.y;',
      '  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2;',
      '  float t = uTime * 0.045;',
      '  float bass = uBands.x;',
      '  float mid = uBands.y;',
      '  float treble = uBands.z;',
      '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));',
      '  vec2 r = vec2(',
      '    fbm(p + 2.6 * q + vec2(1.7, 9.2) + 0.9 * t + bass * 0.55),',
      '    fbm(p + 2.6 * q + vec2(8.3, 2.8) - 0.7 * t + mid * 0.45)',
      '  );',
      '  float f = fbm(p + 2.8 * r + treble * 0.35);',
      '  float body = smoothstep(0.15, 0.95, f * (0.75 + 0.5 * length(q)));',
      '  vec3 col = mix(uColA * 0.18, uColB, body);',
      '  col = mix(col, uColC, smoothstep(0.35, 1.0, length(r)) * (0.35 + 0.65 * mid));',
      '  float d = length(p);',
      '  col += uColA * bass * 0.5 * exp(-d * 1.35);',
      '  float sparkle = pow(vnoise(p * 14.0 + vec2(uTime * 0.6, -uTime * 0.4)), 7.0);',
      '  col += uColC * sparkle * treble * 1.4;',
      '  col *= 0.55 + 0.45 * smoothstep(1.7, 0.2, d);',
      '  col *= uIntensity;',
      '  col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');
  }

  const TIERS = {
    high: { scale: 0.6, octaves: 5, fps: 45 },
    balanced: { scale: 0.42, octaves: 4, fps: 30 },
    low: { scale: 0.28, octaves: 3, fps: 24 },
    minimal: { scale: 0.2, octaves: 2, fps: 15 }
  };
  const TIER_ORDER = ['high', 'balanced', 'low', 'minimal'];

  const state = {
    canvas: null,
    gl: null,
    programs: new Map(),
    buffer: null,
    tierName: 'balanced',
    running: false,
    suspended: false,
    lost: false,
    raf: 0,
    lastDraw: 0,
    lastRaf: 0,
    slowFrames: 0,
    time: 0,
    drawnFps: 0,
    fpsCount: 0,
    fpsStamp: 0,
    stopTimer: 0,
    analyser: null,
    analyserTap: null,
    freq: null,
    bands: [0, 0, 0],
    peaks: [0.4, 0.4, 0.4],
    colors: [[0.5, 0.4, 1], [0.2, 0.2, 0.5], [0.8, 0.5, 1]],
    targetColors: [[0.5, 0.4, 1], [0.2, 0.2, 0.5], [0.8, 0.5, 1]],
    audioEl: null,
    disabledReason: ''
  };

  function isAllowed() {
    if (!RP.get('ambient')) return false;
    const ram = RP.get('ramMode');
    if (ram === 'low' || ram === 'minimal') return false;
    if (document.body && document.body.classList.contains('perf')) return false;
    if (document.body && document.body.classList.contains('mini')) return false;
    return true;
  }

  function currentTierName() {
    const q = RP.get('ambientQuality');
    const ram = RP.get('ramMode');
    if (q !== 'auto' && TIERS[q]) return q;
    if (ram === 'balanced') return state.tierName === 'high' ? 'balanced' : state.tierName;
    return state.tierName;
  }

  function ensureCanvas() {
    if (state.canvas) return state.canvas;
    const canvas = document.createElement('canvas');
    canvas.id = 'rp-ambient';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      state.lost = true;
      stopLoop();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      state.lost = false;
      state.programs.clear();
      state.buffer = null;
      if (setupGL()) maybeStart();
    });
    state.canvas = canvas;
    return canvas;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || 'shader compile failed');
    }
    return shader;
  }

  function getProgram(octaves) {
    if (state.programs.has(octaves)) return state.programs.get(octaves);
    const gl = state.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource(octaves));
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(log || 'program link failed');
    }
    const entry = {
      program,
      uRes: gl.getUniformLocation(program, 'uRes'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uBands: gl.getUniformLocation(program, 'uBands'),
      uColA: gl.getUniformLocation(program, 'uColA'),
      uColB: gl.getUniformLocation(program, 'uColB'),
      uColC: gl.getUniformLocation(program, 'uColC'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity')
    };
    state.programs.set(octaves, entry);
    return entry;
  }

  function setupGL() {
    const canvas = ensureCanvas();
    if (!state.gl || state.gl.isContextLost()) {
      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
        desynchronized: true,
        failIfMajorPerformanceCaveat: true
      });
      if (!gl) {
        state.disabledReason = 'No hardware WebGL available';
        return false;
      }
      state.gl = gl;
    }
    const gl = state.gl;
    try {
      state.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.DITHER);
      getProgram(TIERS[currentTierName()].octaves);
    } catch (e) {
      state.disabledReason = String(e && e.message || e);
      releaseGL();
      return false;
    }
    resize();
    return true;
  }

  function releaseGL() {
    const gl = state.gl;
    if (gl && !gl.isContextLost()) {
      state.programs.forEach((entry) => gl.deleteProgram(entry.program));
      if (state.buffer) gl.deleteBuffer(state.buffer);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    state.programs.clear();
    state.buffer = null;
    state.gl = null;
    if (state.canvas) {
      state.canvas.remove();
      state.canvas = null;
    }
  }

  function resize() {
    if (!state.canvas || !state.gl) return;
    const tier = TIERS[currentTierName()];
    const w = Math.max(16, Math.round(window.innerWidth * tier.scale));
    const h = Math.max(16, Math.round(window.innerHeight * tier.scale));
    if (state.canvas.width !== w || state.canvas.height !== h) {
      state.canvas.width = w;
      state.canvas.height = h;
    }
    state.gl.viewport(0, 0, w, h);
  }

  function attachAnalyser() {
    const eng = window.audioEngine;
    if (!eng || !eng.ctx || !eng.normLimiter) return false;
    if (state.analyser && state.analyser.context === eng.ctx) return true;
    try {
      const node = eng.ctx.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0.82;
      node.minDecibels = -85;
      node.maxDecibels = -18;
      eng.normLimiter.connect(node);
      state.analyser = node;
      state.analyserTap = eng.normLimiter;
      state.freq = new Uint8Array(node.frequencyBinCount);
      return true;
    } catch (e) {
      return false;
    }
  }

  function detachAnalyser() {
    if (state.analyser && state.analyserTap) {
      try { state.analyserTap.disconnect(state.analyser); } catch (e) {}
    }
    state.analyser = null;
    state.analyserTap = null;
    state.freq = null;
  }

  function rangeAverage(freq, from, to) {
    let sum = 0;
    const end = Math.min(to, freq.length - 1);
    let count = 0;
    for (let i = from; i <= end; i++) { sum += freq[i]; count++; }
    return count ? sum / count / 255 : 0;
  }

  function updateBands(playing) {
    let raw = [0, 0, 0];
    if (playing && attachAnalyser()) {
      state.analyser.getByteFrequencyData(state.freq);
      const binHz = state.analyser.context.sampleRate / state.analyser.fftSize;
      const idx = (f) => Math.max(0, Math.round(f / binHz));
      raw = [
        rangeAverage(state.freq, idx(30), Math.max(idx(30), idx(170))),
        rangeAverage(state.freq, idx(400), idx(2400)),
        rangeAverage(state.freq, idx(4500), idx(12000))
      ];
    }
    for (let i = 0; i < 3; i++) {
      state.peaks[i] = Math.max(state.peaks[i] * 0.996, raw[i], 0.25);
      const target = Math.min(1, Math.pow(raw[i] / state.peaks[i], 1.6));
      const k = target > state.bands[i] ? 0.5 : 0.07;
      state.bands[i] += (target - state.bands[i]) * k;
    }
  }

  function refreshColors() {
    const accent = RP.getAccentRgb();
    const container = RP.getTonalRgb('--md-sys-color-primary-container');
    let tertiary = RP.getTonalRgb('--md-sys-color-tertiary');
    if (!tertiary || (tertiary[0] === 0.55 && tertiary[1] === 0.45)) tertiary = RP.mixRgb(accent, [1, 1, 1], 0.35);
    state.targetColors = [accent, RP.mixRgb(container, accent, 0.45), RP.mixRgb(tertiary, accent, 0.25)];
  }

  function stepColors(dt) {
    const k = 1 - Math.exp(-dt / 0.4);
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 3; i++) state.colors[c][i] += (state.targetColors[c][i] - state.colors[c][i]) * k;
    }
  }

  function degradeTier() {
    if (RP.get('ambientQuality') !== 'auto') return;
    const idx = TIER_ORDER.indexOf(state.tierName);
    if (idx < 0 || idx >= TIER_ORDER.length - 1) return;
    state.tierName = TIER_ORDER[idx + 1];
    try { getProgram(TIERS[state.tierName].octaves); } catch (e) { return; }
    resize();
  }

  function draw(now) {
    const gl = state.gl;
    if (!gl || gl.isContextLost()) return;
    const tier = TIERS[currentTierName()];
    const entry = getProgram(tier.octaves);
    gl.useProgram(entry.program);
    gl.uniform2f(entry.uRes, state.canvas.width, state.canvas.height);
    gl.uniform1f(entry.uTime, state.time);
    gl.uniform3f(entry.uBands, state.bands[0], state.bands[1], state.bands[2]);
    gl.uniform3fv(entry.uColA, state.colors[0]);
    gl.uniform3fv(entry.uColB, state.colors[1]);
    gl.uniform3fv(entry.uColC, state.colors[2]);
    gl.uniform1f(entry.uIntensity, 0.25 + 0.95 * (Math.max(0, Math.min(100, Number(RP.get('ambientIntensity')))) / 100));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    state.fpsCount++;
    if (now - state.fpsStamp >= 1000) {
      state.drawnFps = state.fpsCount * 1000 / (now - state.fpsStamp);
      state.fpsCount = 0;
      state.fpsStamp = now;
    }
  }

  function isPlaying() {
    return !!(state.audioEl && !state.audioEl.paused && !state.audioEl.ended);
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    const rafDelta = state.lastRaf ? now - state.lastRaf : 16.7;
    state.lastRaf = now;
    const playing = isPlaying();
    const tier = TIERS[currentTierName()];
    const interval = 1000 / (playing ? tier.fps : 10);
    if (now - state.lastDraw < interval - 2) return;
    const dt = Math.min(0.25, state.lastDraw ? (now - state.lastDraw) / 1000 : 0.016);
    state.lastDraw = now;
    updateBands(playing);
    const energy = (state.bands[0] + state.bands[1] + state.bands[2]) / 3;
    state.time += dt * (0.6 + energy * 1.4);
    stepColors(dt);
    draw(now);
    if (RP.get('ambientQuality') === 'auto' && playing) {
      if (rafDelta > 1000 / tier.fps * 1.9) state.slowFrames++;
      else state.slowFrames = Math.max(0, state.slowFrames - 1);
      if (state.slowFrames > 45) { state.slowFrames = 0; degradeTier(); }
    }
    if (!playing && !state.stopTimer) {
      state.stopTimer = setTimeout(() => { state.stopTimer = 0; if (!isPlaying()) stopLoop(); }, 4000);
    }
  }

  function startLoop() {
    if (state.running || state.suspended || state.lost || !state.gl) return;
    state.running = true;
    state.lastDraw = 0;
    state.lastRaf = 0;
    state.fpsStamp = performance.now();
    state.canvas.classList.add('on');
    state.raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.running = false;
    if (state.stopTimer) { clearTimeout(state.stopTimer); state.stopTimer = 0; }
  }

  function maybeStart() {
    if (!isAllowed() || state.suspended || document.hidden) return;
    if (!state.gl && !setupGL()) return;
    if (!state.running) {
      refreshColors();
      state.colors = state.targetColors.map((c) => c.slice());
      resize();
      draw(performance.now());
      startLoop();
    }
  }

  function teardown() {
    stopLoop();
    detachAnalyser();
    releaseGL();
  }

  function suspend() {
    state.suspended = true;
    teardown();
  }

  function resume() {
    state.suspended = false;
    maybeStart();
  }

  function sync() {
    if (isAllowed() && !state.suspended) maybeStart();
    else if (state.gl || state.canvas || state.running) teardown();
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.gl) return;
      resize();
      if (!state.running) draw(performance.now());
    }, 120);
  });

  let colorTimer = 0;
  new MutationObserver(() => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(() => { if (state.gl) refreshColors(); }, 160);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });

  new MutationObserver(() => sync()).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (state.gl && !state.suspended) startLoop();
    else sync();
  });

  RP.onChange((key) => {
    if (key === 'ambient' || key === 'ramMode') sync();
    else if (key === 'ambientQuality') {
      if (RP.get('ambientQuality') === 'auto') state.tierName = 'balanced';
      if (state.gl) { try { getProgram(TIERS[currentTierName()].octaves); } catch (e) {} resize(); }
    } else if (key === 'accent') {
      setTimeout(() => { if (state.gl) refreshColors(); }, 60);
    }
  });

  RP.onReady(() => {
    state.audioEl = document.getElementById('native-audio');
    if (state.audioEl) {
      state.audioEl.addEventListener('play', () => {
        if (state.stopTimer) { clearTimeout(state.stopTimer); state.stopTimer = 0; }
        if (state.gl && !state.running && !state.suspended && !document.hidden) startLoop();
        else if (!state.gl) sync();
      });
    }
    sync();
  });

  RP.modules.ambient = {
    suspend,
    resume,
    sync,
    stats() {
      return {
        active: state.running,
        tier: currentTierName(),
        fps: Math.round(state.drawnFps),
        resolution: state.canvas ? state.canvas.width + 'x' + state.canvas.height : '-',
        bands: state.bands.map((v) => Number(v.toFixed(2))),
        reason: state.disabledReason
      };
    },
    fragmentSource
  };
})();
