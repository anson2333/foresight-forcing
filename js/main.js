/* Foresight Forcing — Main Site Interactions */

const foresight3D = typeof window.initForesight3D === 'function' ? window.initForesight3D() : null;
const probe3D = typeof window.initProbe3D === 'function' ? window.initProbe3D() : null;

const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('[data-nav-links]');
const replayButton = document.querySelector('[data-intro-replay]');

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

if (replayButton) {
  replayButton.addEventListener('click', () => {
    navLinks?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    const stage = document.querySelector('#foresight-stage');
    if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    foresight3D?.restart();
  });
}

const revealItems = document.querySelectorAll(
  '.section-heading, .idea-step, .wide-figure, .method-principles article, .evidence-figure, .results-explorer, .ablation-band, .latency-compare, .citation-grid'
);
if ('IntersectionObserver' in window) {
  revealItems.forEach((item) => item.classList.add('reveal-item'));
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.02, rootMargin: '0px 0px 80px 0px' });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

/* Real Model Z_delta vs VGGT Teacher Interactive Explorer */
const zdeltaCases = {
  rt_7414: {
    prefix: 'assets/images/zdelta/rt_7414',
    desc: 'Left AGILEX arm lifts the green bottle on a randomized cluttered tabletop (step 10,490). With zero future frames supplied, F<sup>2</sup> recovers the teacher VGGT feature delta across the moving arm and bottle while suppressing static distractors.',
    metrics: [
      ['r = 0.901', 'Norm Pearson'],
      ['0.686', 'Top-25% Cos'],
      ['0.625', 'Top-20% IoU']
    ]
  },
  rt_932848: {
    prefix: 'assets/images/zdelta/rt_932848',
    desc: 'Arm places the red block onto the blue target pad across textured clutter (RoboTwin randomized split, step 10,490). Predicted Z<sub>Δ</sub> matches frozen VGGT teacher magnitude with r = 0.955 and global patch cosine 0.720.',
    metrics: [
      ['r = 0.955', 'Norm Pearson'],
      ['0.720', 'Patch Cos'],
      ['0.472', 'Top-20% IoU']
    ]
  },
  lib_134054: {
    prefix: 'assets/images/zdelta/lib_134054',
    desc: 'Held-out LIBERO-Goal TEST sample (push plate to front of stove, step 33,060). Predicted from O<sub>t</sub> alone, Z<sub>Δ</sub> localizes the moving arm and stove interaction zone (r = 0.876; frozen displacement probe achieves 0.996 direction cosine).',
    metrics: [
      ['r = 0.876', 'Norm Pearson'],
      ['0.655', 'Patch Cos'],
      ['0.667', 'Top-20% IoU']
    ]
  },
  lib_194590: {
    prefix: 'assets/images/zdelta/lib_194590',
    desc: 'LIBERO-10 mug-to-microwave manipulation (step 33,060). Student Z<sub>Δ</sub> predictions concentrate sharply on the active robot wrist and mug trajectory, achieving 0.818 top-20% IoU with the training-only VGGT teacher.',
    metrics: [
      ['r = 0.789', 'Norm Pearson'],
      ['0.653', 'Patch Cos'],
      ['0.818', 'Top-20% IoU']
    ]
  }
};

const zdRoot = document.querySelector('[data-zdelta-explorer]');
if (zdRoot) {
  const tabs = zdRoot.querySelectorAll('[data-zd-case]');
  const modeBtns = zdRoot.querySelectorAll('[data-zd-mode]');
  const gridPanel = zdRoot.querySelector('[data-zd-grid]');
  const wipePanel = zdRoot.querySelector('[data-zd-wipe-panel]');
  const wipeStage = zdRoot.querySelector('[data-zd-wipe-stage]');
  const wipeRange = zdRoot.querySelector('[data-zd-wipe-range]');
  const descEl = zdRoot.querySelector('[data-zd-desc]');
  const metricsEl = zdRoot.querySelector('[data-zd-metrics]');

  function renderZdCase(key) {
    const item = zdeltaCases[key];
    if (!item) return;
    tabs.forEach((btn) => {
      const active = btn.dataset.zdCase === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    ['cur', 'fut', 'teacher', 'student'].forEach((slot) => {
      const img = zdRoot.querySelector(`[data-zd-img="${slot}"]`);
      if (img) img.src = `${item.prefix}_${slot}.jpg`;
    });
    const wStu = zdRoot.querySelector('[data-zd-wipe="student"]');
    const wTea = zdRoot.querySelector('[data-zd-wipe="teacher"]');
    const rCur = zdRoot.querySelector('[data-zd-wipe-ref="cur"]');
    const rFut = zdRoot.querySelector('[data-zd-wipe-ref="fut"]');
    if (wStu) wStu.src = `${item.prefix}_student.jpg`;
    if (wTea) wTea.src = `${item.prefix}_teacher.jpg`;
    if (rCur) rCur.src = `${item.prefix}_cur.jpg`;
    if (rFut) rFut.src = `${item.prefix}_fut.jpg`;

    if (descEl) descEl.innerHTML = item.desc;
    if (metricsEl) {
      metricsEl.innerHTML = item.metrics
        .map(([val, lbl]) => `<span><b>${val}</b> ${lbl}</span>`)
        .join('');
    }
  }

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => renderZdCase(btn.dataset.zdCase));
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.zdMode;
      modeBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      if (gridPanel) gridPanel.hidden = mode !== 'grid';
      if (wipePanel) wipePanel.hidden = mode !== 'wipe';
    });
  });

  if (wipeRange && wipeStage) {
    wipeRange.addEventListener('input', () => {
      wipeStage.style.setProperty('--wipe', `${wipeRange.value}%`);
    });
  }
}

