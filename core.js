(() => {
const endpoint = 'https://ads.tiktok.com/instant_page/api/v1/update/';
function decode(body) {
 let outer, format;
 if (typeof body === 'string') {
  try { outer = JSON.parse(body); format='json'; }
  catch { const q=new URLSearchParams(body); if (!q.has('data')) return null; outer=Object.fromEntries(q); format='params'; }
 } else if (body instanceof URLSearchParams) { outer=Object.fromEntries(body); format='urlparams'; }
 else if (typeof FormData !== 'undefined' && body instanceof FormData) {
  if ([...body.values()].some(v=>typeof v!=='string')) return null;
  outer=Object.fromEntries(body); format='form';
 } else return null;
 if (!outer || typeof outer.page_id!=='string' || !/^\d+$/.test(outer.page_id)) return null;
 const config=typeof outer.data==='string'?JSON.parse(outer.data):outer.data;
 const nodes=config?.data;
 if (!nodes || typeof nodes!=='object') return null;
 const ids=Object.keys(nodes).filter(id=>{
  const node=nodes[id]; if(!node?.buttonsInfo?.website?.link || /nonlead/i.test(id)) return false;
  if(['thanksPageFormCta','leadFormCTA'].includes(id)) return true;
  let parent=node.parent; const seen=new Set();
  while(parent && !seen.has(parent)) {if(/nonlead/i.test(parent))return false;if(/thanks/i.test(parent))return true;seen.add(parent);parent=nodes[parent]?.parent;}
  return false;
 });
 if(ids.length!==1) return null;
 const nodeId=ids[0],link=nodes[nodeId].buttonsInfo.website.link;
 if(link.linkType!=='url') return null;
 return {outer,config,link,nodeId,format,stringData:typeof outer.data==='string'};
}
function diagnose(body) {
 let outer, bodyFormat=typeof body;
 try {
  if(typeof body==='string') {try{outer=JSON.parse(body);bodyFormat='JSON';}catch{outer=Object.fromEntries(new URLSearchParams(body));bodyFormat='URL encoded';}}
  else if(body instanceof URLSearchParams || (typeof FormData!=='undefined' && body instanceof FormData)){outer=Object.fromEntries(body);bodyFormat=body.constructor.name;}
  if(!outer || typeof outer!=='object')return {bodyFormat};
  const result={bodyFormat,topLevelKeys:Object.keys(outer).slice(0,25),hasPageId:typeof outer.page_id==='string',hasData:!!outer.data};
  let config=outer.data;
  if(typeof config==='string'){try{config=JSON.parse(config);}catch{result.dataFormat='not JSON';return result;}}
  if(config && typeof config==='object'){
   result.configKeys=Object.keys(config).slice(0,15);
   const nodes=config.data;
   if(nodes && typeof nodes==='object')result.websiteCtas=Object.entries(nodes).filter(([,n])=>n?.buttonsInfo?.website).slice(0,10).map(([id,n])=>({nodeId:id,parent:n.parent||'',hasLink:!!n.buttonsInfo.website.link,linkKeys:Object.keys(n.buttonsInfo.website.link||{}),linkType:['url','appDownload'].includes(n.buttonsInfo.website.link?.linkType)?n.buttonsInfo.website.link.linkType:'other'}));
  }
  return result;
 }catch{return {bodyFormat,parseError:true};}
}
function encode(d) {
 d.outer.data=d.stringData?JSON.stringify(d.config):d.config;
 if(d.format==='json') return JSON.stringify(d.outer);
 const q=new URLSearchParams(); for(const [k,v] of Object.entries(d.outer)) q.append(k,v);
 if(d.format==='urlparams') return q;
 if(d.format==='form') { const f=new FormData(); for(const [k,v] of q) f.append(k,v); return f; }
 return q.toString();
}
function validate(plan) {
 if(!plan || !/^\d+$/.test(plan.pageId)) throw Error('A recognized existing form is required.');
 const fallback=new URL(plan.fallback);
 if(fallback.protocol!=='https:') throw Error('Fallback must use HTTPS.');
 const deep=new URL(plan.deeplink);
 if(!['snssdk1233:','https:'].includes(deep.protocol)) throw Error('Use an HTTPS or snssdk1233 deeplink.');
 if(plan.deeplink.length>8000) throw Error('Deeplink is too long.');
 return plan;
}
function summary(d) { return {pageId:d.outer.page_id,title:String(d.outer.title||''),fallback:d.link.url||'',deeplink:d.link.scheme||'',nodeId:d.nodeId}; }
function transform(body, plan) {
 validate(plan); const d=decode(body);
 if(!d || (d.outer.page_id!==plan.pageId || (plan.nodeId && d.nodeId!==plan.nodeId))) return null;
 // Only these two values change. Preserve nested deeplink flags, questions and routing.
 d.link.url=plan.fallback; d.link.scheme=plan.deeplink;
 return encode(d);
}
globalThis.FormLinkCore={endpoint,decode,encode,summary,validate,transform,diagnose};
})();