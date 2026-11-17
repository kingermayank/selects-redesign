import json, os, re, html, urllib.request, urllib.parse, concurrent.futures as cf, time, sys
UA = {"User-Agent": "Mozilla/5.0 (selects-design-prototype)"}
B = "https://www.themoviedb.org"
RAW = "scripts/raw"; os.makedirs(RAW, exist_ok=True)
import subprocess
def get(url):
    for i in range(4):
        r = subprocess.run(["curl","-sSL","--max-time","30","-A",UA["User-Agent"],"-w","\n__URL__%{url_effective} %{http_code}",url],capture_output=True,text=True)
        body, _, tail = r.stdout.rpartition("\n__URL__")
        if tail.endswith(" 200"): return body, tail.rsplit(" ",1)[0]
        time.sleep(2*(i+1))
    raise Exception(f"fetch failed {url} {tail}")
T = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
def search(line):
    t, y = line.rsplit("|", 1)
    s, _ = get(f"{B}/search/movie?query={urllib.parse.quote(t + ' y:' + y)}")
    m = re.search(r'href="/movie/(\d+)[^"]*"', s)
    if not m:
        s, _ = get(f"{B}/search/movie?query={urllib.parse.quote(t)}")
        m = re.search(r'href="/movie/(\d+)[^"]*"', s)
    return int(m.group(1)) if m else None
def scrape(mid):
    p = f"{RAW}/{mid}.json"
    if os.path.exists(p): return mid
    s, url = get(f"{B}/movie/{mid}")
    slug = url.split("/movie/")[1].split("?")[0]
    d = {"id": mid, "slug": slug}
    d["title"] = html.unescape(re.search(r'<meta property="og:title" content="([^"]*)"', s).group(1))
    imgs = re.findall(r'<meta property="og:image" content="[^"]*/t/p/(w\d+)(/[^"]+)"', s)
    d["poster"] = next((p for w, p in imgs if w == "w500"), None)
    d["backdrop"] = next((p for w, p in imgs if w == "w780"), None)
    m = re.search(r'<div class="overview"[^>]*>(.*?)</div>', s, re.S); d["overview"] = T(m.group(1)) if m else ""
    m = re.search(r'class="tagline"[^>]*>(.*?)<', s, re.S); d["tagline"] = T(m.group(1)) if m else ""
    m = re.search(r'<span class="genres">(.*?)</span>', s, re.S); d["genres"] = re.findall(r'>([^<]+)</a>', m.group(1)) if m else []
    m = re.search(r'<span class="runtime">(.*?)</span>', s, re.S)
    rt = T(m.group(1)) if m else ""; h = re.search(r"(\d+)h", rt); mi = re.search(r"(\d+)m", rt)
    d["runtime"] = (int(h.group(1))*60 if h else 0) + (int(mi.group(1)) if mi else 0)
    m = re.search(r'<span class="certification">(.*?)</span>', s, re.S); d["cert"] = T(m.group(1)) if m else ""
    m = re.search(r'<span class="tag release_date">\((\d{4})\)', s) or re.search(r'\((\d{4})\)</span>', s); d["year"] = int(m.group(1)) if m else None
    m = re.search(r'data-percent="(\d+)', s); d["score"] = int(m.group(1)) if m else None
    d["keywords"] = [html.unescape(k.replace("-", " ")) for k in re.findall(r'href="/keyword/\d+-([^"/]+)/movie"', s)]
    d["cast"] = [{"name": html.unescape(n), "role": T(c)} for n, c in re.findall(r'<li class="card">\s*<a href="/person/[^"]+">.*?alt="([^"]+)".*?<p class="character">(.*?)</p>', s, re.S)][:8]
    m = re.search(r'<p class="character">.*?</p>', s)
    m = re.search(r'<span class="tag release_date">.*?</span>', s)
    # full crew
    c, _ = get(f"{B}/movie/{slug}/cast")
    crew = {}
    for name, job in re.findall(r'<p><a href="/person/\d+[^"]*">([^<]+)</a></p>\s*<p class="episode_count_crew">\s*([^<]+?)\s*</p>', c):
        crew.setdefault(T(job), []).append(html.unescape(name))
    d["crew"] = {k: v for k, v in crew.items() if k in ("Director", "Director of Photography", "Original Music Composer", "Editor", "Screenplay", "Writer", "Music", "Producer", "Production Design", "Composer", "Original Music Composer")}
    try:
        r, _ = get(f"{B}/movie/{slug}/remote/recommendations?version=1&translate=false")
        d["recs"] = list(dict.fromkeys(int(x) for x in re.findall(r'href="/movie/(\d+)', r) if int(x) != mid))
    except Exception: d["recs"] = []
    try:
        l, _ = get(f"{B}/movie/{slug}/images/logos?image_language=en")
        lg = re.findall(r'/t/p/[a-z0-9_]+(/[A-Za-z0-9]+\.(?:png|svg))', l)
        d["logo"] = next((x for x in lg if x.endswith(".png")), lg[0] if lg else None)
    except Exception: d["logo"] = None
    json.dump(d, open(p, "w")); return mid
if __name__ == "__main__":
    lines = [l.strip() for l in open("scripts/films.txt") if l.strip()]
    if os.path.exists("scripts/ids.json"): ids = json.load(open("scripts/ids.json"))
    else:
        with cf.ThreadPoolExecutor(5) as ex: found = list(ex.map(search, lines))
        print("missing:", [l for l, i in zip(lines, found) if not i])
        ids = {"curated": [i for i in found if i]}
        json.dump(ids, open("scripts/ids.json", "w"))
    allids = list(dict.fromkeys(ids["curated"]))
    if len(sys.argv) > 1: allids = allids[:int(sys.argv[1])]
    ok = 0
    with cf.ThreadPoolExecutor(5) as ex:
        for f in cf.as_completed([ex.submit(scrape, i) for i in allids]):
            try: f.result(); ok += 1
            except Exception as e: print("ERR", e)
    print("scraped", ok, "of", len(allids))
