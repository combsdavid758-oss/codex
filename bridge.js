let latest=null;
window.addEventListener('form-link-state',e=>{try{latest=JSON.parse(e.detail);}catch{}});
chrome.runtime.onMessage.addListener((command,sender,respond)=>{
 if(sender.id!==chrome.runtime.id) return;
 if(command.type==='status') window.dispatchEvent(new CustomEvent('form-link-command',{detail:JSON.stringify({type:'status'})}));
 else if(['arm','disarm'].includes(command.type)) window.dispatchEvent(new CustomEvent('form-link-command',{detail:JSON.stringify(command)}));
 respond(latest || {message:'Hook not ready. Reload Ads Manager after installing the extension.'});
});