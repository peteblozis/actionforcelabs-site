const assert = require('node:assert/strict');
const L = require('../../tester/freezerflow-lifefit/logic.js');

const profile={methods:['no-cook','microwave','air-fryer'],skill:2,effort:2,cleanup:2,household:1};
const item=(overrides={})=>({id:1,name:'Salmon fillet',role:'protein',method:'air-fryer',servings:1,skill:2,effort:2,cleanup:1,age:2,opened:false,leftover:false,preference:85,health:80,...overrides});
const salmon=item();
const broccoli=item({id:2,name:'Broccoli',role:'side',method:'microwave',servings:3,skill:1,effort:1,cleanup:1,age:1,opened:true,preference:75,health:85});
const skillet=item({id:3,name:'Skillet pasta kit',role:'complete',method:'stovetop',servings:2,skill:2,effort:2,cleanup:2,preference:70,health:55});
const leftover=item({id:4,name:'Cooked chicken leftovers',role:'complete',method:'microwave',servings:1,skill:1,effort:1,cleanup:1,leftover:true,opened:true,preference:70,health:65});
const stuffed=item({id:5,name:'Seafood stuffed salmon',role:'protein',method:'air-fryer',servings:1,skill:2,effort:2,cleanup:1,age:0,preference:90,health:80});

assert.equal(L.executionFit(salmon,profile),true,'air fryer should be allowed');
assert.equal(L.executionFit(skillet,profile),false,'stovetop should be hard-blocked');
assert.match(L.rejectReason(skillet,profile),/not allowed/,'blocked method must explain rejection');
assert.ok(L.priority(broccoli,profile)>0,'priority score should be numeric and positive');

const rec=L.chooseRecommendation([skillet,salmon,broccoli],profile);
assert.equal(rec.status,'OK');
assert.equal(rec.main.id,salmon.id,'blocked complete meal must not beat eligible protein');
assert.equal(rec.side.id,broccoli.id,'eligible side should complete the meal');
assert.equal(rec.mealClass,'MAKE NOW');
assert.deepEqual(rec.shoppingGaps,[],'owned side means no shopping gap');

const almost=L.chooseRecommendation([salmon],profile);
assert.equal(almost.mealClass,'ALMOST THERE','protein without side should be classified as almost there');
assert.deepEqual(almost.shoppingGaps,['simple vegetable or salad'],'protein gap must be specific and deterministic');

const breakfast=L.chooseRecommendation([item({id:9,name:'Egg bites',role:'breakfast',method:'microwave',skill:1,effort:1,cleanup:1})],profile);
assert.deepEqual(breakfast.shoppingGaps,['fruit or simple produce add-on'],'breakfast gap should suggest a simple produce add-on');

assert.equal(L.chooseRecommendation([skillet],profile).status,'NO_ELIGIBLE','all-blocked inventory must fail closed');
assert.equal(L.chooseRecommendation([item({role:'side'}),item({id:2,role:'side',method:'microwave'})],profile).status,'NO_ELIGIBLE','side-only inventory is not a complete meal');
assert.match(L.rejectReason(item({servings:0}),profile),/positive quantity/,'zero stock must be rejected');
assert.match(L.rejectReason(item({servings:.25}),{...profile,household:4}),/enough confirmed portions/,'fractional stock cannot feed four');
assert.match(L.rejectReason(item({servings:1}),{...profile,household:2}),/enough confirmed portions/,'one portion cannot feed two');
assert.equal(L.rejectReason(item({servings:4}),{...profile,household:4}),'','four confirmed portions can feed four');

assert.match(L.rejectReason(item({skill:3}),profile),/skill/,'skill limit must be enforced');
assert.match(L.rejectReason(item({effort:3}),profile),/effort/,'effort limit must be enforced');
assert.match(L.rejectReason(item({cleanup:3}),profile),/cleanup/,'cleanup limit must be enforced');
assert.match(L.rejectReason(item({skill:undefined}),profile),/unconfirmed/,'unknown execution requirements must fail closed');
assert.equal(L.inventoryTrusted(item({inferred:false})),true,'manual/confirmed inventory should remain trusted');
assert.equal(L.inventoryTrusted(item({inferred:true,sourceConfidence:.5})),false,'low-confidence inferred inventory must not drive a recommendation');
assert.match(L.rejectReason(item({inferred:true,sourceConfidence:.5}),profile),/confirmation/,'uncertain inferred inventory must fail closed');
assert.equal(L.inventoryTrusted(item({inferred:true,sourceConfidence:.8})),true,'high-confidence inferred inventory may remain eligible');

const family={...profile,household:4};
const familyItems=[item({servings:4}),item({id:2,name:'Broccoli',role:'side',method:'microwave',servings:4,skill:1,effort:1,cleanup:1})];
const consumed=L.consumeItems(familyItems,[1,2],family);
assert.equal(consumed.length,0,'family completion consumes four confirmed portions from every used item');
const partial=L.consumeItems([item({servings:5})],[1],family);
assert.equal(partial[0].servings,1,'consumption deducts actual household quantity');

assert.match(L.safety(leftover),/165°F/,'leftovers must carry 165°F reheat target');
assert.match(L.safety(salmon),/145°F/,'raw fish must carry 145°F target');
assert.match(L.safety(stuffed),/165°F/,'stuffed seafood must carry 165°F center target');

const inferred=item({inferred:true,sourceConfidence:.4});
const confirmed=L.reconcileItem(inferred,'STILL_HERE');
assert.equal(confirmed.inferred,false,'one-tap confirmation must convert inferred stock to confirmed');
assert.equal(confirmed.sourceConfidence,1,'confirmed stock should have full source confidence');
assert.equal(L.reconcileItem(item(),'USED'),null,'USED reconcile action removes inventory');
assert.equal(L.reconcileItem(item(),'SERVINGS_LEFT',2.5).servings,2.5,'servings-left correction must preserve practical fractional quantities');
assert.throws(()=>L.reconcileItem(item(),'SERVINGS_LEFT',0),/positive quantity/,'invalid reconcile quantity must fail closed');

const leftovers=L.createLeftover('Salmon dinner',2,{id:99});
assert.equal(leftovers.leftover,true,'created leftover must be first-class leftover inventory');
assert.equal(leftovers.opened,true,'created leftover must be treated as opened');
assert.equal(leftovers.loc,'Fridge','created leftover defaults to fridge');
assert.equal(leftovers.servings,2,'created leftover preserves confirmed servings');
assert.match(L.safety(leftovers),/165°F/,'created leftovers inherit the reheat safety rule');

console.log('FREEZERFLOW MVP LOGIC TESTS PASSED');