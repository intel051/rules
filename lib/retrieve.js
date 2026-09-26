import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const db = JSON.parse(readFileSync(join(process.cwd(), 'data/regulations.json'), 'utf8'));
const norm = s => s.toLowerCase().replace(/\s+/g, '');
const tokens = s => [...new Set((s.toLowerCase().match(/[가-힣a-z0-9]+/g) || []).flatMap(w => w.length < 2 ? [] : [w, ...Array.from({length:w.length-1}, (_,i)=>w.slice(i,i+2))]))];
export const records = db.documents.flatMap(d => d.records.map(r => ({...r, document:d.name, document_id:d.id, version:d.version_text, pdf_url:d.pdf_url})));
const indexed = records.map(r => ({r, title:norm(r.section.join(' ')+' '+r.label+' '+r.title), body:norm(r.text), ts:new Set(tokens(r.text+' '+r.title))}));
const df = new Map(); for(const x of indexed)for(const t of x.ts)df.set(t,(df.get(t)||0)+1);
const aliases=[['틱','호가가격단위'],['만기일','최종거래일'],['장시간','거래시간'],['야간장','야간거래'],['코스피 200','코스피200'],['증거금','위탁증거금']];
const labelNorm=s=>s.replace(/\s/g,'');
export function retrieve(query, limit=14){
 let expanded=query; for(const [a,b] of aliases)if(query.includes(a))expanded+=' '+b;
 const terms=tokens(expanded);const qnorm=norm(expanded);
 const exact=[...query.matchAll(/제\s*\d+조(?:의\d+)?|별표\s*\d+(?:의\d+)?/g)].map(m=>labelNorm(m[0]));
 const wantsHistory=/부칙|경과조치|개정|시행일|과거/.test(query);
 const ranked=indexed.map(x=>{
  let score=0;for(const t of terms){if(x.ts.has(t))score+=Math.log(1+indexed.length/(df.get(t)||1))*(x.title.includes(t)?3:1);}
  if(exact.includes(labelNorm(x.r.label)))score+=90;
  for(const phrase of ['코스피200','코스닥150','야간','호가가격단위','거래시간','위탁증거금','최종거래일'])if(qnorm.includes(phrase)&&x.title.includes(phrase))score+=16;
  if(x.r.kind==='supplement'&&!wantsHistory)score*=0.15;
  return {r:x.r,score};
 }).filter(x=>x.score>5).sort((a,b)=>b.score-a.score);
 const chosen=new Map(ranked.slice(0,limit).map(x=>[x.r.id,x.r]));
 // Resolve only explicit "규정 제N조"/"세칙 제N조" and local appendix references.
 // Ambiguous bare references are kept as raw text, never assigned to another law.
 for(const {r} of ranked.slice(0,6)){
  for(const m of r.text.matchAll(/(규정|세칙)\s*(제\d+조(?:의\d+)?)|(별표\s*\d+(?:의\d+)?)/g)){
   const target=m[3]?r.document_id:m[1]==='규정'?'reg':'rule';
   const label=labelNorm(m[3]||m[2]);
   const found=records.find(x=>x.document_id===target&&labelNorm(x.label)===label&&x.kind!=='supplement');
   if(found)chosen.set(found.id,found);
  }
 }
 // Include explicit reverse parent references from implementing rules.
 for(const {r} of ranked.slice(0,3))if(r.document_id==='reg'&&r.kind==='article'){
  const re=new RegExp('규정\\s*'+r.label+'(?![0-9]|의[0-9])');
  for(const x of records.filter(x=>x.document_id==='rule'&&x.kind==='article'&&re.test(x.text)).slice(0,4))chosen.set(x.id,x);
 }
 let used=0;const result=[];
 for(const r of chosen.values()){
  if(result.length>=26)break;
  if(used+r.text.length>75000)continue;
  used+=r.text.length;result.push(r);
 }
 return result;
}
export const warnings=db.warnings;
