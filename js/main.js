/* ---------- engine ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const stage=$('#stage');
// Scale the 1920x1080 stage to fit the window, leaving room for the control bar when it's visible.
function fit(){const ctl=$('#ctl'),res=ctl&&!ctl.classList.contains('hide')?ctl.offsetHeight+28:0;$('#wrap').style.bottom=res+'px';const s=Math.min(innerWidth/1920,(innerHeight-res)/1080);stage.style.transform=`scale(${s})`;stage.dataset.scale=s;}
addEventListener('resize',fit);addEventListener('DOMContentLoaded',fit);fit();

let speed=1, paused=true, runToken=0, started=false;
const FOSLOGO='assets/financeos-badge.png';
// Virtual clock: advances only while playing, scaled by speed. All script timing (sleep, untilV) runs on it.
let beatT0=0,vAcc=0,vLast=performance.now();
function vtick(){const n=performance.now();if(!paused&&!seeking)vAcc+=(n-vLast)*speed;vLast=n;}
function vnow(){vtick();return vAcc;}
function setPaused(p){vtick();paused=p;playUI();voSync();}
function setSpeed(v){vtick();speed=v;$$('#speed button').forEach(b=>b.classList.toggle('on',+b.dataset.v===v));voSync();}
// Every sleep has an absolute virtual end time and belongs to the run that created it; a restart rejects stale sleeps.
// While seeking (chapter jump), sleeps go into a queue that is drained in virtual-time order as fast as possible.
let seeking=null;const seekQ=[];
const seekCh=new MessageChannel();seekCh.port1.onmessage=pumpSeek;
function pumpSeek(){if(!seeking||!seekQ.length)return;seekQ.sort((a,b)=>a.end-b.end);const it=seekQ.shift();if(it.tok!==runToken){it.rej(new Error('restart'))}else{vAcc=Math.max(vAcc,it.end);it.r();}seekCh.port2.postMessage(0);}
function waitReal(it){const step=()=>{if(it.tok!==runToken){it.rej(new Error('restart'));return}const rem=it.end-vnow();if(rem<=0){it.r();return}setTimeout(step,paused?60:Math.min(rem/speed,250))};step();}
const sleep=ms=>new Promise((r,rej)=>{const it={end:vnow()+ms,r,rej,tok:runToken};if(seeking){seekQ.push(it);seekCh.port2.postMessage(0);}else waitReal(it);});
// Tween fn(eased 0..1) over ms of virtual time.
const tween=(ms,fn)=>new Promise(res=>{const t0=vnow();const st=()=>{const k=seeking?1:Math.min(1,(vnow()-t0)/ms);fn(1-Math.pow(1-k,3));if(k<1)requestAnimationFrame(st);else res();};st();});
addEventListener('unhandledrejection',e=>{if(e.reason&&e.reason.message==='restart')e.preventDefault();});
function focus(side){P.L.classList.toggle('dim',side==='R');P.R.classList.toggle('dim',side==='L');}
async function untilV(ms){const rem=beatT0+ms-vnow();if(rem>0)await sleep(rem);}
function guard(tok){if(tok!==runToken)throw new Error('restart')}

const P={L:$('#L'),R:$('#R')};
const tokens={L:0,R:0};
function addTok(side,n){tokens[side]+=n;P[side].querySelector('.tok b').textContent=tokens[side].toLocaleString();}
let stampT=0,stampOn=false,stampV0=0;
function stampShow(){stampT=(vnow()-stampV0)/1000;const m=String(Math.floor(stampT/60)).padStart(2,'0'),s=String(Math.floor(stampT%60)).padStart(2,'0');$('#L .stamp').textContent=`${m}:${s}`}
setInterval(()=>{if(stampOn)stampShow()},250);

const cur=$('#cur');
function moveCursorTo(el,dx=0,dy=0){
  const sc=+stage.dataset.scale, sr=stage.getBoundingClientRect(), r=el.getBoundingClientRect();
  cur.style.left=((r.left-sr.left)/sc + r.width/(2*sc)+dx)+'px';
  cur.style.top=((r.top-sr.top)/sc + r.height/(2*sc)+dy)+'px';
}
async function click(el,dx,dy){moveCursorTo(el,dx,dy);await sleep(430);cur.classList.add('click');await sleep(170);cur.classList.remove('click');}
function hideCursor(){cur.style.left='-100px';cur.style.top='-100px';}

function scrollMsgs(side){const m=P[side].querySelector('.msgs');m.scrollTop=m.scrollHeight;}
function clearGreet(side){const g=P[side].querySelector('.greet');if(g)g.remove();}

async function type(side,text,cps=38){
  const ta=P[side].querySelector('.ta'), send=P[side].querySelector('.send');
  ta.classList.add('cursorblink');
  for(let i=0;i<text.length;i++){ta.textContent+=text[i];send.classList.add('on');await sleep(1000/cps+ (text[i]===' '?18:0));}
  ta.classList.remove('cursorblink');
}
async function send(side){
  const ta=P[side].querySelector('.ta'), text=ta.textContent, msgs=P[side].querySelector('.msgs');
  clearGreet(side);
  ta.textContent='';P[side].querySelector('.send').classList.remove('on');
  const u=document.createElement('div');u.className='u';u.textContent=text;msgs.appendChild(u);scrollMsgs(side);
  addTok(side,Math.ceil(text.length/4));
  await sleep(350);
}
const ROWS={'Q3_GL_export_SAP_DE_AU.xlsx':1900,'Q3_GL_export_NetSuite.xlsx':2400,'Q3_bookings_Salesforce.csv':380,'FY26_Plan_v2.xlsx':240,'Q3_GL_export_NetSuite (1).xlsx':2400,'FY26_Plan_v3_FINAL.xlsx':240,'Q3_AU_Priority.xlsx':610};
const TOK_PER_ROW=20; // ~8 short columns at ~2.5 tokens per cell
async function files(side,names,gap=650){
  clearGreet(side);
  const msgs=P[side].querySelector('.msgs');const wrap=document.createElement('div');wrap.className='files';msgs.appendChild(wrap);
  for(const n of names){const c=document.createElement('div');c.className='fchip';const rows=ROWS[n]||300;c.innerHTML=`<span class="ic ${n.endsWith('.csv')?'csv':''}">${n.endsWith('.csv')?'CSV':'X'}</span>${n}<span style="color:#8a867b">&middot; ${rows.toLocaleString()} rows</span>`;wrap.appendChild(c);scrollMsgs(side);await sleep(40);c.classList.add('in');addTok(side,rows*TOK_PER_ROW);await sleep(gap);}
}
const AV=`<div class="av"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg></div>`;
function newAssistant(side){const msgs=P[side].querySelector('.msgs');const a=document.createElement('div');a.className='a';a.innerHTML=AV+'<div class="body"></div>';msgs.appendChild(a);scrollMsgs(side);return a.querySelector('.body');}
async function stream(body,side,text,wps=15){
  const p=document.createElement('p');body.appendChild(p);const words=text.split(' ');
  for(let i=0;i<words.length;i++){p.textContent+=(i?' ':'')+words[i];scrollMsgs(side);await sleep(1000/wps);}
  addTok(side,Math.ceil(text.length/4));
}
function table(body,side,head,rows,opts={}){
  const t=document.createElement('table');t.className='t';
  t.innerHTML='<tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr>'+rows.map((r,ri)=>`<tr data-e="${r[0]}">`+r.map((c,ci)=>`<td class="${(opts.bold||[]).some(([a,b])=>a===ri&&b===ci)?'b':''}">${c}</td>`).join('')+'</tr>').join('');
  body.appendChild(t);scrollMsgs(side);addTok(side,Math.ceil(t.textContent.length/4)+rows.length*6);return t;
}
let toolDefsCounted={L:false,R:false};
function tool(body,side,detail){if(!toolDefsCounted[side]){toolDefsCounted[side]=true;addTok(side,1200);}const d=document.createElement('div');d.className='tool';d.innerHTML=`<img src="assets/financeos-badge.png" alt="FinanceOS"><span class="lbl">Using FinanceOS Connector</span><span class="det">${detail}</span><span class="sp"></span><span class="ok">&#10003;</span>`;body.appendChild(d);scrollMsgs(side);return d;}
function toolDone(d,side,resultTokens=350){d.classList.add('done');addTok(side,resultTokens);}
function line(body,side,cls,html){const d=document.createElement('div');d.className=cls;d.innerHTML=html;body.appendChild(d);scrollMsgs(side);return d;}
async function caption(t){const c=$('#cap');if(!t){c.classList.remove('show');return}c.querySelector('span').textContent=t;c.classList.add('show');}
const RUN_MS=278700; // measured length of one full run (virtual ms); used only for the progress bar. Re-measure after retiming.
const fmt=ms=>{const t=Math.max(0,Math.round(ms/1000));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
setInterval(()=>{const t=started?vnow():vAcc;$('#prog').style.width=Math.min(100,t/RUN_MS*100)+'%';$('#timelbl').textContent=`${fmt(t)} / ${fmt(RUN_MS)}`+(chIdx>=0?` \u00b7 ${chIdx+1} of ${CHAPTERS.length}`:'');},250);
// Chapter names shown in the control bar, keyed like VO. Beats not listed (Setup) keep the previous chapter.
const CHAPTERS=[['0|Opening','Intro'],['2|Turn on the connector','Connecting FinanceOS'],['2b|Under the hood','Under the Hood'],
  ['2|The prompt','Asking the Question'],['3|Data access','Getting the Data'],['4|Consolidation','Consolidating Sources'],
  ['5|Context','Defining the Terms'],['6|The drift','Tracing the Numbers'],['7|Repeatability + Excel','Building the CFO Pack'],
  ['7b|Refresh','Next Month'],['8|Audit','Audit Trail'],['9|Cost efficiency','Token Cost'],['10|Close','Wrap-Up']];
let chIdx=-1;
function chapUI(){$$('#chap li').forEach((li,i)=>{li.classList.toggle('on',i===chIdx);li.classList.toggle('done',chIdx>=0&&i<chIdx);});}
function buildChap(){$('#chap ol').innerHTML=CHAPTERS.map(([k,n],i)=>`<li><button data-k="${k}"><span class="n">${String(i+1).padStart(2,'0')}</span><span class="t">${n}</span></button></li>`).join('');
  $$('#chap button').forEach(b=>b.onclick=()=>{jumpTo(b.dataset.k);$('#chap').classList.remove('open');b.blur();});
  $('#chap .handle').onclick=()=>$('#chap').classList.toggle('open');}
function chapter(key){const i=CHAPTERS.findIndex(c=>c[0]===key);if(i<0)return;chIdx=i;$('#beatlbl').textContent=CHAPTERS[i][1];chapUI();if(seeking&&seeking===key)endSeek();}
function beat(n,t){beatT0=vnow();chapter(`${n}|${t}`);vo(`${n}|${t}`);}

/* narration: one clip per beat, started when the beat starts (keys are `${n}|${label}`) */
const VO={'0|Opening':'VO_00_opening_Despina_v2','2|Turn on the connector':'VO_01_beat2a_connector_Despina_v2','2b|Under the hood':'VO_01b_hood_Despina_v2',
  '3|Data access':'VO_02_beat3_data_Despina_v2','4|Consolidation':'VO_03_beat4_consolidation_Despina_v2','5|Context':'VO_04_beat5_context_Despina_v2',
  '6|The drift':'VO_05_beat6_drift_Despina_v2','7|Repeatability + Excel':'VO_06_beat7a_excel_Despina_v2','7b|Refresh':'VO_07_beat7b_nextmonth_Despina_v2',
  '8|Audit':'VO_08_beat8_audit_Despina_v4','9|Cost efficiency':'VO_09_beat9_cost_Despina_v2','10|Close':'VO_10_beat10_close_Despina_v2'};
