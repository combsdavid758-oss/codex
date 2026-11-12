const $=id=>document.getElementById(id);
let tabId,candidate,reviewed,lastState;
async function command(c){
 if(!tabId)throw Error('Open the duplicate form in an ads.tiktok.com tab first.');
 const s=await chrome.runtime.sendMessage({type:'editor-command',tabId,command:c});
 lastState=s; candidate=s.candidate; $('detected').textContent=candidate?JSON.stringify(candidate,null,2):JSON.stringify(s.diagnostics||{message:'No recognized save yet.'},null,2);
 $('status').textContent=s.message;return s;
}
function reset(){reviewed=null;$('arm').disabled=true;}
function report(e){$('status').textContent=e.message||String(e);}
$('generate').onclick=()=>{try{const u=new URL($('fallback').value);if(u.protocol!=='https:')throw Error('Use HTTPS.');$('deeplink').value='snssdk1233://webview_popup?use_spark=1&use_forest=1&silent_load_type=1&popup_show_type=0&container_bg_color=00000000&loading_bg_color=00000000&hide_nav_bar=1&hide_more=1&url='+encodeURIComponent(u.href);reset();}catch(e){report(e);}};
$('fallback').oninput=$('deeplink').oninput=reset;
$('refresh').onclick=()=>{reset();command({type:'status'}).catch(report);};
$('preview').onclick=()=>{try{
 if(!candidate)throw Error('Save the duplicate form once, then click refresh.');
 reviewed=FormLinkCore.validate({pageId:candidate.pageId,nodeId:candidate.nodeId,fallback:$('fallback').value.trim(),deeplink:$('deeplink').value.trim()});
 $('diff').textContent=JSON.stringify({form:candidate.title,pageId:reviewed.pageId,changes:{[candidate.nodeId+'.buttonsInfo.website.link.url']:{before:candidate.fallback,after:reviewed.fallback},[candidate.nodeId+'.buttonsInfo.website.link.scheme']:{before:candidate.deeplink,after:reviewed.deeplink}}},null,2);
 $('arm').disabled=false;
}catch(e){reset();report(e);}};
$('arm').onclick=async()=>{try{await command({type:'arm',plan:reviewed});reset();}catch(e){report(e);}};
$('disarm').onclick=()=>{reset();command({type:'disarm'}).catch(report);};
(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id;$('generate').click();await command({type:'status'});})().catch(()=>report(Error('Reload the Ads Manager tab after installing, then open this extension again.')));

$('copy-diagnostics').onclick=async()=>{const text=JSON.stringify(lastState,null,2);try{await navigator.clipboard.writeText(text);$('status').textContent='Diagnostic report copied.';}catch{$('detected').textContent=text;$('status').textContent='Select and copy the diagnostic report above.';}};
