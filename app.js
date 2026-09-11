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
  function simulationState(step, needleCount = 8, rowCount = 4) {
    const phases = ['针上升，针舌打开', '纱嘴垫入新纱', '针下降，旧线圈脱圈', '新线圈形成，织片下拉'];
    const totalSteps = needleCount * rowCount * phases.length;
    const safeStep = Math.max(0, Math.min(totalSteps - 1, Number(step) || 0));
    const row = Math.floor(safeStep / (needleCount * phases.length));
    const withinRow = safeStep % (needleCount * phases.length);
    const slot = Math.floor(withinRow / phases.length);
    const phase = withinRow % phases.length;
    const direction = row % 2 === 0 ? 'right' : 'left';
    const needle = direction === 'right' ? slot : needleCount - 1 - slot;
    const completedInRow = phase === phases.length - 1 ? slot + 1 : slot;
    return { step: safeStep, totalSteps, row, rowCount, slot, phase, phaseName: phases[phase], direction, needle, completedInRow };
  }
  return { events, calculate, simulationState };
})();

if (typeof module !== 'undefined') module.exports = KnitModel;

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const routeInfo = {
    map: ['01', '工艺单地图', '本页任务：依次点四个区域，知道身份、尺寸、织片和纱线信息在哪里。'],
    stitches: ['02', '加针与停针', '本页任务：点“下一步”，观察左右各加1支后总针数怎样变化。'],
    density: ['03', '尺寸换算', '本页任务：移动横向密度，观察同样宽度为什么需要不同针数。'],
    pieces: ['04', '从下往上读织片', '本页任务：选择前幅、后幅或袖片，再逐段向上阅读。'],
    simulator: ['05', '横机逐行模拟', '本页任务：先播放2.5D动画，再切换四层视图理解针、线、机头和针床。'],
    machine: ['档案', '准备购买的机器', '本页任务：区分铭牌确认、资料推断和仍待现场确认的信息。']
  };
  let mode = 'increase';
  let stitchStep = 0;
  let stitchEvents = KnitModel.events(mode);
  let stitchTimer = null;
  let piece = 'front';
  let pieceStep = 0;
  let pieceTimer = null;
  let simStep = 0;
  let simTimer = null;
  let simStructure = 'jersey';

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

  const simPhaseCopy = [
    ['针先上升', '针钩穿过旧线圈，针舌被旧线圈推开。', '旧线圈还挂在针杆上；这时还没有形成新线圈。'],
    ['纱嘴送入新纱', '纱嘴跟着机头来到当前针位，把新纱放进打开的针钩。', '新纱进入针钩，但旧线圈仍未脱落。'],
    ['针下降并脱圈', '针开始下降，针舌合上；旧线圈越过针舌，从针头脱下。', '旧线圈包住新纱，新纱被拉过旧线圈。'],
    ['形成新线圈', '新线圈留在针钩里，牵拉机构把织片轻轻向下带。', '这一针完成；全部8针完成后，才算织完这一行。']
  ];

  function stopSimulator() {
    clearTimeout(simTimer);
    simTimer = null;
    if ($('sim-play')) $('sim-play').textContent = '播放逐针动画';
  }

  function simLoopPath(x, y) {
    return `M${x - 16} ${y} C${x - 14} ${y - 15},${x + 14} ${y - 15},${x + 16} ${y} C${x + 10} ${y + 12},${x - 10} ${y + 12},${x - 16} ${y}`;
  }

  function drawSimulator() {
    const state = KnitModel.simulationState(simStep);
    const x = 142 + state.needle * 65;
    const atLastNeedle = state.slot === 7;
    const finishedRows = state.row + (atLastNeedle && state.phase === 3 ? 1 : 0);
    $('sim-row').textContent = `第 ${state.row + 1} / ${state.rowCount} 行`;
    $('sim-direction').textContent = state.direction === 'right' ? '机头：左 → 右' : '机头：右 → 左';
    $('sim-needle').textContent = `当前：第 ${state.needle + 1} 针`;
    $('sim-phase').textContent = `${state.phase + 1} / 4 · ${state.phaseName}`;
    $('sim-stage-title').textContent = simPhaseCopy[state.phase][0];
    $('sim-stage-copy').textContent = simPhaseCopy[state.phase][1];
    $('sim-stage-check').textContent = simPhaseCopy[state.phase][2];
    $('sim-step').textContent = `${simStep + 1} / ${state.totalSteps}`;
    $('sim-timeline').value = simStep;
    $('sim-prev').disabled = simStep === 0;
    $('sim-next').disabled = simStep === state.totalSteps - 1;

    $('sim-carriage').setAttribute('transform', `translate(${x - 54} 50)`);
    $('sim-carriage-label').textContent = state.direction === 'right' ? '机头 →' : '← 机头';
    $('sim-carrier').setAttribute('transform', `translate(${x} 0)`);
    $('sim-yarn').setAttribute('d', `M74 62 C96 34,${x - 26} 44,${x} 130`);
    $('sim-direction-arrow').setAttribute('d', state.direction === 'right'
      ? 'M150 34 H605 M590 22 L607 34 L590 46'
      : 'M605 34 H150 M165 22 L148 34 L165 46');

    $('sim-needles').innerHTML = Array.from({ length: 8 }, (_, index) => {
      const active = index === state.needle;
      const raised = active && state.phase < 2;
      const nx = 142 + index * 65;
      const top = raised ? 130 : 164;
      const latchY = top + 22;
      const latch = active && state.phase < 2
        ? `<path d="M${nx} ${latchY} l14 -15" class="needle-latch open"/>`
        : `<path d="M${nx} ${latchY} l3 20" class="needle-latch"/>`;
      return `<g class="sim-needle${active ? ' current' : ''}"><path d="M${nx} 255 V${top} q0 -13 10 -13 q9 0 9 9 q0 7 -8 7" class="needle-body"/>${latch}<text x="${nx}" y="278" text-anchor="middle">${index + 1}</text></g>`;
    }).join('');

    let loops = '';
    for (let row = 0; row < finishedRows; row += 1) {
      for (let needle = 0; needle < 8; needle += 1) {
        loops += `<path d="${simLoopPath(142 + needle * 65, 335 + row * 20)}" class="formed-loop"/>`;
      }
    }
    const completedNeedles = state.phase === 3 ? state.slot + 1 : state.slot;
    if (finishedRows === state.row) {
      for (let slot = 0; slot < completedNeedles; slot += 1) {
        const needle = state.direction === 'right' ? slot : 7 - slot;
        loops += `<path d="${simLoopPath(142 + needle * 65, 335 + state.row * 20)}" class="formed-loop current-row"/>`;
      }
    }
    if (state.phase >= 1) {
      loops += `<path d="${simLoopPath(x, 315 + state.row * 20)}" class="new-loop phase-${state.phase}"/>`;
    }
    $('sim-loops').innerHTML = loops;
    const fabricHeight = Math.max(8, finishedRows * 20);
    $('sim-fabric').setAttribute('points', `112 342,632 342,610 ${342 + fabricHeight},134 ${342 + fabricHeight}`);
  }

  function advanceSimulator() {
    const state = KnitModel.simulationState(simStep);
    if (simStep >= state.totalSteps - 1) { stopSimulator(); return; }
    simTimer = setTimeout(() => {
      simStep += 1;
      drawSimulator();
      advanceSimulator();
    }, Number($('sim-speed').value));
  }

  $('sim-play').addEventListener('click', () => {
    if (simTimer) { stopSimulator(); return; }
    const state = KnitModel.simulationState(simStep);
    if (simStep >= state.totalSteps - 1) simStep = 0;
    $('sim-play').textContent = '暂停动画';
    drawSimulator();
    advanceSimulator();
  });
  $('sim-prev').addEventListener('click', () => { stopSimulator(); simStep = Math.max(0, simStep - 1); drawSimulator(); });
  $('sim-next').addEventListener('click', () => { stopSimulator(); simStep = Math.min(KnitModel.simulationState(0).totalSteps - 1, simStep + 1); drawSimulator(); });
  $('sim-reset').addEventListener('click', () => { stopSimulator(); simStep = 0; drawSimulator(); });
  $('sim-timeline').addEventListener('input', event => { stopSimulator(); simStep = Number(event.target.value); drawSimulator(); });

  function drawNeedleStates(state) {
    const classes = Array.from({ length: 14 }, (_, index) => {
      if (state === 'added' && (index < 2 || index > 11)) return 'added';
      if (state === 'held' && (index < 3 || index > 10)) return 'held';
      return 'working';
    });
    $('level1-row').innerHTML = classes.map((kind, index) => `<span class="${kind}"><i></i><b>${index + 1}</b></span>`).join('');
    const copy = {
      working: '14根针全部工作：蓝色表示这一行会参与编织。',
      added: '两边橙色针位是刚加入工作的针，织片会从两边变宽。',
      held: '两边灰色针暂时保留线圈但不编织，中间工作区变窄。'
    };
    $('level1-copy').textContent = copy[state];
    document.querySelectorAll('[data-needle-state]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.needleState === state)));
  }
  document.querySelectorAll('[data-needle-state]').forEach(button => button.addEventListener('click', () => drawNeedleStates(button.dataset.needleState)));

  function drawBed3d() {
    const active = (bed, index) => {
      if (simStructure === 'jersey') return bed === 'front';
      if (simStructure === 'rib') return bed === (index % 2 === 0 ? 'front' : 'rear');
      return true;
    };
    ['front', 'rear'].forEach(bed => {
      $(`bed-${bed}`).innerHTML = Array.from({ length: 12 }, (_, index) =>
        `<span class="bed-needle ${active(bed, index) ? 'active' : 'rest'}" style="--i:${index}"><i></i><b>${index + 1}</b></span>`).join('');
    });
    const labels = {
      jersey: ['单边', '本模型只让前床针工作，后床针休息。先用它理解最简单的一面成圈。'],
      rib: ['1×1罗纹', '前床、后床交替工作：前1针、后1针重复。织物有明显弹性。'],
      full: ['四平概念示意', '前后床都参与。不同地区和系统对“四平”的具体程序写法可能不同，实机前必须再核对。']
    };
    $('bed-structure-name').textContent = labels[simStructure][0];
    $('bed-structure-copy').textContent = labels[simStructure][1];
    document.querySelectorAll('[data-structure]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.structure === simStructure)));
  }
  document.querySelectorAll('[data-structure]').forEach(button => button.addEventListener('click', () => { simStructure = button.dataset.structure; drawBed3d(); }));
  $('bed-angle').addEventListener('input', event => {
    $('bed-assembly').style.setProperty('--turn', `${event.target.value}deg`);
    $('bed-angle-out').textContent = `${event.target.value}°`;
  });

  const simLayerButtons = [...document.querySelectorAll('[data-sim-layer]')];
  function selectSimLayer(button) {
    const layer = button.dataset.simLayer;
    if (layer !== 'row') stopSimulator();
    simLayerButtons.forEach(item => {
      item.setAttribute('aria-selected', String(item === button));
      item.tabIndex = item === button ? 0 : -1;
    });
    document.querySelectorAll('[data-sim-panel]').forEach(panel => { panel.hidden = panel.dataset.simPanel !== layer; });
  }
  simLayerButtons.forEach((button, index) => {
    button.addEventListener('click', () => selectSimLayer(button));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % simLayerButtons.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + simLayerButtons.length) % simLayerButtons.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = simLayerButtons.length - 1;
      selectSimLayer(simLayerButtons[nextIndex]);
      simLayerButtons[nextIndex].focus();
    });
  });
  selectSimLayer(simLayerButtons.find(button => button.getAttribute('aria-selected') === 'true'));

  function route() {
    let id = location.hash.slice(1) || 'stitches';
    if (id === 'lesson-01') id = 'stitches';
    if (id === 'lesson-02') id = 'density';
    if (!['map', 'stitches', 'density', 'pieces', 'simulator', 'machine'].includes(id)) id = 'stitches';
    stopStitches();
    stopPiece();
    stopSimulator();
    document.querySelectorAll('.page').forEach(section => section.hidden = section.id !== id);
    document.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const position = ['map', 'stitches', 'density', 'pieces', 'simulator', 'machine'].indexOf(id) + 1;
    $('current-number').textContent = routeInfo[id][0];
    $('current-name').textContent = routeInfo[id][1];
    $('current-task').textContent = routeInfo[id][2];
    $('progress-text').textContent = `${position} / 6`;
    $('course-progress').value = position;
    $('course-progress').textContent = `${position} / 6`;
    document.title = document.getElementById(id).querySelector('h1').textContent + ' · 织学堂';
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopStitches(); stopPiece(); stopSimulator(); } });
  drawStitches();
  setZone('identity');
  calculateDensity();
  drawPiece();
  drawNeedleStates('working');
  drawSimulator();
  drawBed3d();
  route();
}