const VO_REV=4; // bump after editing any clip so browsers don't play a cached copy
let voOn=true,voCur=null;
function voStop(){if(voCur){voCur.pause();voCur=null;}}
function vo(key){const f=VO[key];if(!f)return;voStop();if(!voOn||seeking)return;const a=new Audio(`audio/${f}.wav?v=${VO_REV}`);a.preservesPitch=true;a.playbackRate=speed;voCur=a;if(!paused)a.play().catch(()=>{});}
function voSync(){if(!voCur)return;voCur.playbackRate=speed;if(paused||!voOn)voCur.pause();else if(!voCur.ended)voCur.play().catch(()=>{});}

/* excel */
function buildExcel(side,cfg){
  const ex=P[side].querySelector('.excel');
  const I={cloud:'<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18z"/><path d="M12 12v6M9.5 14.5 12 12l2.5 2.5"/></svg>',refresh:'<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/></svg>',drill:'<svg viewBox="0 0 24 24"><path d="M4 6h10M4 10h10M4 14h7M4 18h7"/><path d="M17 12v8M14 17l3 3 3-3"/></svg>',adv:'<svg viewBox="0 0 24 24"><path d="M3 20h18M4 16l5-6 4 3 6-8"/></svg>',rb:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',fx:'<svg viewBox="0 0 24 24"><path d="M6 20c2 0 3-1 3.4-3L11 7c.4-2 1.4-3 3.4-3"/><path d="M7 11h6"/><path d="M14 20l6-8M14 12l6 8"/></svg>',pub:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M7 13l3-3 3 2 4-4"/></svg>',exp:'<svg viewBox="0 0 24 24"><path d="M5 4h9l5 5v11H5z"/><path d="M12 11v7M9 15l3 3 3-3"/></svg>',fil:'<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>'};
  const bb=(k,l,id)=>`<div class="bb" ${id?`id="${side}-btn-${id}"`:''}>${I[k]}<span>${l}</span></div>`;
  const drRibbon=`<div class="tabs"><span>File</span><span>Home</span><span>Insert</span><span>Page Layout</span><span>Formulas</span><span>Data</span><span>Review</span><span>View</span><span>Automate</span><span>Help</span><span class="on">Datarails</span></div>
  <div class="dr">
    <div class="grp"><div class="row">${bb('cloud','Submit')}${bb('refresh','Refresh','refresh')}</div><div class="gl">File</div></div>
    <div class="grp"><div class="row">${bb('drill','Drill Down','drill')}${bb('adv','Advanced')}</div><div class="gl">Analysis</div></div>
    <div class="grp"><div class="row">${bb('rb','Report Builder')}${bb('fx','Functions')}<div class="sm"><span>Auto-Refresh</span><span>Data Tables</span><span>Dynamic Ranges</span></div></div><div class="gl">Report Tools</div></div>
    <div class="grp"><div class="row"><div class="sm"><span>Filters</span><span>Lists</span><span>[9/30/2026]</span></div><div class="sm"><span>Roll Forward</span></div></div><div class="gl">Report View</div></div>
    <div class="grp"><div class="row">${bb('pub','Publish')}${bb('exp','Export')}</div><div class="gl">Share</div></div>
    <div class="grp"><div class="row"><div class="sm"><span>Entity</span><span>Intercompany</span></div></div><div class="gl">Filters</div></div>
  </div>`;
  const stdRibbon=`<div class="tabs"><span>File</span><span class="on">Home</span><span>Insert</span><span>Page Layout</span><span>Formulas</span><span>Data</span><span>Review</span><span>View</span><span>Automate</span><span>Help</span></div>
  <div class="dr home">
    <div class="grp"><div class="row"><div class="bb"><svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="1.5"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/></svg><span>Paste</span></div><div class="sm"><span class="ico">&#9986;</span><span class="ico">&#10697;</span><span class="ico">&#128396;</span></div></div><div class="gl">Clipboard</div></div>
    <div class="grp"><div class="col"><div class="hrow"><span class="dd" style="width:92px">Calibri</span><span class="dd" style="width:38px">11</span><span class="tb">A<sup>&uarr;</sup></span><span class="tb">A<sup>&darr;</sup></span></div><div class="hrow"><span class="tb b">B</span><span class="tb i">I</span><span class="tb u">U</span><span class="sep"></span><span class="tb">&#9638;</span><span class="tb"><span class="swatch" style="background:#ffd966"></span></span><span class="tb"><span class="swatch" style="background:#c00"></span></span></div></div><div class="gl">Font</div></div>
    <div class="grp"><div class="col"><div class="hrow"><span class="tb">&#8801;</span><span class="tb">&#8801;</span><span class="tb">&#8801;</span><span class="sep"></span><span class="tb small">Wrap Text</span></div><div class="hrow"><span class="tb">&#8676;</span><span class="tb">&#8677;</span><span class="tb">&#8678;</span><span class="sep"></span><span class="tb small">Merge &amp; Center</span></div></div><div class="gl">Alignment</div></div>
    <div class="grp"><div class="col"><div class="hrow"><span class="dd" style="width:96px">General</span></div><div class="hrow"><span class="tb">$</span><span class="tb">%</span><span class="tb">,</span><span class="tb">.0</span><span class="tb">.00</span></div></div><div class="gl">Number</div></div>
    <div class="grp"><div class="sm"><span class="ico">&#9636; Conditional Formatting</span><span class="ico">&#9638; Format as Table</span><span class="ico">&#9635; Cell Styles</span></div><div class="gl">Styles</div></div>
    <div class="grp"><div class="row"><div class="bb"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16M10 5v14"/></svg><span>Cells</span></div></div><div class="gl">Cells</div></div>
    <div class="grp"><div class="row"><div class="bb"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><span>Editing</span></div></div><div class="gl">Editing</div></div>
  </div>`;

  const cols=['A','B','C','D','E','F','G'];
  const grids=cfg.sheets.map((sh,si)=>{
    let g=`<table class="sheet" data-sheet="${si}" style="${si?'display:none':''}"><tr><th class="rh"></th>`+cols.map(c=>`<th style="width:${(sh.w&&sh.w[c])||96}px">${c}</th>`).join('')+'</tr>';
    for(let r=1;r<=12;r++){g+=`<tr><th class="rh">${r}</th>`;for(const c of cols){const v=(sh.cells[c+r]||{});g+=`<td id="${side}-s${si}-${c}${r}" class="${v.cls||''} ${typeof v.v==='string'&&/^[−+\-]?[\d$,.]+%?$/.test(v.v)?'num':''}">${v.v??''}</td>`;}g+='</tr>';}
    return g+'</table>';
  }).join('');
  const pane=`<div class="pane" id="${side}-pane"><div class="ph"><span id="${side}-pane-title">Drill Down</span><img src="assets/financeos-badge.png" alt="FinanceOS"></div><div class="pb" id="${side}-pane-body"></div></div>`;
  ex.innerHTML=`<div class="title"><span style="font-size:12px;opacity:.9">AutoSave <span style="border:1px solid #fff;border-radius:999px;padding:0 6px;font-size:10px">Off</span></span><span class="fn">${cfg.name}</span></div>
  ${cfg.conn?drRibbon:stdRibbon}
  <div class="fbar"><div class="namebox" id="${side}-nb">A1</div><div class="fx">fx</div><div class="formula" id="${side}-fb"></div></div>
  <div class="grid">${grids}${cfg.conn?pane:''}<div class="dlg"><span class="sp"></span>Refreshing from FinanceOS&hellip;</div></div>
  <div class="sheettabs">${cfg.sheets.map((sh,si)=>`<span id="${side}-tab-${si}" class="${si?'':'on'}">${sh.name}</span>`).join('')}</div>`;
  ex.dataset.sheet='0';
}
async function xsheet(side,si){const tab=$(`#${side}-tab-${si}`);await click(tab);$$(`#${side} .excel .sheettabs span`).forEach(t=>t.classList.remove('on'));tab.classList.add('on');$$(`#${side} .excel table.sheet`).forEach(t=>t.style.display=t.dataset.sheet==String(si)?'':'none');P[side].querySelector('.excel').dataset.sheet=String(si);$$(`#${side} .excel td.sel`).forEach(t=>t.classList.remove('sel'));}
function paneSet(side,title,html){$(`#${side}-pane-title`).textContent=title;$(`#${side}-pane-body`).innerHTML=html;}
function xcell(side,ref){const si=P[side].querySelector('.excel').dataset.sheet||'0';return $(`#${side}-s${si}-${ref}`)}
async function xbtn(side,id){const b=$(`#${side}-btn-${id}`);moveCursorTo(b);await sleep(650);b.classList.add('hover');await sleep(350);b.classList.add('press');cur.classList.add('click');await sleep(180);b.classList.remove('press');cur.classList.remove('click');await sleep(300);b.classList.remove('hover');}
async function xselect(side,ref,formula){
  $$(`#${side} .excel td.sel`).forEach(t=>t.classList.remove('sel'));
  const c=xcell(side,ref);await click(c);c.classList.add('sel');$(`#${side}-nb`).textContent=ref;$(`#${side}-fb`).textContent=formula;
}
async function xtypeFormulaBar(side,text,cps=28){const fb=$(`#${side}-fb`);fb.textContent='';for(const ch of text){fb.textContent+=ch;await sleep(1000/cps);}}

