# Emit dist/page.html: the same app as dist/index.html, as a fragment for hosts that supply their own document skeleton.
import re
s = open('dist/index.html').read()
head = re.search(r'<head>(.*?)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', s, re.S).group(1)
head = re.sub(r'\s*<meta charset[^>]*>', '', head)
head = re.sub(r'\s*<meta name="viewport"[^>]*>', '', head)
title = re.search(r'<title>.*?</title>', head).group(0)
head = head.replace(title, '')
open('dist/page.html', 'w').write(title + '\n' + head.strip() + '\n' + body.strip() + '\n')
print(open('dist/page.html').read())

# ── Packs: the claude.ai host holds at most ~511 files per version. Logos and part of the
# backdrops ship as a few binary packs plus an index; src/lib/films.js slices them on demand.
import os, json
packs, index, n = [], {}, 0
def pack(paths, per):
    global n
    for i in range(0, len(paths), per):
        os.makedirs('dist/media/packs', exist_ok=True)
        off = 0
        with open(f'dist/media/packs/{n}.webp', 'wb') as out:
            for p in paths[i:i + per]:
                b = open('dist/' + p, 'rb').read()
                out.write(b)
                index[p] = [n, off, len(b)]
                off += len(b)
        n += 1
b_late = sorted(f'media/b/{x}' for x in os.listdir('dist/media/b') if x[0] in '789')
logos = sorted(f'media/l/{x}' for x in os.listdir('dist/media/l'))
pack(b_late, 6)
pack(logos, 16)
json.dump({'files': index}, open('dist/data/media.json', 'w'), separators=(',', ':'))
print('packs', n, 'packed files', len(index))
