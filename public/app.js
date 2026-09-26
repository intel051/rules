'use strict';
const $=s=>document.querySelector(s);
const input=$('#query'), messages=$('#messages'), reading=$('#reading'), dialog=$('#reference-dialog');
let controller=null, latestSources=[], counter=0, toastTimer;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function notify(text){$('#announcer').textContent=text;}
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),2200);}
function resize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px';$('#send').disabled=!input.value.trim();}
input.addEventListener('input',resize);
function library(container){
 container.replaceChildren();container.append(make('h2','reference-intro','답변의 시작은, 원문.'),make('p','muted small','두 문서에서 필요한 근거를 함께 찾아요.'));
 for(const [name,pages,url] of [['파생상품시장 업무규정','44페이지 · 2026.06.29 시행','regulation'],['업무규정 시행세칙','109페이지 · 2026.07.06 시행','rules']]){
  const a=make('a','document-card');a.href='/docs/'+url+'.pdf';a.target='_blank';a.rel='noopener noreferrer';const c=make('span','',name);c.append(make('small','',pages));a.append(make('span','file-icon','▤'),c,make('span','arrow-static','↗'));container.append(a);
 }
 container.append(make('p','document-note','별표·서식은 제목 목록만 포함되어 있어요. 실제 표에 있는 세부사항은 별도 원문이 필요해요.'));
 container.append(make('div','reference-empty','질문에 답변하면\n여기에서 근거 조문을 확인할 수 있어요.'));
}
function sources(container,list){
 container.replaceChildren();container.append(make('h2','reference-intro','근거를 함께 확인하세요.'),make('p','muted small',`${list.length}개 자료 · 원문을 펼쳐 확인할 수 있어요.`));
 for(const [i,s] of list.entries()){
  const article=make('article','source-item');const btn=make('button','source-toggle');btn.type='button';btn.setAttribute('aria-expanded','false');
  const content=make('div','source-collapse');const cid='source-'+(++counter);content.id=cid;btn.setAttribute('aria-controls',cid);
  btn.append(make('span','source-number',String(i+1).padStart(2,'0')),make('span','',s.title),make('span','chevron','⌄'));
  const inner=make('div','source-inner');content.append(inner);inner.inert=true;
  inner.append(make('p','source-version',s.version||'업로드 PDF 기준'));
  if(s.content_status)inner.append(make('p','warning','제목만 포함되어 있어요. 실제 별표 본문은 없어요.'));
  inner.append(make('div','source-text',s.text||''));
  if(/^\/docs\/[a-z]+\.pdf#page=\d+$/.test(s.url||'')){const link=make('a','pdf-link','PDF 해당 페이지 열기 ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';inner.append(link);}
  btn.onclick=()=>{const open=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(open));content.classList.toggle('open',open);inner.inert=!open;};
  article.append(btn,content);container.append(article);
 }
}
function openDialog(title,render){$('#dialog-title').textContent=title;render($('#dialog-content'));if(!dialog.open)dialog.showModal();}
$('#library-button').onclick=()=>openDialog('자료실',library);
let closing=false;
async function closeDialog(){
 if(closing||!dialog.open)return;closing=true;
 if(!reduced()&&dialog.animate){try{await dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(18px)'}],{duration:180,easing:'ease-in',fill:'none'}).finished;}catch{}}
 dialog.close();closing=false;
}
$('#close-dialog').onclick=closeDialog;
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function showSources(list){latestSources=list;sources($('#reference-panel'),list);if(matchMedia('(max-width:1199px)').matches)openDialog('근거 자료',c=>sources(c,list));}
function formatted(container,text){
 const labels=['한 줄 요약','상세 답변','관련 조항','유의사항'];
 for(const line of text.split('\n')){
  if(!line.trim())continue;const heading=line.trim().replace(/^\*\*|\*\*$/g,'');
  if(labels.includes(heading)){container.append(make('h3','',heading));continue;}
  const p=make('p');for(const part of line.split(/(\*\*.*?\*\*)/g))p.append(part.startsWith('**')&&part.endsWith('**')?make('strong','',part.slice(2,-2)):document.createTextNode(part));container.append(p);
 }
}
function focusMessage(e){e.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});}
function busy(on){$('#send').hidden=on;$('#stop').hidden=!on;$('#composer').setAttribute('aria-busy',String(on));}
async function ask(query){
 if(controller||!query.trim())return;
 $('#welcome').hidden=true;input.value='';resize();const group=make('section','message');group.id='question-'+(++counter);
 const user=make('div','question');user.append(make('p','',query));group.append(user);messages.append(group);
 const history=$('#history');if(history.querySelector('p'))history.replaceChildren();const h=make('button','',query);h.title=query;h.onclick=()=>focusMessage(group);history.prepend(h);$('#history-count').textContent=history.children.length;
 const pending=make('div','pending');const dots=make('span','loading-dots');for(let i=0;i<3;i++)dots.append(make('i'));pending.append(dots,make('span','','관련 조문을 살펴보고 있어요'));group.append(pending);focusMessage(group);busy(true);notify('관련 조문을 확인하고 있어요.');
 const active=new AbortController();controller=active;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;active.abort();},65000);
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:active.signal});
  let data;try{data=await response.json();}catch{throw new Error('서버 응답을 읽을 수 없어요. 배포 상태를 확인해 주세요.');}
  if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했어요.');if(typeof data.text!=='string')throw new Error('답변 형식을 확인할 수 없어요.');
  pending.remove();const answer=make('article','message');const head=make('div','answer-head');head.append(make('span','answer-symbol','✦'),make('span','',data.mode==='search_only'?'규정 데스크 · 원문 검색':'규정 데스크'));
  const body=make('div','answer-body');formatted(body,data.text);answer.append(head,body);const actions=make('div','answer-actions');const list=Array.isArray(data.sources)?data.sources:[];
  if(list.length){const b=make('button','pill',`▤ 근거 자료 ${list.length}`);b.onclick=()=>showSources(list);actions.append(b);latestSources=list;sources($('#reference-panel'),list);}
  if(!list.length){latestSources=[];library($('#reference-panel'));}
  const copy=make('button','pill','답변 복사');copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.text);toast('답변을 복사했어요.');}catch{toast('복사할 내용을 직접 선택해 주세요.');}};actions.append(copy);answer.append(actions);group.append(answer);notify('답변이 준비됐어요.');
 }catch(error){
  pending.remove();const text=error.name==='AbortError'?(timedOut?'응답 시간이 길어 요청을 종료했어요.':'요청을 중지했어요.'):error.message;
  const box=make('div','error',text);const retry=make('button','','다시 시도');retry.onclick=()=>ask(query);box.append(retry);group.append(box);notify(text);
 }finally{clearTimeout(timer);if(controller===active){controller=null;busy(false);resize();}}
}
$('#composer').onsubmit=e=>{e.preventDefault();ask(input.value.trim());};
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();ask(input.value.trim());}});
$('#stop').onclick=()=>controller?.abort();
for(const b of document.querySelectorAll('[data-question]'))b.onclick=()=>{input.value=b.dataset.question;resize();input.focus();};
function fresh(){if(controller){toast('요청을 중지한 후 새 질문을 시작해 주세요.');return;}messages.replaceChildren();$('#history').replaceChildren(make('p','muted small','질문한 내용이 여기에 쌓여요.'));$('#history-count').textContent='0';$('#welcome').hidden=false;latestSources=[];library($('#reference-panel'));input.value='';resize();input.focus();}
for(const b of document.querySelectorAll('[data-new]'))b.onclick=fresh;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();}});
// Visual viewport follows the mobile keyboard without hiding the composer.
function viewport(){if(matchMedia('(max-width:767px)').matches&&window.visualViewport)document.querySelector('.workspace').style.height=window.visualViewport.height+'px';else document.querySelector('.workspace').style.height='';}
window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);viewport();library($('#reference-panel'));resize();
