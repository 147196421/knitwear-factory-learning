'use strict';

const KnitModel = (() => {
  const plans = {
    increase: [[5, 1, 3], [1, 1, 7], [2, 1, 14], [4, 1, 4]],
    hold: [[1, 2, 3], [1, 3, 7], [1, 5, 4]]
  };
  function events(mode) {
    let active = mode === 'increase' ? 56 : 112;
    let held = 0;
    const result = [{
      active, held, previous: active, interval: 0, amount: 0,
      times: 0, repeat: 0, stage: 0,
      code: mode === 'increase' ? '开56支' : '袖身最大112支'
    }];
    plans[mode].forEach(([interval, amount, times], stage) => {
      for (let repeat = 1; repeat <= times; repeat += 1) {
        const previous = active;
        if (mode === 'increase') active += amount * 2;
        else {
          active -= amount * 2;
          held += amount * 2;
        }
        result.push({ active, held, previous, interval, amount, times, repeat, stage: stage + 1,
          code: `${interval}${mode === 'increase' ? '+' : '-'}${amount}${mode === 'increase' ? '+' : '-'}${times}` });
      }
    });
    return result;
  }
  const calculate = (width, gauge, length, courseGauge) => ({
    stitches: Math.round(width * gauge),
    courses: Math.round(length * courseGauge)
  });
  return { events, calculate };
})();

