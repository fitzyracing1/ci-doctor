from PIL import Image, ImageDraw, ImageFont, ImageFilter
B='/workspace/ci-doctor-brand'; F=B+'/fonts/'
BG='#0B1220'; PANEL='#0F172A'; BORDER='#1E293B'; TXT='#E2E8F0'; WHITE='#F8FAFC'; MUTED='#94A3B8'; DIM='#64748B'
TEAL='#2DD4BF'; YEL='#FBBF24'; BLUE='#60A5FA'; GREEN='#34D399'
sg=lambda w,s: ImageFont.truetype(F+f'SpaceGrotesk-{w}.ttf',s)
jm=lambda w,s: ImageFont.truetype(F+f'JetBrainsMono-{w}.ttf',s)

def background(W,H):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    # subtle dot grid
    for x in range(0,W,40):
        for y in range(0,H,40): d.point((x,y),fill='#16223A')
    # soft teal glow top-right
    glow=Image.new('L',(W,H),0); g=ImageDraw.Draw(glow); r=int(W*0.35)
    g.ellipse((W-r,-r,W+r,r),fill=60); glow=glow.filter(ImageFilter.GaussianBlur(r//2))
    im=Image.composite(Image.new('RGB',(W,H),'#0E3B3B'),im,glow)
    return im

def wrap(d,text,font,maxw):
    out=[];cur=''
    for w in text.split():
        t=(cur+' '+w).strip()
        if d.textlength(t,font=font)<=maxw: cur=t
        else: out.append(cur); cur=w
    out.append(cur); return out

def logo(w):
    l=Image.open(B+'/logo/ci-doctor-wordmark-dark.png').convert('RGBA')
    return l.resize((w,int(l.height*w/l.width)),Image.LANCZOS)

# Real findings, verbatim (clipped with …) from fitzyracing1/jess run 43396327866
FIND=[('warning',YEL,'CID003','ci_master.yaml:15','actions/checkout@v2 runs on node12, which GitHub has removed from hosted runners','Use `actions/checkout@v7` (runs natively on node24).'),
      ('notice',BLUE,'CID009','ci_master.yaml:5','No `permissions:` block, so GITHUB_TOKEN gets the repository default, which is read/write on many repos.','Add at the top level: permissions: contents: read'),
      ('notice',BLUE,'CID007','ci_master.yaml:28','`pip install black` is unpinned. New black releases change rules/formatting','Pin it, e.g. `pip install "black==<version you use>"`')]
def clip(s,n):
    if len(s)<=n: return s
    cut=s[:n-1]
    for sep in ('. ',', '):
        i=cut.rfind(sep)
        if i>n*0.4: return s[:i+1] + ('' if sep=='. ' else ' …')
    return cut.rstrip()+'…'

def panel(d,x,y,w,fs=21):
    f=jm(400,fs); fb=jm(700,fs); lh=int(fs*1.55); cw=f.getlength('M')
    n=len(FIND)
    h=56+n*(lh*3+14)+lh+24
    d.rounded_rectangle((x,y,x+w,y+h),20,fill=PANEL,outline=BORDER,width=2)
    d.rounded_rectangle((x,y,x+w,y+48),20,fill='#111C30'); d.rectangle((x,y+28,x+w,y+48),fill='#111C30')
    d.line((x,y+48,x+w,y+48),fill=BORDER,width=2)
    for i in range(3): d.ellipse((x+20+i*22,y+18,x+32+i*22,y+30),fill='#334155')
    t='fitzyracing1/jess · real run'; ft=sg(500,18); d.text((x+w-d.textlength(t,font=ft)-20,y+13),t,font=ft,fill=DIM)
    yy=y+66; xx=x+26
    for sev,col,rid,loc,msg,fix in FIND:
        d.ellipse((xx,yy+fs*0.35,xx+fs*0.55,yy+fs*0.9),fill=col)
        d.text((xx+fs,yy),sev,font=f,fill=col); d.text((xx+fs+cw*8.5,yy),rid,font=f,fill=TEAL)
        d.text((xx+fs+cw*15.5,yy),loc,font=f,fill=MUTED)
        n_=int((w-52-fs)/cw); d.text((xx+fs,yy+lh),clip(msg,n_),font=f,fill=TXT)
        d.text((xx+fs,yy+2*lh),'→ '+clip(fix,n_-2),font=f,fill=GREEN)
        yy+=lh*3+14
    d.text((xx,yy+4),'ci-doctor: 0 error(s), ',font=fb,fill=TXT)
    o=fb.getlength('ci-doctor: 0 error(s), ')
    d.text((xx+o,yy+4),'9 warning(s)',font=fb,fill=YEL); o+=fb.getlength('9 warning(s)')
    d.text((xx+o,yy+4),', ',font=fb,fill=TXT); o+=fb.getlength(', ')
    d.text((xx+o,yy+4),'5 notice(s)',font=fb,fill=BLUE)
    return h

HEAD='Find the deprecations that quietly break your CI.'
SUB='A GitHub Action that flags retired runners, old Node runtimes and shut-down actions on the exact line, with the fix.'
USES='- uses: fitzyracing1/ci-doctor@v0'
URL='github.com/fitzyracing1/ci-doctor'

def footer(d,x,y,W,pad,fs=24):
    fm=jm(500,fs); cw=d.textlength(USES,font=fm)
    d.rounded_rectangle((x,y,x+cw+48,y+fs+36),12,fill=PANEL,outline=BORDER,width=2)
    d.text((x+24,y+16),USES,font=fm,fill=GREEN)
    fu=sg(700,fs+2); uw=d.textlength(URL,font=fu)
    d.text((W-pad-uw,y+14),URL,font=fu,fill=TEAL)

def card_x():
    W,H=1600,900; pad=88; im=background(W,H); d=ImageDraw.Draw(im)
    lg=logo(330); im.paste(lg,(pad,pad-8),lg)
    colw=640
    fh=sg(700,60); y=236
    for ln in wrap(d,HEAD,fh,colw): d.text((pad,y),ln,font=fh,fill=WHITE); y+=72
    y+=30; fs=sg(400,27)
    for ln in wrap(d,SUB,fs,colw-20): d.text((pad,y),ln,font=fs,fill=MUTED); y+=40
    panel(d,776,150,736,fs=19)
    footer(d,pad,H-pad-60,W,pad)
    d.line((pad,H-pad-92,W-pad,H-pad-92),fill=BORDER,width=2)
    im.save(B+'/post-card-x-1600x900.png')

def card_sq():
    W=H=1080; pad=80; im=background(W,H); d=ImageDraw.Draw(im)
    lg=logo(300); im.paste(lg,(pad,pad-6),lg)
    fh=sg(700,58); y=186
    for ln in wrap(d,HEAD,fh,W-2*pad): d.text((pad,y),ln,font=fh,fill=WHITE); y+=70
    y+=26; fs=sg(400,27)
    for ln in wrap(d,SUB,fs,W-2*pad): d.text((pad,y),ln,font=fs,fill=MUTED); y+=40
    panel(d,pad,y+24,W-2*pad,fs=19)
    d.line((pad,H-pad-92,W-pad,H-pad-92),fill=BORDER,width=2)
    footer(d,pad,H-pad-60,W,pad,fs=21)
    im.save(B+'/post-card-square-1080.png')
card_x(); card_sq()