/* ---------- content ---------- */
const PROMPT='Show me Q3 gross margin by entity vs plan. Flag anything more than 2 points off.';
const H4=['Entity','Q3 GM%','Plan GM%','Δ'];
const R_RIGHT=[['Vandelay US','61.2%','60.0%','+1.2'],['Vandelay UK','58.9%','59.5%','−0.6'],['Vandelay DE','54.3%','58.0%','−3.7'],['Vandelay AU','63.0%','61.0%','+2.0']];
const R_LEFT1=[['Vandelay US','61.2%','60.0%'],['Vandelay UK','58.9%','59.5%'],['Vandelay DE','47.1%','58.0%']];
const R_LEFT2=[['Vandelay US','61.2%','60.0%','+1.2'],['Vandelay UK','59.6%','59.5%','+0.1'],['Vandelay DE','52.8%','58.0%','−5.2'],['Vandelay AU','63.0%','61.0%','+2.0']];

function xlsxCells(vals,conn){
  const c={A1:{v:'Entity',cls:'hdr'},B1:{v:'Plan GM%',cls:'hdr'},C1:{v:'Q3 GM%',cls:'hdr'},D1:{v:'Δ',cls:'hdr'}};
  if(conn){c.F1={v:'Period',cls:'hdr'};c.G1={v:'Q3 FY26'};}
  vals.forEach((r,i)=>{const n=i+2;c['A'+n]={v:r[0]};c['B'+n]={v:r[2]};c['C'+n]={v:r[1]};c['D'+n]={v:r[3]};});
  return c;
}
let leftTable2=null,rightTable=null;