/* Simulation Benchmarks Explorer */
const resultData = {
  robotwin: {
    label: 'RoboTwin 2.0 Full · Average',
    score: '95.01%',
    detail: '50 dual-arm tasks, clean and randomized evaluation',
    rows: [
      ['F²', 95.01, true],
      ['Flex-π', 94.55, false],
      ['ImageWAM', 93.38, false],
      ['LingBot-VA', 92.20, false]
    ]
  },
  'libero-plus': {
    label: 'LIBERO-Plus · Overall',
    score: '84.5%',
    detail: 'Seven perturbation dimensions from camera shift to observation noise',
    rows: [
      ['F²', 84.5, true],
      ['π₀.₅', 84.4, false],
      ['ImageWAM', 81.6, false],
      ['X-WAM', 74.8, false]
    ]
  },
  c2r: {
    label: 'RoboTwin Clean-to-Random · Average',
    score: '77.45%',
    detail: 'Policies trained on clean demonstrations and evaluated on shifted scenes',
    rows: [
      ['F²', 77.45, true],
      ['UniWAM', 71.34, false],
      ['ImageWAM', 70.35, false],
      ['4D-WAM', 61.65, false]
    ]
  },
  libero: {
    label: 'LIBERO · Four-suite average',
    score: '98.5%',
    detail: 'Spatial, Object, Goal, and Long suites',
    rows: [
      ['F²', 98.5, true],
      ['LingBot-VA', 98.5, false],
      ['ImageWAM', 98.4, false],
      ['π₀.₅', 96.9, false]
    ]
  }
};

const resultLabel = document.querySelector('[data-result-label]');
const resultScore = document.querySelector('[data-result-score]');
const resultDetail = document.querySelector('[data-result-detail]');
const resultChart = document.querySelector('[data-result-chart]');
const resultTabs = document.querySelectorAll('[data-result-tab]');

function renderResult(key) {
  const result = resultData[key];
  if (!result || !resultChart) return;
  const floor = Math.min(...result.rows.map((row) => row[1])) - 5;

  resultLabel.textContent = result.label;
  resultScore.textContent = result.score;
  resultDetail.textContent = result.detail;
  resultChart.innerHTML = result.rows.map(([name, score, ours]) => {
    const width = Math.max(8, ((score - floor) / (100 - floor)) * 100);
    return `
      <div class="chart-row${ours ? ' is-ours' : ''}">
        <span>${name}</span>
        <div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div>
        <strong>${score.toFixed(score % 1 === 0 ? 1 : 2)}</strong>
      </div>`;
  }).join('');
}

resultTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    resultTabs.forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    renderResult(tab.dataset.resultTab);
  });
});

renderResult('robotwin');

/* Controlled Ablation Explorer (LIBERO-Plus) */
const ablationData = {
  target: {
    title: 'Feature deltas outperform single-frame targets.',
    desc: 'On LIBERO-Plus, delta supervision reaches 84.5%, compared with 83.2% for current features, 81.2% for future features, and 82.3% without distillation.',
    rows: [
      ['F<sup>2</sup> · delta', 84.5],
      ['Current', 83.2],
      ['No distill.', 82.3],
      ['Future', 81.2]
    ]
  },
  teacher: {
    title: 'Geometry-oriented VGGT provides the strongest supervision.',
    desc: 'Among tested frozen teachers on LIBERO-Plus, VGGT (84.5%) outperforms semantic DINOv3 (83.4%) and π³ (82.9%), showing that both 3D geometry and teacher choice matter.',
    rows: [
      ['VGGT (F<sup>2</sup>)', 84.5],
      ['DINOv3', 83.4],
      ['π<sup>3</sup>', 82.9]
    ]
  },
  budget: {
    title: 'Frame-matched query budget (N = 392) performs best.',
    desc: 'Matching LIBERO’s 14×28 two-view visual token grid (392 queries) reaches 84.5%, outperforming both smaller (200 → 82.8%) and larger (512 → 82.1%) query budgets.',
    rows: [
      ['392 (matched)', 84.5],
      ['200 queries', 82.8],
      ['512 queries', 82.1]
    ]
  }
};

