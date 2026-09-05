const assert = require('node:assert/strict');
const L = require('../../tester/freezerflow-lifefit/logic.js');

const profile={methods:['no-cook','microwave','air-fryer'],skill:2,effort:2,cleanup:2,household:1};
const salmon={id:1,name:'Salmon fillet',role:'protein',method:'air-fryer',age:2,opened:false,leftover:false,preference:85,health:80};
const broccoli={id:2,name:'Broccoli',role:'side',method:'microwave',age:1,opened:true,leftover:false,preference:75,health:85};
const skillet={id:3,name:'Skillet pasta kit',role:'complete',method:'stovetop',age:2,opened:false,leftover:false,preference:70,health:55};
const leftover={id:4,name:'Cooked chicken leftovers',role:'complete',method:'microwave',age:2,opened:true,leftover:true,preference:70,health:65};
const stuffed={id:5,name:'Seafood stuffed salmon',role:'protein',method:'air-fryer',age:0,opened:false,leftover:false,preference:90,health:80};

assert.equal(L.executionFit(salmon,profile),true,'air fryer should be allowed');
assert.equal(L.executionFit(skillet,profile),false,'stovetop should be hard-blocked');
assert.match(L.rejectReason(skillet,profile),/not allowed/,'blocked method must explain rejection');
assert.ok(L.priority(broccoli,profile)>0,'priority score should be numeric and positive');

const rec=L.chooseRecommendation([skillet,salmon,broccoli],profile);
assert.equal(rec.status,'OK');
assert.equal(rec.main.id,salmon.id,'blocked complete meal must not beat eligible protein');
assert.equal(rec.side.id,broccoli.id,'eligible side should complete the meal');
assert.equal(rec.mealClass,'MAKE NOW');

const rec2=L.chooseRecommendation([skillet],profile);
assert.equal(rec2.status,'NO_ELIGIBLE','all-blocked inventory must fail closed');

assert.match(L.safety(leftover),/165°F/,'leftovers must carry 165°F reheat target');
assert.match(L.safety(salmon),/145°F/,'raw fish must carry 145°F target');
assert.match(L.safety(stuffed),/165°F/,'stuffed seafood must carry 165°F center target');

console.log('FREEZERFLOW MVP LOGIC TESTS PASSED');