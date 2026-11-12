// Session-only frame discovery; never store complete forms or authentication data.
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(m.type==='frame-state' && sender.tab && sender.frameId!==undefined){
  const key='tab:'+sender.tab.id+':frame:'+sender.frameId;
  chrome.storage.session.set({[key]:{frameId:sender.frameId,state:m.state}}).then(()=>respond({ok:true}));return true;
 }
 if(m.type==='editor-command' && !sender.tab){
  (async()=>{
   const all=await chrome.storage.session.get(null);
   let frames=Object.entries(all).filter(([k])=>k.startsWith('tab:'+m.tabId+':frame:')).map(([,v])=>v);
   // Ask every registered frame for fresh state; ignore frames removed by navigation.
   const fresh=await Promise.all(frames.map(async f=>{try{return {frameId:f.frameId,state:await chrome.tabs.sendMessage(m.tabId,{type:'status'},{frameId:f.frameId})};}catch{return null;}}));
   frames=fresh.filter(Boolean);
   const selected=frames.filter(f=>f.state.candidate && (!m.command.plan || (f.state.candidate.pageId===m.command.plan.pageId && f.state.candidate.nodeId===m.command.plan.nodeId)));
   if(m.command.type==='disarm'){await Promise.all(frames.map(f=>chrome.tabs.sendMessage(m.tabId,{type:'disarm'},{frameId:f.frameId}).catch(()=>{})));return {message:'Cancelled pending changes in all editor frames.'};}
   if(m.command.type==='arm' && selected.length!==1)throw Error('Could not identify exactly one matching editor frame. Reload Ads Manager and save again.');
   if(m.command.type==='arm')return await chrome.tabs.sendMessage(m.tabId,m.command,{frameId:selected[0].frameId});
   if(selected.length===1)return selected[0].state;
   const writes=frames.reduce((n,f)=>n+(f.state.observedWrites||0),0),saves=frames.reduce((n,f)=>n+(f.state.formSaves||0),0);
   const informative=frames.find(f=>f.state.formSaves>0);
   return {message:informative?.state.message || (frames.length?'Connected. Make a small form edit and click Save.':'No editor frame connected. Reload Ads Manager after updating the extension.'),diagnostics:{connectedFrames:frames.length,observedWrites:writes,instantPageRequests:saves,recognizedForms:selected.length}};
  })().then(respond).catch(e=>respond({message:e.message}));return true;
 }
});
chrome.tabs.onRemoved.addListener(async tabId=>{const all=await chrome.storage.session.get(null);await chrome.storage.session.remove(Object.keys(all).filter(k=>k.startsWith('tab:'+tabId+':frame:')));});
