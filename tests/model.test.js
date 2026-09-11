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

console.log("教学模型验算通过：56→112、112→18、162支、90转、2.5D四行往返");
