(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  else{root.FreezerFlowLogic=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
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
    if(!executionFit(item,profile))return 'requires '+item.method+', which is not allowed';
    return '';
  }
  function safety(item){
    if(item.leftover)return 'Reheat the portion you will eat to 165°F.';
    if(/stuffed/i.test(item.name))return 'For a stuffed item, verify 165°F in the center/stuffing.';
    if(/fish|salmon|trout|cod|tilapia/i.test(item.name))return 'If raw fish, cook to at least 145°F in the thickest part.';
    return 'Follow the package or validated prep card and verify doneness before serving.';
  }
  function classifyMeal(main,side){
    if(main.role==='complete'||side)return 'MAKE NOW';
    return 'ALMOST THERE';
  }
  function chooseRecommendation(items,profile){
    if(!profile)return {status:'BLOCKED',reason:'LifeFit profile not saved'};
    const eligible=items.filter(i=>!rejectReason(i,profile)).sort((a,b)=>priority(b,profile)-priority(a,profile));
    if(!eligible.length)return {status:'NO_ELIGIBLE',reason:'No inventory item matches the saved LifeFit cooking methods'};
    const main=eligible.find(i=>i.role==='complete')||eligible.find(i=>i.role==='protein'||i.role==='breakfast')||eligible[0];
    const side=eligible.find(i=>i.id!==main.id&&i.role==='side')||null;
    const used=[main].concat(side?[side]:[]);
    const score=Math.round(used.reduce((sum,i)=>sum+priority(i,profile),0)/used.length);
    return {status:'OK',main,side,used,score,mealClass:classifyMeal(main,side)};
  }
  return {executionFit,priority,rejectReason,safety,classifyMeal,chooseRecommendation};
});