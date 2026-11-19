/* Foresight Forcing — Main Site Interactions */

const foresight3D = typeof window.initForesight3D === 'function' ? window.initForesight3D() : null;

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

/* Real-World Rollout Video Gallery */
const realVideoTasks = {
  cup_stacking: {
    title: 'Cup stacking',
    score: 'F² 93% · ImageWAM 67% · π₀.₅ 73%',
    desc: 'Bimanual pyramid cup stacking requiring precise vertical alignment and contact-rich placement (full-task completion).',
    src: 'assets/videos/cup_stacking.mp4',
    poster: 'assets/videos/cup_stacking.jpg'
  },
  towel_folding: {
    title: 'Towel folding',
    score: 'F² 100% · ImageWAM 87% · π₀.₅ 100%',
    desc: 'Coordinated bimanual folding of deformable cloth with continuous geometry changes across folding creases (full-task completion).',
    src: 'assets/videos/towel_folding.mp4',
    poster: 'assets/videos/towel_folding.jpg'
  },
  egg_transfer: {
    title: 'Egg transfer',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 80%',
    desc: 'Delicate picking and transfer of eggs into target slots without dropping or crushing (full-task completion).',
    src: 'assets/videos/egg_transfer.mp4',
    poster: 'assets/videos/egg_transfer.jpg'
  },
  breakfast_preparation: {
    title: 'Breakfast preparation',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 87%',
    desc: 'Long-horizon sequential food assembly across multiple objects and intermediate configurations (full-task completion).',
    src: 'assets/videos/breakfast_preparation.mp4',
    poster: 'assets/videos/breakfast_preparation.jpg'
  },
  tool_stowing: {
    title: 'Tool stowing*',
    score: 'F² 65.0% · ImageWAM 31.7% · π₀.₅ 63.3%',
    desc: 'Sequential placement of four articulated tools into fitted organizer slots (item-level score across 4 tools per trial).',
    src: 'assets/videos/tool_stowing.mp4',
    poster: 'assets/videos/tool_stowing.jpg'
  },
  size_sorting: {
    title: 'Size sorting*',
    score: 'F² 96.2% · ImageWAM 89.3% · π₀.₅ 97.7%',
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
  const descEl = galleryRoot.querySelector('[data-video-desc]');
  const cards = galleryRoot.querySelectorAll('[data-video-task]');
  const speedBtns = galleryRoot.querySelectorAll('[data-video-speed]');
  let currentSpeed = 1;

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
    descEl.textContent = item.desc;
    videoEl.poster = item.poster;
    videoEl.src = item.src;
    videoEl.playbackRate = currentSpeed;
    videoEl.load();
    if (autoplay) {
      videoEl.play().catch(() => {});
    }
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => selectVideoTask(card.dataset.videoTask, true));
  });

  speedBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSpeed = Number(btn.dataset.videoSpeed) || 1;
      speedBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      if (videoEl) videoEl.playbackRate = currentSpeed;
    });
  });

  // Auto-play featured rollout when scrolled into view, pause when scrolled away
  if ('IntersectionObserver' in window && videoEl) {
    const vidObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          videoEl.playbackRate = currentSpeed;
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
