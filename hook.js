(() => {
if(window.__formLinkEditorInstalled) return;
window.__formLinkEditorInstalled=true;
let plan=null, candidate=null, message='Ready. Save a duplicate form once to detect its final CTA.', expires=0;
const core=window.FormLinkCore;
const state=()=>{if(plan && Date.now()>expires){plan=null;message='Pending change expired. Review and arm again.';}return {candidate,armed:!!plan,message};};
function announce(){window.dispatchEvent(new CustomEvent('form-link-state',{detail:JSON.stringify(state())}));}
window.addEventListener('form-link-command',e=>{
 try {
  const c=JSON.parse(e.detail);
  if(c.type==='arm') {
   core.validate(c.plan);
   if(!candidate || c.plan.pageId!==candidate.pageId) throw Error('Save this duplicate once before applying a change.');
   plan=c.plan; expires=Date.now()+120000; message='Armed for two minutes. Make a small edit and click Save in TikTok. Do not click Complete or Publish.';
  } else if(c.type==='disarm') {plan=null; message='Disarmed.';}
 } catch(e){message=e.message;}
 announce();
});
function prepare(url,method,body){
 let target; try{target=new URL(url,location.href);}catch{return {body};}
 if(method.toUpperCase()!=='POST' || target.origin+target.pathname!==core.endpoint) return {body};
 try{
  const d=core.decode(body); if(!d) {message='Save observed, but this form format is not supported.'; announce();return {body};}
  candidate=core.summary(d);
  if(plan && Date.now()>expires) {plan=null; message='Change expired. Review and arm again.';}
  if(!plan){message='Detected final website CTA. Review the deeplink below.';announce();return {body};}
  const changed=core.transform(body,plan);
  if(changed===null){message='Different form saved; change remains armed for the selected form.';announce();return {body};}
  plan=null; message='Deeplink inserted into one save request. Waiting for response.';announce();return {body:changed,changed:true};
 }catch(e){plan=null;message='No change applied: '+e.message;announce();return {body};}
}
function result(status){message='Modified save returned HTTP '+status+'. Reopen the saved form, save it again unarmed, and compare the detected deeplink. HTTP success alone does not confirm acceptance.';announce();}
const originalFetch=window.fetch;
window.fetch=async function(input,init){
 const req=input instanceof Request;
 const method=String(init?.method || (req?input.method:'GET'));
 let body=init?.body;
 // Request bodies need asynchronous cloning; ordinary fetch inputs remain untouched.
 if(req && body===undefined && method.toUpperCase()==='POST') {
  try {const u=new URL(input.url);if(u.origin+u.pathname===core.endpoint) body=await input.clone().text();}catch{}
 }
 const prepared=prepare(req?input.url:String(input),method,body);
 try{
  const response=await originalFetch.call(this,input,prepared.changed?{...init,body:prepared.body}:init);
  if(prepared.changed) result(response.status);
  return response;
 }catch(e){if(prepared.changed){message='Modified save failed to send; disarmed. Reopen the form before retrying.';announce();}throw e;}
};
const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
const metadata=new WeakMap();
XMLHttpRequest.prototype.open=function(method,url,...args){metadata.set(this,{method:String(method),url:String(url)});return open.call(this,method,url,...args);};
XMLHttpRequest.prototype.send=function(body){
 const m=metadata.get(this),p=m?prepare(m.url,m.method,body):{body};
 if(p.changed)this.addEventListener('loadend',()=>result(this.status),{once:true});
 return send.call(this,p.body);
};
})();