if (typeof module !== 'undefined') module.exports = KnitModel;

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const routeInfo = {
    map: ['01', '工艺单地图', '本页任务：依次点四个区域，知道身份、尺寸、织片和纱线信息在哪里。'],
    stitches: ['02', '加针与停针', '本页任务：点“下一步”，观察左右各加1支后总针数怎样变化。'],
    density: ['03', '尺寸换算', '本页任务：移动横向密度，观察同样宽度为什么需要不同针数。'],
    pieces: ['04', '从下往上读织片', '本页任务：选择前幅、后幅或袖片，再逐段向上阅读。'],
    machine: ['档案', '准备购买的机器', '本页任务：区分铭牌确认、资料推断和仍待现场确认的信息。']
  };
  let mode = 'increase';
  let stitchStep = 0;
  let stitchEvents = KnitModel.events(mode);
  let stitchTimer = null;
  let piece = 'front';
  let pieceStep = 0;
  let pieceTimer = null;

  function stopStitches() {
    clearTimeout(stitchTimer);
    stitchTimer = null;
    $('play').textContent = stitchStep === stitchEvents.length - 1 ? '从头播放' : '播放演示';
  }

  function drawStitches() {
    const event = stitchEvents[stitchStep];
    $('active-count').textContent = event.active;
    $('held-count').textContent = `暂时停织 ${event.held} 支`;
    $('step-count').textContent = `${stitchStep} / ${stitchEvents.length - 1} 次动作`;
    $('stage-name').textContent = stitchStep
      ? `${mode === 'increase' ? '加针' : '停针'}第${event.stage}段 · 第${event.repeat}/${event.times}次`
      : (mode === 'increase' ? '袖口开针' : '开始做袖山');
    $('action-title').textContent = stitchStep
      ? (mode === 'increase' ? `左右各新增 ${event.amount} 支针` : `左右各暂停 ${event.amount} 支针`)
      : (mode === 'increase' ? '先准备 56 支针' : '112 支针，准备分批停织');
    $('action-copy').textContent = stitchStep
      ? (mode === 'increase'
          ? '看橙色针位：这是这一次才加入工作的针。旧针仍继续编织，织片逐渐变宽。'
          : '看灰色针位：线圈仍保留在针上，只是暂时不织。中间继续工作，两侧累计停织。')
      : (mode === 'increase'
          ? '蓝色短线表示正在工作的针位。点“下一步”，看第一轮左右各加一支。'
          : '现在112支都在工作。下一步从两边各停2支，观察工作范围缩小。');
    $('action-code').textContent = event.code + (mode === 'hold' && stitchStep ? '（停针）' : '');
    $('code-parts').innerHTML = stitchStep
      ? `<dt>动作间隔</dt><dd>每 ${event.interval} 转</dd><dt>每次每边</dt><dd>${mode === 'increase' ? '加' : '停'} ${event.amount} 支</dd><dt>本段重复</dt><dd>${event.repeat} / ${event.times} 次</dd>`
      : '';
    $('equation').textContent = stitchStep
      ? `${event.previous} ${mode === 'increase' ? '+' : '−'} ${event.amount} × 2 ＝ ${event.active} 支`
      : `起始：${event.active} 支`;
    $('action-caution').textContent = mode === 'increase'
      ? '“转”按本教学约定解释；实机的行程、移圈和加针方法仍要另编程序。'
      : '这里的减号带有“停针”说明，不等于普通收针，更不是让线圈脱落。';
    $('stitch-svg-title').textContent = `${mode === 'increase' ? '加针' : '停针'}第${stitchStep}次：工作${event.active}支，停织${event.held}支`;

    let rows = '';
    for (let i = 0; i <= stitchStep; i += 1) {
      const row = stitchEvents[i];
      const y = 266 - i * 7.7;
      const x = 300 - row.active * 2;
      if (row.held) {
        const oneSideHeld = row.held;
        rows += `<rect x="76" y="${y}" width="${oneSideHeld * 2}" height="6" fill="#c3cbd6"/>`;
        rows += `<rect x="${300 + row.active * 2}" y="${y}" width="${oneSideHeld * 2}" height="6" fill="#c3cbd6"/>`;
      }
      rows += `<rect x="${x}" y="${y}" width="${row.active * 4}" height="6" rx="1" fill="${i === stitchStep ? '#2443ba' : '#a7b9ec'}"/>`;
      if (mode === 'increase' && i > 0) {
        rows += `<rect x="${x}" y="${y}" width="${row.amount * 4}" height="6" fill="#b85a0b"/>`;
        rows += `<rect x="${300 + row.active * 2 - row.amount * 4}" y="${y}" width="${row.amount * 4}" height="6" fill="#b85a0b"/>`;
      }
    }
    $('fabric-rows').innerHTML = rows;

    let needles = '';
    const total = mode === 'hold' ? 112 : event.active;
    const heldEachSide = event.held / 2;
    for (let needle = 0; needle < total; needle += 1) {
      const isHeld = needle < heldEachSide || needle >= total - heldEachSide;
      const isNew = mode === 'increase' && stitchStep > 0 &&
        (needle < event.amount || needle >= total - event.amount);
      const x = 300 - total * 2 + needle * 4 + 2;
      needles += `<line x1="${x}" x2="${x}" y1="${isHeld ? 27 : 12}" y2="43" stroke="${isHeld ? '#7c899b' : isNew ? '#b85a0b' : '#2443ba'}" stroke-width="2"/>`;
    }
    $('needle-row').innerHTML = needles;
    $('timeline').max = stitchEvents.length - 1;
    $('timeline').value = stitchStep;
    $('previous').disabled = stitchStep === 0;
    $('next').disabled = stitchStep === stitchEvents.length - 1;
    if (!stitchTimer) $('play').textContent = stitchStep === stitchEvents.length - 1 ? '从头播放' : '播放演示';
  }

  function advanceStitches() {
    stitchTimer = setTimeout(() => {
      stitchStep += 1;
      drawStitches();
      if (stitchStep < stitchEvents.length - 1) advanceStitches();
      else stopStitches();
    }, Number($('speed').value));
  }

  $('play').addEventListener('click', () => {
    if (stitchTimer) { stopStitches(); return; }
    if (stitchStep === stitchEvents.length - 1) stitchStep = 0;
    drawStitches();
    $('play').textContent = '暂停演示';
    advanceStitches();
  });
  $('next').addEventListener('click', () => { stopStitches(); stitchStep = Math.min(stitchStep + 1, stitchEvents.length - 1); drawStitches(); });
  $('previous').addEventListener('click', () => { stopStitches(); stitchStep = Math.max(stitchStep - 1, 0); drawStitches(); });
  $('reset').addEventListener('click', () => { stopStitches(); stitchStep = 0; drawStitches(); });
  $('timeline').addEventListener('input', () => { stopStitches(); stitchStep = Number($('timeline').value); drawStitches(); });
  $('speed').addEventListener('change', () => { if (stitchTimer) { clearTimeout(stitchTimer); advanceStitches(); } });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    stopStitches();
    mode = button.dataset.mode;
    stitchStep = 0;
    stitchEvents = KnitModel.events(mode);
    document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    drawStitches();
  }));

  const zones = {
    identity: ['这是哪一款、哪一个版本？', '先核对款式、尺码、日期和改版记录。看错尺码或旧版本，后面的计算再正确也没有用。', '手写批注不一定是最终版，要让负责工艺的人确认。'],
    size: ['想做多大？每英寸要多少针？', '尺寸是目标，密度负责换算。先看英寸还是厘米，再看样片是洗前还是洗后测量。', '“7针”是针距规格线索，不等于每英寸7支，也不是机器只有7根针。'],
    shape: ['从哪里开始，什么时候加减针？', '找前幅、后幅或袖片的起底处。沿编织顺序读开针、身段、夹位和肩领。', '工艺单描述要求，还不是机器可以直接运行的程序。'],
    yarn: ['用什么纱，要准备多少？', '核对纱线规格、合股数、颜色和用纱重量。重量用于备纱和成本，不是针数。', '同色不同批次也可能影响试板；不要把纱支与针数混在一起。']
  };
  function setZone(key) {
    const zone = zones[key];
    $('zone-title').textContent = zone[0];
    $('zone-copy').textContent = zone[1];
    $('zone-tip').textContent = zone[2];
    document.querySelectorAll('[data-zone]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.zone === key)));
  }
  document.querySelectorAll('[data-zone]').forEach(button =>
    button.addEventListener('click', () => setZone(button.dataset.zone)));

  function calculateDensity() {
    const width = Number($('width').value);
    const gauge = Number($('gauge').value);
    const length = Number($('length').value);
    const courseGauge = Number($('courses').value);
    const result = KnitModel.calculate(width, gauge, length, courseGauge);
    [['width', `${width} 英寸`], ['gauge', `${gauge} 支/英寸`],
      ['length', `${length} 英寸`], ['courses', `${courseGauge} 转/英寸`]]
      .forEach(([key, value]) => $(key + '-out').textContent = value);
    $('stitch-result').textContent = result.stitches + ' 支';
    $('course-result').textContent = result.courses + ' 转';
    $('stitch-formula').textContent = `${width} × ${gauge} = ${(width * gauge).toFixed(2)}，取整`;
    $('course-formula').textContent = `${length} × ${courseGauge} = ${(length * courseGauge).toFixed(2)}，取整`;
    $('density-fabric').style.width = width * 10 + 'px';
    $('density-fabric').style.height = length * 9 + 'px';
    $('density-fabric').style.backgroundSize = `${72 / gauge}px ${48 / courseGauge}px`;
    $('density-badge').textContent = `${width} × ${length} 英寸`;
  }
  ['width', 'gauge', 'length', 'courses'].forEach(id => $(id).addEventListener('input', calculateDensity));
  $('reset-density').addEventListener('click', () => {
    [['width', 18], ['gauge', 9], ['length', 20], ['courses', 4.5]]
      .forEach(([id, value]) => $(id).value = value);
    calculateDensity();
  });
  document.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
    $('quiz-feedback').textContent = button.dataset.answer === '162'
      ? '答对了。18 × 9＝162支。这是基础值，还不是确认后的上机针数。'
      : '再试一次。这里只计算18×9；166是用于比较的工艺示例值。';
    document.querySelectorAll('[data-answer]').forEach(item =>
      item.setAttribute('aria-pressed', String(item === button)));
  }));

  const bodyStages = [
    ['起底', '先找开针数和起底方法，确认从哪里开始。'],
    ['下摆罗纹', '这里通常是衣服下摆的弹性边。罗纹密度与身段不一定相同。'],
    ['身段', '往上读身段针数、加减针和转数，不要漏掉中途的宽窄变化。'],
    ['夹位', '腋下进入袖窿区域，沿两侧查看收针。'],
    ['肩斜与领窝', '领窝在中间、肩在两边，两种工艺可能交叉进行。']
  ];
  const sleeveStages = [
    ['起底', '先找袖口开针数，确认起织位置。'],
    ['袖口罗纹', '先织袖口弹性边，不要漏掉它的转数。'],
    ['袖身', '袖口往上通常逐渐加宽，逐段验算左右加针。'],
    ['袖山下段', '到最宽处后进入袖山，收针与停针要按标注区分。'],
    ['袖山顶部', '核对中心剩余针数和结束方式；袖片没有身片的领窝。']
  ];
  const outlines = {
    front: 'M75 320V160L98 120V53H135Q180 140 225 53H262V120L285 160V320Z',
    back: 'M75 320V160L98 120V53H135Q180 78 225 53H262V120L285 160V320Z',
    sleeve: 'M133 320L75 145L110 95L151 53H209L250 95L285 145L227 320Z'
  };
  const bands = [[305, 15], [265, 40], [150, 115], [100, 50], [48, 52]];
  function stopPiece() {
    clearTimeout(pieceTimer);
    pieceTimer = null;
    $('piece-play').textContent = pieceStep === 4 ? '重新播放' : '播放分段';
  }
  function drawPiece() {
    const stages = piece === 'sleeve' ? sleeveStages : bodyStages;
    const name = { front: '前幅', back: '后幅', sleeve: '袖片' }[piece];
    $('piece-name').textContent = name + '阅读示意';
    $('piece-step').textContent = `第 ${pieceStep + 1} / 5 段`;
    $('piece-title').textContent = stages[pieceStep][0];
    $('piece-copy').textContent = stages[pieceStep][1] +
      (piece === 'back' && pieceStep === 4 ? ' 本示例后领比前领浅，实际以款式为准。' : '');
    $('piece-outline').setAttribute('d', outlines[piece]);
    $('piece-clip-path').setAttribute('d', outlines[piece]);
    $('piece-highlight').setAttribute('y', bands[pieceStep][0]);
    $('piece-highlight').setAttribute('height', bands[pieceStep][1]);
    $('piece-svg-title').textContent = name + '：' + stages[pieceStep][0];
    $('piece-stages').innerHTML = stages.map((stage, index) =>
      `<li class="${index === pieceStep ? 'selected' : ''}">${stage[0]}${index === pieceStep ? '（当前）' : ''}</li>`).join('');
    $('piece-prev').disabled = pieceStep === 0;
    $('piece-next').disabled = pieceStep === 4;
    if (!pieceTimer) $('piece-play').textContent = pieceStep === 4 ? '重新播放' : '播放分段';
  }
  function advancePiece() {
    pieceTimer = setTimeout(() => {
      pieceStep += 1;
      drawPiece();
      if (pieceStep < 4) advancePiece();
      else stopPiece();
    }, 2600);
  }
  $('piece-play').addEventListener('click', () => {
    if (pieceTimer) { stopPiece(); return; }
    if (pieceStep === 4) pieceStep = 0;
    drawPiece();
    $('piece-play').textContent = '暂停分段';
    advancePiece();
  });
  $('piece-prev').addEventListener('click', () => { stopPiece(); pieceStep = Math.max(0, pieceStep - 1); drawPiece(); });
  $('piece-next').addEventListener('click', () => { stopPiece(); pieceStep = Math.min(4, pieceStep + 1); drawPiece(); });
  document.querySelectorAll('[data-piece]').forEach(button => button.addEventListener('click', () => {
    stopPiece();
    piece = button.dataset.piece;
    pieceStep = 0;
    document.querySelectorAll('[data-piece]').forEach(item =>
      item.setAttribute('aria-pressed', String(item === button)));
    drawPiece();
  }));

  function route() {
    let id = location.hash.slice(1) || 'stitches';
    if (id === 'lesson-01') id = 'stitches';
    if (id === 'lesson-02') id = 'density';
    if (!['map', 'stitches', 'density', 'pieces', 'machine'].includes(id)) id = 'stitches';
    stopStitches();
    stopPiece();
    document.querySelectorAll('.page').forEach(section => section.hidden = section.id !== id);
    document.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const position = ['map', 'stitches', 'density', 'pieces', 'machine'].indexOf(id) + 1;
    $('current-number').textContent = routeInfo[id][0];
    $('current-name').textContent = routeInfo[id][1];
    $('current-task').textContent = routeInfo[id][2];
    $('progress-text').textContent = `${position} / 5`;
    $('course-progress').value = position;
    $('course-progress').textContent = `${position} / 5`;
    document.title = document.getElementById(id).querySelector('h1').textContent + ' · 织学堂';
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopStitches(); stopPiece(); } });
  drawStitches();
  setZone('identity');
  calculateDensity();
  drawPiece();
  route();
}