/* ---------- the script ---------- */
async function run(tok){
  const L='L',R='R';
  // reset
  for(const s of [L,R]){P[s].querySelector('.msgs').innerHTML='<div class="greet">Good afternoon</div>';P[s].querySelector('.ta').textContent='';const ex=P[s].querySelector('.excel');ex.className='excel';ex.innerHTML='';delete ex.dataset.sheet;const cd=P[s].querySelector('.card');cd.className='card';cd.innerHTML='';tokens[s]=0;addTok(s,0);}
  $('#R .lineage').classList.remove('open');$$('#R .lineage li').forEach(l=>l.classList.remove('in','hl'));
  $$('.ov').forEach(o=>o.classList.remove('on'));$('#L .share').classList.remove('hover','press');$('#L .tip').classList.remove('on');
  $('#R .conn').classList.remove('on');$('#R .pop').classList.remove('on');$('#R .pop .sw').classList.remove('on');toolDefsCounted={L:false,R:false};$('#R .acctname').textContent='a.morgan';$('#R .acct').textContent='AM';$('#R .acctname').style.opacity='';$('#R .acct').style.opacity='';$('#tkL').textContent='0';$('#tkR').textContent='0';$('#pctN').textContent='0%';$$('#stage .cursorblink').forEach(x=>x.classList.remove('cursorblink'));$$('#stage .hover,#stage .press').forEach(x=>x.classList.remove('hover','press'));$$('#stage .send.on').forEach(x=>x.classList.remove('on'));cur.classList.remove('click');$$('#hood .in').forEach(x=>x.classList.remove('in'));$$('#L .finder').forEach(x=>x.remove());$('#L .acct').textContent='AM';$('#intro').classList.remove('on');focus(null);P.L.classList.add('off');P.R.classList.add('off');P.L.style.opacity='';P.L.style.transition='';stampT=0;stampOn=false;$('#L .stamp').textContent='00:00';hideCursor();caption('');
  $('#tokens .bar i').style.width='0';$$('#tokens .bar i')[1].style.width='0';

  vAcc=0;vLast=performance.now();
  const hoodLeft=2650,hoodRight=5560,hoodTags=[8900,16050,20950],hoodEnd=26900;
  // INTRO
  beat(0,'Opening');guard(tok);
  P.L.classList.add('off');P.R.classList.add('off');$('#in1').textContent='';$('#in2').textContent='';$('#intro').classList.add('on');
  caption("What actually changes when you connect Claude to your financial data? Same Claude, same question, same finance team.");
  await sleep(600);
  {const a=$('#in1');a.classList.add('cursorblink');for(const ch of 'Two Claudes. Same question.'){a.textContent+=ch;await sleep(55);}a.classList.remove('cursorblink');await sleep(900);
   const b=$('#in2');b.classList.add('cursorblink');for(const ch of 'One of them has FinanceOS.'){b.textContent+=ch;await sleep(55);}b.classList.remove('cursorblink');b.innerHTML='One of them has <b>FinanceOS.</b>';await sleep(2200);}
  $('#intro').classList.remove('on');await sleep(800);
  caption("Left, Claude working from whatever you hand it. Right, Claude connected to Datarails FinanceOS.");
  P.L.classList.remove('off');await sleep(500);P.R.classList.remove('off');await untilV(16300);caption('');await sleep(300);

  // BEAT 1
  beat(1,'Setup');guard(tok);
  caption('');

  // BEAT 2
  beat(2,'Turn on the connector');guard(tok);
  caption("Step one, on the right. Turn on the FinanceOS Connector.");
  focus('R');{const plus=$('#R .composer .plus');await click(plus);plus.classList.add('hover');$('#R .pop').classList.add('on');await sleep(700);
   const rw=$('#R .pop .rw.fos');moveCursorTo(rw.querySelector('.sw'));await sleep(650);rw.classList.add('hover');await sleep(400);cur.classList.add('click');await sleep(200);cur.classList.remove('click');rw.querySelector('.sw').classList.add('on');await sleep(900);
   $('#R .pop').classList.remove('on');rw.classList.remove('hover');plus.classList.remove('hover');await sleep(200);$('#R .conn').classList.add('on');hideCursor();await untilV(4700);}
  caption('');focus(null);
  // BEAT 2b — Under the hood
  beat('2b','Under the hood');guard(tok);
  $$('#hood .hcol, #hood .hnode, #hood .harrow, #hood .note, #hood .row').forEach(x=>x.classList.remove('in'));
  $('#hood').classList.add('on');caption("Here's what that switch actually did. On the left, Claude gets files. Over on the right, Claude gets FinanceOS: your ERP, CRM and spreadsheets consolidated into one governed, always-current dataset; a semantic layer that holds your definitions, mappings and financial logic; and permissions and lineage on every query. One foundation, underneath every answer.");
  await untilV(hoodLeft);$('#hL').classList.add('in');await sleep(300);$('#hL1').classList.add('in');await sleep(350);$('#hL2').classList.add('in');await sleep(250);$('#hL3').classList.add('in');await sleep(300);$('#hLn').classList.add('in');
  await untilV(hoodRight);$('#hR').classList.add('in');await sleep(300);$('#hR1').classList.add('in');await sleep(300);$('#hR2').classList.add('in');await sleep(250);$('#hR3').classList.add('in');
  {const rows=$$('#hR3 .row');for(let i=0;i<3;i++){await untilV(hoodTags[i]);rows[i].classList.add('in');}}
  await untilV(23950);$('#hR4').classList.add('in');await sleep(250);$('#hR5').classList.add('in');await sleep(250);$('#hR6').classList.add('in');await sleep(250);$('#hR7').classList.add('in');await sleep(300);$('#hRn').classList.add('in');
  await untilV(hoodEnd);$('#hood').classList.remove('on');await sleep(450);
  beat(2,'The prompt');
  await Promise.all([type(L,PROMPT,60),type(R,PROMPT,60)]);await sleep(250);
  await Promise.all([send(L),send(R)]);

  // BEAT 3
  beat(3,'Data access');guard(tok);caption("On the left, Claude's first move is to ask for your files. So you're back in the exports folder: NetSuite, SAP, Salesforce, the plan, hoping every one of them is current. Over on the right, it's already pulling from both ERPs, the CRM and the approved plan. Nothing to hand over.");
  stampOn=true;stampV0=vnow();
  let toolB3=null;const rightB3=async()=>{await sleep(900);const b=newAssistant(R);toolB3=tool(b,R,'gross_margin_pct &middot; by entity &middot; Q3 FY26 &middot; Actual vs Plan');await sleep(900);await stream(b,R,'Pulling Q3 actuals and FY26 plan from FinanceOS.',12);line(b,R,'status','Sources: NetSuite &middot; SAP &middot; Salesforce &middot; FY26 Plan (v3, approved)');};
  const leftB3=async()=>{await sleep(700);const b=newAssistant(L);await stream(b,L,"I don't have access to your financial systems. Please upload the Q3 actuals and the plan, and let me know which entities to include.");await sleep(1400);await files(L,['Q3_GL_export_NetSuite.xlsx','Q3_GL_export_SAP_DE_AU.xlsx','Q3_bookings_Salesforce.csv','FY26_Plan_v2.xlsx','Q3_GL_export_NetSuite (1).xlsx'],750);};
  focus('L');await leftB3();await untilV(13200);focus('R');await rightB3();await untilV(20200);focus(null);guard(tok);caption('');await sleep(250);

  // BEAT 4
  beat(4,'Consolidation');guard(tok);
  caption("On the left, you get a number with a warning attached. Two ERPs with different charts of accounts, a CRM that doesn't agree with either, currencies still mixed, intercompany counted twice. So back you go to fix it. Over on the right, FinanceOS has already brought NetSuite, SAP and Salesforce into one consolidated set: accounts mapped, FX applied, intercompany eliminated. That small tag under the table is the receipt.");
  const rightB4=async()=>{await sleep(300);toolDone(toolB3,R,420);await sleep(500);const b=newAssistant(R);rightTable=table(b,R,H4,R_RIGHT,{bold:[[2,3]]});await sleep(500);line(b,R,'status','<b style="color:#29261b">Flagged:</b> Vandelay DE is 3.7 points below plan.');await sleep(600);const tg=line(b,R,'','<span class="tag cons"><span class="lead">Consolidated: NetSuite + SAP + Salesforce</span><i class="seg">accounts mapped</i><i class="seg">FX at Q3 average</i><i class="seg">intercompany eliminated</i></span>');
    // VO: "accounts mapped, FX applied, intercompany eliminated. That small tag under the table is the receipt."
    const segs=$$('.seg',tg);for(const [k,t] of [[0,22300],[1,23200],[2,24400]]){await untilV(t);segs[k].classList.add('on');}
    await untilV(26100);tg.firstChild.classList.add('pulse');await untilV(28400);tg.firstChild.classList.remove('pulse');};
  const leftB4=async()=>{await sleep(900);const b=newAssistant(L);await stream(b,L,"Here's a first pass. Notes: the SAP export for DE and AU uses a different chart of accounts from NetSuite, so I mapped accounts approximately. Salesforce bookings don't reconcile to either GL. UK is in GBP, DE in EUR, AU in AUD; not converted. Intercompany between US and DE may be counted twice.",22);table(b,L,['Entity','Q3 GM%','Plan GM%'],R_LEFT1);await sleep(1800);await type(L,'Map SAP accounts to the NetSuite chart. Use GL revenue, not bookings. Convert to USD at Q3 average rates. Eliminate intercompany. Redo.',60);await sleep(300);await send(L);};
  focus('L');await leftB4();await untilV(15000);focus('R');await rightB4();await untilV(29000);focus(null);guard(tok);caption('');await sleep(250);

  // BEAT 5
  beat(5,'Context');guard(tok);
  caption("On the left, now you're writing a paragraph. What counts as net revenue, what sits in COGS, how 'Services' maps, which plan is official. You're teaching Claude your business from scratch, and you'll teach it again next time. Over on the right, those terms are defined once, in the FinanceOS semantic layer, and every report, dashboard and Claude answer uses the same ones. Ask how a number was built, and it walks you straight back to the ledger.");
  const leftB5=async()=>{await sleep(500);await type(L,'A few definitions before you redo it. Net revenue is after credits and intercompany. Gross margin uses net revenue and excludes implementation services cost, that sits in opex. "Services" in Salesforce maps to "Professional Services" in the GL. The plan file is v2 but we measure against v3, uploading it.',85);await send(L);await files(L,['FY26_Plan_v3_FINAL.xlsx'],500);await sleep(600);const b=newAssistant(L);await stream(b,L,'Understood. Recalculating with those definitions.',14);await sleep(600);leftTable2=table(b,L,H4,R_LEFT2,{bold:[[2,3]]});line(b,L,'status','<b style="color:#29261b">Flagged:</b> Vandelay DE is 5.2 points below plan.');await sleep(500);[[1,1],[2,1]].forEach(([r,c])=>leftTable2.rows[r+1].cells[c].classList.add('pulsecell'));};
  const rightB5=async()=>{await sleep(1200);await type(R,"How was Vandelay DE's 54.3% calculated? Show me the source.",44);await send(R);const b=newAssistant(R);const t5=tool(b,R,'drill_down &middot; gross_margin_pct &middot; Vandelay DE &middot; Q3 FY26');await sleep(1500);toolDone(t5,R,640);await stream(b,R,"Here's the breakdown from FinanceOS:",13);const d=line(b,R,'drill',`<div class="dh"><img src="assets/financeos-badge.png" alt="FinanceOS">Gross margin, Vandelay DE, Q3 FY26</div><div class="dbig">54.3%</div><div class="ddef"><b>Defined in the FinanceOS semantic layer</b> &middot; Net Revenue &middot; COGS &middot; Gross Margin % &middot; Plan v3<br>Same definitions in every report, dashboard and Claude answer.</div><div class="ddef">Gross Margin % = (Net Revenue &minus; COGS) / Net Revenue. Net Revenue is after credits and intercompany. COGS excludes implementation services (opex).</div><ul><li>Revenue: $4,180,000 <span>&mdash; accounts 4000&ndash;4090</span></li><li>COGS: $1,910,000 <span>&mdash; accounts 5000&ndash;5090</span></li><li id="srcline">Source: SAP GL, Vandelay DE <span>&mdash; 1,284 transactions, 2026-07-01 to 2026-09-30</span></li><li id="fxline">FX: EUR&rarr;USD, Q3 average <b>1.0842</b></li><li>Plan: FY26 Plan v3 <span>&mdash; approved 2026-01-14</span></li></ul>`);addTok(R,140);
    await untilV(23900);for(const li of $$('li',d)){li.classList.add('in');scrollMsgs(R);await sleep(460);}
    const src=$('#srcline');src.classList.add('hl');await untilV(27300);src.classList.remove('hl');};
  focus('L');await leftB5();await untilV(13800);focus('R');await rightB5();await untilV(27600);focus(null);guard(tok);caption('');await sleep(250);

  // BEAT 6
  beat(6,'The drift');guard(tok);
  hideCursor();
  [1,2].forEach(i=>{leftTable2.rows[i+1].classList.add('hl');rightTable.rows[i+1].classList.add('hl','good');});
  await sleep(2000);$('#drift').classList.add('on');
  caption("Ask the left how it got there, and it rebuilds the whole dataset from the files, estimating the FX rate and the eliminations it can't see. That's a lot of trust, and a big place for errors to hide. Ask the right, and FinanceOS drills straight down to the source transactions. Every number explained, back to the ledger.");
  await untilV(5700);$('#drift').classList.remove('on');await sleep(200);
  caption("Now into Excel. Not a table, the whole pack: variance, monthly trend, and what's driving Germany.");
  const leftB6=async()=>{await type(L,'How did you get 52.8% for DE?',44);await send(L);const b=newAssistant(L);await stream(b,L,"I rebuilt it from the files: revenue 4,102,000 from the SAP export after mapping accounts, COGS estimated at 1,936,000 with 'Services' mapped to professional services, FX at an approximate Q3 average of 1.07. I couldn't verify the intercompany eliminations from the files, so treat this as approximate.",20);const st=line(b,L,'status','Rebuilt from uploaded files &middot; FX estimated &middot; eliminations unverified');
    const p=b.lastElementChild.previousElementSibling;for(const ph of ['COGS estimated at 1,936,000','FX at an approximate Q3 average of 1.07',"I couldn't verify the intercompany eliminations from the files"])p.innerHTML=p.innerHTML.replace(ph,`<mark class="est">${ph}</mark>`);
    const ms=$$('mark.est',p);for(const [k,t] of [[0,10100],[1,11300],[2,12900]]){await untilV(t);ms[k]&&ms[k].classList.add('on');}
    await untilV(15200);st.classList.add('warn');};
  const rightB6=async()=>{const src=$('#srcline'),fx=$('#fxline');if(src){scrollMsgs(R);moveCursorTo(src,-80,0);await sleep(500);src.classList.add('hl');await sleep(2600);src.classList.remove('hl');moveCursorTo(fx,-80,0);await sleep(400);fx.classList.add('hl');await sleep(2600);fx.classList.remove('hl');}};
  focus('L');await leftB6();await untilV(19300);focus('R');await rightB6();await untilV(27400);focus(null);guard(tok);
  [1,2].forEach(i=>{leftTable2.rows[i+1].classList.remove('hl');rightTable.rows[i+1].classList.remove('hl','good');});
  caption('');hideCursor();await sleep(500);

  // BEAT 7
  beat(7,'Repeatability + Excel');guard(tok);
  await sleep(400);
  let nextMonthRight=12650;const P7='Put this in an Excel file for the CFO. GM by entity vs plan with variance in dollars and points, a monthly trend for the quarter, and a revenue and COGS bridge showing what is driving the DE variance.';
  await Promise.all([type(L,P7,52),type(R,P7,52)]);await sleep(300);
  await Promise.all([send(L),send(R)]);
  caption("Left, you get a file and three footnotes. Plan spread evenly, FX estimated, COGS as you described it. Reasonable guesses, nicely formatted.");
  const HDR={cls:'hdr'};
  const W1={A:120,B:86,C:86,D:64,E:96,F:70,G:90};
  const sumCells=(rows,conn)=>{const c={A1:{v:'Entity',...HDR},B1:{v:'Plan GM%',...HDR},C1:{v:'Actual GM%',...HDR},D1:{v:'Δ pts',...HDR},E1:{v:'Δ $',...HDR}};if(conn){c.F1={v:'Period',...HDR};c.G1={v:'Q3 FY26'};}rows.forEach((r,i)=>{const n=i+2;c['A'+n]={v:r[0]};c['B'+n]={v:r[1]};c['C'+n]={v:r[2]};c['D'+n]={v:r[3]};c['E'+n]={v:r[4]};});return c;};
  const trendCells=(rows)=>{const c={A1:{v:'Entity',...HDR},B1:{v:'Jul',...HDR},C1:{v:'Aug',...HDR},D1:{v:'Sep',...HDR},E1:{v:'Q3',...HDR},F1:{v:'Plan Q3',...HDR}};rows.forEach((r,i)=>{const n=i+2;r.forEach((v,ci)=>c[cols7[ci]+n]={v});});return c;};
  const cols7=['A','B','C','D','E','F','G'];
  const bridgeCells=(rows)=>{const c={A1:{v:'DE gross margin bridge, Q3 FY26',...HDR},B1:{v:'$',...HDR}};rows.forEach((r,i)=>{const n=i+2;c['A'+n]={v:r[0]};c['B'+n]={v:r[1]};});return c;};
  const SUM_R=[['Vandelay US','60.0%','61.2%','+1.2','+62,400'],['Vandelay UK','59.5%','58.9%','−0.6','−18,900'],['Vandelay DE','58.0%','54.3%','−3.7','−154,400'],['Vandelay AU','61.0%','63.0%','+2.0','+41,200']];
  const SUM_L=[['Vandelay US','60.0%','61.2%','+1.2','+62,400'],['Vandelay UK','59.5%','59.6%','+0.1','+3,100'],['Vandelay DE','58.0%','52.8%','−5.2','−217,400'],['Vandelay AU','61.0%','63.0%','+2.0','+41,200']];
  const TR_R=[['Vandelay US','60.8%','61.0%','61.7%','61.2%','60.0%'],['Vandelay UK','59.4%','58.7%','58.6%','58.9%','59.5%'],['Vandelay DE','57.1%','54.8%','51.2%','54.3%','58.0%'],['Vandelay AU','62.4%','63.1%','63.5%','63.0%','61.0%']];
  const TR_L=[['Vandelay US','60.8%','61.0%','61.7%','61.2%','60.0%'],['Vandelay UK','60.1%','59.5%','59.2%','59.6%','59.5%'],['Vandelay DE','55.9%','53.1%','49.6%','52.8%','58.0%'],['Vandelay AU','62.4%','63.1%','63.5%','63.0%','61.0%']];
  const BR_R=[['Plan GM$','2,424,400'],['Revenue volume','−38,600'],['Revenue mix','+12,300'],['COGS rate','−118,900'],['FX','−9,200'],['Actual GM$','2,270,000']];
  const BR_L=[['Plan GM$','2,424,400'],['Revenue volume','−41,100'],['Revenue mix','+9,800'],['COGS rate','−148,200'],['FX','−37,500'],['Actual GM$','2,207,400']];
  const Q4S=[['+58,100','60.5%','60.4%','−0.1'],['−12,600','59.5%','59.1%','−0.4'],['−49,800','58.0%','56.8%','−1.2'],['+24,900','61.0%','62.2%','+1.2']];
  const leftB7=async()=>{await sleep(800);const b=newAssistant(L);await stream(b,L,"Done. A few notes: the monthly plan wasn't in the file I have, so I spread the quarterly plan evenly across the three months. The monthly figures use the FX rate I estimated earlier. The bridge is based on the mapping you gave me for 'Services'; let me know if COGS should include anything else.",26);const f=line(b,L,'','<div class="fchip in" style="display:inline-flex;margin-top:6px"><span class="ic">X</span>Q3_GM_pack_CFO.xlsx</div>');await sleep(900);await click(f.firstChild);
    buildExcel(L,{name:'Q3_GM_pack_CFO.xlsx',sheets:[{name:'Summary',w:W1,cells:sumCells(SUM_L,false)},{name:'Monthly trend',cells:trendCells(TR_L)},{name:'DE bridge',w:{A:170,B:100},cells:bridgeCells(BR_L)}]});P[L].querySelector('.excel').classList.add('on');await sleep(1000);await xselect(L,'E4','−217,400');await sleep(800);await xsheet(L,2);await sleep(300);await xselect(L,'B5','-148200');await sleep(1500);hideCursor();};
  let f7=null;const rightB7a=async()=>{await sleep(1500);const b=newAssistant(R);const t7=tool(b,R,'export_workbook &middot; 3 sheets &middot; Excel-connected (DR.GET)');await sleep(2000);toolDone(t7,R,180);await stream(b,R,'Done. Three sheets, all connected to FinanceOS. Change the period cell and everything refreshes.',13);f7=line(b,R,'','<div class="fchip in" style="display:inline-flex;margin-top:6px"><span class="ic">X</span>Q3_GM_pack_CFO.xlsx</div>');};
  const rightB7=async()=>{const f=f7;await click(f.firstChild);
    buildExcel(R,{name:'Q3_GM_pack_CFO.xlsx',conn:true,sheets:[{name:'Summary',w:W1,cells:sumCells(SUM_R,true)},{name:'Monthly trend',cells:trendCells(TR_R)},{name:'DE bridge',w:{A:170,B:100},cells:bridgeCells(BR_R)}]});P[R].querySelector('.excel').classList.add('on');await sleep(600);await xselect(R,'E4','=DR.GET( … )');
    caption("Over on the right, every cell is a live DR.GET formula. Think of a VLOOKUP, but instead of searching a range in your workbook, it reaches straight into FinanceOS. Give it the metric, the entity and the period, and it returns the governed number, live, and connected to its source. Drill Down on the bridge shows you the accounts behind it.");
    {const grid=$('#R .excel .grid');const card=document.createElement('div');card.className='fxcard';card.innerHTML='<h5>Excel-connected formula</h5><div class="big">DR.GET</div><div class="ln" id="fx-l1">Like a VLOOKUP, but it doesn\'t search a range in your workbook.</div><div class="ln" id="fx-l2">It reaches straight into FinanceOS.</div><div class="lbls"><span class="lb" id="lb-m">metric</span><span class="lb" id="lb-e">entity</span><span class="lb" id="lb-p">period</span></div><div class="res" id="fx-res">and returns the <b>governed number</b> · live · connected to its source</div>';grid.appendChild(card);
     await untilV(19500);card.classList.add('on');$('#fx-l1').classList.add('in');
     await untilV(23600);$('#fx-l2').classList.add('in');
     await untilV(25600);$('#lb-m').classList.add('in','on');await untilV(27400);$('#lb-e').classList.add('in','on');await untilV(29100);$('#lb-p').classList.add('in','on');
     await untilV(30900);$('#fx-res').classList.add('in');const e4=xcell(R,'E4');e4.classList.add('glow');
     await untilV(33600);card.classList.remove('on');e4.classList.remove('glow');await sleep(350);card.remove();}
    await xsheet(R,2);await sleep(150);await xselect(R,'B5','=DR.GET( … )');
    
    await sleep(600);paneSet(R,'Drill Down · DE bridge!B5',`<div><div class="k">COGS rate variance, Vandelay DE, Q3 FY26</div><div class="v">−118,900 = Actual COGS − Plan COGS</div></div><table><tr><th>Component</th><th>Amount</th><th>Accounts</th></tr><tr><td>Actual COGS</td><td>1,910,000</td><td>5000&ndash;5090</td></tr><tr><td>Plan COGS (v3)</td><td>1,791,100</td><td>5000&ndash;5090</td></tr></table><div><div class="k">Definition</div><div class="v">COGS excludes implementation services (opex 6200&ndash;6240)</div></div><div><div class="k">Source</div><div class="v">NetSuite GL &middot; Vandelay DE &middot; 2026-07-01 to 2026-09-30</div></div><div><div class="k">FX</div><div class="v">EUR&rarr;USD, Q3 average 1.0842</div></div><span class="lk">Open source transactions (612 rows)</span>`);
    await untilV(34000);await xbtn(R,'drill');$('#R-pane').classList.add('on');await untilV(41300);$('#R-pane').classList.remove('on');await sleep(300);
    await untilV(42000);caption("Now imagine next month. On the left, you do all of it again: find the files, re-upload, re-explain every definition, and hope Claude applies the same logic it did last time. Over on the right, you change the period and hit Refresh. Same definitions, same sources, current numbers.");chapter('7b|Refresh');beatT0=vnow();vo('7b|Refresh');focus('L');{const card=P[L].querySelector('.card');card.innerHTML='<h3>One month later.</h3><ul class="todo"></ul>';card.classList.add('on');}(async()=>{await sleep(1600);const ul=$('#L .card .todo');for(const t of ['Find the files again','Re-upload six exports','Re-explain every definition','Hope Claude applies the same logic']){const li=document.createElement('li');li.textContent=t;ul.appendChild(li);await sleep(60);li.classList.add('in');await sleep(1900);}})();await untilV(nextMonthRight);focus('R');
    await xsheet(R,0);await sleep(300);await xselect(R,'G1','Q3 FY26');await sleep(500);const g1=xcell(R,'G1');g1.classList.add('edit');g1.textContent='';const t='Q4 FY26';for(const ch of t){g1.textContent+=ch;$(`#R-fb`).textContent=g1.textContent;await sleep(110);}await sleep(400);g1.classList.remove('edit');await xbtn(R,'refresh');$('#R .excel .dlg').classList.add('on');await sleep(1400);$('#R .excel .dlg').classList.remove('on');
    Q4S.forEach((r,i)=>{const n=i+2;[['E',0],['B',1],['C',2],['D',3]].forEach(([col,ix])=>{const c=xcell(R,col+n);c.textContent=r[ix];c.classList.add('flash');});});xcell(R,'A1');$('#R .excel .fn').textContent='Q4_GM_pack_CFO.xlsx';await sleep(1500);};
  focus('L');await Promise.all([leftB7(),rightB7a()]);await untilV(18150);focus('R');await rightB7();await untilV(20100);focus(null);guard(tok);caption('');hideCursor();await sleep(300);

  // BEAT 8 — Audit trail. Timings follow the pauses in VO_08_beat8_audit_Despina_v4 (41.7s).
  beat(8,'Audit');guard(tok);
  for(const s of [L,R]){P[s].querySelector('.excel').classList.remove('on');}P[L].querySelector('.card').classList.remove('on');
  caption("Now, the audit. On the left, a number is only as traceable as the chat it came from. To find the source, you find the conversation, scroll back, and search for how Claude got there. Or you ask again, and hope it can retrace its own steps. That's not an audit-ready environment. For a finance team, that's a real problem. Over on the right, every action by every user is logged securely in FinanceOS: who asked what, and when. And every number stays traceable. Open a new chat, ask where 54.3 came from, and FinanceOS lineage drills straight down to the source. That's audit-ready.");
  const leftB8=async()=>{
    await untilV(2200);focus('L');
    // "you find the conversation": the find bar appears over the old thread
    const fd=document.createElement('div');fd.className='finder';fd.innerHTML='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><span class="q"></span><span class="cnt"></span>';P[L].querySelector('.win').appendChild(fd);
    await untilV(6900);fd.classList.add('on');
    // "scroll back": wind the thread up to the top
    const m=P[L].querySelector('.msgs');await untilV(8500);const st=m.scrollTop;await tween(1300,e=>{m.scrollTop=st*(1-e)});
    // "search for how Claude got there": type the number, mark the hits, step through them
    await untilV(9600);const q=$('.q',fd);for(const ch of '52.8%'){q.textContent+=ch;await sleep(90);}
    const nodes=[];const walk=document.createTreeWalker(m,NodeFilter.SHOW_TEXT);let tn;while(tn=walk.nextNode())if(tn.nodeValue.includes('52.8%'))nodes.push(tn);
    const hits=nodes.map(t=>{const i=t.nodeValue.indexOf('52.8%');const r=document.createRange();r.setStart(t,i);r.setEnd(t,i+5);const mk=document.createElement('mark');mk.className='hit';r.surroundContents(mk);return mk;});
    $('.cnt',fd).textContent=`${hits.length} matches`;
    const sc=()=>+stage.dataset.scale;
    for(const h of hits){await sleep(600);hits.forEach(x=>x.classList.remove('cur'));h.classList.add('cur');m.scrollTop+=(h.getBoundingClientRect().top-m.getBoundingClientRect().top)/sc()-m.clientHeight/2;}
    // "Or you ask again, and hope it can retrace its own steps": a fresh chat, and it can't
    await untilV(11830);fd.remove();m.innerHTML='<div class="greet">Good afternoon</div>';await sleep(350);
    await type(L,'Where did the 52.8% for Vandelay DE come from?',70);await send(L);
    const b=newAssistant(L);await stream(b,L,"I don't have access to our earlier conversation, so I can't trace where that 52.8% came from. If you share the files and the definitions again, I can rebuild the calculation.",22);
    line(b,L,'status','No lineage &middot; retraced from memory, or not at all');
    // "That's not an audit-ready environment. For a finance team, that's a real problem."
    await untilV(16090);const card=P[L].querySelector('.card');card.className='card limits';card.innerHTML='<h3>Not audit-ready</h3><ul><li>The source lives in a chat thread</li><li>Retraced from memory, or not at all</li><li>Nothing to hand an auditor</li></ul>';card.classList.add('on');
    const lis=$$('li',card);for(const [k,t] of [[0,18800],[1,19700],[2,20600]]){await untilV(t);lis[k].classList.add('in');}
  };
  const rightB8=async()=>{
    // "every action by every user is logged securely in FinanceOS": the activity log
    await untilV(21820);focus('R');
    const card=P[R].querySelector('.card');card.className='card log';
    const ROWS8=[['14:02','a.morgan','gross_margin_pct &middot; by entity &middot; Q3 FY26','NetSuite, SAP, Salesforce'],['14:09','a.morgan','drill_down &middot; gross_margin_pct &middot; Vandelay DE','SAP GL'],['14:31','d.meyer','gross_margin_pct &middot; by entity &middot; Q3 FY26','NetSuite, SAP'],['14:40','a.morgan','export_workbook &middot; Q3_GM_pack_CFO.xlsx','3 sheets, DR.GET'],['15:12','r.patel','refresh &middot; Q4_GM_pack_CFO.xlsx &middot; Q4 FY26','FinanceOS']];
    card.innerHTML='<h3>FinanceOS activity log</h3>'+ROWS8.map(r=>`<div class="lrow"><span class="lt">${r[0]}</span><span class="lu">${r[1]}</span><span class="la">${r[2]}</span><span class="ls">${r[3]}</span></div>`).join('')+'<div class="lfoot"><span class="pip"></span>Every action, by every user, logged securely in FinanceOS</div>';
    await untilV(23140);card.classList.add('on');const rows=$$('.lrow',card);for(let k=0;k<rows.length;k++){await untilV(23300+k*800);rows[k].classList.add('in');}
    await untilV(27920);card.classList.add('hl-user');                                   // "who asked what"
    await untilV(29090);card.classList.remove('hl-user');card.classList.add('hl-time');   // "and when"
    await untilV(30120);card.classList.remove('hl-time');$('.lfoot',card).classList.add('in');
    // "every number stays traceable. Open a new chat": a fresh thread
    await untilV(32740);card.classList.remove('on');P[R].querySelector('.msgs').innerHTML='<div class="greet">Good afternoon</div>';
    await untilV(34110);await type(R,'Where did the 54.3% for Vandelay DE come from?',70);await send(R);
    const b=newAssistant(R);const t8=tool(b,R,'lineage &middot; gross_margin_pct &middot; Vandelay DE &middot; Q3 FY26');
    // "FinanceOS lineage drills straight down to the source"
    await untilV(36530);toolDone(t8,R,520);
    const d=line(b,R,'drill',`<div class="dh"><img src="${FOSLOGO}" alt="FinanceOS">Lineage &middot; Gross margin, Vandelay DE, Q3 FY26</div><div class="dbig">54.3%</div><div class="ddef">(Net Revenue &minus; COGS) / Net Revenue &middot; defined once in the FinanceOS semantic layer</div><ul><li>Revenue: $4,180,000 <span>&mdash; accounts 4000&ndash;4090</span></li><li>COGS: $1,910,000 <span>&mdash; accounts 5000&ndash;5090</span></li><li>Source: SAP GL, Vandelay DE <span>&mdash; 1,284 transactions, 2026-07-01 to 2026-09-30</span></li><li>FX: EUR&rarr;USD, Q3 average <b>1.0842</b></li><li>Plan: FY26 Plan v3 <span>&mdash; approved 2026-01-14</span></li><li>Asked by a.morgan <span>&mdash; 15:20, logged in FinanceOS</span></li></ul>`);
    const lis=$$('li',d);for(let k=0;k<lis.length;k++){await untilV(36800+k*450);lis[k].classList.add('in');scrollMsgs(R);}addTok(R,160);
    // "That's audit-ready."
    await untilV(40170);const ok=line(b,R,'',`<span class="tag pulse">&#10003; Audit-ready: every action logged, every number traced to its source</span>`);scrollMsgs(R);await sleep(900);ok.firstChild.classList.remove('pulse');
  };
  const lB8=leftB8(),rB8=rightB8();await lB8;await untilV(21600);P[L].querySelector('.card').classList.remove('on');await rB8;await untilV(42200);P[L].querySelector('.card').className='card';P[R].querySelector('.card').className='card';focus(null);guard(tok);caption('');hideCursor();await sleep(300);

  // BEAT 9
  beat(9,'Cost efficiency');guard(tok);stampShow();stampOn=false;
  $('#dim').classList.add('on');await sleep(500);
  const tl=tokens.L,tr=tokens.R;$('#tokens').classList.add('on');
  caption("All that re-uploading and re-explaining on the left costs tokens, and it costs your afternoon. On the right, the data and the logic are already in place, so Claude isn't rebuilding the world with every prompt.");
  const bars=$$('#tokens .bar i');sleep(300).then(()=>{bars[0].style.width='100%';bars[1].style.width=Math.max(6,Math.round(tr/tl*100))+'%'},()=>{});$('#tokens .pct').classList.remove('in');$('#pctN').textContent='0%';
  await tween(1800,e=>{$('#tkL').textContent=Math.round(tl*e).toLocaleString();$('#tkR').textContent=Math.round(tr*e).toLocaleString();});
  {const pct=Math.round((1-tr/tl)*100);await untilV(6500);$('#tokens .pct').classList.add('in');await tween(1400,e=>{$('#pctN').textContent='−'+Math.round(pct*e)+'%';});}
  await untilV(13700);guard(tok);caption('');$('#tokens').classList.remove('on');$('#tokens .pct').classList.remove('in');await sleep(500);

  // BEAT 10
  beat(10,'Close');guard(tok);
  $('#dim').classList.remove('on');await sleep(300);
  P[L].style.transition='opacity .8s';P[L].style.opacity='0';
  caption('Same AI. Different foundation.');await sleep(2400);caption('');
  $('#end').classList.add('on');await sleep(500);
  $('#beatlbl').textContent='Complete';chIdx=-1;$$('#chap li').forEach(li=>{li.classList.remove('on');li.classList.add('done')});
  started=false;setPaused(true);
}

