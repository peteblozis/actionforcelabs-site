const assert=require('node:assert/strict');
const S=require('../../tester/freezerflow-lifefit/storage-adapter.js');

function memoryStorage(){
  const m=new Map();
  return {
    getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>m.set(k,String(v)),
    removeItem:k=>m.delete(k)
  };
}

const mem=memoryStorage();
const adapter=S.createLocalStorageAdapter(mem,'ff');
let state=adapter.load();
assert.equal(state.profile,null);
assert.deepEqual(state.items,[]);
assert.deepEqual(state.quickMeals,[]);
assert.deepEqual(state.shoppingList,[]);

state.profile={household:1};
state.items=[{id:1,name:'Salmon'}];
state.quickMeals=[{id:'q1',name:'Salmon + broccoli'}];
state.shoppingList=[{id:'s1',text:'simple vegetable or salad'}];
adapter.save(state);

const loaded=adapter.load();
assert.equal(loaded.profile.household,1);
assert.equal(loaded.items[0].name,'Salmon');
assert.equal(loaded.quickMeals[0].id,'q1');
assert.equal(loaded.shoppingList[0].id,'s1');

const exported=adapter.exportData(loaded);
const imported=adapter.importData(exported);
assert.deepEqual(imported.items,loaded.items);
assert.deepEqual(imported.quickMeals,loaded.quickMeals);
assert.deepEqual(imported.shoppingList,loaded.shoppingList);

const legacy=adapter.importData(JSON.stringify({
  version:1,
  profile:{household:2},
  items:[{id:2,name:'Eggs'}],
  feedback:[],
  quickMeals:[],
  shoppingList:[]
}));
assert.equal(legacy.profile.household,2);
assert.equal(legacy.items[0].name,'Eggs');

assert.throws(()=>adapter.importData('{bad'),/valid JSON/);
assert.throws(()=>adapter.importData(JSON.stringify({version:9})),/Unsupported/);

adapter.clear();
assert.deepEqual(adapter.load().items,[]);

console.log('FREEZERFLOW STORAGE ADAPTER TESTS PASSED');
