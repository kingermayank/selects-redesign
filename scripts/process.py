import json, os, glob, io, subprocess, concurrent.futures as cf, colorsys, math, random
from PIL import Image
import numpy as np
RAW="scripts/raw"; OUT="public"; IMG="https://image.tmdb.org/t/p"
os.makedirs(f"{OUT}/data", exist_ok=True)
def dl(url):
    r = subprocess.run(["curl","-sSfL","--max-time","40",url],capture_output=True)
    if r.returncode: raise Exception("dl fail "+url)
    return Image.open(io.BytesIO(r.stdout))
def palette(im):
    a = np.asarray(im.convert("RGB").resize((48,72))).reshape(-1,3).astype(float)/255
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in a])
    # dominant: weight by saturation*value, bin hues
    w = hsv[:,1]*np.clip(hsv[:,2]*1.4,0,1)
    bins = (hsv[:,0]*24).astype(int)%24
    score = np.bincount(bins, weights=w, minlength=24)
    order = np.argsort(-score)
    cols=[]
    for b in order[:6]:
        m = (bins==b)&(w>0.08)
        if m.sum()<8: continue
        c = np.average(a[m],axis=0,weights=w[m]+1e-6)
        h,s,v = colorsys.rgb_to_hsv(*c)
        # normalize to a usable UI tone: keep hue, clamp s/v
        s=min(max(s,0.38),0.82); v=min(max(v,0.42),0.78)
        cols.append((h,s,v,score[b]))
    if not cols:
        m=a.mean(0); h,s,v=colorsys.rgb_to_hsv(*m); cols=[(h,0.25,0.5,1)]
    hexes=["#%02x%02x%02x"%tuple(int(x*255) for x in colorsys.hsv_to_rgb(h,s,v)) for h,s,v,_ in cols[:3]]
    lum = float((a@[0.2126,0.7152,0.0722]).mean())
    warmth = float(np.mean(np.cos((hsv[:,0]-0.06)*2*math.pi)*hsv[:,1]))
    return hexes, lum, warmth
def work(path):
    d=json.load(open(path)); i=d["id"]; r={}
    try:
        if d.get("poster") and not os.path.exists(f"{OUT}/media/p/{i}.webp"):
            im=dl(f"{IMG}/w342{d['poster']}").convert("RGB"); im=im.resize((342,513),Image.LANCZOS); im.save(f"{OUT}/media/p/{i}.webp","WEBP",quality=80,method=6)
        if d.get("backdrop") and not os.path.exists(f"{OUT}/media/b/{i}.webp"):
            im=dl(f"{IMG}/w1280{d['backdrop']}").convert("RGB"); im=im.resize((1280,720),Image.LANCZOS); im.save(f"{OUT}/media/b/{i}.webp","WEBP",quality=72,method=6)
        if d.get("logo") and not os.path.exists(f"{OUT}/media/l/{i}.webp"):
            im=dl(f"{IMG}/w500{d['logo']}").convert("RGBA"); im.thumbnail((500,200)); im.save(f"{OUT}/media/l/{i}.webp","WEBP",quality=85,method=6)
        src = f"{OUT}/media/p/{i}.webp" if os.path.exists(f"{OUT}/media/p/{i}.webp") else None
        if src: r["pal"], r["lum"], r["warm"] = palette(Image.open(src))
    except Exception as e: print("ERR", i, e)
    return i, r
if __name__=="__main__":
    files=sorted(glob.glob(f"{RAW}/*.json"))
    with cf.ThreadPoolExecutor(8) as ex: res=dict(ex.map(work, files))
    films=[]
    for p in files:
        d=json.load(open(p)); i=d["id"]; x=res.get(i,{})
        if not os.path.exists(f"{OUT}/media/p/{i}.webp") or not os.path.exists(f"{OUT}/media/b/{i}.webp"): continue
        cr=d.get("crew",{})
        films.append({"id":i,"t":d["title"],"y":d.get("year"),"rt":d.get("runtime"),"g":d.get("genres",[]),"k":d.get("keywords",[])[:14],
          "ov":d.get("overview",""),"tg":d.get("tagline",""),"cert":d.get("cert",""),"sc":d.get("score"),
          "dir":cr.get("Director",[])[:2],"dp":cr.get("Director of Photography",[])[:2],"mus":(cr.get("Original Music Composer") or cr.get("Composer") or cr.get("Music") or [])[:2],
          "ed":cr.get("Editor",[])[:2],"wr":(cr.get("Screenplay") or cr.get("Writer") or [])[:2],
          "cast":[c["name"] for c in d.get("cast",[])][:6],"roles":[c["role"] for c in d.get("cast",[])][:6],
          "recs":d.get("recs",[]),"pal":x.get("pal",["#3a6e85"]),"lum":round(x.get("lum",0.3),3),"warm":round(x.get("warm",0),3),
          "logo":os.path.exists(f"{OUT}/media/l/{i}.webp")})
    ids={f["id"] for f in films}
    for f in films: f["recs"]=[r for r in f["recs"] if r in ids][:12]
    # taste map coords: x warm(-1) .. sharp(+1), y quiet(-1) .. loud(+1)
    SHARP={"Thriller":1,"Crime":.8,"Horror":1,"Mystery":.6,"War":.7,"Science Fiction":.4,"Action":.3,"Western":.4}
    WARM={"Romance":1,"Comedy":.9,"Family":1,"Animation":.7,"Music":.8,"Fantasy":.4,"Documentary":.2,"Drama":.25}
    LOUD={"Action":1,"Adventure":.9,"Science Fiction":.6,"Horror":.6,"War":.7,"Fantasy":.5,"Thriller":.3,"Animation":.3}
    QUIET={"Drama":.7,"Romance":.6,"Documentary":.6,"History":.4,"Music":.2,"Mystery":.2}
    rnd=random.Random(7)
    for f in films:
        g=f["g"] or ["Drama"]
        sx=sum(SHARP.get(x,0) for x in g)-sum(WARM.get(x,0) for x in g)
        sy=sum(LOUD.get(x,0) for x in g)-sum(QUIET.get(x,0) for x in g)
        sx+= -f["warm"]*1.2; sy+= (f["rt"] or 110)<100 and .2 or ((f["rt"] or 110)>150 and -.25 or 0)
        f["mx"]=round(max(-1,min(1,math.tanh(sx/1.6)+rnd.uniform(-.12,.12))),3)
        f["my"]=round(max(-1,min(1,math.tanh(sy/1.6)+rnd.uniform(-.12,.12))),3)
    json.dump(films, open(f"{OUT}/data/films.json","w"), separators=(",",":"), ensure_ascii=False)
    print("films", len(films), "bytes", os.path.getsize(f"{OUT}/data/films.json"))