/* ---------- controls ---------- */
function playUI(){const on=started&&!paused;$('#play').classList.toggle('playing',on);$('#playlbl').textContent=on?'Pause':'Play';$('#play').setAttribute('aria-label',on?'Pause':'Play');}
function start(target){runToken++;const tok=runToken;seekQ.length=0;started=true;
  if(target&&target!==CHAPTERS[0][0]){vtick();seeking=target;stage.classList.add('seeking');$('#seekname').textContent=CHAPTERS.find(c=>c[0]===target)[1];}else endSeek(true);
  setPaused(false);run(tok).catch(e=>{if(e.message!=='restart')console.error(e)});}
function endSeek(quiet){const was=seeking;seeking=null;vLast=performance.now();const q=seekQ.splice(0);q.forEach(waitReal);if(was||quiet){void stage.offsetWidth;stage.classList.remove('seeking');}} // flush styles with transitions off, then re-enable them
function jumpTo(key){voStop();runToken++;started=false;$('#end').classList.remove('on');start(key);}
$('#play').onclick=()=>{if(!started){start();return}setPaused(!paused);};
$('#restart').onclick=()=>jumpTo(CHAPTERS[0][0]);
$$('#speed button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.v));
$('#vochk').onchange=e=>{voOn=e.target.checked;voSync();};
$('#capchk').onchange=e=>$('#cap').classList.toggle('hidden',!e.target.checked);
$('#cap').classList.add('hidden');buildChap();
{const q=new URLSearchParams(location.search);if(q.get('speed'))setSpeed(+q.get('speed'));if(q.get('rec')){$('#ctl').classList.add('hide');$('#chap').classList.add('hide');stage.classList.add('recording');fit()}if(q.get('cap'))$('#cap').classList.remove('hidden');if(q.get('vo')==='0'){voOn=false;$('#vochk').checked=false;}if(q.get('anim')){const r=+q.get('anim');setInterval(()=>{for(const an of document.getAnimations()){if(an.playbackRate!==r)an.playbackRate=r;}},25);}if(q.get('auto'))setTimeout(start,600);}
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('#play').click()}if(e.key==='r'||e.key==='R')$('#restart').click();if(e.key==='h'||e.key==='H'){$('#ctl').classList.toggle('hide');$('#chap').classList.toggle('hide',$('#ctl').classList.contains('hide'));stage.classList.toggle('recording');fit()}});
