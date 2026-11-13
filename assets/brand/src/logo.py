import os, cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
B='/workspace/ci-doctor-brand'
F=B+'/fonts/'
NAVY='#0B1220'; INK='#0F172A'; TEAL='#2DD4BF'; MINT='#34D399'; WHITE='#F8FAFC'; SLATE='#94A3B8'

def text_path(text, font, size, x, y, tracking=0):
    f=TTFont(F+font); gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
    s=size/upm; d=[]; cx=0
    for ch in text:
        g=cmap[ord(ch)]; pen=SVGPathPen(gs)
        tp=TransformPen(pen,(s,0,0,-s,x+cx,y)); gs[g].draw(tp); d.append(pen.getCommands())
        cx+=gs[g].width*s+tracking
    return ' '.join(d), cx-tracking

def mark(dark=True, bg=True):
    # 512 box
    tile = NAVY if dark else '#FFFFFF'
    line = WHITE if dark else INK
    border = '' if dark else f'<rect x="8" y="8" width="496" height="496" rx="112" fill="none" stroke="#E2E8F0" stroke-width="4"/>'
    g = f'''<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{TEAL if dark else '#0D9488'}"/><stop offset="1" stop-color="{MINT if dark else '#10B981'}"/></linearGradient>
<linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{'#111C30' if dark else '#FFFFFF'}"/><stop offset="1" stop-color="{tile}"/></linearGradient></defs>'''
    if bg: g += f'<rect x="0" y="0" width="512" height="512" rx="116" fill="url(#bgg)"/>' + border
    # pipeline -> pulse -> check
    g += '<g transform="translate(4 -14)">'
    g += f'<path d="M 84 268 H 160 L 196 172 L 244 372 L 282 268 H 300 L 344 316 L 432 196" fill="none" stroke="url(#g)" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>'
    g += f'<circle cx="84" cy="268" r="30" fill="{tile}" stroke="{line}" stroke-width="20"/></g>'
    return g

def svg(w,h,body): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'

def wordmark(dark=True):
    fg = WHITE if dark else INK
    H=160; size=104
    d1,w1=text_path('ci-','SpaceGrotesk-700.ttf',size,0,0,-1)
    d2,w2=text_path('doctor','SpaceGrotesk-700.ttf',size,0,0,-1)
    gap=36; markh=H; tx=markh+gap; base=H/2+size*0.35
    d1,_=text_path('ci-','SpaceGrotesk-700.ttf',size,tx,base,-1)
    d2,_=text_path('doctor','SpaceGrotesk-700.ttf',size,tx+w1,base,-1)
    W=int(tx+w1+w2+8)
    body=f'<g transform="scale({H/512})">{mark(dark)}</g><path d="{d1}" fill="{TEAL if dark else "#0D9488"}"/><path d="{d2}" fill="{fg}"/>'
    return W,H,body

os.makedirs(B+'/logo',exist_ok=True)
for name,dark in (('dark',True),('light',False)):
    s=svg(512,512,mark(dark)); open(f'{B}/logo/ci-doctor-mark-{name}.svg','w').write(s)
    for px in (512,1024): cairosvg.svg2png(bytestring=s.encode(),write_to=f'{B}/logo/ci-doctor-mark-{name}-{px}.png',output_width=px,output_height=px)
    W,H,b=wordmark(dark)
    s=svg(W,H,b); open(f'{B}/logo/ci-doctor-wordmark-{name}.svg','w').write(s)
    cairosvg.svg2png(bytestring=s.encode(),write_to=f'{B}/logo/ci-doctor-wordmark-{name}.png',output_width=W*3)
# avatar 400 (full bleed square, no rounded corners: platforms crop to circle)
for name,dark in (('dark',True),('light',False)):
    bgc = NAVY if dark else '#FFFFFF'
    s=svg(512,512,f'<rect width="512" height="512" fill="{bgc}"/><g transform="translate(20 20) scale(0.921875)">{mark(dark,bg=False)}</g>'.replace('fill="{tile}"',''))
    # mark(bg=False) still refs gradient defs - fine
    open(f'{B}/logo/ci-doctor-avatar-{name}.svg','w').write(s)
    cairosvg.svg2png(bytestring=s.encode(),write_to=f'{B}/logo/ci-doctor-avatar-{name}-400.png',output_width=400,output_height=400)
print(os.listdir(B+'/logo'))
