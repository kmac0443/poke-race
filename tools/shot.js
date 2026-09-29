// Headless playtest driver.
//   node tools/shot.js <script.js> <outDir>
// The script exports an async function (t) => { … } using:
//   t.press(code, frames=6)  t.hold(code, ms)  t.holdAll([codes], ms)  t.wait(ms)  t.shot(name)  t.eval(fn)  t.keys([...], each=6)
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

(async () => {
  const [scriptPath, outDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  // static server on a random port
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0);
  const port = srv.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: path.join(require('os').tmpdir(), 'pr-chrome-' + Date.now()), args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1100,850'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  const logs = [];
  page.on('console', async m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    if (m.text().startsWith('Failed to load resource')) return;
    let txt = m.text();
    try {
      const parts = await Promise.all(m.args().map(a => a.evaluate(v => (v && v.stack) ? v.stack : String(v)).catch(() => '?')));
      if (parts.length) txt = parts.join(' ');
    } catch {}
    logs.push(`[${m.type()}] ${txt}`);
  });
  page.on('response', r => { if (r.status() >= 400) logs.push('[404] ' + decodeURIComponent(r.url())); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + e.stack));
  for (let i = 0; i < 3; i++) {
    try { await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { console.log('goto retry', e.message); await new Promise(r => setTimeout(r, 1000)); }
  }
  const t = {
    page,
    wait: ms => new Promise(r => setTimeout(r, ms)),
    async press(code, frames = 6) { await page.keyboard.down(code); await t.wait(frames * 17); await page.keyboard.up(code); await t.wait(40); },
    async hold(code, ms) { await page.keyboard.down(code); await t.wait(ms); await page.keyboard.up(code); await t.wait(40); },
    /** hold several keys at once (two players pushing a heavy crate together) */
    async holdAll(codes, ms) { for (const c of codes) await page.keyboard.down(c); await t.wait(ms); for (const c of codes) await page.keyboard.up(c); await t.wait(40); },
    async keys(list, gap = 150) { for (const k of list) { await t.press(k); await t.wait(gap); } },
    async shot(name) { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); },
    eval: (fn, ...a) => page.evaluate(fn, ...a),
    /** name of the top scene for player i */
    top: i => page.evaluate(i => { const p = window.game.players[i]; return p.top ? p.top.constructor.name : null; }, i),
    /** press `key` until player i's top scene is `name` (or fn returns true) */
    async mashUntil(i, key, name, max = 60) {
      for (let n = 0; n < max; n++) {
        const top = await t.top(i);
        if (typeof name === 'function' ? await name(top) : top === name) return true;
        await t.press(key); await t.wait(120);
      }
      console.log('mashUntil timeout; top =', await t.top(i));
      return false;
    },
  };
  try {
    await require(path.resolve(scriptPath))(t);
  } catch (e) {
    console.log('SCRIPT ERROR', e);
  }
  console.log(logs.length ? logs.join('\n') : 'no console errors');
  await browser.close();
  srv.close();
})();
