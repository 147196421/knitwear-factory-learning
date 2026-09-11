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

const sheet1FrontStart = model.garmentState("sheet1", "front", 0);
assert.deepEqual(
  { course: sheet1FrontStart.course, stitches: sheet1FrontStart.stitches, total: sheet1FrontStart.total, direction: sheet1FrontStart.direction },
  { course: 0, stitches: 163, total: 94, direction: "right" }
);
const sheet1FrontEnd = model.garmentState("sheet1", "front", 94);
assert.equal(sheet1FrontEnd.stage, "前幅完成");
assert.ok(sheet1FrontEnd.neckOpen > 0);
assert.equal(model.garmentState("sheet1", "front", 999).course, 94);

const sheet1SleeveMid = model.garmentState("sheet1", "sleeve", 35);
assert.ok(sheet1SleeveMid.stitches > 55);
assert.equal(model.garmentState("sheet1", "sleeve", 59).stage, "袖片完成");

const sheet2SleeveEnd = model.garmentState("sheet2", "sleeve", 73);
assert.deepEqual(
  { course: sheet2SleeveEnd.course, total: sheet2SleeveEnd.total, stage: sheet2SleeveEnd.stage },
  { course: 73, total: 73, stage: "袖片完成" }
);

console.log("教学模型验算通过：针数变化、密度换算、逐针往返、两张图纸的六片成形");
