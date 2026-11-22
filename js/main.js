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

/* Simulation Benchmarks Explorer (Sub-metric Pills + Expandable Full Table) */
const resultData = {
  robotwin: {
    name: 'RoboTwin 2.0 Full',
    decimals: 2,
    defaultMetric: 'avg',
    note: 'Success rates (%) on 50 dual-arm tasks. Bold: best; underlined: second best. P.T.: embodied-policy pretraining; Geo.: geometric supervision or inputs.',
    flags: [
      { key: 'pt', label: 'P.T.' },
      { key: 'geo', label: 'Geo.' }
    ],
    metrics: [
      { key: 'avg', pill: 'Average', col: 'Avg.', label: 'RoboTwin 2.0 Full · Average', detail: 'Unweighted mean across clean and randomized scenes (50 tasks, no policy pretraining).' },
      { key: 'clean', pill: 'Clean', col: 'Clean', label: 'RoboTwin 2.0 Full · Clean', detail: 'Clean tabletop scenes across all 50 dual-arm tasks (+1.70 vs. ImageWAM).' },
      { key: 'rand', pill: 'Randomized', col: 'Rand.', label: 'RoboTwin 2.0 Full · Randomized', detail: 'Randomized lighting, texture, and clutter scenes across 50 tasks (+1.56 vs. ImageWAM).' }
    ],
    groups: [
      {
        title: 'Vision-Language-Action Models',
        rows: [
          { name: 'π₀.₅', pt: true, geo: false, clean: 82.74, rand: 76.76, avg: 79.75 }
        ]
      },
      {
        title: 'World Action Models',
        rows: [
          { name: 'Motus', pt: true, geo: false, clean: 88.66, rand: 87.02, avg: 87.84 },
          { name: 'LingBot-VA', pt: true, geo: false, clean: 92.90, rand: 91.50, avg: 92.20 },
          { name: 'X-WAM', pt: true, geo: true, clean: 89.80, rand: 90.70, avg: 90.25 },
          { name: 'WAM4D', pt: true, geo: true, clean: 93.80, rand: 89.90, avg: 91.80 },
          { name: 'Flex-π (full joint)', pt: true, geo: true, clean: 94.30, rand: 94.80, avg: 94.55 },
          { name: 'Fast-WAM', pt: false, geo: false, clean: 91.88, rand: 91.78, avg: 91.83 },
          { name: 'GeoSem-WAM', pt: false, geo: true, clean: 92.94, rand: 92.14, avg: 92.54 },
          { name: 'MECo-WAM', pt: false, geo: true, clean: 93.26, rand: 91.98, avg: 92.62 },
          { name: 'ImageWAM', pt: false, geo: false, clean: 93.20, rand: 93.56, avg: 93.38 },
          { name: 'F² (Ours)', shortName: 'F²', ours: true, pt: false, geo: true, clean: 94.90, rand: 95.12, avg: 95.01 }
        ]
      }
    ]
  },
  'libero-plus': {
    name: 'LIBERO-Plus',
    decimals: 1,
    defaultMetric: 'overall',
    note: 'Zero-shot robustness (%) trained solely on original LIBERO demonstrations (no LIBERO-Plus augmentation). Bold: best; underlined: second best. P.T.: embodied-policy pretraining.',
    flags: [
      { key: 'pt', label: 'P.T.' }
    ],
    metrics: [
      { key: 'overall', pill: 'Overall', col: 'Overall', label: 'LIBERO-Plus · Overall', detail: 'Mean across all seven distribution-shift perturbation dimensions (+2.9 vs. ImageWAM).' },
      { key: 'cam', pill: 'Camera', col: 'Cam.', label: 'LIBERO-Plus · Camera viewpoint', detail: 'Camera pose and viewpoint shifts (+5.4 vs. ImageWAM, highest among all methods).' },
      { key: 'rob', pill: 'Robot', col: 'Rob.', label: 'LIBERO-Plus · Robot initial state', detail: 'Perturbed robot initial joint configurations (+8.7 vs. ImageWAM).' },
      { key: 'lang', pill: 'Language', col: 'Lang.', label: 'LIBERO-Plus · Language rephrasing', detail: 'Paraphrased task instructions (tied highest at 90.6%).' },
      { key: 'light', pill: 'Lighting', col: 'Light', label: 'LIBERO-Plus · Lighting shift', detail: 'Scene illumination and shadow shifts (highest at 98.3%).' },
      { key: 'bg', pill: 'Background', col: 'Bg.', label: 'LIBERO-Plus · Background change', detail: 'Unseen tabletop and room textures (+2.0 vs. ImageWAM).' },
      { key: 'noise', pill: 'Noise', col: 'Noise', label: 'LIBERO-Plus · Observation noise', detail: 'Sensor and observation corruption (highest at 95.8%).' },
      { key: 'layout', pill: 'Layout', col: 'Layout', label: 'LIBERO-Plus · Object layout', detail: 'Shifted initial object positions (+1.2 vs. ImageWAM).' }
    ],
    groups: [
      {
        title: 'Vision-Language-Action Models',
        rows: [
          { name: 'π₀.₅', pt: true, cam: 78.4, rob: 73.6, lang: 80.8, light: 96.2, bg: 94.1, noise: 89.0, layout: 84.5, overall: 84.4 },
          { name: 'starVLA', pt: false, cam: 64.0, rob: 57.2, lang: 85.8, light: 93.8, bg: 96.0, noise: 81.0, layout: 77.3, overall: 77.8 }
        ]
      },
      {
        title: 'World Action Models',
        rows: [
          { name: 'OpenWAM-α', pt: true, cam: 33.2, rob: 75.9, lang: 87.6, light: 97.0, bg: 85.6, noise: 39.9, layout: 77.4, overall: 68.8 },
          { name: 'Fast-WAM', pt: false, cam: 16.4, rob: 44.5, lang: 68.9, light: 78.2, bg: 53.7, noise: 37.7, layout: 60.7, overall: 51.5 },
          { name: 'X-WAM', pt: true, cam: 72.9, rob: 46.3, lang: 88.5, light: 93.6, bg: 88.3, noise: 62.9, layout: 80.8, overall: 74.8 },
          { name: '4D-WAM', pt: true, cam: 45.2, rob: 64.3, lang: 90.6, light: 94.3, bg: 57.7, noise: 69.1, layout: 79.2, overall: 71.0 },
          { name: 'ImageWAM', pt: false, cam: 77.7, rob: 48.3, lang: 89.9, light: 97.5, bg: 86.0, noise: 95.2, layout: 81.8, overall: 81.6 },
          { name: 'F² (Ours)', shortName: 'F²', ours: true, pt: false, cam: 83.1, rob: 57.0, lang: 90.6, light: 98.3, bg: 88.0, noise: 95.8, layout: 83.0, overall: 84.5 }
        ]
      }
    ]
  },
  c2r: {
    name: 'RoboTwin 2.0 Clean-to-Random',
    decimals: 2,
    defaultMetric: 'avg',
    note: 'Success rates (%) trained solely on clean demonstrations and evaluated on clean and randomized scenes. Bold: best; underlined: second best. 4D-WAM follows the official RoboTwin 2.0 leaderboard.',
    flags: [
      { key: 'pt', label: 'P.T.' },
      { key: 'geo', label: 'Geo.' }
    ],
    metrics: [
      { key: 'avg', pill: 'Average', col: 'Avg.', label: 'RoboTwin C2R · Average', detail: 'Mean across clean and shifted scenes (+7.10 vs. ImageWAM, +6.11 vs. UniWAM).' },
      { key: 'clean', pill: 'Clean', col: 'Clean', label: 'RoboTwin C2R · Clean', detail: 'In-distribution clean evaluation after clean-only fine-tuning (+5.96 vs. ImageWAM).' },
      { key: 'rand', pill: 'Randomized', col: 'Rand.', label: 'RoboTwin C2R · Randomized', detail: 'Out-of-distribution randomized scenes without randomized training data (+8.24 vs. ImageWAM).' }
    ],
    groups: [
      {
        title: 'Vision-Language-Action Models',
        rows: [
          { name: 'π₀.₅', pt: true, geo: false, clean: 70.66, rand: 46.00, avg: 58.33 }
        ]
      },
      {
        title: 'World Action Models',
        rows: [
          { name: 'Fast-WAM', pt: false, geo: false, clean: 77.76, rand: 1.92, avg: 39.84 },
          { name: 'UniWAM', pt: true, geo: false, clean: 75.12, rand: 67.56, avg: 71.34 },
          { name: 'X-WAM', pt: true, geo: true, clean: 69.98, rand: 25.84, avg: 47.91 },
          { name: '4D-WAM', pt: true, geo: true, clean: 81.50, rand: 41.80, avg: 61.65 },
          { name: 'ImageWAM', pt: true, geo: false, clean: 81.88, rand: 58.82, avg: 70.35 },
          { name: 'F² (Ours)', shortName: 'F²', ours: true, pt: true, geo: true, clean: 87.84, rand: 67.06, avg: 77.45 }
        ]
      }
    ]
  },
  libero: {
    name: 'LIBERO',
    decimals: 1,
    defaultMetric: 'avg',
    note: 'Success rates (%) across the four standard LIBERO suites (10 tasks × 50 trials each). Bold: best; underlined: second best. Geo.: geometric supervision or inputs.',
    flags: [
      { key: 'geo', label: 'Geo.' }
    ],
    metrics: [
      { key: 'avg', pill: 'Average', col: 'Avg.', label: 'LIBERO · Four-suite average', detail: 'Mean over Spatial, Object, Goal, and Long suites (tied highest at 98.5%).' },
      { key: 'spat', pill: 'Spatial', col: 'Spatial', label: 'LIBERO · Spatial suite', detail: 'Spatial relationship generalization (+2.2 vs. ImageWAM).' },
      { key: 'obj', pill: 'Object', col: 'Object', label: 'LIBERO · Object suite', detail: 'Novel object manipulation (100.0% perfect score).' },
      { key: 'goal', pill: 'Goal', col: 'Goal', label: 'LIBERO · Goal suite', detail: 'Diverse manipulation goals in shared tabletop scenes.' },
      { key: 'long', pill: 'Long', col: 'Long', label: 'LIBERO · Long suite', detail: 'Multi-stage long-horizon manipulation tasks.' }
    ],
    groups: [
      {
        title: 'Vision-Language-Action Models',
        rows: [
          { name: 'OpenVLA-OFT', geo: false, spat: 97.6, obj: 98.4, goal: 97.9, long: 94.5, avg: 97.1 },
          { name: 'π₀.₅', geo: false, spat: 98.8, obj: 98.2, goal: 98.0, long: 92.4, avg: 96.9 },
          { name: 'Spatial Forcing', geo: true, spat: 99.4, obj: 99.6, goal: 98.8, long: 96.0, avg: 98.5 }
        ]
      },
      {
        title: 'World Action Models',
        rows: [
          { name: 'LingBot-VA', geo: false, spat: 98.5, obj: 99.6, goal: 97.2, long: 98.5, avg: 98.5 },
          { name: 'Motus', geo: false, spat: 96.8, obj: 99.8, goal: 96.6, long: 97.6, avg: 97.7 },
          { name: 'Fast-WAM', geo: false, spat: 98.2, obj: 100.0, goal: 97.0, long: 95.2, avg: 97.6 },
          { name: 'MECo-WAM', geo: true, spat: 98.8, obj: 100.0, goal: 98.2, long: 95.8, avg: 98.2 },
          { name: 'Flex-π (full joint)', geo: true, spat: 99.6, obj: 99.8, goal: 98.6, long: 96.0, avg: 98.5 },
          { name: 'ImageWAM', geo: false, spat: 97.2, obj: 99.2, goal: 98.8, long: 98.4, avg: 98.4 },
          { name: 'F² (Ours)', shortName: 'F²', ours: true, geo: true, spat: 99.4, obj: 100.0, goal: 97.8, long: 96.6, avg: 98.5 }
        ]
      }
    ]
  }
};