const abRoot = document.querySelector('[data-ablation-explorer]');
if (abRoot) {
  const abTabs = abRoot.querySelectorAll('[data-ablation-tab]');
  const abTitle = abRoot.querySelector('[data-ablation-title]');
  const abDesc = abRoot.querySelector('[data-ablation-desc]');
  const abBars = abRoot.querySelector('[data-ablation-bars]');

  function renderAblation(key) {
    const item = ablationData[key];
    if (!item || !abBars) return;
    abTabs.forEach((t) => {
      const act = t.dataset.ablationTab === key;
      t.classList.toggle('is-active', act);
      t.setAttribute('aria-selected', String(act));
    });
    if (abTitle) abTitle.textContent = item.title;
    if (abDesc) abDesc.textContent = item.desc;
    abBars.innerHTML = item.rows
      .map(([lbl, val]) => `<div><span>${lbl}</span><i style="--value: ${val}%"></i><b>${val.toFixed(1)}</b></div>`)
      .join('');
  }

  abTabs.forEach((t) => t.addEventListener('click', () => renderAblation(t.dataset.ablationTab)));
}

/* Inference Latency Toggle (Eager vs CUDA Graph) */
const latData = {
  eager: {
    baseMs: '187.41 ms', baseW: '96.1%',
    oursMs: '195.01 ms', oursW: '100%',
    note: 'Median latency per 16-action chunk · H200 · BF16 · 10 denoising steps · +4.1% overhead'
  },
  cudagraph: {
    baseMs: '80.20 ms', baseW: '41.1%',
    oursMs: '99.53 ms', oursW: '51.0%',
    note: 'CUDA Graph deployed mode · H200 · BF16 · 49% faster than eager F² (relative to eager 195.01 ms)'
  }
};

const latRoot = document.querySelector('[data-latency-compare]');
if (latRoot) {
  const latBtns = latRoot.querySelectorAll('[data-latency-mode]');
  const barBase = latRoot.querySelector('[data-lat-bar="base"]');
  const barOurs = latRoot.querySelector('[data-lat-bar="ours"]');
  const valBase = latRoot.querySelector('[data-lat-val="base"]');
  const valOurs = latRoot.querySelector('[data-lat-val="ours"]');
  const latNote = latRoot.querySelector('[data-lat-note]');

  latBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = latData[btn.dataset.latencyMode];
      if (!m) return;
      latBtns.forEach((b) => {
        const act = b === btn;
        b.classList.toggle('is-active', act);
        b.setAttribute('aria-selected', String(act));
      });
      if (barBase) barBase.style.width = m.baseW;
      if (barOurs) barOurs.style.width = m.oursW;
      if (valBase) valBase.textContent = m.baseMs;
      if (valOurs) valOurs.textContent = m.oursMs;
      if (latNote) latNote.textContent = m.note;
    });
  });
}

