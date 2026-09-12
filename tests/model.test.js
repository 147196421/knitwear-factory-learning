const assert = require("node:assert/strict");
const model = require("../app.js");

const increase = model.events("increase");
assert.equal(increase.length, 29);
assert.equal(increase.at(-1).active, 112);
assert.equal(increase.at(-1).held, 0);

const hold = model.events("hold");
assert.equal(hold.length, 15);
assert.equal(hold.at(-1).active, 18);
assert.equal(hold.at(-1).held, 94);

assert.deepEqual(model.calculate(18, 9, 20, 4.5), { stitches: 162, courses: 90 });

const auditDefault = model.auditDimensions({ measurement: "flat", unit: "in", chest: 18, length: 24, shoulder: 5.5, stitchGauge: 9, courseGauge: 4.5, edgeEach: 2, repeat: 2 });
assert.deepEqual(
  { flatWidthIn: auditDefault.flatWidthIn, baseChest: auditDefault.baseChest, finalStitches: auditDefault.finalStitches, finalCourses: auditDefault.finalCourses, shoulderStitches: auditDefault.shoulderStitches, reverseChestIn: auditDefault.reverseChestIn },
  { flatWidthIn: 18, baseChest: 162, finalStitches: 166, finalCourses: 108, shoulderStitches: 50, reverseChestIn: 18 }
);
const auditCircumference = model.auditDimensions({ measurement: "circumference", unit: "cm", chest: 91.44, length: 60.96, shoulder: 13.97, stitchGauge: 9, courseGauge: 4.5, edgeEach: 2, repeat: 2 });
assert.ok(Math.abs(auditCircumference.flatWidthIn - 18) < 1e-9);
assert.equal(auditCircumference.finalStitches, 166);
const auditRepeatRounding = model.auditDimensions({ measurement: "flat", unit: "in", chest: 18, length: 24, shoulder: 5.5, stitchGauge: 9, courseGauge: 4.5, edgeEach: 2, repeat: 4 });
assert.deepEqual(
  { withEdges: auditRepeatRounding.withEdges, repeatAdjustment: auditRepeatRounding.repeatAdjustment, finalStitches: auditRepeatRounding.finalStitches },
  { withEdges: 166, repeatAdjustment: 2, finalStitches: 168 }
);

const simStart = model.simulationState(0);
assert.deepEqual(
  { row: simStart.row, needle: simStart.needle, phase: simStart.phase, direction: simStart.direction, total: simStart.totalSteps },
  { row: 0, needle: 0, phase: 0, direction: "right", total: 128 }
);
const simSecondRow = model.simulationState(32);
assert.deepEqual(
  { row: simSecondRow.row, needle: simSecondRow.needle, direction: simSecondRow.direction },
  { row: 1, needle: 7, direction: "left" }
);
assert.equal(model.simulationState(999).step, 127);

const jerseyStart = model.structureState("jersey", 0);
assert.deepEqual(
  { label: jerseyStart.label, bed: jerseyStart.bed, needle: jerseyStart.needle, direction: jerseyStart.direction, totalSteps: jerseyStart.totalSteps },
  { label: "单边", bed: "front", needle: 0, direction: "right", totalSteps: 32 }
);
assert.equal(model.structureState("jersey", 31).bed, "front");
assert.equal(model.structureState("rib", 0).bed, "front");
assert.equal(model.structureState("rib", 1).bed, "rear");
assert.equal(model.structureState("rib", 8).needle, 7);
assert.equal(model.structureState("full", 0).bed, "front");
assert.equal(model.structureState("full", 8).bed, "rear");
assert.equal(model.structureState("full", 999).step, 31);

const sheet1FrontStart = model.garmentState("sheet1", "front", 0);
assert.deepEqual(
  { course: sheet1FrontStart.course, stitches: sheet1FrontStart.stitches, total: sheet1FrontStart.total, direction: sheet1FrontStart.direction },
  { course: 0, stitches: 163, total: 94, direction: "right" }
);
const sheet1FrontEnd = model.garmentState("sheet1", "front", 94);
assert.equal(sheet1FrontEnd.stage, "前幅完成");
assert.ok(sheet1FrontEnd.neckOpen > 0);
assert.equal(sheet1FrontEnd.evidence, "照片可辨认节点");
assert.equal(sheet1FrontEnd.segments.length, 6);
assert.equal(model.garmentState("sheet1", "front", 999).course, 94);

const sheet1SleeveMid = model.garmentState("sheet1", "sleeve", 35);
assert.ok(sheet1SleeveMid.stitches > 55);
assert.equal(sheet1SleeveMid.segments.length, 4);
assert.equal(model.garmentState("sheet1", "sleeve", 59).stage, "袖片完成");

const sheet1FrontStraight = model.garmentState("sheet1", "front", 30);
assert.equal(sheet1FrontStraight.stageKey, "body");
assert.equal(sheet1FrontStraight.delta, 0);
assert.match(sheet1FrontStraight.equation, /针数不变/);

const sheet2SleeveEnd = model.garmentState("sheet2", "sleeve", 73);
assert.deepEqual(
  { course: sheet2SleeveEnd.course, total: sheet2SleeveEnd.total, stage: sheet2SleeveEnd.stage },
  { course: 73, total: 73, stage: "袖片完成" }
);

console.log("教学模型验算通过：针数变化、尺寸人工验算、三种组织针床分配、逐针往返、两张图纸的六片成形");
