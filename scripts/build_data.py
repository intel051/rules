"""Requires Poppler pdftotext; run from project root. Preserves all page text."""
import subprocess,re,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
docs=[]
for key,name,filename in [('reg','파생상품시장 업무규정','regulation.pdf'),('rule','파생상품시장 업무규정 시행세칙','rules.pdf')]:
 source=root/'public/docs'/filename
 raw=subprocess.check_output(['pdftotext','-layout',str(source),'-']).decode()
 pages=[]; records=[]; current=None; section=[]; mode='article'; supplement=0
 def flush():
  global current
  if current:
   current['text']='\n'.join(current.pop('lines')).strip()
   current['references_raw']=list(dict.fromkeys(re.findall(r'(?:규정\s*|세칙\s*)?제\d+조(?:의\d+)?(?:제\d+항)?|별표\s*\d+(?:의\d+)?',current['text'])))
   records.append(current);current=None
 for n,page in enumerate(raw.split('\f'),1):
  if not page.strip():continue
  pages.append({'page':n,'text':page})
  for line in page.splitlines():
   t=line.strip()
   if not t or 'KRX' in t and '법무포털' in t or t.startswith('https://rule.krx.co.kr/out/regulation/popPrint.do'):continue
   if re.match(r'^부\s*칙(?:\s|<|$)',t):
    flush();mode='supplement';supplement+=1
    current={'id':f'{key}_supp_{supplement}','kind':mode,'label':t,'title':t,'section':[], 'pages':[],'lines':[]}
   elif t=='별표 및 서식':
    flush();mode='appendix_listing';section=[]
   if mode=='article' and re.match(r'^제\d+[편장절관]\s',t):
    flush(); level={'편':0,'장':1,'절':2,'관':3}[re.match(r'^제\d+([편장절관])',t)[1]]
    section=section[:level]+[t];continue
   m=re.match(r'^(제\d+조(?:의\d+)?)\s*(?:\(([^)]*)\)|(?=삭제))',t) if mode=='article' else None
   a=re.match(r'^\[(별표\s*\d+(?:의\d+)?|별지[^]]+)\]\s*(.*)',t) if mode=='appendix_listing' else None
   if m or a:
    flush(); label=(m or a)[1];title=(m or a)[2] or '삭제'
    current={'id':f'{key}_{len(records)+1}','kind':mode,'label':label,'title':title,'section':list(section),'pages':[],'lines':[]}
    if a:current['content_status']='title_only_missing_body'
   if current:
    current['lines'].append(t)
    if n not in current['pages']:current['pages'].append(n)
 flush()
 version=re.search(r'\[일부개정[^\n]+',raw)
 docs.append({'id':key,'name':name,'pdf_url':'/docs/'+filename,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'version_text':version[0] if version else None,'page_count':len(pages),'pages':pages,'records':records})
data={'schema_version':1,'warnings':['시행세칙 별표·서식은 제목 목록만 제공됨. 실제 표 본문 없음.','자동 추출: 줄바꿈·수식·본문 표는 원본 PDF 대조 필요.'],'documents':docs}
(root/'data/regulations.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
report={d['id']:{'pages':d['page_count'],'records':len(d['records']),'articles':sum(r['kind']=='article' for r in d['records']),'supplements':sum(r['kind']=='supplement' for r in d['records']),'appendix_listings':sum(r['kind']=='appendix_listing' for r in d['records'])} for d in docs}
(root/'data/extraction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report))