const resultLabel = document.querySelector('[data-result-label]');
const resultScore = document.querySelector('[data-result-score]');
const resultDetail = document.querySelector('[data-result-detail]');
const resultChart = document.querySelector('[data-result-chart]');
const resultTabs = document.querySelectorAll('[data-result-tab]');
const resultSubtabsEl = document.querySelector('[data-result-subtabs]');
const resultTableToggle = document.querySelector('[data-result-table-toggle]');
const resultToggleText = document.querySelector('[data-result-toggle-text]');
const resultToggleIcon = document.querySelector('[data-result-toggle-icon]');
const resultTableDrawer = document.querySelector('[data-result-table-drawer]');
const resultDetailTable = document.querySelector('[data-result-detail-table]');
const resultDetailNote = document.querySelector('[data-result-detail-note]');

let currentBenchKey = 'robotwin';
let currentMetricKey = 'avg';
let detailTableOpen = false;

function allRowsOf(bench) {
  return bench.groups.flatMap((g) => g.rows);
}

function getColRankThresholds(rows, colKey) {
  const uniq = [...new Set(rows.map((r) => r[colKey]))].sort((a, b) => b - a);
  return { best: uniq[0], second: uniq.length > 1 ? uniq[1] : null };
}

function renderDetailTable(bench) {
  if (!resultDetailTable) return;
  const rows = allRowsOf(bench);
  const dec = bench.decimals;
  const ranks = {};
  bench.metrics.forEach((m) => {
    ranks[m.key] = getColRankThresholds(rows, m.key);
  });

  // Put metric columns in paper order (Clean, Rand, Avg / Cam..Layout, Overall / Spat..Long, Avg)
  const orderedMetrics = [...bench.metrics.slice(1), bench.metrics[0]];
  const colSpan = 1 + bench.flags.length + orderedMetrics.length;

  const headHtml = `
    <thead>
      <tr>
        <th scope="col">Method</th>
        ${bench.flags.map((f) => `<th scope="col" class="col-flag">${f.label}</th>`).join('')}
        ${orderedMetrics.map((m) => `<th scope="col" class="col-num${m.key === currentMetricKey ? ' is-active-col' : ''}" data-col-pick="${m.key}" title="Plot ${m.pill} in chart">${m.col}</th>`).join('')}
      </tr>
    </thead>`;

  const bodyHtml = bench.groups.map((grp) => {
    const grpRow = `<tr class="sim-group-row"><td colspan="${colSpan}">${grp.title}</td></tr>`;
    const dataRows = grp.rows.map((r) => {
      const flagCells = bench.flags.map((f) =>
        `<td class="col-flag ${r[f.key] ? 'flag-yes' : 'flag-no'}">${r[f.key] ? '✓' : '×'}</td>`
      ).join('');
      const metricCells = orderedMetrics.map((m) => {
        const val = r[m.key];
        const txt = val.toFixed(dec);
        const { best, second } = ranks[m.key];
        let inner = txt;
        if (val === best) inner = `<strong>${txt}</strong>`;
        else if (second !== null && val === second) inner = `<u>${txt}</u>`;
        return `<td class="col-num${m.key === currentMetricKey ? ' is-active-col' : ''}">${inner}</td>`;
      }).join('');
      return `
        <tr class="${r.ours ? 'is-ours-row' : ''}">
          <td class="col-method">${r.ours ? '<strong>F<sup>2</sup> (Ours)</strong>' : r.name}</td>
          ${flagCells}
          ${metricCells}
        </tr>`;
    }).join('');
    return grpRow + dataRows;
  }).join('');

  resultDetailTable.innerHTML = `${headHtml}<tbody>${bodyHtml}</tbody>`;
  if (resultDetailNote) resultDetailNote.textContent = bench.note;

  // Clicking a column header in the full table also switches the active chart metric!
  resultDetailTable.querySelectorAll('[data-col-pick]').forEach((th) => {
    th.addEventListener('click', () => {
      currentMetricKey = th.dataset.colPick;
      renderResult(currentBenchKey, currentMetricKey);
    });
  });
}

