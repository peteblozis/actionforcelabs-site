(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  else{root.FreezerFlowStorage=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function normalizeState(raw){
    const state=raw&&typeof raw==='object'?clone(raw):{};
    if(!('profile' in state))state.profile=null;
    if(!Array.isArray(state.items))state.items=[];
    if(!Array.isArray(state.feedback))state.feedback=[];
    if(!Array.isArray(state.quickMeals))state.quickMeals=[];
    if(!Array.isArray(state.shoppingList))state.shoppingList=[];
    if(!Array.isArray(state.processedTokens))state.processedTokens=[];
    if(!('lastAction' in state))state.lastAction=null;
    return state;
  }
  function createLocalStorageAdapter(storage,key){
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'){
      throw new Error('A storage implementation is required');
    }
    if(!key)throw new Error('A storage key is required');
    return {
      kind:'local-browser',
      load(){
        const raw=storage.getItem(key);
        if(!raw)return normalizeState(null);
        try{return normalizeState(JSON.parse(raw));}
        catch(e){throw new Error('Stored FreezerFlow data is unreadable');}
      },
      save(state){
        const normalized=normalizeState(state);
        storage.setItem(key,JSON.stringify(normalized));
        return clone(normalized);
      },
      clear(){storage.removeItem(key);},
      exportData(state){
        return JSON.stringify({format:'freezerflow-export',version:1,state:normalizeState(state)},null,2);
      },
      importData(text){
        let parsed;
        try{parsed=JSON.parse(text);}catch(e){throw new Error('Backup is not valid JSON');}
        if(parsed&&parsed.format==='freezerflow-export'&&parsed.version===1){
          return normalizeState(parsed.state);
        }
        if(parsed&&parsed.version===1){
          return normalizeState(parsed);
        }
        throw new Error('Unsupported FreezerFlow backup format');
      }
    };
  }
  return {normalizeState,createLocalStorageAdapter};
});