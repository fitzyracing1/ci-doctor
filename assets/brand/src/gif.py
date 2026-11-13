from PIL import Image, ImageDraw, ImageFont
B='/workspace/ci-doctor-brand'; F=B+'/fonts/'
W,H=1280,720
BG='#0B1220'; PANEL='#0F172A'; BORDER='#1E293B'; TXT='#E2E8F0'; DIM='#64748B'; MUTED='#94A3B8'
TEAL='#2DD4BF'; YEL='#FBBF24'; BLUE='#60A5FA'; GREEN='#34D399'
mono=ImageFont.truetype(F+'JetBrainsMono-400.ttf',19); monob=ImageFont.truetype(F+'JetBrainsMono-700.ttf',19)
sg=lambda w,s: ImageFont.truetype(F+f'SpaceGrotesk-{w}.ttf',s)
CW=mono.getlength('M')
# REAL findings, verbatim from the log of fitzyracing1/jess run 43396327866 (log order).
# file:line from the run annotations and a local re-run of ci-doctor@9a0df89 on jess@495e14b.
N20="which GitHub has removed from hosted runners (Node 20 was removed on 2026-09-23)."
def c3(a,v,new,fix_v,node='node20'): return ('CID003',a,f"actions/{v} runs on {node}, "+N20,f"Use `actions/{new}` (runs natively on node24).")
WARN=[('CID003','ci_master.yaml:15',"actions/checkout@v2 runs on node12, "+N20,"Use `actions/checkout@v7` (runs natively on node24)."),
('CID003','ci_master.yaml:17',"actions/setup-python@v1 runs on node12, "+N20,"Use `actions/setup-python@v7` (runs natively on node24)."),
('CID003','ci_master.yaml:42',"codecov/codecov-action@v1 runs on node12, "+N20,"Use `codecov/codecov-action@v7` (runs natively on node24)."),
('CID008','ci-doctor-trial.yml:4',"`on.push.branches` is [try/ci-doctor], but this repo's default branch is `main`, so this workflow never runs for pushes to it.","Add it: `branches: [try/ci-doctor, main]`."),
('CID003','publish_to_pypi.yml:11',"actions/checkout@v4 runs on node20, "+N20,"Use `actions/checkout@v7` (runs natively on node24)."),
('CID003','publish_to_pypi.yml:15',"actions/setup-python@v5 runs on node20, "+N20,"Use `actions/setup-python@v7` (runs natively on node24)."),
('CID003','publish_to_pypi.yml:27',"actions/upload-artifact@v4 runs on node20, "+N20,"Use `actions/upload-artifact@v7` (runs natively on node24)."),
('CID003','publish_to_pypi.yml:47',"actions/download-artifact@v4 runs on node20, "+N20,"Use `actions/download-artifact@v8` (runs natively on node24)."),
('CID003','publish_to_pypi.yml:69',"actions/download-artifact@v4 runs on node20, "+N20,"Use `actions/download-artifact@v8` (runs natively on node24).")]
PERM="No `permissions:` block, so GITHUB_TOKEN gets the repository default, which is read/write on many repos."
NOTE=[('CID009','ci_master.yaml:5',PERM,"Add at the top level:  permissions: contents: read"),
('CID007','ci_master.yaml:28',"`pip install flake8` is unpinned. New flake8 releases change rules/formatting and can turn CI red with no code change.",'Pin it, e.g. `pip install "flake8==<version you use>"`, or put it in a requirements/lock file and let Dependabot bump it.'),
('CID007','ci_master.yaml:28',"`pip install black` is unpinned. New black releases change rules/formatting and can turn CI red with no code change.",'Pin it, e.g. `pip install "black==<version you use>"`, or put it in a requirements/lock file and let Dependabot bump it.'),
('CID011','ci_master.yaml:44',"This job runs on `pull_request` and reads `secrets.CODECOV_TOKEN`. Secrets are empty for pull requests from forks, so contributor PRs fail here (or the code crashes on an unset value).","Guard the step, e.g. `if: github.event.pull_request.head.repo.full_name == github.repository`, or give the code a safe fallback when the value is empty."),
('CID009','publish_to_pypi.yml:5',PERM,"Add at the top level:  permissions: contents: read")]

X0,Y0=40,40; X1,Y1=W-40,H-64  # window
TX=X0+28; TOP=Y0+60; LH=27; MAXCH=int((X1-TX-28)/CW)
def clip(s,n):
    if len(s)<=n: return s
    cut=s[:n-1]
    for sep in ('. ',', ',' ('):
        i=cut.rfind(sep)
        if i>n*0.5: return s[:i+(1 if sep=='. ' else 0)] + ('' if sep=='. ' else ' …')
    return cut.rstrip()+'…'

