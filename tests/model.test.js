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

console.log("教学模型验算通过：56→112、112→18、162支、90转");
