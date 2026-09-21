"""Regenerate the latest taxonomy seed from frontend/assets/data/categories-source.txt.
Preserves non-taxonomy demo data and any legacy taxonomy nodes still referenced by MCQs.
No external requests are made.
"""
import json,re,pathlib,copy
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'frontend/assets/data'; seedp=out/'seed.json'
data=json.loads(seedp.read_text(encoding='utf-8'))

def entry(raw):
    s=re.sub(r'^[│\s├└─]+','',raw).strip()
    if not s:return None,None
    m=re.match(r'([^\wA-Za-z0-9]+)?\s*(.*)$',s)
    return (m.group(1) or '').strip(),m.group(2).strip()

cats=[];subs=[];children=[]
for raw in (out/'categories-source.txt').read_text(encoding='utf-8').splitlines():
    if not raw.strip() or raw.strip()=='│':continue
    icon,name=entry(raw)
    if not name:continue
    if raw.startswith(('│   ','    ')):
        children.append(dict(id=130000+len(children),name=name,icon=icon or '•',subcategory_id=subs[-1]['id'],active=True))
    elif raw.startswith(('├','└')):
        subs.append(dict(id=120000+len(subs),name=name,icon=icon or '•',category_id=cats[-1]['id'],active=True))
    else:
        cats.append(dict(id=110000+len(cats),name=name,icon=icon or '•',active=True))

# Retain only legacy nodes actually referenced by questions.
oldc={x['id']:x for x in data.get('categories',[]) if x.get('legacy')}
olds={x['id']:x for x in data.get('subcategories',[]) if x.get('legacy')}
oldh={x['id']:x for x in data.get('children',[]) if x.get('legacy')}
rc=set();rs=set();rh=set()
for q in data.get('mcqs',[]):
    rc.add(q['category_id']);rs.update(q.get('subcategory_ids',[]));rh.update(q.get('child_subcategory_ids',[]))
legacyc=[copy.deepcopy(oldc[i]) for i in sorted(rc) if i in oldc]
legacys=[copy.deepcopy(olds[i]) for i in sorted(rs) if i in olds]
legacyh=[copy.deepcopy(oldh[i]) for i in sorted(rh) if i in oldh]
data['categories']=cats+legacyc;data['subcategories']=subs+legacys;data['children']=children+legacyh;data['schemaVersion']=2
seedp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'frontend/assets/js/seed.js').write_text('window.MCQ_SEED = '+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
print({'categories':len(cats),'subcategories':len(subs),'children':len(children),'legacy_categories':len(legacyc),'legacy_subcategories':len(legacys),'legacy_children':len(legacyh)})
