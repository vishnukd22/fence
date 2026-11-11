# Screenshots of the TV and every phone at each phase while bots play.
import json, os, sys, time, subprocess
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3200'
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
tok = os.path.join(OUT, 'tokens.json')
if os.path.exists(tok): os.remove(tok)
bots = subprocess.Popen(['node', 'test/bots.js'], env={**os.environ, 'URL': URL, 'N': '4', 'TOKENS_OUT': tok, 'WAIT_START': '9000', 'MAXMS': '900000', 'BOT_DELAY': os.environ.get('BOT_DELAY','0')}, cwd='/home/claude/fence')
while not os.path.exists(tok): time.sleep(0.2)
time.sleep(0.3)
info = json.load(open(tok))
code = info['code']
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    tv = b.new_page(viewport={'width': 1600, 'height': 900})
    tv.on('pageerror', lambda e: errors.append(('tv', str(e))))
    tv.add_init_script(f"sessionStorage.setItem('fenceHost', '{code}')")
    tv.goto(URL + '/tv')
    tv.click('#bOpen')
    phones = []
    for pl in info['players']:
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e, n=pl['name']: errors.append((n, str(e))))
        pg.add_init_script(f"localStorage.setItem('fence:token:{code}', '{pl['token']}'); localStorage.setItem('fence:code','{code}');")
        pg.goto(f"{URL}/?room={code}")
        phones.append((pl['name'], pg))
    seen = {}
    last = None
    t0 = time.time()
    while time.time() - t0 < 900:
        try:
            ph = tv.evaluate('window.__S && window.__S.phase')
        except Exception:
            ph = None
        if ph and ph != last:
            last = ph
            n = seen.get(ph, 0); seen[ph] = n + 1
            time.sleep(1.2 if ph not in ('HEIST_LIVE',) else 0.5)
            tag = f"{len(seen):02d}_{ph}_{n}"
            if n < 1 or ph in ('HEIST_LIVE', 'SPLIT_RESULT', 'PAPER', 'MARKET', 'OPENING', 'HEIST_BRIEF', 'ESCAPE'):
                if n < 3:
                    tv.screenshot(path=f"{OUT}/{tag}_tv.png")
                    for name, pg in phones:
                        pg.screenshot(path=f"{OUT}/{tag}_{name}.png", full_page=True)
            if ph == 'FINAL':
                break
        time.sleep(0.15)
    b.close()
bots.wait(timeout=60)
print('errors', errors)
print('phases seen', seen)