function renderResult(benchKey, metricKey) {
  const bench = resultData[benchKey];
  if (!bench || !resultChart) return;
  currentBenchKey = benchKey;
  const metricObj = bench.metrics.find((m) => m.key === metricKey) || bench.metrics.find((m) => m.key === bench.defaultMetric) || bench.metrics[0];
  currentMetricKey = metricObj.key;

  // Render sub-metric pills
  if (resultSubtabsEl) {
    resultSubtabsEl.innerHTML = bench.metrics.map((m) => `
      <button class="result-subtab${m.key === currentMetricKey ? ' is-active' : ''}" type="button" role="tab" aria-selected="${m.key === currentMetricKey}" data-submetric="${m.key}">${m.pill}</button>
    `).join('');
    resultSubtabsEl.querySelectorAll('[data-submetric]').forEach((btn) => {
      btn.addEventListener('click', () => renderResult(currentBenchKey, btn.dataset.submetric));
    });
  }

  const allRows = allRowsOf(bench);
  const oursRow = allRows.find((r) => r.ours);
  const dec = bench.decimals;

  // Top 5 bars sorted by selected metric, always including F² and ImageWAM
  const sorted = [...allRows].sort((a, b) => {
    const scoreDiff = b[currentMetricKey] - a[currentMetricKey];
    return scoreDiff || Number(Boolean(b.ours)) - Number(Boolean(a.ours));
  });
  let chartRows = sorted.slice(0, 5);
  for (const mustName of ['F² (Ours)', 'ImageWAM']) {
    if (!chartRows.some((r) => r.name === mustName)) {
      const found = allRows.find((r) => r.name === mustName);
      if (found) chartRows[chartRows.length - 1] = found;
    }
  }
  chartRows.sort((a, b) => {
    const scoreDiff = b[currentMetricKey] - a[currentMetricKey];
    return scoreDiff || Number(Boolean(b.ours)) - Number(Boolean(a.ours));
  });

  const minVal = Math.min(...chartRows.map((r) => r[currentMetricKey]));
  const floor = Math.max(0, minVal - (minVal > 85 ? 5 : 10));

  resultLabel.textContent = metricObj.label;
  resultScore.textContent = `${oursRow[currentMetricKey].toFixed(dec)}%`;
  resultDetail.textContent = metricObj.detail;
  resultChart.innerHTML = chartRows.map((row) => {
    const val = row[currentMetricKey];
    const width = Math.max(8, ((val - floor) / (100 - floor)) * 100);
    const displayName = row.shortName || row.name.replace(' (full joint)', '');
    return `
      <div class="chart-row${row.ours ? ' is-ours' : ''}">
        <span>${displayName}</span>
        <div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div>
        <strong>${val.toFixed(dec)}</strong>
      </div>`;
  }).join('');

  if (resultToggleText) {
    resultToggleText.textContent = detailTableOpen
      ? `Hide full table (${allRows.length} methods)`
      : `Show full table (${allRows.length} methods)`;
  }
  if (resultToggleIcon) {
    resultToggleIcon.textContent = detailTableOpen ? '−' : '+';
  }
  renderDetailTable(bench);
}

resultTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    resultTabs.forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    const key = tab.dataset.resultTab;
    renderResult(key, resultData[key].defaultMetric);
  });
});

if (resultTableToggle && resultTableDrawer) {
  resultTableToggle.addEventListener('click', () => {
    detailTableOpen = !detailTableOpen;
    resultTableDrawer.hidden = !detailTableOpen;
    resultTableToggle.setAttribute('aria-expanded', String(detailTableOpen));
    resultTableToggle.classList.toggle('is-open', detailTableOpen);
    const count = allRowsOf(resultData[currentBenchKey]).length;
    if (resultToggleText) {
      resultToggleText.textContent = detailTableOpen
        ? `Hide full table (${count} methods)`
        : `Show full table (${count} methods)`;
    }
    if (resultToggleIcon) {
      resultToggleIcon.textContent = detailTableOpen ? '−' : '+';
    }
  });
}

renderResult('robotwin', 'avg');

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
    rate: '2× real-time · full rollout',
    desc: 'Bimanual pyramid cup stacking requiring precise vertical alignment and contact-rich placement (full-task completion).',
    src: 'assets/videos/cup_stacking.mp4',
    poster: 'assets/videos/cup_stacking.jpg'
  },
  towel_folding: {
    title: 'Towel folding',
    score: 'F² 100% · ImageWAM 87% · π₀.₅ 100%',
    rate: '2× real-time · full rollout',
    desc: 'Coordinated bimanual folding of deformable cloth with continuous geometry changes across folding creases (full-task completion).',
    src: 'assets/videos/towel_folding.mp4',
    poster: 'assets/videos/towel_folding.jpg'
  },
  egg_transfer: {
    title: 'Egg transfer',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 80%',
    rate: '2× real-time · full rollout',
    desc: 'Delicate picking and transfer of eggs into target slots without dropping or crushing (full-task completion).',
    src: 'assets/videos/egg_transfer.mp4',
    poster: 'assets/videos/egg_transfer.jpg'
  },
  breakfast_preparation: {
    title: 'Breakfast preparation',
    score: 'F² 80% · ImageWAM 73% · π₀.₅ 87%',
    rate: '2× real-time · full rollout',
    desc: 'Long-horizon sequential food assembly across multiple objects and intermediate configurations (full-task completion).',
    src: 'assets/videos/breakfast_preparation.mp4',
    poster: 'assets/videos/breakfast_preparation.jpg'
  },
  tool_stowing: {
    title: 'Tool stowing*',
    score: 'F² 65.0% · ImageWAM 31.7% · π₀.₅ 63.3%',
    rate: '2× real-time · full rollout',
    desc: 'Sequential placement of four articulated tools into fitted organizer slots (item-level score across 4 tools per trial).',
    src: 'assets/videos/tool_stowing.mp4',
    poster: 'assets/videos/tool_stowing.jpg'
  },
  size_sorting: {
    title: 'Size sorting*',
    score: 'F² 96.2% · ImageWAM 89.3% · π₀.₅ 97.7%',
    rate: '2× real-time · full rollout',
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