IND=4
def lines_all():
    L=[]
    L.append([('▶ ',GREEN),('Run fitzyracing1/ci-doctor@v0',TXT)])
    L.append([('  with: path: .  fail-on: none  use-profile: true',DIM)])
    L.append([])
    for sev,col,items in (('warning',YEL,WARN),('notice',BLUE,NOTE)):
        for rid,loc,msg,fix in items:
            L.append([('● ',col),(f'{sev:<8}',col),(rid+'  ',TEAL),('.github/workflows/'+loc,MUTED)])
            L.append([(' '*IND,TXT),(clip(msg,MAXCH-IND),TXT)])
            L.append([(' '*IND+'→ ',DIM),(clip('Fix: '+fix,MAXCH-IND-2),GREEN)])
    L.append([])
    L.append([('ci-doctor: ',TXT),('0 error(s), ',TXT),('9 warning(s)',YEL),(', ',TXT),('5 notice(s)',BLUE),('. ',TXT),('Fixed by ci-doctor',TEAL)])
    return L

def chrome(d,title):
    d.rounded_rectangle((X0,Y0,X1,Y1),18,fill=PANEL,outline=BORDER,width=2)
    d.rounded_rectangle((X0,Y0,X1,Y0+44),18,fill='#111C30')
    d.rectangle((X0,Y0+26,X1,Y0+44),fill='#111C30'); d.line((X0,Y0+44,X1,Y0+44),fill=BORDER,width=2)
    for i,c in enumerate(('#334155','#334155','#334155')): d.ellipse((X0+20+i*22,Y0+16,X0+32+i*22,Y0+28),fill=c)
    f=sg(500,18); tw=d.textlength(title,font=f); d.text(((X0+X1)/2-tw/2,Y0+11),title,font=f,fill=MUTED)

def footer(d):
    f=sg(500,18)
    t='Real output: fitzyracing1/jess · GitHub Actions run 43396327866 · passed'
    d.text((X0+4,H-46),t,font=f,fill=DIM)
    t2='github.com/fitzyracing1/ci-doctor'; d.text((X1-d.textlength(t2,font=f)-4,H-46),t2,font=f,fill=TEAL)

def term_frame(n, cursor=True, highlight_last=False):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    chrome(d,'doctor  ·  fitzyracing1/ci-doctor@v0'); footer(d)
    L=lines_all()[:n]
    rows=int((Y1-TOP-16)/LH)
    vis=L[-rows:] if len(L)>rows else L
    y=TOP
    for i,ln in enumerate(vis):
        x=TX
        last = highlight_last and i==len(vis)-1
        if last:
            d.rounded_rectangle((TX-12,y-5,X1-16,y+LH-3),8,fill='#0F2A2A')
        for s,c in ln:
            d.text((x,y),s,font=monob if last else mono,fill=c); x+=CW*len(s)
        y+=LH
    if cursor:
        d.rectangle((TX,y+2,TX+CW-2,y+LH-6),fill=TEAL)
    return im

def end_card():
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    logo=Image.open(B+'/logo/ci-doctor-wordmark-dark.png').convert('RGBA')
    lw=760; logo=logo.resize((lw,int(logo.height*lw/logo.width)),Image.LANCZOS)
    im.paste(logo,((W-lw)//2,150),logo)
    f=sg(500,32); t='Finds the GitHub Actions deprecations that quietly break CI,'
    t2='and shows the exact line to change.'
    for i,s in enumerate((t,t2)):
        d.text(((W-d.textlength(s,font=f))/2,350+i*44),s,font=f,fill=TXT)
    code='- uses: fitzyracing1/ci-doctor@v0'; fm=ImageFont.truetype(F+'JetBrainsMono-500.ttf',26)
    cw=d.textlength(code,font=fm); bx=(W-cw)/2
    d.rounded_rectangle((bx-28,472,bx+cw+28,532),12,fill=PANEL,outline=BORDER,width=2)
    d.text((bx,486),code,font=fm,fill=GREEN)
    f2=sg(500,22); s='github.com/fitzyracing1/ci-doctor  ·  MIT'
    d.text(((W-d.textlength(s,font=f2))/2,580),s,font=f2,fill=MUTED)
    return im

frames=[];dur=[]
total=len(lines_all())
frames.append(term_frame(0)); dur.append(500)
frames.append(term_frame(1)); dur.append(400)
frames.append(term_frame(3)); dur.append(600)
n=3
n=3
while n< total-5:
    n+=3; frames.append(term_frame(n)); dur.append(260)
frames.append(term_frame(total,cursor=False,highlight_last=True)); dur.append(2800)
frames.append(end_card()); dur.append(3200)
# shared palette
pal_src=Image.new('RGB',(W,H*2)); pal_src.paste(frames[-2],(0,0)); pal_src.paste(frames[-1],(0,H))
pal=pal_src.quantize(colors=128,method=Image.Quantize.MEDIANCUT)
q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
q[0].save(B+'/ci-doctor-demo.gif',save_all=True,append_images=q[1:],duration=dur,loop=0,optimize=True,disposal=1)
for i in (2,10,len(frames)-2,len(frames)-1): frames[i].save(f'/tmp/gif_f{i}.png')
print(len(frames), sum(dur)/1000,'s')
