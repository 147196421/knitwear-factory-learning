'use strict';

const KnitModel = (() => {
  const plans = {
    increase: [[5, 1, 3], [1, 1, 7], [2, 1, 14], [4, 1, 4]],
    hold: [[1, 2, 3], [1, 3, 7], [1, 5, 4]]
  };
  function events(mode) {
    let active = mode === 'increase' ? 55 : 111;
    let held = 0;
    const result = [{
      active, held, previous: active, interval: 0, amount: 0,
      times: 0, repeat: 0, stage: 0,
      code: mode === 'increase' ? '开55支' : '袖身最大111支'
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
  function auditDimensions(input) {
    const unit = input.unit === 'cm' ? 'cm' : 'in';
    const toInches = value => unit === 'cm' ? Number(value) / 2.54 : Number(value);
    const chestEnteredIn = toInches(input.chest);
    const flatWidthIn = input.measurement === 'circumference' ? chestEnteredIn / 2 : chestEnteredIn;
    const lengthIn = toInches(input.length);
    const shoulderIn = toInches(input.shoulder);
    const stitchGauge = Number(input.stitchGauge);
    const courseGauge = Number(input.courseGauge);
    const edgeEach = Math.round(Number(input.edgeEach));
    const repeat = Math.max(1, Math.round(Number(input.repeat)));
    const baseChestRaw = flatWidthIn * stitchGauge;
    const baseChest = Math.round(baseChestRaw);
    const withEdges = baseChest + edgeEach * 2;
    const finalStitches = Math.ceil(withEdges / repeat) * repeat;
    const bodyCoursesRaw = lengthIn * courseGauge;
    const finalCourses = Math.round(bodyCoursesRaw);
    const shoulderRaw = shoulderIn * stitchGauge;
    const shoulderStitches = Math.round(shoulderRaw);
    const usableBodyStitches = finalStitches - edgeEach * 2;
    return {
      unit, chestEnteredIn, flatWidthIn, lengthIn, shoulderIn, stitchGauge, courseGauge,
      edgeEach, repeat, baseChestRaw, baseChest, withEdges, finalStitches,
      repeatAdjustment: finalStitches - withEdges, bodyCoursesRaw, finalCourses,
      shoulderRaw, shoulderStitches, reverseChestIn: usableBodyStitches / stitchGauge,
      reverseLengthIn: finalCourses / courseGauge,
      reverseShoulderIn: shoulderStitches / stitchGauge
    };
  }
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
  const structurePlans = {
    jersey: {
      label: '单边', short: '前床连续成圈',
      plain: '这一排只让前针床工作。你从正面看到整齐的正面线圈，背面是反面线圈。',
      paper: '工艺单写“单边”时，先把它理解为一种基本组织名称；针数和密度仍要看对应单边试片。',
      machine: '教学模型中前床8个针位依次成圈，后床休息。真实机器仍由机头三角和选针系统控制。',
      compare: ['通常较薄', '横向弹性较小', '边缘较容易卷'],
      bedFor: () => 'front'
    },
    rib: {
      label: '1×1罗纹', short: '前1针、后1针交替',
      plain: '相邻针位轮流放在前床和后床，正面针与反面针交替，所以横向拉开后更容易回弹。',
      paper: '“1×1”先读成一个正针、一个反针的重复。它不是“1支加1支”的加针公式。',
      machine: '教学模型按针位奇偶让前、后床交替成圈；真实排针、起底和转组织要按程序确认。',
      compare: ['通常比单边厚', '横向弹性明显', '常见于下摆和袖口'],
      bedFor: (needle) => needle % 2 === 0 ? 'front' : 'rear'
    },
    full: {
      label: '四平概念', short: '前后床分行参与',
      plain: '先把它看成前、后针床都参与的一类双面结构。画面用前后床轮流整排成圈帮助理解厚度来源。',
      paper: '看到“四平”不能只凭名称抄程序；不同地区、工厂和系统的具体叫法、走针可能不同。',
      machine: '本模型用前床一行、后床一行交替说明空间关系，不代表慈星机器的正式四平程序。',
      compare: ['通常更厚实', '正反面更接近', '耗纱与密度需另做试片'],
      bedFor: (_needle, row) => row % 2 === 0 ? 'front' : 'rear'
    }
  };
  function structureState(kind, step, needleCount = 8, rowCount = 4) {
    const plan = structurePlans[kind] || structurePlans.jersey;
    const totalSteps = needleCount * rowCount;
    const safeStep = Math.max(0, Math.min(totalSteps - 1, Math.round(Number(step) || 0)));
    const row = Math.floor(safeStep / needleCount);
    const slot = safeStep % needleCount;
    const direction = row % 2 === 0 ? 'right' : 'left';
    const needle = direction === 'right' ? slot : needleCount - 1 - slot;
    const bed = plan.bedFor(needle, row);
    return { ...plan, kind, step: safeStep, totalSteps, row, rowCount, slot, needle, bed, direction };
  }
  const garmentPlans = {
    sheet1: {
      label: '图纸1',
      front: { label: '前幅', kind: 'body', start: 160, body: 160, total: 95, neck: 'front', source: '照片可辨认：图形底部160支、衫身95转；下方分边开针说明仍需原纸复核' },
      back: { label: '后幅', kind: 'body', start: 163, body: 163, total: 94, neck: 'back', source: '照片可辨认：图形底部163支、衫身94转' },
      sleeve: { label: '袖片', kind: 'sleeve', start: 55, body: 111, total: 59, source: '照片可辨认：开55支、袖身59转、上部111支' }
    },
    sheet2: {
      label: '图纸2 · 圆领款',
      front: { label: '前幅', kind: 'body', start: 154, body: 166, total: 79, neck: 'front', source: '照片可辨认：开154支、衫身79转；身段166支为图形旁转录值' },
      back: { label: '后幅', kind: 'body', start: 150, body: 162, total: 77, neck: 'back', source: '照片可辨认：开150支、衫身77转；身段162支为图形旁转录值' },
      sleeve: { label: '袖片', kind: 'sleeve', start: 55, body: 111, total: 73, source: '照片可辨认：开55支、袖身73转、上部111支' }
    }
  };
  function garmentSegments(plan) {
    const at = ratio => Math.round(plan.total * ratio);
    if (plan.kind === 'sleeve') return [
      { key: 'cuff', name: '袖口罗纹', start: 0, end: at(.1), paper: `先按约${plan.start}支起针，建立有弹性的袖口。`, machine: '起底装置和牵拉先稳定织片；实际罗纹组织、转数和度目仍待原纸确认。', reason: '袖口要能贴合手腕，也要给后面的袖身加针留下起点。' },
      { key: 'widen', name: '袖身分段加针', start: at(.1) + 1, end: at(.7), paper: `从约${plan.start}支逐步加宽到约${plan.body}支。`, machine: '机头继续往返，在指定行程把左右边针逐步加入工作。', reason: '手臂越往上越粗，所以袖片两边需要大致对称地增加针位。' },
      { key: 'cap', name: '袖山分段收针', start: at(.7) + 1, end: at(.96), paper: '开始逐段收窄袖山；精确停针次序必须回看清晰原纸。', machine: '边缘针逐步退出当前工作区，中间继续编织，形成袖山弧线。', reason: '袖山要与前后幅夹圈位置配合，不能把示意曲线直接当成生产收针表。' },
      { key: 'cap-top', name: '袖山顶与结束', start: at(.96) + 1, end: plan.total, paper: `到约第${plan.total}转结束这片袖。`, machine: '完成最后工作区并按正式程序执行收尾；本动画不模拟落布与安全动作。', reason: '这里只确认“逐步变窄并结束”，不虚构照片中看不清的最后几次停针。' }
    ];
    return [
      { key: 'rib', name: '起底与下摆罗纹', start: 0, end: at(.08), paper: `按约${plan.start}支开针，先建立下摆。`, machine: '完成起底与下摆组织，织片从针床向下挂出。', reason: '稳定起织并给衣身建立底边；罗纹转数、针法和度目需以原纸为准。' },
      { key: 'body', name: '身段直织', start: at(.08) + 1, end: at(.64), paper: `主体保持约${plan.body}支向上直织。`, machine: '工作针范围基本不变，机头持续左右往返形成主体。', reason: '这是衣片最长的稳定区域；针数不变不等于机器停止，而是继续增加转数。' },
      { key: 'armhole', name: '夹位分段收针', start: at(.64) + 1, end: at(.78), paper: '两侧开始收窄，形成腋下到肩部的夹位。', machine: '左右边缘的工作针逐步减少，中间针继续编织。', reason: '身体到肩部需要变窄；精确“几转收几支”目前仍待清晰原纸复核。' },
      { key: 'upper', name: '上胸直织', start: at(.78) + 1, end: at(.86), paper: '夹位收窄后，剩余工作区短暂保持。', machine: '在较窄的针区继续往返，为开领和收肩准备高度。', reason: '这一小段决定夹圈上方高度，但当前只做阶段教学。' },
      { key: 'neck', name: plan.neck === 'front' ? '前领与左右肩' : '后领与左右肩', start: at(.86) + 1, end: at(.98), paper: plan.neck === 'front' ? '中间逐步开出较深前领，左右肩分开继续。' : '中间开出较浅后领，左右肩分开继续。', machine: '中间领位不再成圈或按程序收针，左右肩区继续工作。', reason: '领窝使一整排变成左右两个工作区；前领通常比后领深。' },
      { key: 'shoulder', name: '肩部收针与结束', start: at(.98) + 1, end: plan.total, paper: `到约第${plan.total}转完成${plan.label}。`, machine: '完成肩部最后工作区并按正式程序收尾；本动画不模拟落布。', reason: '总转数来自照片可辨认值，肩斜细分仍不能凭模糊照片编造。' }
    ];
  }
  function garmentShape(plan, safeCourse) {
    const segments = garmentSegments(plan);
    const segment = segments.find(item => safeCourse >= item.start && safeCourse <= item.end) || segments.at(-1);
    const span = Math.max(1, segment.end - segment.start);
    const within = Math.max(0, Math.min(1, (safeCourse - segment.start) / span));
    const progress = safeCourse / plan.total;
    let stitches = plan.start;
    let stage = segment.name;
    const stageKey = segment.key;
    let neckOpen = 0;
    if (plan.kind === 'sleeve') {
      if (stageKey === 'widen') stitches = Math.round(plan.start + (plan.body - plan.start) * within);
      else if (stageKey === 'cap') stitches = Math.round(plan.body * (1 - .72 * within));
      else if (stageKey === 'cap-top') {
        stitches = Math.round(plan.body * .28);
        if (safeCourse === plan.total) stage = '袖片完成';
      }
    } else {
      if (stageKey === 'rib') stitches = Math.round(plan.start + (plan.body - plan.start) * within);
      else if (stageKey === 'body') stitches = plan.body;
      else if (stageKey === 'armhole') stitches = Math.round(plan.body * (1 - .12 * within));
      else if (stageKey === 'upper') stitches = Math.round(plan.body * .88);
      else if (stageKey === 'neck') {
        stitches = Math.round(plan.body * .88);
        neckOpen = within * (plan.neck === 'front' ? .38 : .28);
      } else if (stageKey === 'shoulder') {
        stitches = Math.round(plan.body * .88);
        neckOpen = plan.neck === 'front' ? .38 : .28;
        if (safeCourse === plan.total) stage = `${plan.label}完成`;
      }
    }
    return { progress, stitches, stage, stageKey, neckOpen };
  }
  function garmentState(sheet, piece, course) {
    const plan = garmentPlans[sheet]?.[piece] || garmentPlans.sheet1.front;
    const safeCourse = Math.max(0, Math.min(plan.total, Math.round(Number(course) || 0)));
    const shape = garmentShape(plan, safeCourse);
    const previous = garmentShape(plan, Math.max(0, safeCourse - 1)).stitches;
    const delta = safeCourse === 0 ? 0 : shape.stitches - previous;
    const segments = garmentSegments(plan);
    const segment = segments.find(item => item.key === shape.stageKey) || segments[0];
    const action = safeCourse === 0 ? `开针约${plan.start}支`
      : delta > 0 ? `工作区增加约${delta}支`
      : delta < 0 ? `工作区减少约${Math.abs(delta)}支`
      : '针数暂时不变，继续织1转';
    const equation = safeCourse === 0 ? `起点＝${plan.start}支`
      : delta === 0 ? `${previous}支 → ${shape.stitches}支（针数不变）`
      : `${previous} ${delta > 0 ? '+' : '−'} ${Math.abs(delta)} ＝ ${shape.stitches}支`;
    const evidence = safeCourse === 0 || safeCourse === plan.total ? '照片可辨认节点' : '教学推演过程';
    return { ...plan, ...shape, course: safeCourse, previous, delta, action, equation, evidence, segments, segment, direction: safeCourse % 2 === 0 ? 'right' : 'left' };
  }
  function decodeNotation({ interval, amount, times, operation = 'hold', start = 20, sides = 2 }) {
    const safeInterval = Math.max(1, Math.round(Number(interval) || 1));
    const safeAmount = Math.max(1, Math.round(Number(amount) || 1));
    const safeTimes = Math.max(1, Math.round(Number(times) || 1));
    const safeStart = Math.max(0, Math.round(Number(start) || 0));
    const safeSides = Math.max(1, Math.round(Number(sides) || 1));
    const direction = operation === 'increase' ? 1 : -1;
    const changePerRepeat = safeAmount * safeSides * direction;
    const steps = [{ repeat: 0, active: safeStart, change: 0 }];
    for (let repeat = 1; repeat <= safeTimes; repeat += 1) {
      steps.push({ repeat, active: safeStart + changePerRepeat * repeat, change: changePerRepeat });
    }
    return {
      interval: safeInterval, amount: safeAmount, times: safeTimes, start: safeStart, sides: safeSides,
      operation: direction > 0 ? 'increase' : 'hold', sign: direction > 0 ? '+' : '−',
      actionWord: direction > 0 ? '加' : '停', changePerRepeat,
      totalChange: changePerRepeat * safeTimes, final: steps.at(-1).active, steps
    };
  }
  return { events, calculate, auditDimensions, simulationState, structurePlans, structureState, garmentPlans, garmentSegments, garmentState, decodeNotation };
})();

if (typeof module !== 'undefined') module.exports = KnitModel;

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const routeInfo = {
    map: ['01', '工艺单地图', '本页任务：先放大查看两张干净清稿，再点四个区域认识尺寸、织片和纱线信息。'],
    stitches: ['02', '加针与停针', '本页任务：点“下一步”，观察左右各加1支后总针数怎样变化。'],
    density: ['03', '尺寸换算', '本页任务：移动横向密度，观察同样宽度为什么需要不同针数。'],
    pieces: ['04', '从下往上读织片', '本页任务：选择前幅、后幅或袖片，再逐段向上阅读。'],
    structures: ['05', '认识三种组织', '本页任务：切换单边、1×1罗纹和四平概念，观察前后针床谁在成圈。'],
    audit: ['06', '尺寸人工验算', '本页任务：输入胸阔、身长和样片密度，按四步算出针数与转数，再反算尺寸。'],
    simulator: ['07', '图纸到衣片', '本页任务：选择图纸和衣片，从第0转开始看机头往返、针数变化和衣片成形。'],
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
  let machineView = 'garment';
  let garmentSheet = 'sheet1';
  let garmentPiece = 'front';
  let garmentCourse = 0;
  let garmentTimer = null;
  let garmentStopAt = null;
  let structureKind = 'jersey';
  let structureStep = 0;
  let structureTimer = null;
  let auditStep = 0;
  let auditUnit = 'in';
  let sheetPreviewScale = 1;
  let sheetPreviewTrigger = null;

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
      : (mode === 'increase' ? '先准备 55 支针' : '111 支针，准备分批停织');
    $('action-copy').textContent = stitchStep
      ? (mode === 'increase'
          ? '看橙色针位：这是这一次才加入工作的针。旧针仍继续编织，织片逐渐变宽。'
          : '看灰色针位：线圈仍保留在针上，只是暂时不织。中间继续工作，两侧累计停织。')
      : (mode === 'increase'
          ? '蓝色短线表示正在工作的针位。点“下一步”，看第一轮左右各加一支。'
          : '现在111支都在工作。下一步从两边各停2支，观察工作范围缩小。');
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
    const total = mode === 'hold' ? 111 : event.active;
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

  const notationExamples = {
    basic: { interval: 1, amount: 1, times: 2, operation: 'hold', start: 20 },
    increase: { interval: 5, amount: 1, times: 3, operation: 'increase', start: 55 },
    hold: { interval: 1, amount: 2, times: 3, operation: 'hold', start: 111 }
  };
  function drawNotation(key = 'basic') {
    const result = KnitModel.decodeNotation(notationExamples[key] || notationExamples.basic);
    $('notation-interval').textContent = result.interval;
    $('notation-amount').textContent = result.amount;
    $('notation-times').textContent = result.times;
    $('notation-sign-one').textContent = result.sign;
    $('notation-sign-two').textContent = result.sign;
    $('notation-interval-copy').textContent = `每隔${result.interval}转`;
    $('notation-amount-copy').textContent = `每次每边${result.actionWord}${result.amount}支`;
    $('notation-times-copy').textContent = `共重复${result.times}次`;
    $('notation-read').textContent = `${result.interval}${result.sign}${result.amount}${result.sign}${result.times}读作：每隔${result.interval}转，左右每边${result.actionWord}${result.amount}支，共做${result.times}次。`;
    $('notation-total').textContent = `左右合计：${result.amount}支 × ${result.times}次 × 2边 ＝ ${Math.abs(result.totalChange)}支；工作针${result.sign}${Math.abs(result.totalChange)}支。`;
    $('notation-steps').innerHTML = result.steps.map((step, index) => `<li class="${index ? 'changed' : ''}"><span>${index ? `第${index}次` : '开始'}</span><strong>${step.active}支</strong>${index ? `<small>左右各${result.actionWord}${result.amount}支</small>` : '<small>原有工作针</small>'}</li>`).join('');
    document.querySelectorAll('[data-notation]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.notation === key)));
  }
  document.querySelectorAll('[data-notation]').forEach(button => button.addEventListener('click', () => drawNotation(button.dataset.notation)));

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
    document.querySelectorAll('[data-sim-phase]').forEach((item, index) => {
      item.classList.toggle('done', index < state.phase);
      item.classList.toggle('current', index === state.phase);
      if (index === state.phase) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
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

    const realX = 188 + state.needle * 62;
    $('real-carriage').setAttribute('transform', `translate(${realX - 69} 0)`);
    $('real-carrier').setAttribute('transform', `translate(${realX} 0)`);
    $('real-yarn').setAttribute('d', `M325 67 C390 82,${realX - 36} 128,${realX} 247`);
    $('real-knit-line').setAttribute('d', state.direction === 'right'
      ? `M145 302H${realX}`
      : `M675 302H${realX}`);
    const realFabricHeight = Math.max(8, finishedRows * 18);
    $('real-fabric').setAttribute('points', `145 306,675 306,665 ${306 + realFabricHeight},155 ${306 + realFabricHeight}`);
    $('real-machine').setAttribute('data-phase', state.phase);

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

  function stopGarment() {
    clearTimeout(garmentTimer);
    garmentTimer = null;
    garmentStopAt = null;
    if ($('garment-play')) $('garment-play').textContent = '播放到完成';
    if ($('garment-stage-play')) $('garment-stage-play').textContent = '播放到下一阶段';
  }

  function drawGarment() {
    const state = KnitModel.garmentState(garmentSheet, garmentPiece, garmentCourse);
    const maxWidth = 520;
    const scale = maxWidth / state.body;
    const center = 410;
    const rowGap = Math.min(3.45, 330 / state.total);
    let rows = '';
    for (let course = 0; course <= state.course; course += 1) {
      const rowState = KnitModel.garmentState(garmentSheet, garmentPiece, course);
      const width = Math.max(70, rowState.stitches * scale);
      const y = 174 + (state.course - course) * rowGap;
      const left = center - width / 2;
      const right = center + width / 2;
      const current = course === state.course ? ' current' : '';
      if (rowState.neckOpen > 0) {
        const gap = Math.max(20, width * rowState.neckOpen);
        rows += `<path d="M${left.toFixed(1)} ${y.toFixed(1)}H${(center - gap / 2).toFixed(1)}M${(center + gap / 2).toFixed(1)} ${y.toFixed(1)}H${right.toFixed(1)}" class="garment-row${current}"/>`;
      } else {
        rows += `<path d="M${left.toFixed(1)} ${y.toFixed(1)}H${right.toFixed(1)}" class="garment-row${current}"/>`;
      }
    }
    $('garment-rows').innerHTML = rows;
    const carriageX = state.direction === 'right' ? 560 : 92;
    const carrierX = state.direction === 'right' ? 644 : 176;
    $('garment-carriage').setAttribute('transform', `translate(${carriageX} 0)`);
    $('garment-carrier').setAttribute('transform', `translate(${carrierX} 0)`);
    $('garment-yarn').setAttribute('d', `M410 20C360 42,${carrierX + (state.direction === 'right' ? -28 : 28)} 74,${carrierX} 169`);
    $('garment-stage').textContent = state.stage;
    $('garment-course').textContent = `第 ${state.course} / ${state.total} 转`;
    $('garment-stitches').textContent = `当前约 ${state.stitches} 支`;
    $('garment-source').textContent = `${KnitModel.garmentPlans[garmentSheet].label} · ${state.label}｜${state.source}`;
    $('garment-action').textContent = state.action;
    $('garment-reason').textContent = state.segment.reason;
    $('garment-paper-copy').textContent = state.segment.paper;
    $('garment-machine-copy').textContent = `${state.direction === 'right' ? '机头由左向右' : '机头由右向左'}。${state.segment.machine}`;
    $('garment-equation').textContent = state.equation;
    $('garment-direction-text').textContent = `本转方向：${state.direction === 'right' ? '左 → 右' : '右 → 左'}`;
    $('garment-evidence').textContent = state.evidence;
    $('garment-evidence').className = `evidence ${state.evidence === '照片可辨认节点' ? 'confirmed' : 'concept'}`;
    const paperOutlines = {
      front: 'M50 292V112L76 82L85 43H109Q130 68 151 43H175L184 82L210 112V292Z',
      back: 'M50 292V112L76 82L85 43H111Q130 53 149 43H175L184 82L210 112V292Z',
      sleeve: 'M91 292L47 121L74 91L103 43H157L186 91L213 121L169 292Z'
    };
    const paperPath = paperOutlines[garmentPiece];
    $('garment-paper-outline').setAttribute('d', paperPath);
    $('garment-paper-clip-path').setAttribute('d', paperPath);
    const paperHeight = 249 * state.progress;
    $('garment-paper-progress').setAttribute('y', (292 - paperHeight).toFixed(1));
    $('garment-paper-progress').setAttribute('height', paperHeight.toFixed(1));
    $('garment-paper-title').textContent = `${state.label}：纸上读到第${state.course}转，${state.stage}`;
    $('garment-stage-list').innerHTML = state.segments.map(segment => {
      const active = segment.key === state.stageKey;
      const done = state.course > segment.end;
      return `<button data-garment-course="${segment.start}" class="${done ? 'done' : ''}"${active ? ' aria-current="step"' : ''}><span>${segment.name}</span><small>${segment.start}–${segment.end}转</small></button>`;
    }).join('');
    $('garment-timeline').max = state.total;
    $('garment-timeline').value = state.course;
    $('garment-prev').disabled = state.course === 0;
    $('garment-next').disabled = state.course === state.total;
    document.querySelectorAll('[data-garment-sheet]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.garmentSheet === garmentSheet)));
    document.querySelectorAll('[data-garment-piece]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.garmentPiece === garmentPiece)));
  }

  function advanceGarment() {
    const state = KnitModel.garmentState(garmentSheet, garmentPiece, garmentCourse);
    const target = garmentStopAt ?? state.total;
    if (garmentCourse >= target || garmentCourse >= state.total) { stopGarment(); return; }
    garmentTimer = setTimeout(() => {
      garmentCourse += 1;
      drawGarment();
      advanceGarment();
    }, Number($('garment-speed').value));
  }

  $('garment-play').addEventListener('click', () => {
    if (garmentTimer) { stopGarment(); return; }
    const state = KnitModel.garmentState(garmentSheet, garmentPiece, garmentCourse);
    if (garmentCourse >= state.total) garmentCourse = 0;
    garmentStopAt = state.total;
    $('garment-play').textContent = '暂停播放';
    drawGarment();
    advanceGarment();
  });
  $('garment-stage-play').addEventListener('click', () => {
    if (garmentTimer) { stopGarment(); return; }
    const state = KnitModel.garmentState(garmentSheet, garmentPiece, garmentCourse);
    let nextBoundary = state.segments.find(segment => segment.end > garmentCourse);
    if (!nextBoundary) {
      garmentCourse = 0;
      nextBoundary = state.segments[0];
      drawGarment();
    }
    garmentStopAt = nextBoundary.end;
    $('garment-stage-play').textContent = `暂停（到${nextBoundary.end}转）`;
    advanceGarment();
  });
  $('garment-prev').addEventListener('click', () => { stopGarment(); garmentCourse = Math.max(0, garmentCourse - 1); drawGarment(); });
  $('garment-next').addEventListener('click', () => { stopGarment(); garmentCourse = Math.min(KnitModel.garmentState(garmentSheet, garmentPiece, 0).total, garmentCourse + 1); drawGarment(); });
  $('garment-reset').addEventListener('click', () => { stopGarment(); garmentCourse = 0; drawGarment(); });
  $('garment-timeline').addEventListener('input', event => { stopGarment(); garmentCourse = Number(event.target.value); drawGarment(); });
  $('garment-stage-list').addEventListener('click', event => {
    const button = event.target.closest('[data-garment-course]');
    if (!button) return;
    stopGarment();
    garmentCourse = Number(button.dataset.garmentCourse);
    drawGarment();
  });
  document.querySelectorAll('[data-garment-sheet]').forEach(button => button.addEventListener('click', () => { stopGarment(); garmentSheet = button.dataset.garmentSheet; garmentCourse = 0; drawGarment(); }));
  document.querySelectorAll('[data-garment-piece]').forEach(button => button.addEventListener('click', () => { stopGarment(); garmentPiece = button.dataset.garmentPiece; garmentCourse = 0; drawGarment(); }));

  function selectMachineView(view) {
    machineView = view;
    $('real-machine-view').hidden = view !== 'real';
    $('internal-machine-view').hidden = view !== 'inside';
    $('garment-machine-view').hidden = view !== 'garment';
    $('loop-controls').hidden = view === 'garment';
    $('sim-workspace').classList.toggle('garment-mode', view === 'garment');
    $('sim-teacher-panel').hidden = view === 'garment';
    if (view === 'garment') stopSimulator();
    else stopGarment();
    document.querySelectorAll('[data-machine-view]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.machineView === view)));
    const notes = {
      garment: '先看图纸怎样变成衣片：实机上的织片从针床向下悬挂，方向与纸上从下往上阅读相反。',
      real: '再看整机动作：灰色机头在透明护罩内往返，纱嘴跟随，织片逐行向下增长。',
      inside: '最后看单针特写：橙色是当前织针，下面四步轨道会告诉你这一瞬间发生什么。'
    };
    $('sim-view-note').textContent = notes[view];
  }
  document.querySelectorAll('[data-machine-view]').forEach(button =>
    button.addEventListener('click', () => selectMachineView(button.dataset.machineView)));
  selectMachineView(machineView);

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
    if (layer !== 'row') { stopSimulator(); stopGarment(); }
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

  function stopStructure() {
    clearTimeout(structureTimer);
    structureTimer = null;
    if ($('structure-play')) $('structure-play').textContent = structureStep >= 31 ? '从头播放' : '播放逐针动画';
  }

  function structureLoopPath(x, y, bed) {
    const lift = bed === 'rear' ? -10 : 10;
    return `M${x - 18} ${y}Q${x - 8} ${y + lift * 2} ${x} ${y}Q${x + 8} ${y - lift * 2} ${x + 18} ${y}`;
  }

  function drawStructure() {
    const state = KnitModel.structureState(structureKind, structureStep);
    const needleMarkup = bed => Array.from({ length: 8 }, (_, index) => {
      const x = 110 + index * 75;
      const current = state.needle === index && state.bed === bed;
      const assigned = state.bedFor(index, state.row) === bed;
      const y = bed === 'rear' ? 178 : 292;
      return `<g class="structure-needle ${current ? 'current' : assigned ? 'assigned' : 'rest'}"><path d="M${x} ${y + 42}V${y - (current ? 38 : 12)}"/><path d="M${x} ${y - (current ? 38 : 12)}q0 -12 10 -12q9 0 9 8q0 7 -8 7"/><text x="${x}" y="${y + 66}" text-anchor="middle">${index + 1}</text></g>`;
    }).join('');
    $('structure-front-needles').innerHTML = needleMarkup('front');
    $('structure-rear-needles').innerHTML = needleMarkup('rear');
    let loops = '';
    for (let completed = 0; completed < state.step; completed += 1) {
      const past = KnitModel.structureState(structureKind, completed);
      const x = 110 + past.needle * 75;
      const y = (past.bed === 'rear' ? 222 : 350) + past.row * 17;
      loops += `<path d="${structureLoopPath(x, y, past.bed)}" class="structure-loop ${past.bed}"/>`;
    }
    const currentX = 110 + state.needle * 75;
    const currentY = (state.bed === 'rear' ? 222 : 350) + state.row * 17;
    loops += `<path d="${structureLoopPath(currentX, currentY, state.bed)}" class="structure-loop current ${state.bed}"/>`;
    $('structure-loops').innerHTML = loops;
    const carriageX = 35 + state.needle / 7 * 510;
    $('structure-carriage').setAttribute('transform', `translate(${carriageX.toFixed(1)} 0)`);
    $('structure-yarn').setAttribute('d', `M380 10C310 34,${(carriageX + 66).toFixed(1)} 48,${currentX} ${currentY - 20}`);
    $('structure-name').textContent = state.label;
    $('structure-short').textContent = state.short;
    $('structure-plain').textContent = state.plain;
    $('structure-paper').textContent = state.paper;
    $('structure-machine-copy').textContent = state.machine;
    $('structure-direction').textContent = `机头：${state.direction === 'right' ? '左 → 右' : '右 → 左'}`;
    $('structure-current').textContent = `${state.bed === 'front' ? '前床' : '后床'}第${state.needle + 1}针`;
    $('structure-check').textContent = `第${state.row + 1}行，第${state.slot + 1}/8个动作：当前应由${state.bed === 'front' ? '前床' : '后床'}第${state.needle + 1}针参与。`;
    $('structure-progress').textContent = `第${state.step + 1} / ${state.totalSteps}针`;
    $('structure-properties').innerHTML = state.compare.map(item => `<span>${item}</span>`).join('');
    $('structure-svg-title').textContent = `${state.label}：${state.bed === 'front' ? '前床' : '后床'}第${state.needle + 1}针正在成圈`;
    $('structure-timeline').value = state.step;
    $('structure-prev').disabled = state.step === 0;
    $('structure-next').disabled = state.step === state.totalSteps - 1;
    document.querySelectorAll('[data-knit-structure]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.knitStructure === structureKind)));
    document.querySelectorAll('[data-structure-row]').forEach((item, index) => {
      item.classList.toggle('active', index === state.row);
      item.classList.toggle('done', index < state.row);
    });
  }

  function advanceStructure() {
    const state = KnitModel.structureState(structureKind, structureStep);
    if (structureStep >= state.totalSteps - 1) { stopStructure(); return; }
    structureTimer = setTimeout(() => {
      structureStep += 1;
      drawStructure();
      advanceStructure();
    }, Number($('structure-speed').value));
  }

  document.querySelectorAll('[data-knit-structure]').forEach(button => button.addEventListener('click', () => {
    stopStructure();
    structureKind = button.dataset.knitStructure;
    structureStep = 0;
    drawStructure();
  }));
  $('structure-play').addEventListener('click', () => {
    if (structureTimer) { stopStructure(); return; }
    if (structureStep >= 31) structureStep = 0;
    $('structure-play').textContent = '暂停动画';
    drawStructure();
    advanceStructure();
  });
  $('structure-prev').addEventListener('click', () => { stopStructure(); structureStep = Math.max(0, structureStep - 1); drawStructure(); });
  $('structure-next').addEventListener('click', () => { stopStructure(); structureStep = Math.min(31, structureStep + 1); drawStructure(); });
  $('structure-reset').addEventListener('click', () => { stopStructure(); structureStep = 0; drawStructure(); });
  $('structure-timeline').addEventListener('input', event => { stopStructure(); structureStep = Number(event.target.value); drawStructure(); });
  document.querySelectorAll('[data-structure-answer]').forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.structureAnswer === 'no';
    $('structure-feedback').textContent = correct ? '答对了：组织改变会改变线圈排列、弹性和缩率，必须用对应罗纹试片重新量密度。' : '再想一步：针数相同只表示针位数量相同，不表示织出来的宽度、弹性和缩率相同。';
    $('structure-feedback').className = correct ? 'correct' : 'wrong';
  }));

  const auditFieldIds = ['audit-chest', 'audit-length', 'audit-shoulder', 'audit-stitch-gauge', 'audit-course-gauge', 'audit-edge', 'audit-repeat'];
  function auditValues() {
    return {
      measurement: $('audit-measurement').value,
      unit: $('audit-unit').value,
      chest: Number($('audit-chest').value),
      length: Number($('audit-length').value),
      shoulder: Number($('audit-shoulder').value),
      stitchGauge: Number($('audit-stitch-gauge').value),
      courseGauge: Number($('audit-course-gauge').value),
      edgeEach: Number($('audit-edge').value),
      repeat: Number($('audit-repeat').value)
    };
  }

  function auditErrors(values) {
    const toInches = value => values.unit === 'cm' ? value / 2.54 : value;
    const errors = {};
    const checkRange = (id, value, min, max, label) => {
      if (!Number.isFinite(value) || value <= 0) errors[id] = `${label}必须填写大于0的数字。`;
      else if (value < min || value > max) errors[id] = `${label}超出本课练习范围，请填写${min}到${max}之间的值。`;
    };
    checkRange('audit-chest', toInches(values.chest), 5, 100, '胸部尺寸');
    checkRange('audit-length', toInches(values.length), 5, 80, '身长');
    checkRange('audit-shoulder', toInches(values.shoulder), 1, 20, '单边肩宽');
    checkRange('audit-stitch-gauge', values.stitchGauge, 1, 30, '横密');
    checkRange('audit-course-gauge', values.courseGauge, 1, 50, '纵密');
    if (!Number.isInteger(values.edgeEach) || values.edgeEach < 0 || values.edgeEach > 10) errors['audit-edge'] = '每边边针必须填写0到10之间的整数。';
    if (!Number.isInteger(values.repeat) || values.repeat < 1 || values.repeat > 24) errors['audit-repeat'] = '组织循环必须填写1到24之间的整数。';
    return errors;
  }

  function showAuditFieldError(id, message = '') {
    const input = $(id);
    const error = $(`${id}-error`);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    error.textContent = message;
  }

  function auditDimensionText(inches, unit, decimals = 2) {
    const value = unit === 'cm' ? inches * 2.54 : inches;
    return `${value.toFixed(decimals)}${unit === 'cm' ? '厘米' : '英寸'}`;
  }

  function selectAuditStep(step) {
    auditStep = Math.max(0, Math.min(3, Number(step) || 0));
    document.querySelectorAll('[data-audit-step]').forEach(button => {
      if (Number(button.dataset.auditStep) === auditStep) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    drawAudit(false);
  }

  function drawAudit(showSummary = false) {
    const values = auditValues();
    const errors = auditErrors(values);
    if (Object.keys(errors).length) {
      if (showSummary) {
        auditFieldIds.forEach(id => showAuditFieldError(id, errors[id] || ''));
        $('audit-error-list').innerHTML = Object.entries(errors).map(([id, message]) => `<li><a href="#${id}">${message}</a></li>`).join('');
        $('audit-errors').hidden = false;
        $('audit-errors').focus();
      }
      return false;
    }
    auditFieldIds.forEach(id => showAuditFieldError(id));
    $('audit-errors').hidden = true;
    const result = KnitModel.auditDimensions(values);
    const unit = values.unit;
    $('audit-flat-result').textContent = auditDimensionText(result.flatWidthIn, unit);
    $('audit-base-result').textContent = `${result.baseChest}支`;
    $('audit-final-result').textContent = `${result.finalStitches}支`;
    $('audit-course-result').textContent = `${result.finalCourses}转`;
    $('audit-shoulder-result').textContent = `${result.shoulderStitches}支`;
    $('audit-chest-label').textContent = `胸阔${auditDimensionText(result.flatWidthIn, unit)}`;
    $('audit-length-label').textContent = `身长${auditDimensionText(result.lengthIn, unit)}`;
    $('audit-shoulder-label').textContent = `单边肩宽${auditDimensionText(result.shoulderIn, unit)}`;
    $('audit-step-one').textContent = values.measurement === 'circumference'
      ? `${auditDimensionText(result.chestEnteredIn, unit)}胸围 ÷ 2`
      : `${auditDimensionText(result.flatWidthIn, unit)}胸阔`;
    $('audit-step-two').textContent = `${result.flatWidthIn.toFixed(2)}×${result.stitchGauge}＝${result.baseChestRaw.toFixed(1)}支`;
    $('audit-step-three').textContent = `${result.baseChest}+${result.edgeEach * 2}+${result.repeatAdjustment}＝${result.finalStitches}支`;
    $('audit-step-four').textContent = `(${result.finalStitches}−${result.edgeEach * 2})÷${result.stitchGauge}＝${result.reverseChestIn.toFixed(2)}英寸`;
    $('audit-reverse-chest').textContent = auditDimensionText(result.reverseChestIn, unit);
    $('audit-reverse-length').textContent = auditDimensionText(result.reverseLengthIn, unit);
    $('audit-reverse-shoulder').textContent = auditDimensionText(result.reverseShoulderIn, unit);
    $('audit-rounding-note').textContent = `胸部凑循环增加${result.repeatAdjustment}支；肩宽${result.shoulderRaw.toFixed(1)}支取整为${result.shoulderStitches}支。反算差值要留给试板判断，不能默默忽略。`;
    const stages = [
      {
        title: values.measurement === 'circumference' ? '先把胸围除以2，得到单片平铺胸阔' : '先确认输入的是平铺胸阔',
        copy: '宽度、长度和密度的单位必须先统一。当前横密与纵密都按每英寸记录，所以厘米尺寸会先换成英寸。',
        formula: values.measurement === 'circumference' ? `${auditDimensionText(result.chestEnteredIn, unit)} ÷ 2 ＝ ${auditDimensionText(result.flatWidthIn, unit)}` : `平铺胸阔 ＝ ${auditDimensionText(result.flatWidthIn, unit)}`,
        check: '先看尺寸表的量法说明。胸围是绕身体一圈，胸阔是衣片平铺宽度，两者不能混着乘密度。'
      },
      {
        title: '横向尺寸乘横密，纵向尺寸乘纵密',
        copy: `胸阔先得到${result.baseChestRaw.toFixed(1)}支，身长先得到${result.bodyCoursesRaw.toFixed(1)}转，单边肩宽先得到${result.shoulderRaw.toFixed(1)}支。`,
        formula: `胸阔：${result.flatWidthIn.toFixed(2)} × ${result.stitchGauge} ＝ ${result.baseChestRaw.toFixed(1)}支；身长：${result.lengthIn.toFixed(2)} × ${result.courseGauge} ＝ ${result.bodyCoursesRaw.toFixed(1)}转`,
        check: '支数必须变成整数，转数也要按工厂计数规则处理。本课先四舍五入，真实工艺还要看加减针节奏和组织循环。'
      },
      {
        title: '把边针和凑循环分开，不要只写一个结果',
        copy: `基础${result.baseChest}支，左右边针共${result.edgeEach * 2}支，再为${result.repeat}针循环补${result.repeatAdjustment}支。`,
        formula: `${result.baseChest} + ${result.edgeEach}×2 + ${result.repeatAdjustment} ＝ ${result.finalStitches}支`,
        check: result.repeatAdjustment ? `最终${result.finalStitches}能被${result.repeat}整除；多出的${result.repeatAdjustment}支来自凑循环，不是凭空加的缝耗。` : `加边针后已经能被${result.repeat}整除，本次不用额外凑针。`
      },
      {
        title: '最后必须反算，确认工艺结果回到多少尺寸',
        copy: '反算不是为了证明自己一定正确，而是把取整、边针和循环造成的尺寸差显示出来。差值是否可以接受，要靠试板和洗后尺寸判断。',
        formula: `胸阔＝(${result.finalStitches}−${result.edgeEach * 2})÷${result.stitchGauge}＝${result.reverseChestIn.toFixed(2)}英寸`,
        check: `反算胸阔${auditDimensionText(result.reverseChestIn, unit)}，身长${auditDimensionText(result.reverseLengthIn, unit)}，单边肩宽${auditDimensionText(result.reverseShoulderIn, unit)}。`
      }
    ];
    const stage = stages[auditStep];
    $('audit-stage-title').textContent = stage.title;
    $('audit-stage-copy').textContent = stage.copy;
    $('audit-stage-formula').textContent = stage.formula;
    $('audit-stage-check').textContent = stage.check;
    return true;
  }

  auditFieldIds.forEach(id => {
    $(id).addEventListener('input', () => {
      showAuditFieldError(id);
      if (!Object.keys(auditErrors(auditValues())).length) drawAudit(false);
    });
    $(id).addEventListener('blur', () => showAuditFieldError(id, auditErrors(auditValues())[id] || ''));
  });
  $('audit-measurement').addEventListener('change', event => {
    const next = event.target.value;
    const chest = Number($('audit-chest').value);
    if (Number.isFinite(chest) && chest > 0) $('audit-chest').value = (next === 'circumference' ? chest * 2 : chest / 2).toFixed(2);
    drawAudit(false);
  });
  $('audit-unit').addEventListener('change', event => {
    const next = event.target.value;
    const factor = auditUnit === 'in' && next === 'cm' ? 2.54 : auditUnit === 'cm' && next === 'in' ? 1 / 2.54 : 1;
    ['audit-chest', 'audit-length', 'audit-shoulder'].forEach(id => {
      const value = Number($(id).value);
      if (Number.isFinite(value)) $(id).value = (value * factor).toFixed(2);
    });
    auditUnit = next;
    drawAudit(false);
  });
  $('audit-form').addEventListener('submit', event => { event.preventDefault(); drawAudit(true); });
  $('audit-reset').addEventListener('click', () => {
    const defaults = { 'audit-chest': 18, 'audit-length': 24, 'audit-shoulder': 5.5, 'audit-stitch-gauge': 9, 'audit-course-gauge': 4.5, 'audit-edge': 2, 'audit-repeat': 2 };
    Object.entries(defaults).forEach(([id, value]) => { $(id).value = value; });
    $('audit-measurement').value = 'flat'; $('audit-unit').value = 'in'; auditUnit = 'in'; auditStep = 0;
    document.querySelectorAll('[data-audit-step]').forEach(button => {
      if (Number(button.dataset.auditStep) === 0) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    drawAudit(false);
  });
  document.querySelectorAll('[data-audit-step]').forEach(button => button.addEventListener('click', () => selectAuditStep(button.dataset.auditStep)));
  document.querySelectorAll('[data-audit-answer]').forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.auditAnswer === 'half';
    $('audit-quiz-feedback').textContent = correct ? '答对了：36英寸是绕一圈的胸围，常见分片前／后幅计算要先用36÷2＝18英寸平铺胸阔，再算18×9＝162支基础值。' : '不对。横密单位已经是支/英寸，不需要改成纵密或再乘2.54；真正漏掉的是胸围到平铺胸阔的÷2。';
    $('audit-quiz-feedback').className = correct ? 'correct' : 'wrong';
  }));

  function setSheetPreviewScale(nextScale) {
    sheetPreviewScale = Math.max(.5, Math.min(3, nextScale));
    $('sheet-preview-image').style.width = `${sheetPreviewScale * 100}%`;
    $('sheet-preview-scale').textContent = `${Math.round(sheetPreviewScale * 100)}%`;
    $('sheet-zoom-out').disabled = sheetPreviewScale <= .5;
    $('sheet-zoom-in').disabled = sheetPreviewScale >= 3;
  }
  document.querySelectorAll('[data-sheet-preview]').forEach(button => button.addEventListener('click', () => {
    sheetPreviewTrigger = button;
    $('sheet-preview-image').src = button.dataset.sheetPreview;
    $('sheet-preview-image').alt = button.querySelector('img').alt;
    $('sheet-preview-title').textContent = button.dataset.sheetTitle;
    $('sheet-preview-original').href = button.dataset.sheetPreview;
    setSheetPreviewScale(1);
    $('sheet-preview-dialog').showModal();
  }));
  $('sheet-zoom-out').addEventListener('click', () => setSheetPreviewScale(sheetPreviewScale - .25));
  $('sheet-zoom-reset').addEventListener('click', () => setSheetPreviewScale(1));
  $('sheet-zoom-in').addEventListener('click', () => setSheetPreviewScale(sheetPreviewScale + .25));
  $('sheet-preview-close').addEventListener('click', () => $('sheet-preview-dialog').close());
  $('sheet-preview-dialog').addEventListener('click', event => {
    if (event.target === $('sheet-preview-dialog')) $('sheet-preview-dialog').close();
  });
  $('sheet-preview-dialog').addEventListener('close', () => sheetPreviewTrigger?.focus());

  function route() {
    let id = location.hash.slice(1) || 'stitches';
    if (id === 'lesson-01') id = 'stitches';
    if (id === 'lesson-02') id = 'density';
    if (!['map', 'stitches', 'density', 'pieces', 'structures', 'audit', 'simulator', 'machine'].includes(id)) id = 'stitches';
    stopStitches();
    stopPiece();
    stopSimulator();
    stopGarment();
    stopStructure();
    document.querySelectorAll('.page').forEach(section => section.hidden = section.id !== id);
    document.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const position = ['map', 'stitches', 'density', 'pieces', 'structures', 'audit', 'simulator', 'machine'].indexOf(id) + 1;
    $('current-number').textContent = routeInfo[id][0];
    $('current-name').textContent = routeInfo[id][1];
    $('current-task').textContent = routeInfo[id][2];
    $('progress-text').textContent = `${position} / 8`;
    $('course-progress').value = position;
    $('course-progress').textContent = `${position} / 8`;
    document.title = document.getElementById(id).querySelector('h1').textContent + ' · 织学堂';
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopStitches(); stopPiece(); stopSimulator(); stopGarment(); stopStructure(); } });
  drawStitches();
  drawNotation();
  setZone('identity');
  calculateDensity();
  drawPiece();
  drawNeedleStates('working');
  drawSimulator();
  drawGarment();
  drawBed3d();
  drawStructure();
  drawAudit(false);
  route();
}