/* Real-World Rollout Video Gallery */
const realVideoTasks = {
  cup_stacking: {
    title: 'Cup stacking',
    score: 'F² 93% · ImageWAM 67% · π₀.₅ 73%',
    rate: '6× real-time · full rollout',
    desc: 'Bimanual pyramid cup stacking requiring precise vertical alignment and contact-rich placement (full-task completion).',
    src: 'assets/videos/cup_stacking.mp4',
    poster: 'assets/videos/cup_stacking.jpg'
  },
  towel_folding: {
    title: 'Towel folding',
    score: 'F² 100% · ImageWAM 87% · π₀.₅ 100%',
    rate: '6× real-time · full rollout',
    desc: 'Coordinated bimanual folding of deformable cloth with continuous geometry changes across folding creases (full-task completion).',
    src: 'assets/videos/towel_folding.mp4',
    poster: 'assets/videos/towel_folding.jpg'
  },
  egg_transfer: {
    title: 'Egg transfer',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 80%',
    rate: '6× real-time · full rollout',
    desc: 'Delicate picking and transfer of eggs into target slots without dropping or crushing (full-task completion).',
    src: 'assets/videos/egg_transfer.mp4',
    poster: 'assets/videos/egg_transfer.jpg'
  },
  breakfast_preparation: {
    title: 'Breakfast preparation',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 87%',
    rate: '6× real-time · full rollout',
    desc: 'Long-horizon sequential food assembly across multiple objects and intermediate configurations (full-task completion).',
    src: 'assets/videos/breakfast_preparation.mp4',
    poster: 'assets/videos/breakfast_preparation.jpg'
  },
  tool_stowing: {
    title: 'Tool stowing*',
    score: 'F² 65.0% · ImageWAM 31.7% · π₀.₅ 63.3%',
    rate: '6× real-time · full rollout',
    desc: 'Sequential placement of four articulated tools into fitted organizer slots (item-level score across 4 tools per trial).',
    src: 'assets/videos/tool_stowing.mp4',
    poster: 'assets/videos/tool_stowing.jpg'
  },
  size_sorting: {
    title: 'Size sorting*',
    score: 'F² 96.2% · ImageWAM 89.3% · π₀.₅ 97.7%',
    rate: '6× real-time · full rollout',
    desc: 'Continuous sorting of 15 blocks by physical size into designated bins (item-level score across 15 blocks per trial).',
    src: 'assets/videos/size_sorting.mp4',
    poster: 'assets/videos/size_sorting.jpg'
  }
};

const galleryRoot = document.querySelector('[data-video-gallery]');
if (galleryRoot) {
  const videoEl = galleryRoot.querySelector('[data-featured-video]');
  const titleEl = galleryRoot.querySelector('[data-video-title]');
  const scoreEl = galleryRoot.querySelector('[data-video-score]');
  const rateEl = galleryRoot.querySelector('[data-video-rate-tag]');
  const descEl = galleryRoot.querySelector('[data-video-desc]');
  const cards = galleryRoot.querySelectorAll('[data-video-task]');

  function selectVideoTask(key, autoplay = true) {
    const item = realVideoTasks[key];
    if (!item || !videoEl) return;
    cards.forEach((card) => {
      const active = card.dataset.videoTask === key;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-selected', String(active));
    });
    titleEl.textContent = item.title;
    scoreEl.textContent = item.score;
    if (rateEl) rateEl.textContent = item.rate;
    if (descEl) descEl.textContent = item.desc;
    videoEl.poster = item.poster;
    videoEl.src = item.src;
    videoEl.load();
    if (autoplay) {
      videoEl.play().catch(() => {});
    }
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => selectVideoTask(card.dataset.videoTask, true));
  });

  // Auto-play featured rollout when scrolled into view, pause when scrolled away
  if ('IntersectionObserver' in window && videoEl) {
    const vidObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          videoEl.play().catch(() => {});
        } else {
          videoEl.pause();
        }
      });
    }, { threshold: 0.35 });
    vidObserver.observe(videoEl);
  }
}

/* Copy BibTeX */
const copyButton = document.querySelector('[data-copy-bibtex]');
if (copyButton) {
  copyButton.addEventListener('click', async () => {
    const bibtex = document.querySelector('#bibtex').textContent;
    try {
      await navigator.clipboard.writeText(bibtex);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => { copyButton.textContent = 'Copy BibTeX'; }, 1500);
    } catch {
      copyButton.textContent = 'Select text to copy';
    }
  });
}

/* Expandable Figure Lightbox */
const dialog = document.querySelector('[data-image-dialog]');
const dialogImage = document.querySelector('[data-dialog-image]');
const dialogViewport = dialog?.querySelector('.dialog-viewport');
let dialogZoom = 1;

function setDialogZoom(nextZoom) {
  dialogZoom = Math.min(3, Math.max(0.75, nextZoom));
  if (dialogImage) dialogImage.style.width = `${dialogZoom * 100}%`;
}

if (dialog && dialogImage && dialogViewport) {
  document.querySelectorAll('[data-expand-image]').forEach((button) => {
    button.addEventListener('click', () => {
      dialogImage.src = button.dataset.expandImage;
      setDialogZoom(1);
      dialog.showModal();
      dialogViewport.scrollTo(0, 0);
    });
  });
  document.querySelector('[data-dialog-zoom-in]')?.addEventListener('click', () => setDialogZoom(dialogZoom + 0.25));
  document.querySelector('[data-dialog-zoom-out]')?.addEventListener('click', () => setDialogZoom(dialogZoom - 0.25));
  document.querySelector('[data-dialog-zoom-reset]')?.addEventListener('click', () => setDialogZoom(1));
  dialogImage.addEventListener('dblclick', () => setDialogZoom(dialogZoom === 1 ? 2 : 1));
  document.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
