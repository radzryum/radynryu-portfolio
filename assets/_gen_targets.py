# Regenerates assets/_targets.json from assets/model-dither.png.
# Run this after replacing model-dither.png, then re-embed the JSON into
# index.html by replacing the `const TARGETS = /*__TARGETS__*/[...];` line.
from PIL import Image
import json

SRC = 'assets/model-dither.png'
im = Image.open(SRC).convert('RGBA')
W, H = im.size

sampleW = 110
scale = sampleW / W
sampleH = max(1, round(H * scale))
small = im.resize((sampleW, sampleH), Image.BOX)
px = small.load()

pts = []
for y in range(sampleH):
    for x in range(sampleW):
        r, g, b, a = px[x, y]
        if a < 120:
            continue
        bright = (int(r) + int(g) + int(b)) / 3
        if bright < 100:
            flag = 1
        elif (x * 31 + y * 17) % 13 == 0:
            flag = 2
        else:
            flag = 0
        pts.append([round((x + 0.5) / sampleW, 4), round((y + 0.5) / sampleH, 4), flag])

if len(pts) > 3200:
    stride = len(pts) / 3200
    sel, i = [], 0.0
    while int(i) < len(pts):
        sel.append(pts[int(i)])
        i += stride
    pts = sel

out = json.dumps(pts, separators=(',', ':'))
with open('assets/_targets.json', 'w') as f:
    f.write(out)
print(f'sampled {len(pts)} particles, wrote assets/_targets.json ({len(out)} bytes)')
