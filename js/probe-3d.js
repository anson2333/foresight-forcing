/* Foresight Forcing — Interactive 3D Future-Point Displacement Probe Viewer (v2)
 * Dual-frame (Current O_t <-> Future O_{t+H}) real VGGT 3D point clouds with subtle
 * foreground ghost of the complementary frame, defaulting to 1 crisp center query point
 * (toggleable to all 5 tracked points).
 */
(function () {
  'use strict';

  function mat4Perspective(fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    const nf = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function mat4LookAt(eye, target, up) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  const CLOUD_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in vec3 aRgb;
    layout(location = 2) in float aHeat;
    layout(location = 3) in float aChanged;

    uniform mat4 uViewProj;
    uniform float uHeatMix;
    uniform float uPointScale;
    uniform float uGhostMode;   // 0 = solid full scene, 1 = faint ghost of changed foreground only
    uniform float uOpacity;
    uniform vec3 uGhostTint;

    out vec3 vColor;
    out float vAlpha;

    vec3 heatCol(float h) {
      vec3 c0 = vec3(0.18, 0.24, 0.36);
      vec3 c1 = vec3(0.58, 0.28, 0.85);
      vec3 c2 = vec3(0.96, 0.48, 0.30);
      vec3 c3 = vec3(1.00, 0.86, 0.45);
      if (h < 0.35) return mix(c0, c1, h / 0.35);
      if (h < 0.72) return mix(c1, c2, (h - 0.35) / 0.37);
      return mix(c2, c3, (h - 0.72) / 0.28);
    }

    void main() {
      // Ghost pass: show ONLY changed foreground points (subsampled 1-in-2 for clean see-through look)
      if (uGhostMode > 0.5) {
        if (aChanged < 0.5 || (gl_VertexID % 2) != 0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          vAlpha = 0.0;
          vColor = vec3(0.0);
          return;
        }
        vec3 baseRgb = pow(aRgb, vec3(0.95));
        vColor = mix(baseRgb, uGhostTint, 0.58);
        vAlpha = uOpacity;
        vec4 gClip = uViewProj * vec4(aPos, 1.0);
        gl_Position = gClip;
        float gDist = max(0.25, gClip.w);
        gl_PointSize = clamp((3.1 * uPointScale) / gDist, 1.6, 10.0);
        return;
      }

      vec3 baseRgb = pow(aRgb, vec3(0.95));
      float lum = dot(baseRgb, vec3(0.299, 0.587, 0.114));
      vec3 mutedRgb = mix(baseRgb, vec3(lum) * 0.85, 0.14);
      vec3 hCol = heatCol(aHeat);
      float hBlend = uHeatMix * (0.22 + 0.66 * smoothstep(0.18, 0.85, aHeat));
      vColor = mix(mutedRgb, hCol, hBlend);
      vAlpha = 0.90 * uOpacity;

      vec4 clip = uViewProj * vec4(aPos, 1.0);
      gl_Position = clip;
      float dist = max(0.25, clip.w);
      gl_PointSize = clamp((3.9 * uPointScale) / dist, 1.8, 13.0);
    }
  `;

  const CLOUD_FS = `#version 300 es
    precision highp float;
    in vec3 vColor;
    in float vAlpha;
    out vec4 outColor;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = length(c);
      if (r > 0.5) discard;
      float core = smoothstep(0.5, 0.16, r);
      outColor = vec4(vColor, core * vAlpha);
    }
  `;

  const RIBBON_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in vec4 aCol;
    uniform mat4 uViewProj;
    out vec4 vCol;
    void main() {
      vCol = aCol;
      gl_Position = uViewProj * vec4(aPos, 1.0);
    }
  `;

  const RIBBON_FS = `#version 300 es
    precision highp float;
    in vec4 vCol;
    out vec4 outColor;
    void main() {
      outColor = vCol;
    }
  `;

  const MARKER_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in float aSize;
    layout(location = 2) in vec4 aCol;
    layout(location = 3) in float aStyle;
    uniform mat4 uViewProj;
    uniform float uPointScale;
    out vec4 vCol;
    out float vStyle;
    void main() {
      vCol = aCol;
      vStyle = aStyle;
      vec4 clip = uViewProj * vec4(aPos, 1.0);
      gl_Position = clip;
      gl_PointSize = clamp((aSize * uPointScale) / max(0.25, clip.w), 6.0, 30.0);
    }
  `;

  const MARKER_FS = `#version 300 es
    precision highp float;
    in vec4 vCol;
    in float vStyle;
    out vec4 outColor;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = length(c);
      if (r > 0.5) discard;
      if (vStyle > 0.5) {
        float glow = exp(-r * r * 11.0);
        vec3 col = mix(vCol.rgb, vec3(1.0), smoothstep(0.22, 0.0, r) * 0.65);
        outColor = vec4(col, glow * vCol.a);
      } else {
        float outer = smoothstep(0.5, 0.40, r);
        float border = smoothstep(0.36, 0.28, r);
        vec3 col = mix(vec3(0.05, 0.08, 0.14), vCol.rgb, border);
        float centerSpec = smoothstep(0.16, 0.0, r) * 0.35;
        outColor = vec4(col + vec3(centerSpec), outer * vCol.a);
      }
    }
  `;

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('Probe3D shader error:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }

  const CAM_PRESETS = {
    oblique: { yaw: 0.34, pitch: 0.32, dist: 1.06 },
    front:   { yaw: 0.00, pitch: 0.04, dist: 1.15 },
    top:     { yaw: 0.06, pitch: 0.90, dist: 1.04 }
  };

  class Probe3DViewer {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('[data-probe-canvas]');
      this.caseBtns = root.querySelectorAll('[data-probe-case]');
      this.frameBtns = root.querySelectorAll('[data-probe-frame]');
      this.camBtns = root.querySelectorAll('[data-probe-cam]');
      this.layerBtns = root.querySelectorAll('[data-probe-layer]');
      this.ptsBtn = root.querySelector('[data-probe-points-toggle]');
      this.ghostBtn = root.querySelector('[data-probe-ghost-toggle]');
      this.heatBtn = root.querySelector('[data-probe-heat]');
      this.zoomInBtn = root.querySelector('[data-probe-zoom-in]');
      this.zoomOutBtn = root.querySelector('[data-probe-zoom-out]');
      this.resetBtn = root.querySelector('[data-probe-reset]');
      this.descEl = root.querySelector('[data-probe-desc]');
      this.metricsEl = root.querySelector('[data-probe-metrics]');
      this.hintEl = root.querySelector('[data-probe-hint]');

      this.layers = { gt: true, ours: true, baseline: true };
      this.showAll5 = false;       // Default: 1 clean center point!
      this.showGhost = true;       // Faint ghost of complementary state (Future when viewing Current, Current when viewing Future)
      this.frameMode = 'current';  // 'current' | 'future'
      this.heatEnabled = false;
      this.heatMix = 0;

      this.yaw = CAM_PRESETS.oblique.yaw;
      this.pitch = CAM_PRESETS.oblique.pitch;
      this.dist = CAM_PRESETS.oblique.dist;
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.targetDist = this.dist;

      this.dragging = false;
      this.lastX = 0;
      this.lastY = 0;

      this.cache = new Map();
      this.activeCase = null;
      this.ready = false;
      this.useWebGL = false;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.bindUI();
      this.loadMeta();
    }

    bindUI() {
      this.caseBtns.forEach((btn) => {
        btn.addEventListener('click', () => this.selectCase(btn.dataset.probeCase));
      });

      this.frameBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.frameMode = btn.dataset.probeFrame;
          this.frameBtns.forEach((b) => {
            const act = b === btn;
            b.classList.toggle('is-active', act);
            b.setAttribute('aria-pressed', String(act));
          });
          this.updateHint();
        });
      });

      this.camBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = CAM_PRESETS[btn.dataset.probeCam];
          if (!preset) return;
          this.camBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
          this.targetYaw = preset.yaw;
          this.targetPitch = preset.pitch;
          this.targetDist = preset.dist;
        });
      });

      this.layerBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.probeLayer;
          this.layers[key] = !this.layers[key];
          btn.classList.toggle('is-active', this.layers[key]);
          btn.setAttribute('aria-pressed', String(this.layers[key]));
        });
      });

      if (this.ptsBtn) {
        this.ptsBtn.addEventListener('click', () => {
          this.showAll5 = !this.showAll5;
          this.ptsBtn.classList.toggle('is-active', this.showAll5);
          this.ptsBtn.setAttribute('aria-pressed', String(this.showAll5));
          this.ptsBtn.innerHTML = this.showAll5 ? '<span>All 5 pts</span>' : '<span>1 center pt</span>';
          this.updateMetrics();
        });
      }

      if (this.ghostBtn) {
        this.ghostBtn.addEventListener('click', () => {
          this.showGhost = !this.showGhost;
          this.ghostBtn.classList.toggle('is-active', this.showGhost);
          this.ghostBtn.setAttribute('aria-pressed', String(this.showGhost));
          this.updateHint();
        });
      }

      if (this.heatBtn) {
        this.heatBtn.addEventListener('click', () => {
          this.heatEnabled = !this.heatEnabled;
          this.heatBtn.classList.toggle('is-active', this.heatEnabled);
          this.heatBtn.setAttribute('aria-pressed', String(this.heatEnabled));
        });
      }

      this.zoomInBtn?.addEventListener('click', () => {
        this.targetDist = Math.max(0.68, this.targetDist * 0.85);
      });
      this.zoomOutBtn?.addEventListener('click', () => {
        this.targetDist = Math.min(2.4, this.targetDist * 1.18);
      });
      this.resetBtn?.addEventListener('click', () => {
        this.targetYaw = CAM_PRESETS.oblique.yaw;
        this.targetPitch = CAM_PRESETS.oblique.pitch;
        this.targetDist = CAM_PRESETS.oblique.dist;
        this.camBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.probeCam === 'oblique'));
      });

      const c = this.canvas;
      const vp = c.parentElement;
      this.wheelZoomActive = false;

      const setWheelZoom = (on) => {
        this.wheelZoomActive = Boolean(on);
        if (vp) vp.classList.toggle('is-zoom-active', this.wheelZoomActive);
      };

      c.addEventListener('pointerdown', (e) => {
        setWheelZoom(true);
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        c.setPointerCapture(e.pointerId);
        c.classList.add('is-dragging');
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.targetYaw -= dx * 0.007;
        this.targetPitch = Math.max(-0.45, Math.min(1.25, this.targetPitch + dy * 0.0055));
      });
      const stopDrag = (e) => {
        if (!this.dragging) return;
        this.dragging = false;
        try { c.releasePointerCapture(e.pointerId); } catch (_) {}
        c.classList.remove('is-dragging');
      };
      c.addEventListener('pointerup', stopDrag);
      c.addEventListener('pointercancel', stopDrag);

      if (vp) {
        vp.addEventListener('pointerleave', () => {
          if (!this.dragging && this.wheelZoomActive) setWheelZoom(false);
        });
      }
      document.addEventListener('pointerdown', (e) => {
        if (this.wheelZoomActive && vp && !vp.contains(e.target)) setWheelZoom(false);
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.wheelZoomActive) setWheelZoom(false);
      });

      c.addEventListener('wheel', (e) => {
        const direct = this.wheelZoomActive || e.ctrlKey || e.metaKey || e.shiftKey;
        if (!direct) return;
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= 120;
        dy = Math.max(-120, Math.min(120, dy));
        const factor = Math.exp(dy * (e.ctrlKey || e.metaKey ? 0.0045 : 0.0018));
        this.targetDist = Math.max(0.55, Math.min(2.55, this.targetDist * factor));
      }, { passive: false });

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(c);
    }

    updateHint() {
      if (!this.hintEl) return;
      if (this.frameMode === 'current') {
        this.hintEl.innerHTML = this.showGhost
          ? 'Solid: Current O<sub>t</sub> · Faint ghost: Future O<sub>t+H</sub> · Drag to orbit 3D'
          : 'Solid: Current O<sub>t</sub> · Drag to orbit 3D';
      } else {
        this.hintEl.innerHTML = this.showGhost
          ? 'Solid: Future O<sub>t+H</sub> (object lands at green/violet tips) · Faint ghost: Current O<sub>t</sub>'
          : 'Solid: Future O<sub>t+H</sub> · Drag to orbit 3D';
      }
    }

    updateMetrics() {
      if (!this.metricsEl || !this.activeCase) return;
      const m = this.activeCase.cfg.metrics;
      const oursPx = this.showAll5 ? m.oursAll5Px : m.oursCenterPx;
      const basePx = this.showAll5 ? m.baseAll5Px : m.baseCenterPx;
      const ratio = (basePx / Math.max(oursPx, 0.01)).toFixed(1);
      const scope = this.showAll5 ? '5-pt mean' : 'center pt';
      this.metricsEl.innerHTML = `
        <span class="m-ours"><b>${oursPx.toFixed(2)} px</b> F<sup>2</sup> (${scope})</span>
        <span class="m-base"><b>${basePx.toFixed(2)} px</b> ImageWAM</span>
        <span class="m-gain"><b>${ratio}×</b> lower error</span>
      `;
    }

    async loadMeta() {
      try {
        const res = await fetch('assets/data/probe_meta.json');
        if (!res.ok) throw new Error('probe_meta fetch failed');
        this.meta = await res.json();
        this.initGL();
        await this.selectCase('134054');
        this.ready = true;
        this.root.dataset.ready = 'true';
        this.resize();
        this.updateHint();
        requestAnimationFrame((t) => this.tick(t));
      } catch (err) {
        console.warn('Probe3D init failed:', err);
      }
    }

    initGL() {
      const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance' });
      if (!gl) return;
      this.gl = gl;
      this.progCloud = createProgram(gl, CLOUD_VS, CLOUD_FS);
      this.progRibbon = createProgram(gl, RIBBON_VS, RIBBON_FS);
      this.progMarker = createProgram(gl, MARKER_VS, MARKER_FS);
      if (!this.progCloud || !this.progRibbon || !this.progMarker) return;
      this.useWebGL = true;

      const B = 4;
      this.vaoRibbon = gl.createVertexArray();
      gl.bindVertexArray(this.vaoRibbon);
      this.vboRibbon = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboRibbon);
      gl.bufferData(gl.ARRAY_BUFFER, 36000 * B, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7 * B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7 * B, 3 * B);

      this.vaoMarker = gl.createVertexArray();
      gl.bindVertexArray(this.vaoMarker);
      this.vboMarker = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboMarker);
      gl.bufferData(gl.ARRAY_BUFFER, 4000 * B, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 9 * B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 9 * B, 3 * B);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 9 * B, 4 * B);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 9 * B, 8 * B);
      gl.bindVertexArray(null);

      this.uC = {
        vp: gl.getUniformLocation(this.progCloud, 'uViewProj'),
        heat: gl.getUniformLocation(this.progCloud, 'uHeatMix'),
        scale: gl.getUniformLocation(this.progCloud, 'uPointScale'),
        ghostMode: gl.getUniformLocation(this.progCloud, 'uGhostMode'),
        opacity: gl.getUniformLocation(this.progCloud, 'uOpacity'),
        ghostTint: gl.getUniformLocation(this.progCloud, 'uGhostTint')
      };
      this.uR = { vp: gl.getUniformLocation(this.progRibbon, 'uViewProj') };
      this.uM = {
        vp: gl.getUniformLocation(this.progMarker, 'uViewProj'),
        scale: gl.getUniformLocation(this.progMarker, 'uPointScale')
      };
    }

    unpackCloud(buf, count, stride, qRange) {
      const view = new DataView(buf);
      const scale = qRange / 32000.0;
      const arr = new Float32Array(count * 8); // pos3 + rgb3 + heat1 + changed1
      for (let i = 0; i < count; i += 1) {
        const bo = i * stride;
        const fo = i * 8;
        arr[fo + 0] = view.getInt16(bo + 0, true) * scale;
        arr[fo + 1] = view.getInt16(bo + 2, true) * scale;
        arr[fo + 2] = view.getInt16(bo + 4, true) * scale;
        arr[fo + 3] = view.getUint8(bo + 6) / 255.0;
        arr[fo + 4] = view.getUint8(bo + 7) / 255.0;
        arr[fo + 5] = view.getUint8(bo + 8) / 255.0;
        arr[fo + 6] = view.getUint8(bo + 9) / 255.0;
        arr[fo + 7] = view.getUint8(bo + 10);
      }
      if (!this.useWebGL) return null;
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      const B = 4;
      const S = 8 * B;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 3 * B);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, S, 6 * B);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 7 * B);
      gl.bindVertexArray(null);
      return vao;
    }

    async selectCase(id) {
      const cfg = this.meta?.cases?.[id];
      if (!cfg) return;

      this.caseBtns.forEach((btn) => {
        const active = btn.dataset.probeCase === id;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
      });

      if (!this.cache.has(id)) {
        const [resCur, resFut] = await Promise.all([fetch(cfg.binCur), fetch(cfg.binFut)]);
        const [bufCur, bufFut] = await Promise.all([resCur.arrayBuffer(), resFut.arrayBuffer()]);
        const vaoCur = this.unpackCloud(bufCur, cfg.countCur, cfg.stride, cfg.qRange);
        const vaoFut = this.unpackCloud(bufFut, cfg.countFut, cfg.stride, cfg.qRange);
        this.cache.set(id, { cfg, vaoCur, vaoFut });
      }

      this.activeCase = this.cache.get(id);
      if (this.descEl) {
        this.descEl.innerHTML = cfg.desc
          .replace(/O_t/g, 'O<sub>t</sub>')
          .replace(/O_\{t\+H\}/g, 'O<sub>t+H</sub>')
          .replace(/Z_Δ/g, 'Z<sub>Δ</sub>')
          .replace(/F²/g, 'F<sup>2</sup>');
      }
      this.updateMetrics();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = dpr;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      if (this.useWebGL) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    pushTrajectoryRibbon(tris, markers, p0, p1, eye, lift, width, colStart, colEnd, alpha, pulseT) {
      const segs = 16;
      const mid = [
        (p0[0] + p1[0]) * 0.5,
        (p0[1] + p1[1]) * 0.5 + lift,
        (p0[2] + p1[2]) * 0.5 + lift * 0.55
      ];
      const pts = [];
      for (let s = 0; s <= segs; s += 1) {
        const t = s / segs;
        const it = 1 - t;
        pts.push([
          it * it * p0[0] + 2 * it * t * mid[0] + t * t * p1[0],
          it * it * p0[1] + 2 * it * t * mid[1] + t * t * p1[1],
          it * it * p0[2] + 2 * it * t * mid[2] + t * t * p1[2]
        ]);
      }

      const sideAt = (i) => {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(segs, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
        const vx = eye[0] - pts[i][0], vy = eye[1] - pts[i][1], vz = eye[2] - pts[i][2];
        let sx = ty * vz - tz * vy;
        let sy = tz * vx - tx * vz;
        let sz = tx * vy - ty * vx;
        const sl = Math.hypot(sx, sy, sz) || 1;
        return [sx / sl, sy / sl, sz / sl];
      };

      const pushV = (p, c, al) => { tris.push(p[0], p[1], p[2], c[0], c[1], c[2], al); };
      const shaftEnd = segs - 2;
      for (let i = 0; i < shaftEnd; i += 1) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        const s0 = sideAt(i), s1 = sideAt(i + 1);
        const c0 = [lerp(colStart[0], colEnd[0], t0), lerp(colStart[1], colEnd[1], t0), lerp(colStart[2], colEnd[2], t0)];
        const c1 = [lerp(colStart[0], colEnd[0], t1), lerp(colStart[1], colEnd[1], t1), lerp(colStart[2], colEnd[2], t1)];
        const a0 = [pts[i][0] - s0[0] * width, pts[i][1] - s0[1] * width, pts[i][2] - s0[2] * width];
        const b0 = [pts[i][0] + s0[0] * width, pts[i][1] + s0[1] * width, pts[i][2] + s0[2] * width];
        const a1 = [pts[i + 1][0] - s1[0] * width, pts[i + 1][1] - s1[1] * width, pts[i + 1][2] - s1[2] * width];
        const b1 = [pts[i + 1][0] + s1[0] * width, pts[i + 1][1] + s1[1] * width, pts[i + 1][2] + s1[2] * width];
        pushV(a0, c0, alpha); pushV(b0, c0, alpha); pushV(b1, c1, alpha);
        pushV(a0, c0, alpha); pushV(b1, c1, alpha); pushV(a1, c1, alpha);
      }

      const basePt = pts[shaftEnd];
      const tipPt = pts[segs];
      const sHead = sideAt(shaftEnd);
      const hw = width * 2.8;
      const hL = [basePt[0] - sHead[0] * hw, basePt[1] - sHead[1] * hw, basePt[2] - sHead[2] * hw];
      const hR = [basePt[0] + sHead[0] * hw, basePt[1] + sHead[1] * hw, basePt[2] + sHead[2] * hw];
      pushV(hL, colEnd, alpha); pushV(hR, colEnd, alpha); pushV(tipPt, colEnd, alpha);

      markers.push(tipPt[0], tipPt[1], tipPt[2], 8.6, colEnd[0], colEnd[1], colEnd[2], alpha, 0.0);

      if (pulseT !== null) {
        const it = 1 - pulseT;
        const bx = it * it * p0[0] + 2 * it * pulseT * mid[0] + pulseT * pulseT * p1[0];
        const by = it * it * p0[1] + 2 * it * pulseT * mid[1] + pulseT * pulseT * p1[1];
        const bz = it * it * p0[2] + 2 * it * pulseT * mid[2] + pulseT * pulseT * p1[2];
        markers.push(bx, by, bz, 10.5, colEnd[0], colEnd[1], colEnd[2], Math.sin(pulseT * Math.PI) * 0.95, 1.0);
      }
    }

    tick(now) {
      requestAnimationFrame((t) => this.tick(t));
      if (!this.ready || !this.activeCase || !this.width || !this.height || !this.useWebGL) return;

      this.yaw += (this.targetYaw - this.yaw) * 0.12;
      this.pitch += (this.targetPitch - this.pitch) * 0.12;
      this.dist += (this.targetDist - this.dist) * 0.12;
      this.heatMix += ((this.heatEnabled ? 1.0 : 0.0) - this.heatMix) * 0.12;

      const { cfg, vaoCur, vaoFut } = this.activeCase;
      const oc = cfg.objCenter;
      const target = [oc[0] * 0.90, oc[1] * 0.90, oc[2] * 0.90];
      const eye = [
        target[0] + this.dist * Math.cos(this.pitch) * Math.sin(this.yaw),
        target[1] + this.dist * Math.sin(this.pitch),
        target[2] + this.dist * Math.cos(this.pitch) * Math.cos(this.yaw)
      ];
      const aspect = this.width / this.height;
      const proj = mat4Perspective((44 * Math.PI) / 180, aspect, 0.05, 20.0);
      const view = mat4LookAt(eye, target, [0, 1, 0]);
      const vp = mat4Multiply(proj, view);

      const gl = this.gl;
      gl.clearColor(0.039, 0.062, 0.105, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const pxScale = (this.height || 440) * this.dpr / 420.0;
      const solidIsFuture = this.frameMode === 'future';
      const solidVao = solidIsFuture ? vaoFut : vaoCur;
      const solidCount = solidIsFuture ? cfg.countFut : cfg.countCur;
      const ghostVao = solidIsFuture ? vaoCur : vaoFut;
      const ghostCount = solidIsFuture ? cfg.countCur : cfg.countFut;

      // 1. Solid active scene (Current O_t OR Future O_{t+H})
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(this.progCloud);
      gl.uniformMatrix4fv(this.uC.vp, false, vp);
      gl.uniform1f(this.uC.heat, solidIsFuture ? this.heatMix * 0.45 : this.heatMix);
      gl.uniform1f(this.uC.scale, pxScale);
      gl.uniform1f(this.uC.ghostMode, 0.0);
      gl.uniform1f(this.uC.opacity, 1.0);
      gl.uniform3f(this.uC.ghostTint, 0.3, 0.85, 0.95);
      gl.bindVertexArray(solidVao);
      gl.drawArrays(gl.POINTS, 0, solidCount);

      // 2. Very faint translucent ghost of the complementary frame's moved foreground object/arm
      if (this.showGhost) {
        gl.depthMask(false);
        gl.uniform1f(this.uC.ghostMode, 1.0);
        gl.uniform1f(this.uC.opacity, 0.28);
        if (solidIsFuture) {
          // Viewing solid Future -> faint silver-blue ghost of original Current O_t pose
          gl.uniform3f(this.uC.ghostTint, 0.65, 0.78, 0.96);
        } else {
          // Viewing solid Current -> faint emerald-cyan ghost of where Future O_{t+H} lands
          gl.uniform3f(this.uC.ghostTint, 0.30, 0.92, 0.76);
        }
        gl.bindVertexArray(ghostVao);
        gl.drawArrays(gl.POINTS, 0, ghostCount);
        gl.depthMask(true);
      }

      // 3. Draw 1 crisp center point (default) OR all 5 tracked points
      const tris = [];
      const markers = [];
      const timeSec = now * 0.001;
      const pulse = this.reducedMotion ? 0.55 : (timeSec * 0.55) % 1.0;
      const countPts = this.showAll5 ? cfg.start.length : 1;
      const ribbonW = this.showAll5 ? 0.0046 : 0.0064;

      for (let i = 0; i < countPts; i += 1) {
        const p0 = cfg.start[i];
        const s0 = [p0[0], p0[1] + 0.012, p0[2] + 0.018];
        markers.push(s0[0], s0[1], s0[2], this.showAll5 ? 7.4 : 9.2, 0.96, 0.98, 1.0, 0.98, 0.0);

        if (this.layers.baseline) {
          const pb = cfg.baseline[i];
          const sb = [pb[0], pb[1] + 0.012, pb[2] + 0.018];
          this.pushTrajectoryRibbon(tris, markers, s0, sb, eye, 0.042, ribbonW * 0.88, [0.98, 0.58, 0.24], [0.98, 0.45, 0.28], 0.90, null);
        }
        if (this.layers.gt) {
          const pg = cfg.gt[i];
          const sg = [pg[0], pg[1] + 0.012, pg[2] + 0.018];
          this.pushTrajectoryRibbon(tris, markers, s0, sg, eye, 0.068, ribbonW * 0.96, [0.22, 0.85, 0.62], [0.24, 0.94, 0.68], 0.96, null);
        }
        if (this.layers.ours) {
          const po = cfg.ours[i];
          const so = [po[0], po[1] + 0.012, po[2] + 0.018];
          this.pushTrajectoryRibbon(tris, markers, s0, so, eye, 0.092, ribbonW * 1.06, [0.68, 0.48, 1.0], [0.26, 0.88, 1.0], 0.98, (pulse + i * 0.11) % 1.0);
        }
      }

      gl.disable(gl.DEPTH_TEST);
      if (tris.length > 0) {
        gl.useProgram(this.progRibbon);
        gl.uniformMatrix4fv(this.uR.vp, false, vp);
        gl.bindVertexArray(this.vaoRibbon);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboRibbon);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(tris));
        gl.drawArrays(gl.TRIANGLES, 0, tris.length / 7);
      }

      if (markers.length > 0) {
        gl.useProgram(this.progMarker);
        gl.uniformMatrix4fv(this.uM.vp, false, vp);
        gl.uniform1f(this.uM.scale, pxScale);
        gl.bindVertexArray(this.vaoMarker);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboMarker);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(markers));
        gl.drawArrays(gl.POINTS, 0, markers.length / 9);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.bindVertexArray(null);
    }
  }

  window.initProbe3D = function initProbe3D() {
    const root = document.querySelector('[data-probe-3d]');
    if (!root) return null;
    return new Probe3DViewer(root);
  };
})();
