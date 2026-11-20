/* Foresight Forcing — Interactive Real-Data 3D Point Cloud & VGGT Feature Delta Stage
 * Renders measured RoboTwin RGB-D geometry + VGGT feature residual (||Y+ - Y-||_2)
 * using WebGL2 (with automatic 2D-projected fallback). Zero external dependencies.
 */
(function () {
  'use strict';

  const STAGE_DEFS = [
    {
      id: 0,
      code: '01',
      short: '2D Observation',
      badge: 'STAGE 01 · CURRENT OBSERVATION O<sub>t</sub>',
      title: 'Start from a standard 2D RGB observation O<sub>t</sub>',
      detail: 'Real RoboTwin scene (Rank the blocks) with cluttered distractors (soy-sauce bottle, plate, scale, blocks) and an AGILEX arm grasping the cyan block.'
    },
    {
      id: 1,
      code: '02',
      short: '3D Lifting',
      badge: 'STAGE 02 · 2D IMAGE → 3D POINT CLOUD',
      title: 'Unproject pixels into 3D scene geometry',
      detail: 'Each pixel lifts along its calibrated camera ray into 3D coordinates, exposing depth and object-arm spatial layout.'
    },
    {
      id: 2,
      code: '03',
      short: 'VGGT Feature Δ',
      badge: 'STAGE 03 · MEASURED VGGT FEATURE CHANGE Y<sub>Δ</sub>',
      title: 'Isolate what changes in 3D feature space',
      detail: 'As the arm carries the grasped block from O<sub>t</sub> to O<sub>t+H</sub>, static distractors fade while measured VGGT feature delta ‖Y<sub>+</sub> − Y<sub>−</sub>‖<sub>2</sub> ignites on both the arm and carried block.'
    },
    {
      id: 3,
      code: '04',
      short: 'Spatial Queries Z_Δ',
      badge: 'STAGE 04 · DEPLOYMENT CONCEPT Z<sub>Δ</sub> → ACTION (SCHEMATIC)',
      title: 'Anticipate 3D motion from O<sub>t</sub> alone',
      detail: 'Schematic: solid arm & grasped block show current input O<sub>t</sub>; the sparse cyan hologram marks anticipated pose O<sub>t+H</sub> bridged by Z<sub>Δ</sub> motion streamlines (teacher removed).'
    }
  ];

  // Minimal 4x4 matrix helpers (column-major for WebGL)
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

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(e0, e1, x) {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Shaders
  const POINT_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aImgPos;
    layout(location = 1) in vec3 aCurPos;
    layout(location = 2) in vec3 aFutPos;
    layout(location = 3) in vec3 aRgb;
    layout(location = 4) in float aDelta;
    layout(location = 5) in float aFlags;

    uniform mat4 uViewProj;
    uniform float uUnproject;
    uniform float uMorph;
    uniform float uDeltaMix;
    uniform float uScanX;
    uniform float uQueryMix;
    uniform float uGhostPass;
    uniform float uGhostT;
    uniform float uGhostAlpha;
    uniform float uTime;
    uniform float uPointScale;

    out vec3 vColor;
    out float vAlpha;
    out float vGlow;

    vec3 deltaPalette(float d) {
      // Cool muted slate for static scene -> vivid amber/coral/crimson for VGGT feature delta
      vec3 cool = vec3(0.32, 0.44, 0.56);
      vec3 mid  = vec3(0.96, 0.52, 0.28);
      vec3 hot  = vec3(0.99, 0.24, 0.36);
      vec3 peak = vec3(1.00, 0.85, 0.45);
      if (d < 0.22) return mix(cool, vec3(0.50, 0.56, 0.64), d / 0.22);
      if (d < 0.58) return mix(vec3(0.55, 0.56, 0.62), mid, (d - 0.22) / 0.36);
      if (d < 0.86) return mix(mid, hot, (d - 0.58) / 0.28);
      return mix(hot, peak, (d - 0.86) / 0.14);
    }

    void main() {
      bool isTable = mod(aFlags, 2.0) >= 0.5;
      bool isMoving = mod(floor(aFlags / 2.0), 2.0) >= 0.5;
      bool inFrame = mod(floor(aFlags / 4.0), 2.0) >= 0.5;

      // Holographic foresight target ghost pass (single airy sparse hologram at O_{t+H})
      if (uGhostPass > 0.5) {
        // Sparsely subsample 1-in-3 points so the ghost reads as a clean see-through hologram, never a dense wall
        if (!isMoving || (gl_VertexID % 3) != 0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          vAlpha = 0.0;
          vGlow = 0.0;
          vColor = vec3(0.0);
          return;
        }
        vec3 gPos = mix(aCurPos, aFutPos, uGhostT);
        // Subtle breathing pulse
        float pulse = 0.88 + 0.12 * sin(uTime * 2.6 + gPos.y * 8.0);
        vec3 gCol = mix(vec3(0.42, 0.78, 1.0), vec3(0.68, 0.56, 1.0), 0.35);
        vColor = gCol;
        vAlpha = uGhostAlpha * pulse * (0.65 + 0.35 * aDelta);
        vGlow = 0.25 * aDelta;

        vec4 gClip = uViewProj * vec4(gPos, 1.0);
        gl_Position = gClip;
        float gDist = max(0.35, gClip.w);
        float gSize = 3.2;
        gl_PointSize = clamp((gSize * uPointScale) / gDist, 1.6, 11.0);
        return;
      }

      // Subtle organic radial stagger during 2D -> 3D lift
      float radial = length(aImgPos.xz) * 0.22;
      float liftT = clamp((uUnproject * 1.24 - radial), 0.0, 1.0);
      liftT = liftT * liftT * (3.0 - 2.0 * liftT);

      // Base 3D position interpolated between current O_t and future O_{t+H}
      vec3 p3d = mix(aCurPos, aFutPos, uMorph);
      vec3 pos = mix(aImgPos, p3d, liftT);

      // Scan wave mask across X for smooth VGGT residual reveal
      float scanMask = smoothstep(uScanX + 0.14, uScanX - 0.06, pos.x);
      float localDeltaMix = uDeltaMix * scanMask;
      // Thin bright scan line highlight right at uScanX
      float scanLine = exp(-pow((pos.x - uScanX) * 16.0, 2.0)) * uDeltaMix * (1.0 - smoothstep(0.95, 1.35, uScanX));

      // Color blend: real RGB -> VGGT residual heatmap -> solid O_t deployment scene
      vec3 rgbCol = pow(aRgb, vec3(0.94));
      // Slight contrast lift so dark robot arm reads cleanly on dark canvas
      rgbCol = mix(rgbCol, vec3(0.75, 0.83, 0.94), isTable ? 0.08 : 0.06);
      vec3 dCol = deltaPalette(aDelta);

      // In Stage 4 (deployment concept), keep solid current arm O_t crisp & natural so the
      // gliding violet-cyan foresight ghost (O_t -> O_{t+H}) stands out with unmistakable contrast.
      vec3 qCol = isMoving
        ? mix(rgbCol, vec3(0.78, 0.88, 1.0), 0.22)
        : mix(rgbCol * 0.65, vec3(0.28, 0.39, 0.52), 0.52);

      vec3 col = mix(rgbCol, dCol, localDeltaMix);
      col = mix(col, qCol, uQueryMix * 0.92);
      col += vec3(0.35, 0.82, 1.0) * scanLine * 0.65;

      // Alpha & visibility
      float baseAlpha = isTable ? 0.56 : 0.94;
      // Keep Stage 1 crisp as pure 2D photo, then smoothly materialize particles as 3D lift begins
      float pointMaterialize = smoothstep(0.015, 0.14, uUnproject);
      baseAlpha *= pointMaterialize;
      // Points outside initial camera frame fade in cleanly as arm moves into view
      if (!inFrame) {
        baseAlpha *= smoothstep(0.08, 0.45, uMorph + uUnproject * 0.65);
      }
      // Dim static clutter during delta & query emphasis so solid O_t arm + ghost pop cleanly
      float activeKeep = isMoving ? 1.0 : smoothstep(0.18, 0.48, aDelta);
      float clutterDim = mix(1.0, isTable ? 0.26 : 0.42, max(localDeltaMix, uQueryMix * 0.88) * (1.0 - activeKeep));
      vAlpha = baseAlpha * clutterDim;
      vGlow = clamp((aDelta - 0.38) * 1.7, 0.0, 1.0) * localDeltaMix;
      vColor = col;

      vec4 clip = uViewProj * vec4(pos, 1.0);
      gl_Position = clip;

      float dist = max(0.35, clip.w);
      float baseSize = isTable ? 3.5 : 4.8;
      // Slightly larger pixels when flat in 2D photo mode for dense coverage
      baseSize = mix(baseSize * 1.18, baseSize, liftT);
      // Highlight high-delta points
      baseSize += vGlow * 2.6 + scanLine * 1.8;
      gl_PointSize = clamp((baseSize * uPointScale) / dist, 1.5, 22.0);
    }
  `;

  const POINT_FS = `#version 300 es
    precision highp float;
    in vec3 vColor;
    in float vAlpha;
    in float vGlow;
    out vec4 outColor;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = length(c);
      if (r > 0.5) discard;
      float core = smoothstep(0.5, 0.16, r);
      float halo = exp(-r * r * 11.0) * vGlow * 0.48;
      vec3 col = vColor + vec3(0.22, 0.14, 0.25) * halo;
      float alpha = clamp(core * vAlpha + halo * 0.55, 0.0, 1.0);
      outColor = vec4(col, alpha);
    }
  `;

  const QUAD_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in vec2 aUv;
    uniform mat4 uViewProj;
    out vec2 vUv;
    void main() {
      vUv = aUv;
      gl_Position = uViewProj * vec4(aPos, 1.0);
    }
  `;

  const QUAD_FS = `#version 300 es
    precision highp float;
    in vec2 vUv;
    uniform sampler2D uTex;
    uniform float uAlpha;
    out vec4 outColor;
    void main() {
      vec3 tex = texture(uTex, vUv).rgb;
      // Subtle vignette & frame edge polish
      vec2 edge = min(vUv, 1.0 - vUv);
      float border = 1.0 - smoothstep(0.004, 0.012, min(edge.x, edge.y));
      vec3 col = mix(tex, vec3(0.45, 0.80, 1.0), border * 0.65);
      outColor = vec4(col, uAlpha);
    }
  `;

  const LINE_VS = `#version 300 es
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

  const LINE_FS = `#version 300 es
    precision highp float;
    in vec4 vCol;
    out vec4 outColor;
    void main() {
      outColor = vCol;
    }
  `;

  const QUERY_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPos;
    layout(location = 1) in float aSize;
    layout(location = 2) in vec4 aCol;
    uniform mat4 uViewProj;
    uniform float uPointScale;
    out vec4 vCol;
    void main() {
      vCol = aCol;
      vec4 clip = uViewProj * vec4(aPos, 1.0);
      gl_Position = clip;
      gl_PointSize = clamp((aSize * uPointScale) / max(0.35, clip.w), 3.0, 34.0);
    }
  `;

  const QUERY_FS = `#version 300 es
    precision highp float;
    in vec4 vCol;
    out vec4 outColor;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = length(c);
      if (r > 0.5) discard;
      float ring = smoothstep(0.48, 0.34, r) - smoothstep(0.32, 0.22, r);
      float core = smoothstep(0.24, 0.06, r);
      float glow = exp(-r * r * 10.0) * 0.6;
      float a = clamp((core * 1.0 + ring * 0.85 + glow) * vCol.a, 0.0, 1.0);
      vec3 col = mix(vCol.rgb, vec3(1.0), core * 0.55);
      outColor = vec4(col, a);
    }
  `;

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  class Foresight3DShowcase {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('[data-stage-canvas]');
      this.badgeEl = root.querySelector('[data-stage-badge]');
      this.titleEl = root.querySelector('[data-stage-title]');
      this.detailEl = root.querySelector('[data-stage-detail]');
      this.hintEl = root.querySelector('[data-stage-hint]');
      this.stageButtons = Array.from(root.querySelectorAll('[data-stage-select]'));
      this.playBtn = root.querySelector('[data-stage-toggle]');
      this.resetBtn = root.querySelector('[data-stage-reset]');
      this.zoomInBtn = root.querySelector('[data-stage-zoom-in]');
      this.zoomOutBtn = root.querySelector('[data-stage-zoom-out]');
      this.thumbCurrent = root.querySelector('[data-thumb-current]');
      this.thumbFuture = root.querySelector('[data-thumb-future]');
      this.scrubber = root.querySelector('[data-stage-scrubber]');
      this.scrubberFill = root.querySelector('[data-stage-fill]');
      this.scrubberThumb = root.querySelector('[data-stage-thumb]');

      this.cycleDuration = 20500; // ms for full 4-stage loop (longer Stage 4 for 3 full pulse cycles)
      this.progress = 0.02;
      this.animTime = 1.12; // Dedicated animation clock that freezes in place on pause
      this.playing = true;
      this.scrubbing = false;
      this.wasPlayingBeforeScrub = false;
      this.activeStage = -1;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (this.reducedMotion) {
        this.playing = false;
        this.progress = 0.64; // Default to striking 3D VGGT delta view
      }

      // User manual orbit offsets (blended smoothly)
      this.userYaw = 0;
      this.userPitch = 0;
      this.userZoom = 1.0;
      this.targetUserYaw = 0;
      this.targetUserPitch = 0;
      this.targetUserZoom = 1.0;
      this.dragging = false;
      this.lastPtrX = 0;
      this.lastPtrY = 0;

      this.ready = false;
      this.useWebGL = false;
      this.lastFrameTime = performance.now();

      this.initControls();
      this.loadAssets();
    }

    initControls() {
      // Stage tabs (chapter jump shortcuts)
      this.stageButtons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          const targets = [0.05, 0.29, 0.52, 0.74];
          this.progress = targets[idx];
          this.updateStageUI(idx, this.progress);
        });
      });

      // Unified draggable timeline scrubber
      if (this.scrubber) {
        const scrubToClientX = (clientX) => {
          const track = this.scrubber.querySelector('.scrubber-track') || this.scrubber;
          const rect = track.getBoundingClientRect();
          if (!rect.width) return;
          const next = clamp01((clientX - rect.left) / rect.width);
          const deltaP = next - this.progress;
          this.progress = next;
          // Gently advance particle clock along with manual scrubbing so particles respond to dragging
          this.animTime = Math.max(0, this.animTime + deltaP * 8.0);
          const st = this.computeTimeline(this.progress);
          this.updateStageUI(st.stageIdx, this.progress);
        };

        this.scrubber.addEventListener('pointerdown', (e) => {
          this.scrubbing = true;
          this.wasPlayingBeforeScrub = this.playing;
          this.playing = false;
          this.scrubber.classList.add('is-scrubbing');
          this.scrubber.setPointerCapture(e.pointerId);
          scrubToClientX(e.clientX);
        });
        this.scrubber.addEventListener('pointermove', (e) => {
          if (!this.scrubbing) return;
          scrubToClientX(e.clientX);
        });
        const endScrub = (e) => {
          if (!this.scrubbing) return;
          this.scrubbing = false;
          this.scrubber.classList.remove('is-scrubbing');
          try { this.scrubber.releasePointerCapture(e.pointerId); } catch (_) {}
          if (this.wasPlayingBeforeScrub) {
            this.playing = true;
          }
          this.syncPlayButton();
        };
        this.scrubber.addEventListener('pointerup', endScrub);
        this.scrubber.addEventListener('pointercancel', endScrub);

        this.scrubber.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            this.progress = clamp01(this.progress + 0.02);
            this.animTime += 0.16;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            this.progress = clamp01(this.progress - 0.02);
            this.animTime = Math.max(0, this.animTime - 0.16);
          } else if (e.key === ' ') {
            e.preventDefault();
            this.playing = !this.playing;
            this.syncPlayButton();
          }
        });
      }

      if (this.playBtn) {
        this.playBtn.addEventListener('click', () => {
          this.playing = !this.playing;
          this.syncPlayButton();
        });
        this.syncPlayButton();
      }

      if (this.resetBtn) {
        this.resetBtn.addEventListener('click', () => {
          this.targetUserYaw = 0;
          this.targetUserPitch = 0;
          this.targetUserZoom = 1.0;
        });
      }

      if (this.zoomInBtn) {
        this.zoomInBtn.addEventListener('click', () => {
          this.targetUserZoom = Math.max(0.62, this.targetUserZoom * 0.86);
        });
      }
      if (this.zoomOutBtn) {
        this.zoomOutBtn.addEventListener('click', () => {
          this.targetUserZoom = Math.min(1.65, this.targetUserZoom * 1.16);
        });
      }

      // Pointer drag to orbit 3D point cloud + scroll-safe wheel zoom
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
        this.lastPtrX = e.clientX;
        this.lastPtrY = e.clientY;
        c.setPointerCapture(e.pointerId);
        c.classList.add('is-dragging');
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.lastPtrX;
        const dy = e.clientY - this.lastPtrY;
        this.lastPtrX = e.clientX;
        this.lastPtrY = e.clientY;
        this.targetUserYaw -= dx * 0.0068;
        this.targetUserPitch = Math.max(-0.55, Math.min(0.62, this.targetUserPitch + dy * 0.0052));
      });
      const endDrag = (e) => {
        if (!this.dragging) return;
        this.dragging = false;
        try { c.releasePointerCapture(e.pointerId); } catch (_) {}
        c.classList.remove('is-dragging');
      };
      c.addEventListener('pointerup', endDrag);
      c.addEventListener('pointercancel', endDrag);

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

      // Wheel zoom when active (after clicking/dragging 3D) or when Ctrl/Meta/Shift held (pinch-to-zoom)
      c.addEventListener('wheel', (e) => {
        const direct = this.wheelZoomActive || e.ctrlKey || e.metaKey || e.shiftKey;
        if (!direct) return;
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= 120;
        dy = Math.max(-120, Math.min(120, dy));
        const factor = Math.exp(dy * (e.ctrlKey || e.metaKey ? 0.0045 : 0.0018));
        this.targetUserZoom = Math.max(0.52, Math.min(1.80, this.targetUserZoom * factor));
      }, { passive: false });

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(c);
    }

    syncPlayButton() {
      if (!this.playBtn) return;
      this.playBtn.setAttribute('aria-pressed', String(!this.playing));
      this.playBtn.title = this.playing ? 'Pause animation' : 'Play animation';
      this.playBtn.innerHTML = this.playing
        ? '<span aria-hidden="true">❚❚</span> Pause'
        : '<span aria-hidden="true">▶</span> Play';
    }

    restart() {
      this.progress = 0.01;
      this.playing = true;
      this.targetUserYaw = 0;
      this.targetUserPitch = 0;
      this.targetUserZoom = 1.0;
      this.syncPlayButton();
    }

    async loadAssets() {
      try {
        const [metaRes, binRes] = await Promise.all([
          fetch('assets/data/foresight_meta.json'),
          fetch('assets/data/foresight_cloud.bin')
        ]);
        if (!metaRes.ok || !binRes.ok) throw new Error('Asset fetch failed');
        this.meta = await metaRes.json();
        const buf = await binRes.arrayBuffer();
        this.unpackCloud(buf);
        this.initRenderer();
        this.loadPhotoTexture('assets/images/scene_before.jpg');
        this.ready = true;
        this.root.dataset.ready = 'true';
        this.resize();
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.tick(t));
      } catch (err) {
        console.warn('Foresight 3D load error:', err);
        this.root.dataset.error = 'true';
      }
    }

    unpackCloud(buf) {
      const { count, stride, qRange } = this.meta;
      const view = new DataView(buf);
      const scale = qRange / 32000.0;
      // Interleaved float buffer for WebGL: 14 floats per point (img3, cur3, fut3, rgb3, delta1, flags1)
      const data = new Float32Array(count * 14);
      for (let i = 0; i < count; i += 1) {
        const bo = i * stride;
        const fo = i * 14;
        data[fo + 0] = view.getInt16(bo + 0, true) * scale;
        data[fo + 1] = view.getInt16(bo + 2, true) * scale;
        data[fo + 2] = view.getInt16(bo + 4, true) * scale;
        data[fo + 3] = view.getInt16(bo + 6, true) * scale;
        data[fo + 4] = view.getInt16(bo + 8, true) * scale;
        data[fo + 5] = view.getInt16(bo + 10, true) * scale;
        data[fo + 6] = view.getInt16(bo + 12, true) * scale;
        data[fo + 7] = view.getInt16(bo + 14, true) * scale;
        data[fo + 8] = view.getInt16(bo + 16, true) * scale;
        data[fo + 9] = view.getUint8(bo + 18) / 255.0;
        data[fo + 10] = view.getUint8(bo + 19) / 255.0;
        data[fo + 11] = view.getUint8(bo + 20) / 255.0;
        data[fo + 12] = view.getUint8(bo + 21) / 255.0;
        data[fo + 13] = view.getUint8(bo + 22);
      }
      this.pointData = data;
      this.pointCount = count;
    }

    initRenderer() {
      const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance' });
      if (!gl) {
        this.useWebGL = false;
        this.ctx2d = this.canvas.getContext('2d');
        return;
      }
      this.gl = gl;
      this.progPoints = createProgram(gl, POINT_VS, POINT_FS);
      this.progQuad = createProgram(gl, QUAD_VS, QUAD_FS);
      this.progLines = createProgram(gl, LINE_VS, LINE_FS);
      this.progQueries = createProgram(gl, QUERY_VS, QUERY_FS);
      if (!this.progPoints || !this.progQuad || !this.progLines || !this.progQueries) {
        this.useWebGL = false;
        this.ctx2d = this.canvas.getContext('2d');
        return;
      }
      this.useWebGL = true;

      // 1. Point cloud VAO
      this.vaoPoints = gl.createVertexArray();
      gl.bindVertexArray(this.vaoPoints);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.pointData, gl.STATIC_DRAW);
      const B = 4;
      const S = 14 * B;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 3 * B);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, S, 6 * B);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, S, 9 * B);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, S, 12 * B);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, S, 13 * B);
      gl.bindVertexArray(null);

      // 2. 2D Image Plane Quad VAO (exact 4 calibrated corners)
      const [c0, c1, c2, c3] = this.meta.corners;
      const quadVerts = new Float32Array([
        c0[0], c0[1], c0[2], 0, 0,
        c1[0], c1[1], c1[2], 1, 0,
        c2[0], c2[1], c2[2], 1, 1,
        c0[0], c0[1], c0[2], 0, 0,
        c2[0], c2[1], c2[2], 1, 1,
        c3[0], c3[1], c3[2], 0, 1
      ]);
      this.vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQuad);
      const qbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, qbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * B, 3 * B);
      gl.bindVertexArray(null);

      // 3. Dynamic Lines VAO (frustum frame + 3D motion flow arcs)
      this.vaoLines = gl.createVertexArray();
      gl.bindVertexArray(this.vaoLines);
      this.vboLines = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboLines);
      gl.bufferData(gl.ARRAY_BUFFER, 24000 * B, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7 * B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7 * B, 3 * B);
      gl.bindVertexArray(null);

      // 4. Dynamic Query Nodes VAO (Z_delta tokens + animated flow beads)
      this.vaoQueries = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQueries);
      this.vboQueries = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboQueries);
      gl.bufferData(gl.ARRAY_BUFFER, 4000 * B, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 8 * B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 8 * B, 3 * B);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 8 * B, 4 * B);
      gl.bindVertexArray(null);

      // Uniform locations
      this.uP = {
        vp: gl.getUniformLocation(this.progPoints, 'uViewProj'),
        unproject: gl.getUniformLocation(this.progPoints, 'uUnproject'),
        morph: gl.getUniformLocation(this.progPoints, 'uMorph'),
        deltaMix: gl.getUniformLocation(this.progPoints, 'uDeltaMix'),
        scanX: gl.getUniformLocation(this.progPoints, 'uScanX'),
        queryMix: gl.getUniformLocation(this.progPoints, 'uQueryMix'),
        ghostPass: gl.getUniformLocation(this.progPoints, 'uGhostPass'),
        ghostT: gl.getUniformLocation(this.progPoints, 'uGhostT'),
        ghostAlpha: gl.getUniformLocation(this.progPoints, 'uGhostAlpha'),
        time: gl.getUniformLocation(this.progPoints, 'uTime'),
        scale: gl.getUniformLocation(this.progPoints, 'uPointScale')
      };
      this.uQ = {
        vp: gl.getUniformLocation(this.progQuad, 'uViewProj'),
        tex: gl.getUniformLocation(this.progQuad, 'uTex'),
        alpha: gl.getUniformLocation(this.progQuad, 'uAlpha')
      };
      this.uL = { vp: gl.getUniformLocation(this.progLines, 'uViewProj') };
      this.uZ = {
        vp: gl.getUniformLocation(this.progQueries, 'uViewProj'),
        scale: gl.getUniformLocation(this.progQueries, 'uPointScale')
      };

      // Placeholder 1x1 texture until JPEG loads
      this.photoTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 23, 38, 255]));
    }

    loadPhotoTexture(url) {
      const img = new Image();
      img.onload = () => {
        this.photoImg = img;
        if (!this.useWebGL) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      };
      img.src = url;
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
      if (this.useWebGL) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    computeTimeline(p) {
      // 4-stage choreography over p in [0, 1] (20.5s total)
      // Stage 0: 0.00 - 0.17 (~3.5s) Flat 2D RGB observation O_t
      // Stage 1: 0.17 - 0.39 (~4.5s) 2D Image -> 3D Point Cloud lifting + camera orbit
      // Stage 2: 0.39 - 0.62 (~4.7s) Rigid 3D motion O_t -> O_{t+H} + VGGT feature delta scan
      // Stage 3: 0.62 - 1.00 (~7.8s) Z_delta schematic foresight ghost + 3 full streamline pulse cycles
      let stageIdx = 0;
      let stageLocal = 0;
      if (p < 0.17) { stageIdx = 0; stageLocal = p / 0.17; }
      else if (p < 0.39) { stageIdx = 1; stageLocal = (p - 0.17) / 0.22; }
      else if (p < 0.62) { stageIdx = 2; stageLocal = (p - 0.39) / 0.23; }
      else { stageIdx = 3; stageLocal = (p - 0.62) / 0.38; }

      // Smoothly return at very end [0.955, 1.00] for seamless looping
      const loopReset = smoothstep(0.955, 1.0, p);

      // 2D -> 3D lift factor
      const unproject = smoothstep(0.165, 0.34, p) * (1.0 - loopReset);

      // Photo plane opacity: crisp in Stage 0, dissolves to ghostly reference plane in Stage 1
      const photoAlpha = (1.0 - smoothstep(0.145, 0.27, p)) * 0.94 + loopReset * 0.94;
      const frameAlpha = (1.0 - smoothstep(0.36, 0.45, p)) * 0.85 + loopReset * 0.85;

      // Temporal 3D morph O_t -> O_{t+H} in Stage 2, then returns cleanly to solid O_t right as Stage 3 opens
      const morphUp = smoothstep(0.385, 0.505, p);
      const morphBack = smoothstep(0.605, 0.655, p);
      const morph = morphUp * (1.0 - morphBack);

      // VGGT feature delta reveal in Stage 2, fades out as Stage 3 deployment opens
      const deltaIn = smoothstep(0.415, 0.495, p);
      const deltaOut = smoothstep(0.605, 0.665, p);
      const deltaMix = deltaIn * (1.0 - deltaOut) * (1.0 - loopReset);
      const scanX = lerp(-0.85, 1.35, smoothstep(0.40, 0.515, p));

      // Spatial transition queries Z_delta + sparse target hologram in Stage 3 (full visibility ~6.0s -> 3 full pulse cycles)
      const queryMix = smoothstep(0.615, 0.66, p) * (1.0 - smoothstep(0.945, 0.99, p));

      // Camera orbit keyframes (auto-scaled for calibrated fovY so scene never clips top/bottom)
      const fovScale = Math.min(1.42, Math.max(1.06, Math.tan((55 * Math.PI) / 360) / Math.tan(((this.meta?.fovY || 55) * Math.PI) / 360) * 1.06));
      const basePitch = 0.927;
      let yaw = lerp(-0.04, 0.04, smoothstep(0.0, 0.17, p));
      let pitch = basePitch;
      let dist = 1.14 * fovScale;

      // Lift into sweeping 3/4 isometric perspective
      const t1 = smoothstep(0.16, 0.39, p);
      yaw = lerp(yaw, 0.52, t1);
      pitch = lerp(pitch, 0.52, t1);
      dist = lerp(dist, 1.44 * fovScale, t1);

      // Frame both moving arm and lifted object during VGGT delta reveal
      const t2 = smoothstep(0.39, 0.62, p);
      yaw = lerp(yaw, 0.24, t2);
      pitch = lerp(pitch, 0.56, t2);
      dist = lerp(dist, 1.38 * fovScale, t2);

      // Lower side-3/4 angle in Stage 4 so vertical upward lift O_t -> O_{t+H} separates cleanly across screen
      const t3 = smoothstep(0.62, 0.72, p);
      const t3Drift = smoothstep(0.72, 0.95, p);
      yaw = lerp(yaw, 0.78, t3);
      yaw = lerp(yaw, 0.66, t3Drift);
      pitch = lerp(pitch, 0.30, t3);
      dist = lerp(dist, 1.36 * fovScale, t3);

      // Smooth return to frontal camera at loop boundary
      yaw = lerp(yaw, -0.04, loopReset);
      pitch = lerp(pitch, basePitch, loopReset);
      dist = lerp(dist, 1.14 * fovScale, loopReset);

      return { stageIdx, stageLocal, unproject, photoAlpha, frameAlpha, morph, deltaMix, scanX, queryMix, yaw, pitch, dist };
    }

    updateStageUI(stageIdx, progress) {
      if (this.activeStage !== stageIdx) {
        this.activeStage = stageIdx;
        const def = STAGE_DEFS[stageIdx];
        if (this.badgeEl) this.badgeEl.innerHTML = def.badge;
        if (this.titleEl) this.titleEl.innerHTML = def.title;
        if (this.detailEl) this.detailEl.innerHTML = def.detail;
        if (this.hintEl) {
          this.hintEl.innerHTML = def.hint || 'Drag to orbit 3D · 8,552 measured RoboTwin points';
        }
        this.stageButtons.forEach((btn, i) => {
          const isCur = i === stageIdx;
          btn.classList.toggle('is-active', isCur);
          btn.setAttribute('aria-selected', String(isCur));
        });
        if (this.thumbCurrent) this.thumbCurrent.classList.toggle('is-active', stageIdx === 0 || stageIdx === 1 || stageIdx === 3);
        if (this.thumbFuture) this.thumbFuture.classList.toggle('is-active', stageIdx === 2);
      }
      const pct = clamp01(progress) * 100;
      if (this.scrubberFill) this.scrubberFill.style.width = `${pct.toFixed(2)}%`;
      if (this.scrubberThumb) this.scrubberThumb.style.left = `${pct.toFixed(2)}%`;
      if (this.scrubber) this.scrubber.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    buildCamera(state) {
      const target = this.meta.camTarget;
      const yaw = state.yaw + this.userYaw;
      const pitch = Math.max(0.18, Math.min(1.38, state.pitch + this.userPitch));
      const dist = state.dist * this.userZoom;

      // Subtle target shift toward moving arm & lifted object during Stage 2 & 3
      const focusWeight = Math.max(state.deltaMix, state.queryMix) * 0.14;
      const tx = target[0] - focusWeight * 0.35;
      const ty = target[1] + 0.06 + focusWeight * 0.30;
      const tz = target[2] + focusWeight * 0.10;

      const eye = [
        tx + dist * Math.cos(pitch) * Math.sin(yaw),
        ty + dist * Math.sin(pitch),
        tz + dist * Math.cos(pitch) * Math.cos(yaw)
      ];
      const aspect = (this.width || 16) / (this.height || 9);
      const proj = mat4Perspective((this.meta.fovY * Math.PI) / 180, aspect, 0.05, 25.0);
      const view = mat4LookAt(eye, [tx, ty, tz], [0, 1, 0]);
      return { vp: mat4Multiply(proj, view), eye, target: [tx, ty, tz] };
    }

    renderWebGL(state, timeSec) {
      const gl = this.gl;
      const { vp } = this.buildCamera(state);

      gl.clearColor(0.039, 0.062, 0.105, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // 1. Draw calibrated 2D RGB photo quad on the image plane during Stage 0 -> 1
      if (state.photoAlpha > 0.015) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.useProgram(this.progQuad);
        gl.uniformMatrix4fv(this.uQ.vp, false, vp);
        gl.uniform1f(this.uQ.alpha, state.photoAlpha);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
        gl.uniform1i(this.uQ.tex, 0);
        gl.bindVertexArray(this.vaoQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.depthMask(true);
      }

      // 2. Draw 7,884 real RGB-D + VGGT delta points (solid O_t scene in Stage 4)
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(this.progPoints);
      gl.uniformMatrix4fv(this.uP.vp, false, vp);
      gl.uniform1f(this.uP.unproject, state.unproject);
      gl.uniform1f(this.uP.morph, state.morph);
      gl.uniform1f(this.uP.deltaMix, state.deltaMix);
      gl.uniform1f(this.uP.scanX, state.scanX);
      gl.uniform1f(this.uP.queryMix, state.queryMix);
      gl.uniform1f(this.uP.ghostPass, 0.0);
      gl.uniform1f(this.uP.ghostT, 0.0);
      gl.uniform1f(this.uP.ghostAlpha, 0.0);
      gl.uniform1f(this.uP.time, timeSec);
      const pxScale = (this.height || 500) * this.dpr / 460.0;
      gl.uniform1f(this.uP.scale, pxScale);
      gl.bindVertexArray(this.vaoPoints);
      gl.drawArrays(gl.POINTS, 0, this.pointCount);

      // 2b. Stage 4 Single Airy Target Hologram at O_{t+H} (no stacked multi-ghost clutter)
      if (state.queryMix > 0.02) {
        gl.depthMask(false);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(this.uP.ghostPass, 1.0);
        gl.uniform1f(this.uP.ghostT, 1.0);
        gl.uniform1f(this.uP.ghostAlpha, state.queryMix * 0.62);
        gl.drawArrays(gl.POINTS, 0, this.pointCount);
        gl.depthMask(true);
      }

      // 3. Draw 3D Lines: image-plane frustum border + camera rays during lift + 3D foresight flow arcs in Stage 3
      const lineVerts = [];
      const pushSeg = (a, b, r, g, bl, al) => {
        lineVerts.push(a[0], a[1], a[2], r, g, bl, al, b[0], b[1], b[2], r, g, bl, al);
      };

      if (state.frameAlpha > 0.02) {
        const [c0, c1, c2, c3] = this.meta.corners;
        const a = state.frameAlpha * 0.55;
        pushSeg(c0, c1, 0.45, 0.78, 1.0, a);
        pushSeg(c1, c2, 0.45, 0.78, 1.0, a);
        pushSeg(c2, c3, 0.45, 0.78, 1.0, a);
        pushSeg(c3, c0, 0.45, 0.78, 1.0, a);

        // Subtle camera frustum rays during 2D -> 3D lift
        const rayA = Math.sin(state.unproject * Math.PI) * 0.34;
        if (rayA > 0.02) {
          const cam = this.meta.camEye;
          pushSeg(cam, c0, 0.45, 0.78, 1.0, rayA);
          pushSeg(cam, c1, 0.45, 0.78, 1.0, rayA);
          pushSeg(cam, c2, 0.45, 0.78, 1.0, rayA);
          pushSeg(cam, c3, 0.45, 0.78, 1.0, rayA);
        }
      }

      // Sparse, well-spaced 3D motion streamlines + Z_delta query anchors (max ~14 clean arcs, zero tangle)
      const queryVerts = [];
      if (state.queryMix > 0.02 && this.meta.queries) {
        const qm = state.queryMix;
        const qs = this.meta.queries;
        // Pick spatially separated moving queries (greedy min-distance spacing) for clean readable flow lines
        const chosen = [];
        for (let i = 0; i < qs.length && chosen.length < 14; i += 1) {
          const q = qs[i];
          const dist3 = Math.hypot(q.fut[0] - q.cur[0], q.fut[1] - q.cur[1], q.fut[2] - q.cur[2]);
          if (!q.moving || dist3 < 0.045) continue;
          let tooClose = false;
          for (let j = 0; j < chosen.length; j += 1) {
            const c = chosen[j].cur;
            if (Math.hypot(q.cur[0] - c[0], q.cur[1] - c[1], q.cur[2] - c[2]) < 0.11) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) chosen.push(q);
        }

        const pulseCycle = ((this.animTime * 0.52) % 1.0 + 1.0) % 1.0;
        for (let i = 0; i < chosen.length; i += 1) {
          const q = chosen[i];
          const p0 = q.cur;
          const p1 = q.fut;
          const d = q.delta;
          const dist3 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);

          // Small crisp violet anchor dot at O_t start
          queryVerts.push(p0[0], p0[1], p0[2], 5.2, 0.74, 0.54, 1.0, qm * 0.72);
          // Crisp cyan endpoint dot on the O_{t+H} hologram
          queryVerts.push(p1[0], p1[1], p1[2], 5.6, 0.34, 0.90, 1.0, qm * 0.80);

          // Sleek 3D curved streamline from O_t -> O_{t+H}
          const segs = 12;
          const arcLift = 0.024 + dist3 * 0.14;
          const mid = [
            (p0[0] + p1[0]) * 0.5,
            (p0[1] + p1[1]) * 0.5 + arcLift,
            (p0[2] + p1[2]) * 0.5
          ];
          let prev = p0;
          for (let s = 1; s <= segs; s += 1) {
            const t = s / segs;
            const it = 1 - t;
            const pt = [
              it * it * p0[0] + 2 * it * t * mid[0] + t * t * p1[0],
              it * it * p0[1] + 2 * it * t * mid[1] + t * t * p1[1],
              it * it * p0[2] + 2 * it * t * mid[2] + t * t * p1[2]
            ];
            const colR = lerp(0.74, 0.30, t);
            const colG = lerp(0.52, 0.92, t);
            const colB = lerp(1.0, 1.0, t);
            pushSeg(prev, pt, colR, colG, colB, qm * 0.85 * (0.45 + 0.55 * t));
            prev = pt;
          }

          // Smooth travelling foresight energy pulse gliding O_t -> O_{t+H}
          const bt = (pulseCycle + i * 0.04) % 1.0;
          const ib = 1 - bt;
          const bx = ib * ib * p0[0] + 2 * ib * bt * mid[0] + bt * bt * p1[0];
          const by = ib * ib * p0[1] + 2 * ib * bt * mid[1] + bt * bt * p1[1];
          const bz = ib * ib * p0[2] + 2 * ib * bt * mid[2] + bt * bt * p1[2];
          queryVerts.push(bx, by, bz, 6.4, 0.48, 0.96, 1.0, qm * Math.sin(Math.max(0.06, bt) * Math.PI) * 0.95);
        }
      }

      if (lineVerts.length > 0) {
        gl.depthMask(false);
        gl.useProgram(this.progLines);
        gl.uniformMatrix4fv(this.uL.vp, false, vp);
        gl.bindVertexArray(this.vaoLines);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboLines);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(lineVerts));
        gl.drawArrays(gl.LINES, 0, lineVerts.length / 7);
        gl.depthMask(true);
      }

      if (queryVerts.length > 0) {
        gl.depthMask(false);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive glow for Z_delta queries
        gl.useProgram(this.progQueries);
        gl.uniformMatrix4fv(this.uZ.vp, false, vp);
        gl.uniform1f(this.uZ.scale, pxScale);
        gl.bindVertexArray(this.vaoQueries);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboQueries);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(queryVerts));
        gl.drawArrays(gl.POINTS, 0, queryVerts.length / 8);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(true);
      }

      gl.bindVertexArray(null);
    }

    render2DFallback(state) {
      const ctx = this.ctx2d;
      if (!ctx) return;
      const w = this.width, h = this.height;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#0a101b';
      ctx.fillRect(0, 0, w, h);
      const { vp } = this.buildCamera(state);
      const d = this.pointData;
      const step = 2; // subsample slightly for silky 2D fallback
      for (let i = 0; i < this.pointCount; i += step) {
        const o = i * 14;
        const x = lerp(d[o + 0], lerp(d[o + 3], d[o + 6], state.morph), state.unproject);
        const y = lerp(d[o + 1], lerp(d[o + 4], d[o + 7], state.morph), state.unproject);
        const z = lerp(d[o + 2], lerp(d[o + 5], d[o + 8], state.morph), state.unproject);
        const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
        if (cw <= 0.1) continue;
        const sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw * 0.5 + 0.5) * w;
        const sy = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw * 0.5) * h;
        const del = d[o + 12];
        const dm = state.deltaMix;
        const r = Math.round(lerp(d[o + 9] * 255, del > 0.35 ? 245 : 85, dm));
        const g = Math.round(lerp(d[o + 10] * 255, del > 0.35 ? 92 : 112, dm));
        const b = Math.round(lerp(d[o + 11] * 255, del > 0.35 ? 78 : 140, dm));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }

    tick(now) {
      requestAnimationFrame((t) => this.tick(t));
      if (!this.ready || !this.width || !this.height) return;

      const dt = Math.min(64, now - this.lastFrameTime);
      this.lastFrameTime = now;

      if (this.playing) {
        this.progress = (this.progress + dt / this.cycleDuration) % 1.0;
        if (!this.reducedMotion) {
          this.animTime += dt * 0.001;
        }
      }

      // Smooth damping on manual orbit
      this.userYaw += (this.targetUserYaw - this.userYaw) * 0.14;
      this.userPitch += (this.targetUserPitch - this.userPitch) * 0.14;
      this.userZoom += (this.targetUserZoom - this.userZoom) * 0.14;

      const state = this.computeTimeline(this.progress);
      this.updateStageUI(state.stageIdx, this.progress);

      if (this.useWebGL) {
        this.renderWebGL(state, this.animTime);
      } else {
        this.render2DFallback(state);
      }
    }
  }

  window.initForesight3D = function initForesight3D() {
    const root = document.querySelector('[data-foresight-stage]');
    if (!root) return null;
    return new Foresight3DShowcase(root);
  };
})();
