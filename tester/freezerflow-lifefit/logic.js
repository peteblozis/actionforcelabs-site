(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  else{root.FreezerFlowLogic=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function positiveQuantity(item){
    return Number.isFinite(Number(item.servings)) && Number(item.servings)>0;
  }
  function householdSize(profile){
    const size=Number(profile&&profile.household);
    return Number.isFinite(size)&&size>0?size:1;
  }
  function confirmedRequirements(item){
    return Number.isFinite(Number(item.skill)) &&
      Number.isFinite(Number(item.effort)) &&
      Number.isFinite(Number(item.cleanup));
  }
  function sourceConfidence(item){
    if(item.inferred!==true)return 1;
    const raw=Number(item.sourceConfidence);
    if(!Number.isFinite(raw))return 0;
    return Math.max(0,Math.min(1,raw));
  }
  function inventoryTrusted(item){
    return item.inferred!==true || sourceConfidence(item)>=0.70;
  }
  function executionFit(item,profile){
    return !!(profile && Array.isArray(profile.methods) && profile.methods.includes(item.method));
  }
  function priority(item,profile){
    const waste=item.age===2?100:item.age===1?70:35;
    const exec=executionFit(item,profile)?100:0;
    const complete=item.role==='complete'?100:(item.role==='protein'||item.role==='side'?75:55);
    const openedUrg=item.leftover?100:item.opened?90:35;
    const preference=Number.isFinite(item.preference)?item.preference:70;
    const health=Number.isFinite(item.health)?item.health:70;
    return Math.round(.30*waste+.20*exec+.15*complete+.15*openedUrg+.10*preference+.10*health);
  }
  function rejectReason(item,profile){
    if(!profile)return 'LifeFit profile not saved';
    if(!positiveQuantity(item))return 'has no confirmed positive quantity';
    if(!inventoryTrusted(item))return 'inventory fact needs confirmation before it can drive a meal decision';
    if(!executionFit(item,profile))return 'requires '+item.method+', which is not allowed';
    if(!confirmedRequirements(item))return 'has unconfirmed skill, effort, or cleanup requirements';
    if(Number(item.skill)>Number(profile.skill))return 'requires more kitchen skill than the saved LifeFit limit';
    if(Number(item.effort)>Number(profile.effort))return 'requires more effort than the saved LifeFit limit';
    if(Number(item.cleanup)>Number(profile.cleanup))return 'requires more cleanup than the saved LifeFit limit';
    if(Number(item.servings)<householdSize(profile))return 'does not have enough confirmed portions for this household';
    return '';
  }
  function safety(item){
    if(item.leftover)return 'Reheat the portion you will eat to 165°F.';
    if(/stuffed/i.test(item.name))return 'For a stuffed item, verify 165°F in the center/stuffing.';
    if(/fish|salmon|trout|cod|tilapia/i.test(item.name))return 'If raw fish, cook to at least 145°F in the thickest part.';
    return 'Follow the package or validated prep card and verify doneness before serving.';
  }
  function classifyMeal(main,side){
    if(!main)return 'NO_ELIGIBLE';
    if(main.role==='complete'||side)return 'MAKE NOW';
    return 'ALMOST THERE';
  }
  function chooseRecommendation(items,profile){
    if(!profile)return {status:'BLOCKED',reason:'LifeFit profile not saved'};
    const eligible=items.filter(i=>!rejectReason(i,profile)).sort((a,b)=>priority(b,profile)-priority(a,profile));
    if(!eligible.length)return {status:'NO_ELIGIBLE',reason:'No inventory item satisfies the saved LifeFit limits and confirmed household quantity'};
    const main=eligible.find(i=>i.role==='complete')||eligible.find(i=>i.role==='protein'||i.role==='breakfast')||null;
    if(!main)return {status:'NO_ELIGIBLE',reason:'No eligible main, protein, breakfast, or complete meal is available'};
    const side=eligible.find(i=>i.id!==main.id&&i.role==='side')||null;
    const used=[main].concat(side?[side]:[]);
    const score=Math.round(used.reduce((sum,i)=>sum+priority(i,profile),0)/used.length);
    return {status:'OK',main,side,used,score,mealClass:classifyMeal(main,side),portions:householdSize(profile)};
  }
  function consumeItems(items,ids,profile){
    const amount=householdSize(profile);
    const selected=new Set(ids);
    return items.map(i=>selected.has(i.id)?{...i,servings:Math.max(0,Number(i.servings)-amount),preference:Math.min(100,(Number.isFinite(i.preference)?i.preference:70)+5)}:i).filter(i=>i.servings>0);
  }
  function reconcileItem(item,action,value){
    const now=new Date().toISOString();
    if(action==='USED')return null;
    if(action==='STILL_HERE')return {...item,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    if(action==='OPENED')return {...item,opened:true,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    if(action==='FRESH')return {...item,age:0,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    if(action==='HAD_A_WHILE')return {...item,age:1,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    if(action==='FROZEN')return {...item,loc:'Freezer',age:0,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    if(action==='SERVINGS_LEFT'){
      const qty=Number(value);
      if(!Number.isFinite(qty)||qty<=0)throw new Error('SERVINGS_LEFT requires a positive quantity');
      return {...item,servings:qty,inferred:false,sourceConfidence:1,lastConfirmedAt:now};
    }
    throw new Error('Unknown reconcile action');
  }
  function createLeftover(name,servings,options={}){
    const qty=Number(servings);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Leftover servings must be positive');
    return {
      id: options.id || Date.now(),
      name: String(name||'Meal')+' leftovers',
      role:'complete',
      loc:options.loc||'Fridge',
      servings:qty,
      method:options.method||'microwave',
      skill:1,
      effort:1,
      cleanup:1,
      age:1,
      opened:true,
      leftover:true,
      inferred:false,
      sourceConfidence:1,
      lastConfirmedAt:new Date().toISOString(),
      preference:Number.isFinite(options.preference)?options.preference:70,
      health:Number.isFinite(options.health)?options.health:70
    };
  }
  return {positiveQuantity,householdSize,confirmedRequirements,sourceConfidence,inventoryTrusted,executionFit,priority,rejectReason,safety,classifyMeal,chooseRecommendation,consumeItems,reconcileItem,createLeftover};
});