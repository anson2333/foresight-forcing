const intro = document.querySelector('[data-intro-demo]');
const conceptCanvas = document.querySelector('[data-concept-canvas]');
const introPlayButton = document.querySelector('[data-intro-play]');
const introStatus = document.querySelector('[data-intro-status]');
const replayButton = document.querySelector('[data-intro-replay]');
const pageRegions = document.querySelectorAll('.site-header, main, .site-footer');
let replayTriggered = false;
let introCloseTimer;

class ForesightConceptAnimation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.duration = 8800;
    this.progress = 0;
    this.running = false;
    this.completed = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize = this.resize.bind(this);
    this.draw = this.draw.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    requestAnimationFrame(this.draw);
  }

  reset() {
    this.running = false;
    this.completed = false;
    this.progress = 0;
    intro.style.setProperty('--intro-progress', '0%');
    introStatus.textContent = 'Ready · click to play';
    introPlayButton.disabled = false;
    introPlayButton.innerHTML = '<span aria-hidden="true">▶</span>Play concept';
  }

  play(onComplete) {
    if (this.running) return;
    this.running = true;
    this.completed = false;
    this.startedAt = performance.now();
    this.onComplete = onComplete;
    introPlayButton.disabled = true;
    introPlayButton.innerHTML = '<span aria-hidden="true">▶</span>Playing concept';
  }

  stop() {
    this.running = false;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  roundedRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  label(text, x, y, color = '#91a0b4', align = 'left', alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = '600 11px "DM Sans", Arial, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  phase(progress, start, end) {
    const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
    return value * value * (3 - 2 * value);
  }

  arrow(x1, y1, x2, y2, color, alpha = 1, width = 2) {
    const ctx = this.ctx;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(5, width * 3.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  object(x, y, scale, color, alpha = 1) {
    const ctx = this.ctx;
    const width = 34 * scale;
    const height = 38 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - height / 2, width / 2, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y - height / 2);
    ctx.lineTo(x - width * .38, y + height / 2);
    ctx.quadraticCurveTo(x, y + height * .7, x + width * .38, y + height / 2);
    ctx.lineTo(x + width / 2, y - height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  gripper(x, y, angle, color = '#dbe6f4', alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -31);
    ctx.lineTo(0, -7);
    ctx.moveTo(0, -7);
    ctx.lineTo(-13, 8);
    ctx.moveTo(0, -7);
    ctx.lineTo(13, 8);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -34, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  frame(x, y, width, height, future, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20,31,48,.94)';
    ctx.strokeStyle = future ? 'rgba(231,164,75,.58)' : 'rgba(102,189,242,.58)';
    ctx.lineWidth = 1;
    this.roundedRect(x - width / 2, y - height / 2, width, height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(145,166,194,.18)';
    for (let col = 1; col < 5; col += 1) {
      const gridX = x - width / 2 + width * col / 5;
      ctx.beginPath(); ctx.moveTo(gridX, y - height / 2); ctx.lineTo(gridX, y + height / 2); ctx.stroke();
    }
    for (let row = 1; row < 4; row += 1) {
      const gridY = y - height / 2 + height * row / 4;
      ctx.beginPath(); ctx.moveTo(x - width / 2, gridY); ctx.lineTo(x + width / 2, gridY); ctx.stroke();
    }
    const objectX = x + width * (future ? .18 : -.18);
    const objectY = y + height * (future ? -.13 : .16);
    this.object(objectX, objectY, Math.max(.48, width / 280), '#e36850', 1);
    this.gripper(x - width * .2, y - height * .12, .45, '#dbe6f4', .82);
    ctx.restore();
  }

  lens(x, y, radius, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#8bcfff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(139,207,255,.25)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(x, y, radius - 8, -.65, 1.4); ctx.stroke();
    ctx.fillStyle = '#e7edf6';
    ctx.font = '700 12px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VGGT', x, y);
    ctx.restore();
  }

  featureGrid(x, y, cell, palette, alpha = 1, difference = false) {
    const ctx = this.ctx;
    const cols = 5;
    const rows = 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const active = difference
          ? [3, 4, 7, 8, 9, 12, 13, 14, 18].includes(index)
          : (index + (palette === 'amber' ? 2 : 0)) % 4 !== 0;
        ctx.fillStyle = !active
          ? 'rgba(112,128,151,.16)'
          : palette === 'amber' ? 'rgba(231,164,75,.78)'
            : palette === 'purple' ? 'rgba(170,122,239,.82)'
              : 'rgba(102,189,242,.75)';
        ctx.fillRect(x + col * (cell + 3), y + row * (cell + 3), cell, cell);
      }
    }
    ctx.restore();
  }

  grid(scene, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20,31,48,.86)';
    this.roundedRect(scene.x, scene.y, scene.w, scene.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(145,166,194,.26)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let col = 1; col < 10; col += 1) {
      const x = scene.x + (scene.w * col) / 10;
      ctx.beginPath(); ctx.moveTo(x, scene.y); ctx.lineTo(x, scene.y + scene.h); ctx.stroke();
    }
    for (let row = 1; row < 6; row += 1) {
      const y = scene.y + (scene.h * row) / 6;
      ctx.beginPath(); ctx.moveTo(scene.x, y); ctx.lineTo(scene.x + scene.w, y); ctx.stroke();
    }
    ctx.restore();
  }

  queryField(scene, oldPoint, targetPoint, color, alpha, now, arrows = false) {
    const ctx = this.ctx;
    const dx = targetPoint.x - oldPoint.x;
    const dy = targetPoint.y - oldPoint.y;
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        const x = scene.x + scene.w * (col + .5) / 10;
        const y = scene.y + scene.h * (row + .5) / 6;
        const distance = Math.hypot(x - oldPoint.x, y - oldPoint.y);
        const influence = Math.max(0, 1 - distance / (scene.w * .32));
        const wave = .78 + .22 * Math.sin(now / 260 + col * .55 + row * .8);
        if (arrows && influence > .18) {
          const length = 7 + 15 * influence;
          const magnitude = Math.hypot(dx, dy) || 1;
          this.arrow(x, y, x + dx / magnitude * length, y + dy / magnitude * length, color, alpha * influence * wave, 1.5);
        } else {
          ctx.save();
          ctx.globalAlpha = alpha * (.22 + influence * .78) * wave;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 2 + influence * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  trajectory(scene, start, end, progress) {
    const ctx = this.ctx;
    const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - scene.h * .18 };
    const points = [];
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
      const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
      points.push({ x, y });
    }
    const visible = Math.max(2, Math.floor(progress * (points.length - 1)));
    ctx.save();
    ctx.strokeStyle = '#68cf91';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i <= visible; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    for (let i = 0; i < 16; i += 1) {
      const index = Math.round((i / 15) * (points.length - 1));
      if (index > visible) continue;
      ctx.fillStyle = '#68cf91';
      ctx.fillRect(points[index].x - 1.5, points[index].y - 1.5, 3, 3);
    }
    ctx.restore();
    return points[Math.min(visible, points.length - 1)];
  }

  candidatePath(start, end, bend, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#7d899a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo((start.x + end.x) / 2, Math.min(start.y, end.y) - bend, end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  conditioningStrip(y, deploy) {
    const ctx = this.ctx;
    const w = this.width;
    const inputY = y;
    const visualX = w * .19;
    const queryX = w * .41;
    const expertX = w * .66;
    const actionX = w * .86;

    ctx.save();
    ctx.globalAlpha = deploy;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = 'rgba(102,189,242,.78)';
      ctx.fillRect(visualX - 28 + i * 16, inputY - 9, 11, 18);
      ctx.fillStyle = 'rgba(170,122,239,.82)';
      ctx.fillRect(queryX - 28 + i * 16, inputY - 9, 11, 18);
    }
    this.label('H_cur', visualX, inputY + 25, '#74c4ff', 'center');
    this.label('ZΔ', queryX, inputY + 25, '#c3a7ee', 'center');
    this.arrow(visualX + 42, inputY, expertX - 49, inputY - 7, '#74c4ff', deploy, 1.5);
    this.arrow(queryX + 42, inputY, expertX - 49, inputY + 7, '#a97aef', deploy, 1.5);

    ctx.fillStyle = 'rgba(23,34,51,.95)';
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(expertX, inputY, 43, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eef3f9';
    ctx.font = '600 9px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ACTION', expertX, inputY - 6);
    ctx.fillText('EXPERT', expertX, inputY + 7);
    this.arrow(expertX + 48, inputY, actionX - 50, inputY, '#68cf91', deploy, 1.8);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i < 6 ? 'rgba(104,207,145,.82)' : 'rgba(104,207,145,.28)';
      ctx.fillRect(actionX - 45 + i * 12, inputY - 10, 7, 20);
    }
    this.label('A_t:t+H−1', actionX, inputY + 25, '#68cf91', 'center');
    ctx.restore();
  }

  conceptCard(x, y, width, height, label, accent, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(18,29,46,.94)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    this.roundedRect(x, y, width, height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = '700 10px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + 12, y + 11);
    ctx.restore();
  }

  transitionField(x, y, width, height, alpha, now) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const px = x + width * (col + .5) / 8;
        const py = y + height * (row + .5) / 3;
        const focus = Math.max(0, 1 - Math.hypot(px - x - width * .5, py - y - height * .52) / (width * .58));
        const wave = .7 + .3 * Math.sin(now / 300 + col * .8 + row);
        const len = 6 + focus * 13;
        ctx.save();
        ctx.globalAlpha = alpha * (.25 + focus * .7) * wave;
        ctx.strokeStyle = col % 2 ? '#a97aef' : '#74c4ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px - len * .5, py); ctx.lineTo(px + len * .5, py - len * .18); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  tokenRow(x, y, count, color, alpha = 1, active = count) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = i < active ? color : 'rgba(129,144,165,.18)';
      ctx.fillRect(x + i * 14, y, 9, 18);
    }
    ctx.restore();
  }

  motionArc(start, end, alpha = 1, color = '#c3a7ee') {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo((start.x + end.x) / 2, Math.min(start.y, end.y) - 34, end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  drawNew(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (this.running) {
      const duration = this.reducedMotion ? 1600 : this.duration;
      this.progress = Math.min(1, (time - this.startedAt) / duration);
      intro.style.setProperty('--intro-progress', `${this.progress * 100}%`);
      this.updateStatus(this.progress);
    }
    const p = this.progress;
    const paired = 1 - this.phase(p, .68, .79);
    const fieldAlpha = this.phase(p, .18, .48) * paired;
    const queryAlpha = this.phase(p, .42, .72) * paired;
    const deploy = this.phase(p, .72, .9);
    const pulse = this.reducedMotion ? .7 : .5 + .5 * Math.sin(time / 420);
    ctx.clearRect(0, 0, w, h);

    if (paired > 0) {
      this.label('PAIRED OBSERVATIONS  ·  TRAINING ONLY', w * .5, h * .08, '#8f9caf', 'center', paired);
      const cardW = Math.min(w * .33, 245);
      const cardH = Math.min(h * .3, 145);
      const left = { x: w * .05, y: h * .15, w: cardW, h: cardH };
      const right = { x: w - w * .05 - cardW, y: h * .15, w: cardW, h: cardH };
      this.conceptCard(left.x, left.y, left.w, left.h, 'CURRENT  O_t', '#74c4ff', paired);
      this.conceptCard(right.x, right.y, right.w, right.h, 'FUTURE  O_t+H', '#e7a44b', paired * .9);
      this.frame(left.x + left.w * .52, left.y + left.h * .65, left.w * .8, left.h * .72, false, paired);
      this.frame(right.x + right.w * .48, right.y + right.h * .65, right.w * .8, right.h * .72, true, paired * .82);
      const motionStart = { x: left.x + left.w * .7, y: left.y + left.h * .73 };
      const motionEnd = { x: right.x + right.w * .34, y: right.y + right.h * .48 };
      this.motionArc(motionStart, motionEnd, fieldAlpha, '#c3a7ee');
      this.label('what changes?', w * .5, h * .17, '#c3a7ee', 'center', fieldAlpha);
      if (fieldAlpha > 0) {
        const fx = w * .22;
        const fy = h * .49;
        const fw = w * .56;
        const fh = h * .16;
        this.conceptCard(fx, fy, fw, fh, 'FEATURE CHANGE  YΔ = Y+ − Y−', '#a97aef', fieldAlpha);
        this.transitionField(fx + 16, fy + 36, fw - 32, fh - 47, fieldAlpha, time);
        this.arrow(left.x + left.w * .76, left.y + left.h, fx + 24, fy, '#74c4ff', fieldAlpha, 1.2);
        this.arrow(right.x + right.w * .24, right.y + right.h, fx + fw - 24, fy, '#e7a44b', fieldAlpha, 1.2);
      }
      if (queryAlpha > 0) {
        const qy = h * .73;
        this.tokenRow(w * .37, qy, 8, '#a97aef', queryAlpha, 5);
        this.label('SPATIAL QUERY  ZΔ', w * .5, qy + 30, '#c3a7ee', 'center', queryAlpha);
        ctx.save();
        ctx.globalAlpha = queryAlpha;
        ctx.strokeStyle = 'rgba(195,167,238,.75)';
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(w * .5, h * .65); ctx.lineTo(w * .5, qy - 8); ctx.stroke();
        ctx.restore();
        this.label('SUPERVISION ONLY', w * .5 + 12, h * .68, '#8d99aa', 'left', queryAlpha);
      }
    }

    if (deploy > 0) {
      const scene = { x: w * .1, y: h * .14, w: w * .8, h: h * .48 };
      this.conceptCard(scene.x, scene.y, scene.w, scene.h, 'DEPLOYMENT  ·  CURRENT INPUTS ONLY', '#68cf91', deploy);
      const start = { x: scene.x + scene.w * .25, y: scene.y + scene.h * .7 };
      const end = { x: scene.x + scene.w * .68, y: scene.y + scene.h * .35 };
      this.transitionField(scene.x + 15, scene.y + 34, scene.w - 30, scene.h - 48, deploy * (.55 + pulse * .15), time);
      const move = this.phase(p, .76, .98);
      const ambiguity = deploy * Math.max(0, 1 - move * 1.4);
      this.candidatePath(start, { x: scene.x + scene.w * .55, y: scene.y + scene.h * .18 }, scene.h * .2, ambiguity);
      this.candidatePath(start, { x: scene.x + scene.w * .83, y: scene.y + scene.h * .72 }, scene.h * .08, ambiguity);
      const position = this.trajectory(scene, start, end, move);
      this.object(position.x, position.y, Math.max(.72, w / 1000), '#e36850', deploy);
      this.gripper(position.x - 24, position.y - 28, .55 - move * .2, '#dbe6f4', deploy);
      this.label('ZΔ narrows the action', scene.x + 14, scene.y + scene.h - 16, '#c3a7ee', 'left', deploy);
      this.label('teacher removed', scene.x + scene.w - 14, scene.y + 18, '#68cf91', 'right', deploy);
      const routeY = h * .78;
      this.tokenRow(w * .17, routeY, 4, '#74c4ff', deploy, 4);
      this.label('H_cur', w * .2, routeY + 27, '#74c4ff', 'center', deploy);
      this.tokenRow(w * .4, routeY, 4, '#a97aef', deploy, 4);
      this.label('ZΔ', w * .43, routeY + 27, '#c3a7ee', 'center', deploy);
      this.arrow(w * .24, routeY + 9, w * .61, routeY + 3, '#74c4ff', deploy, 1.4);
      this.arrow(w * .47, routeY + 9, w * .61, routeY + 16, '#a97aef', deploy, 1.4);
      ctx.save(); ctx.globalAlpha = deploy; ctx.fillStyle = 'rgba(23,34,51,.95)'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(w * .66, routeY + 10, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      this.label('ACTION', w * .66, routeY + 5, '#eef3f9', 'center', deploy);
      this.label('EXPERT', w * .66, routeY + 16, '#eef3f9', 'center', deploy);
      this.arrow(w * .7, routeY + 10, w * .83, routeY + 10, '#68cf91', deploy, 1.5);
      this.tokenRow(w * .84, routeY, 5, '#68cf91', deploy, 5);
      this.label('A_t:t+H−1', w * .88, routeY + 27, '#68cf91', 'center', deploy);
    }
    if (this.running && this.progress >= 1 && !this.completed) {
      this.completed = true;
      this.running = false;
      introStatus.textContent = 'Complete · entering site';
      if (this.onComplete) this.onComplete();
    }
  }

  updateStatus(progress) {
    if (!this.running) return;
    if (progress < .2) introStatus.textContent = 'Current + future jointly enter frozen VGGT';
    else if (progress < .4) introStatus.textContent = 'VGGT returns paired patch features';
    else if (progress < .58) introStatus.textContent = 'Patch-wise difference forms YΔ';
    else if (progress < .78) introStatus.textContent = 'Spatial queries learn the feature change';
    else introStatus.textContent = 'H_cur + ZΔ condition the Action Expert';
  }

  draw(time) {
    requestAnimationFrame(this.draw);
    if (!this.width || !this.height || intro.hidden) return;
    this.drawNew(time);
    return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (this.running) {
      const duration = this.reducedMotion ? 1600 : this.duration;
      this.progress = Math.min(1, (time - this.startedAt) / duration);
      intro.style.setProperty('--intro-progress', `${this.progress * 100}%`);
      this.updateStatus(this.progress);
    }
    const p = this.progress;
    const encode = this.phase(p, .04, .2);
    const features = this.phase(p, .18, .38);
    const delta = this.phase(p, .36, .56);
    const learn = this.phase(p, .54, .76);
    const deploy = this.phase(p, .79, .91);
    const trainingAlpha = 1 - this.phase(p, .75, .83);
    const teacherAlpha = 1 - this.phase(p, .73, .8);
    const pulse = this.reducedMotion ? .7 : .5 + .5 * Math.sin(time / 420);
    ctx.clearRect(0, 0, w, h);

    const frameW = Math.min(w * .25, 210);
    const frameH = frameW * .62;
    const current = { x: w * .2, y: h * .29 };
    const future = { x: w * .8, y: h * .29 };
    const lens = { x: w * .5, y: h * .28 };
    const cell = Math.max(7, Math.min(13, w / 72));
    const featureY = h * .53;
    const minusX = w * .29 - cell * 2.5;
    const plusX = w * .71 - cell * 2.5;
    const deltaX = w * .5 - cell * 2.5;
    const deltaY = h * .64;

    if (trainingAlpha > 0) {
      this.frame(current.x, current.y, frameW, frameH, false, trainingAlpha);
      this.frame(future.x, future.y, frameW, frameH, true, teacherAlpha * trainingAlpha);
      this.label('CURRENT  O_t', current.x, current.y - frameH / 2 - 16, '#74c4ff', 'center', trainingAlpha);
      this.label('FUTURE  O_t+H', future.x, future.y - frameH / 2 - 16, '#e7a44b', 'center', teacherAlpha * trainingAlpha);

      if (encode > 0) {
        this.arrow(current.x + frameW / 2 + 8, current.y, lens.x - 38, lens.y, '#8bcfff', encode * teacherAlpha * trainingAlpha, 1.6);
        this.arrow(future.x - frameW / 2 - 8, future.y, lens.x + 38, lens.y, '#e7a44b', encode * teacherAlpha * trainingAlpha, 1.6);
        this.lens(lens.x, lens.y, 34, encode * teacherAlpha * trainingAlpha);
        this.label('JOINT ENCODING', lens.x, lens.y - 53, '#aab6c7', 'center', teacherAlpha * trainingAlpha);
      }

      if (features > 0) {
        this.featureGrid(minusX, featureY, cell, 'blue', features * teacherAlpha * trainingAlpha);
        this.featureGrid(plusX, featureY, cell, 'amber', features * teacherAlpha * trainingAlpha);
        this.label('Y−', w * .29, featureY - 15, '#74c4ff', 'center', teacherAlpha * trainingAlpha);
        this.label('Y+', w * .71, featureY - 15, '#e7a44b', 'center', teacherAlpha * trainingAlpha);
        this.arrow(lens.x - 14, lens.y + 38, w * .29, featureY - 7, '#74c4ff', features * teacherAlpha * trainingAlpha, 1.4);
        this.arrow(lens.x + 14, lens.y + 38, w * .71, featureY - 7, '#e7a44b', features * teacherAlpha * trainingAlpha, 1.4);
      }

      if (delta > 0) {
        this.arrow(w * .29, featureY + cell * 4 + 9, w * .44, deltaY + cell * 2, '#8190a5', delta * teacherAlpha * trainingAlpha, 1.3);
        this.arrow(w * .71, featureY + cell * 4 + 9, w * .56, deltaY + cell * 2, '#8190a5', delta * teacherAlpha * trainingAlpha, 1.3);
        this.featureGrid(deltaX, deltaY, cell, 'purple', delta * teacherAlpha * trainingAlpha, true);
        this.label('YΔ  =  Y+  −  Y−', w * .5, deltaY - 16, '#c3a7ee', 'center', teacherAlpha * trainingAlpha);
      }

      if (learn > 0) {
        const queryY = h * .82;
        this.featureGrid(deltaX, queryY, cell, 'purple', learn * trainingAlpha, true);
        ctx.save();
        ctx.globalAlpha = trainingAlpha;
        ctx.strokeStyle = 'rgba(195,167,238,.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(w * .5, deltaY + cell * 4 + 6); ctx.lineTo(w * .5, queryY - 8); ctx.stroke();
        ctx.restore();
        this.label('SPATIAL QUERY  ZΔ', w * .5, queryY + cell * 4 + 15, '#c3a7ee', 'center', trainingAlpha);
        const supervisionY = (deltaY + cell * 4 + queryY) / 2;
        this.label('SUPERVISION ONLY', w * .5 + 12, supervisionY, '#8d99aa', 'left', trainingAlpha);
        this.label('predicted from current inputs', w * .23, queryY + cell * 2, '#74c4ff', 'center', trainingAlpha);
        this.arrow(current.x, current.y + frameH / 2 + 7, w * .4, queryY + cell * 2, '#74c4ff', learn * trainingAlpha, 1.3);
      }
    }

    if (deploy > 0) {
      const scene = { x: w * .08, y: h * .1, w: w * .84, h: h * .52 };
      const start = { x: scene.x + scene.w * .34, y: scene.y + scene.h * .63 };
      const end = { x: scene.x + scene.w * .69, y: scene.y + scene.h * .38 };
      this.grid(scene, deploy);
      this.queryField(scene, start, end, '#a97aef', deploy * (.55 + pulse * .18), time, true);
      const move = this.phase(p, .83, .98);
      const ambiguity = deploy * Math.max(0, 1 - move * 1.45);
      this.candidatePath(start, { x: scene.x + scene.w * .62, y: scene.y + scene.h * .18 }, scene.h * .18, ambiguity);
      this.candidatePath(start, { x: scene.x + scene.w * .8, y: scene.y + scene.h * .68 }, scene.h * .08, ambiguity);
      const position = this.trajectory(scene, start, end, move);
      this.object(position.x, position.y, Math.max(.7, w / 1000), '#e36850', deploy);
      this.gripper(position.x - 24, position.y - 28, .55 - move * .2, '#dbe6f4', deploy);
      this.label('PREDICTED FORESIGHT DISAMBIGUATES ACTION', scene.x + 12, scene.y + 18, '#b99aec');
      this.label('TEACHER REMOVED', scene.x + scene.w - 12, scene.y + 18, '#68cf91', 'right');
      this.conditioningStrip(h * .78, deploy);
    }

    if (this.running && this.progress >= 1 && !this.completed) {
      this.completed = true;
      this.running = false;
      introStatus.textContent = 'Complete · entering site';
      if (this.onComplete) this.onComplete();
    }
  }
}

const conceptAnimation = new ForesightConceptAnimation(conceptCanvas);

function setPageInert(isInert) {
  pageRegions.forEach((region) => { region.inert = isInert; });
}

function openIntro(fromReplay = false) {
  replayTriggered = fromReplay;
  window.clearTimeout(introCloseTimer);
  intro.hidden = false;
  intro.classList.remove('is-leaving');
  intro.dataset.state = 'idle';
  document.body.classList.add('intro-open');
  setPageInert(true);
  conceptAnimation.reset();
}

function closeIntro() {
  window.clearTimeout(introCloseTimer);
  conceptAnimation.stop();
  intro.classList.add('is-leaving');
  document.body.classList.remove('intro-open');
  setPageInert(false);
  window.setTimeout(() => {
    intro.hidden = true;
    intro.classList.remove('is-leaving');
    if (replayTriggered) replayButton.focus();
    replayTriggered = false;
  }, 620);
}

introPlayButton.addEventListener('click', () => {
  intro.dataset.state = 'playing';
  conceptAnimation.play(() => {
    introCloseTimer = window.setTimeout(closeIntro, 850);
  });
});

document.querySelector('[data-intro-skip]').addEventListener('click', closeIntro);
replayButton.addEventListener('click', () => {
  navLinks?.classList.remove('is-open');
  navToggle?.setAttribute('aria-expanded', 'false');
  openIntro(true);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !intro.hidden) closeIntro();
});

openIntro();

const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

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

const revealItems = document.querySelectorAll('.section-heading, .idea-step, .wide-figure, .method-principles article, .evidence-figure, .results-explorer, .ablation-band, .real-overview, .task-strip, .latency-compare, .citation-grid');
if ('IntersectionObserver' in window) {
  revealItems.forEach((item) => item.classList.add('reveal-item'));
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -40px' });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

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

const copyButton = document.querySelector('[data-copy-bibtex]');
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

const dialog = document.querySelector('[data-image-dialog]');
const dialogImage = document.querySelector('[data-dialog-image]');
const dialogViewport = dialog.querySelector('.dialog-viewport');
let dialogZoom = 1;

function setDialogZoom(nextZoom) {
  dialogZoom = Math.min(3, Math.max(0.75, nextZoom));
  dialogImage.style.width = `${dialogZoom * 100}%`;
}

document.querySelectorAll('[data-expand-image]').forEach((button) => {
  button.addEventListener('click', () => {
    dialogImage.src = button.dataset.expandImage;
    setDialogZoom(1);
    dialog.showModal();
    dialogViewport.scrollTo(0, 0);
  });
});
document.querySelector('[data-dialog-zoom-in]').addEventListener('click', () => setDialogZoom(dialogZoom + 0.25));
document.querySelector('[data-dialog-zoom-out]').addEventListener('click', () => setDialogZoom(dialogZoom - 0.25));
document.querySelector('[data-dialog-zoom-reset]').addEventListener('click', () => setDialogZoom(1));
dialogImage.addEventListener('dblclick', () => setDialogZoom(dialogZoom === 1 ? 2 : 1));
document.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
