// End-to-end smoke test: serves `dist/` with `vite preview`, then plays the
// game in a real Chromium on a desktop and a phone viewport.
// Usage: npm run build && npm run test:e2e
//
// Every step waits for a game condition (or a number of rendered frames)
// instead of a fixed time, so the test also passes on machines without a GPU
// (software rendering at ~1-2 fps).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency (it is big); use a local or global install.
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4179;
const BASE_URL = `http://localhost:${PORT}/`;
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
const SLOW = 90_000;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('preview server did not start')), 20000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(timer);
      resolve();
    }
  });
});

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const state = (page) => page.evaluate(() => window.__game.debugState());
const until = (page, fn, arg) =>
  page
    .waitForFunction(fn, arg, { timeout: SLOW, polling: 250 })
    .then(() => true)
    .catch(() => false);
const settled = (page) => until(page, () => !window.__game.cam.isFlying);
/** Waits until the game has rendered `n` more frames. */
const frames = async (page, n) => {
  const f0 = (await state(page)).frames;
  await until(page, (f) => window.__game.debugState().frames >= f, f0 + n);
};
const shot = (page, name) =>
  page.screenshot({ path: `${SHOTS}${name}.png`, timeout: SLOW, animations: 'disabled' }).catch((e) => console.log(`      (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const node = (page) => page.evaluate(() => window.__game.debugState().line?.nodeId ?? null);
const social = (page) => page.evaluate(() => window.__game.debugState().social);

/** Conversation helpers: wait for a line, then answer by tapping or with the number keys. */
async function atLine(page, id) {
  return until(page, (n) => window.__game.debugState().line?.nodeId === n && !!document.querySelector('.dlg-actions button'), id);
}
async function answer(page, mobile, choice) {
  const btn = page.locator(`.dlg-choice[data-choice="${choice}"]`);
  await btn.waitFor();
  if (mobile) await btn.tap();
  else {
    // the number shown on the button, as a player would press it
    await page.keyboard.press(await btn.locator('.dlg-num').innerText());
  }
}
async function next(page, mobile) {
  const btn = page.locator('.dlg-next');
  await btn.waitFor();
  if (mobile) await btn.tap();
  else await page.keyboard.press('Enter');
}
/** Uses the journal's "take me there" button, then starts talking. */
async function meet(page, mobile, id) {
  await page.click('.btn-people');
  await page.click(`.people-go[data-npc="${id}"]`);
  await until(page, (n) => window.__game.debugState().nearNpc === n && !window.__game.cam.isFlying, id);
  if (mobile) await page.click('.interact-prompt');
  else await page.keyboard.press('KeyE');
  return until(page, () => !document.querySelector('.dialog').hidden);
}

/** Presses the action key (desktop) or taps the action button (phone). */
async function act(page, mobile) {
  if (mobile) await page.click('.interact-prompt');
  else await page.keyboard.press('KeyE');
}

/**
 * Talks to a character (via the journal's "take me there") and plays the
 * conversation to its end: mission topics first, otherwise the first answer.
 * Repeats (up to 3 talks) until `done(state)` holds.
 */
async function converse(page, mobile, id, done) {
  for (let talk = 0; talk < 3; talk++) {
    if (await page.evaluate(done, null).catch(() => false)) return true;
    await page.click('.btn-people');
    await page.click(`.people-go[data-npc="${id}"]`);
    await until(page, (n) => window.__game.debugState().nearNpc === n && !window.__game.cam.isFlying && !window.__game.debugState().fading, id);
    await act(page, mobile);
    await until(page, () => !document.querySelector('.dialog').hidden);
    for (let step = 0; step < 24; step++) {
      await until(page, () => document.querySelector('.dialog').hidden || !!document.querySelector('.dlg-actions button'));
      if (await page.evaluate(() => document.querySelector('.dialog').hidden)) break;
      // goal reached in the middle of a topic menu: leave politely
      if (await page.evaluate(done, null).catch(() => false)) {
        await page.keyboard.press('Escape');
        break;
      }
      const line = await page.evaluate(() => window.__game.debugState().line);
      if (!line) break;
      if (line.choices.length) {
        const pick = line.choices.find((c) => /hub\.branch$/.test(c.textKey)) ?? line.choices.find((c) => c.tone !== 'rude' && c.tone !== 'bye') ?? line.choices[0];
        await answer(page, mobile, pick.index);
      } else await next(page, mobile);
      await until(page, (n) => document.querySelector('.dialog').hidden || window.__game.debugState().line?.nodeId !== n || !document.querySelector('.dlg-actions button'), line.nodeId);
    }
    await until(page, () => document.querySelector('.dialog').hidden);
  }
  return page.evaluate(done, null);
}

/** Teleports the player to a free spot within reach of (x, z), facing it. */
function approach(page, x, z, reach = 1.9, floor = 0) {
  return page.evaluate(
    ([x, z, reach, floor]) => {
      const g = window.__game;
      for (let r = 0.9; r <= reach; r += 0.25) {
        for (let i = 0; i < 16; i++) {
          // start in front (+z, the door side) and go round
          const a = (i / 16) * Math.PI * 2;
          const px = x + Math.sin(a) * r;
          const pz = z + Math.cos(a) * r;
          if (g.city.collision.isFree(px, pz, 0.45, floor + 0.4)) {
            g.player.teleport(px, pz, Math.atan2(x - px, z - pz), floor);
            return true;
          }
        }
      }
      return false;
    },
    [x, z, reach, floor],
  );
}

/** Uses whatever is near once the prompt for `key` shows. */
async function use(page, mobile, key) {
  const ok = await until(page, (k) => window.__game.debugState().near === k && !window.__game.debugState().fading, key);
  if (ok) await act(page, mobile);
  return ok;
}

/** Holds the joystick in a direction (dx, dy in pixels) while `fn` runs. */
async function withJoystick(page, dx, dy, fn) {
  const box = await page.locator('.joystick').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 3 });
  try {
    return await fn();
  } finally {
    await page.mouse.up();
  }
}

async function run(label, contextOptions, mobile) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(SLOW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text()) && errors.push(m.text()));

  /* ------------------------------ title screen ----------------------------- */
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game, null, { timeout: SLOW });
  await page.waitForSelector('#start-create:not([disabled])');
  check(`${label}: page is RTL Hebrew`, await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'he'));
  check(`${label}: a first visit offers only "create character"`, (await page.locator('#start-continue').count()) === 0);
  await shot(page, `${label}-01-title`);

  const s0 = await state(page);
  const zones = new Set(s0.pois.map((p) => p.zone));
  const districts = ['tech', 'energy', 'health', 'food', 'banking', 'realEstate', 'industry'];
  check(`${label}: all 7 districts exist`, districts.every((d) => zones.has(d)));
  const keys = new Set(s0.pois.map((p) => p.key));
  const landmarks = ['bank', 'exchange', 'newsTower', 'academy', 'portfolioHQ'];
  check(`${label}: all key buildings exist`, landmarks.every((k) => keys.has(k)), landmarks.filter((k) => !keys.has(k)).join(','));

  /* --------------------------- character creator --------------------------- */
  await page.click('#start-create');
  await page.waitForSelector('.creator');
  check(`${label}: creator opens`, (await state(page)).mode === 'creator');
  await page.click('.creator-tab[data-tab="hair"]');
  await page.click('.creator-body .choice[data-value="bun"]');
  await page.click(`.creator-body .swatch-group >> nth=0 >> .swatch >> nth=4`);
  await page.click('.creator-tab[data-tab="clothes"]');
  await page.click('.creator-body .choice[data-value="hoodie"]');
  await page.click('.creator-tab[data-tab="extras"]');
  await page.click('.creator-body .choice[data-value="cap"]');
  await page.click('.creator-body .choice[data-value="backpack"]');
  check(`${label}: chosen options are marked`, (await page.locator('.creator-body .choice.on').count()) >= 3);
  // "done" without a nickname jumps to the nickname tab instead of starting
  // (force: Playwright refuses to click aria-disabled buttons, but players can)
  await page.click('#creator-done', { force: true });
  check(`${label}: a nickname is required`, (await state(page)).mode === 'creator' && (await page.locator('#nickname').isVisible()));
  await page.fill('#nickname', 'דני<>!');
  check(`${label}: nickname strips symbols`, (await page.inputValue('#nickname')) === 'דני');
  await page.fill('#nickname', 'דני הכריש');
  await shot(page, `${label}-02-creator`);
  await page.click('#creator-done');
  check(`${label}: entering the city after creating`, await until(page, () => window.__game.debugState().mode === 'playing'));
  await settled(page);
  let s = await state(page);
  check(`${label}: player spawns on the central plaza`, s.zone === 'central', `zone=${s.zone}`);
  check(`${label}: camera follows the player`, s.camera.mode === 'follow');
  check(`${label}: the look is applied`, s.player.look.hairStyle === 'bun' && s.player.look.top === 'hoodie' && s.player.look.headwear === 'cap' && s.player.look.backwear === 'backpack');
  check(`${label}: nickname floats above the player`, (await page.locator('.name-tag').innerText()) === 'דני הכריש');
  check(`${label}: draw calls stay low`, s.drawCalls < 380, `drawCalls=${s.drawCalls}, triangles=${s.triangles}`);
  await shot(page, `${label}-03-spawn`);

  /* --------------------------- walking and running ------------------------- */
  const p0 = s.player;
  let walk = 0;
  let runSpeed = 0;
  if (mobile) {
    await withJoystick(page, 0, -32, async () => {
      check(`${label}: joystick walks the player`, await until(page, (p) => Math.hypot(window.__game.player.position.x - p.x, window.__game.player.position.z - p.z) > 2, p0));
      walk = (await state(page)).player.speed;
    });
    // turn around: the fountain is ahead, open plaza is behind
    await page.evaluate(() => {
      window.__game.player.teleport(0, 18, 0);
      window.__game.cam.snapBehind(0);
    });
    await page.click('.run-btn');
    check(`${label}: run button toggles`, await page.locator('.run-btn.on').isVisible());
    await withJoystick(page, 0, -30, async () => {
      await until(page, () => window.__game.player.speed > 6);
      runSpeed = (await state(page)).player.speed;
    });
    await page.click('.run-btn');
  } else {
    await page.keyboard.down('KeyW');
    check(`${label}: W walks the player`, await until(page, (p) => Math.hypot(window.__game.player.position.x - p.x, window.__game.player.position.z - p.z) > 2, p0));
    walk = (await state(page)).player.speed;
    await page.keyboard.down('ShiftLeft');
    await until(page, () => window.__game.player.speed > 6);
    runSpeed = (await state(page)).player.speed;
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    // arrows turn the character
    const h0 = (await state(page)).player.heading;
    await page.keyboard.down('ArrowLeft');
    check(`${label}: arrow keys turn and move`, await until(page, (h) => Math.abs(window.__game.player.heading - h) > 0.8, h0));
    await page.keyboard.up('ArrowLeft');
  }
  check(`${label}: walking speed`, walk > 2 && walk < 5, `walk=${walk.toFixed(1)} m/s`);
  check(`${label}: running is faster than walking`, runSpeed > walk * 1.5, `run=${runSpeed.toFixed(1)} m/s`);

  /* ----------------------- collision with a building ----------------------- */
  // stand south of the stock exchange, face it, and keep walking forward
  const exchange = s0.pois.find((p) => p.key === 'exchange');
  await page.evaluate(() => {
    const g = window.__game;
    g.player.teleport(0, -4, Math.PI);
    g.cam.snapBehind(Math.PI);
  });
  const front = exchange.z + exchange.d / 2;
  const walkInto = async () => {
    // walk until the wall is reached (frame time varies a lot in software rendering)
    for (let i = 0; i < 12; i++) {
      await frames(page, 30);
      if ((await state(page)).player.z < front + 1.2) break;
    }
    await frames(page, 10);
    const a = (await state(page)).player;
    await frames(page, 8);
    return [a, (await state(page)).player];
  };
  let a;
  let b;
  if (mobile) [a, b] = await withJoystick(page, 0, -55, walkInto);
  else {
    await page.keyboard.down('KeyW');
    [a, b] = await walkInto();
    await page.keyboard.up('KeyW');
  }
  check(`${label}: player walked toward the exchange`, b.z < -6, `z=${b.z.toFixed(2)}`);
  check(`${label}: the exchange wall stops the player`, b.z > front - 3.5 && dist(a, b) < 0.3, `stopped at z=${b.z.toFixed(2)}, wall at z=${front.toFixed(2)}`);
  await shot(page, `${label}-04-wall`);

  /* ------------------------------- interaction ----------------------------- */
  check(`${label}: interaction prompt appears near the building`, await until(page, () => !document.querySelector('.interact-prompt').hidden));
  const promptText = await page.locator('.interact-prompt').innerText();
  check(`${label}: the prompt names the building`, promptText.includes('אקדמיית ההשקעות'), promptText.replace(/\s+/g, ' '));
  if (mobile) await page.click('.interact-prompt');
  else await page.keyboard.press('KeyE');
  await page.waitForSelector('.info-card:not([hidden])').catch(() => null);
  const card = (await page.locator('.info-card').isVisible()) ? await page.locator('.info-card h3').innerText() : '';
  check(`${label}: interacting opens the building card`, card.includes('אקדמיית ההשקעות'), card);
  await shot(page, `${label}-05-interact`);
  await page.keyboard.press('Escape');
  await page.click('.card-close').catch(() => null);


  /* ------------------------- characters and conversations ------------------------- */
  s = await state(page);
  check(`${label}: eight characters stand in the city`, s.npcs.length === 8);
  await page.click('.btn-people');
  check(`${label}: the journal lists all eight, none met yet`, (await page.locator('.people-card.unmet').count()) === 8 && (await page.locator('.people-count').innerText()).includes('0'));
  await shot(page, `${label}-09-journal`);
  await page.keyboard.press('Escape');

  // Leo: a friendly, careful conversation that ends with an errand
  check(`${label}: walking up to Leo shows a talk prompt`, await meet(page, mobile, 'leo'));
  check(`${label}: Leo greets with his first line`, await atLine(page, 'hello'));
  check(`${label}: the conversation shows his name and role`, (await page.locator('.dlg-name').innerText()) === 'ליאו' && (await page.locator('.dlg-role').innerText()).includes('המשקיע'));
  await shot(page, `${label}-10-leo`);
  await answer(page, mobile, 0);
  check(`${label}: an answer leads to Leo's reply`, await atLine(page, 'how'));
  await answer(page, mobile, 0);
  check(`${label}: a careful answer gets a thoughtful reaction`, await atLine(page, 'check'));
  check(`${label}: reputation feedback appears`, await until(page, () => document.querySelector('.dlg-repfx')?.classList.contains('up')));
  await next(page, mobile);
  await atLine(page, 'offer');
  await answer(page, mobile, 0);
  await atLine(page, 'accept');
  await next(page, mobile);
  check(`${label}: the conversation closes`, await until(page, () => document.querySelector('.dialog').hidden && window.__game.debugState().talking === null));
  let soc = await social(page);
  check(`${label}: Leo's errand starts and he likes us more`, soc.errands.leo === 'active' && soc.npcs.leo.rep > 10, `rep=${soc.npcs.leo.rep}`);
  check(`${label}: the errand tracker shows it`, (await page.locator('.tracker').innerText()).includes('ליאו'));

  // Marco: a rude answer first, then an apology, then checking Leo's rumor
  await meet(page, mobile, 'marco');
  await atLine(page, 'hello');
  await answer(page, mobile, 2);
  check(`${label}: a rude answer offends Marco`, await atLine(page, 'rude') && (await until(page, () => document.querySelector('.dlg-repfx')?.classList.contains('down'))));
  await shot(page, `${label}-11-rude`);
  await next(page, mobile);
  await until(page, () => document.querySelector('.dialog').hidden);
  soc = await social(page);
  check(`${label}: Marco's opinion drops`, soc.npcs.marco.rep < 10, `rep=${soc.npcs.marco.rep}`);
  if (mobile) await page.click('.interact-prompt');
  else await page.keyboard.press('KeyE');
  check(`${label}: next time Marco is cold`, await atLine(page, 'cold'));
  await answer(page, mobile, 0);
  await atLine(page, 'sorry');
  await next(page, mobile);
  check(`${label}: after apologising, Marco offers to talk`, await atLine(page, 'hub'));
  check(`${label}: a topic only appears when Leo's errand needs it`, (await page.locator('.dlg-choice[data-choice="2"]').count()) === 1);
  await answer(page, mobile, 2);
  await atLine(page, 'rumor');
  await answer(page, mobile, 0);
  await atLine(page, 'rumor2');
  await next(page, mobile);
  await until(page, () => document.querySelector('.dialog').hidden);
  soc = await social(page);
  check(`${label}: checking the rumor completes Leo's goal`, soc.errands.leo === 'ready' && soc.flags.includes('marco.rumorChecked'));
  check(`${label}: Leo now has a hand-in mark`, await until(page, () => document.querySelector('.npc-tag[data-npc="leo"] .npc-mark')?.textContent === '?'));

  // back to Leo: the "what did you learn?" scene
  await meet(page, mobile, 'leo');
  check(`${label}: Leo asks what we found`, await atLine(page, 'done1'));
  await answer(page, mobile, 0);
  await atLine(page, 'done2');
  await next(page, mobile);
  await atLine(page, 'done3');
  await next(page, mobile);
  check(`${label}: then the topic menu`, await atLine(page, 'hub'));
  await answer(page, mobile, 4);
  await atLine(page, 'bye');
  await next(page, mobile);
  await until(page, () => document.querySelector('.dialog').hidden);
  soc = await social(page);
  check(`${label}: Leo's errand is done and he is a friend now`, soc.errands.leo === 'done' && soc.npcs.leo.rep >= 45, `rep=${soc.npcs.leo.rep}`);

  // Oliver the owl
  await meet(page, mobile, 'oliver');
  check(`${label}: Oliver the owl talks`, await atLine(page, 'hello') && (await page.locator('.dlg-name').innerText()).includes('אוליבר'));
  await shot(page, `${label}-12-oliver`);
  await page.keyboard.press('Escape');
  check(`${label}: Escape leaves a conversation`, await until(page, () => document.querySelector('.dialog').hidden));

  await page.click('.btn-people');
  check(`${label}: the journal shows who we met`, (await page.locator('.people-card.met').count()) === 3 && (await page.locator('.people-card[data-npc="leo"] .people-errand.done').count()) === 1);
  await shot(page, `${label}-13-journal`);
  await page.keyboard.press('Escape');

  /* ------------------- phase 4: buildings, mission, notebook ------------------- */
  s = await state(page);
  // a "Did you know?" marker in the city
  const fountainCurio = s.curios.find((c) => c.id === 'fountain');
  await approach(page, fountainCurio.x, fountainCurio.z);
  check(`${label}: a "Did you know?" marker shows a prompt`, await use(page, mobile, 'curio:fountain'));
  check(`${label}: the discovery card opens`, await until(page, () => !!document.querySelector('.find-card.kind-curio') && !document.querySelector('.find-modal').hidden));
  await shot(page, `${label}-14-curio`);
  await page.click('.card-ok');
  s = await state(page);
  check(`${label}: the discovery is collected`, s.learning.curiosities.includes('fountain') && !s.overlay);

  // into the pizzeria
  const pizzaDoor = s.doors.find((d) => d.id === 'pizzeria');
  await approach(page, pizzaDoor.x, pizzaDoor.z + 0.2, 1.6, pizzaDoor.y);
  check(`${label}: the pizzeria door has an enter prompt`, await use(page, mobile, 'door:pizzeria'));
  check(`${label}: walking into the pizzeria`, await until(page, () => window.__game.debugState().inside === 'pizzeria' && !window.__game.debugState().fading));
  await settled(page);
  s = await state(page);
  check(`${label}: indoors the city is hidden and Marco is at the counter`, (await page.evaluate(() => !window.__game.city.root.visible)) && dist(s.npcs.find((n) => n.id === 'marco'), s.player) < 9);
  check(`${label}: indoors the badge names the room`, (await page.locator('.district-badge').innerText()).includes('פיצרייה'));
  await shot(page, `${label}-15-pizzeria`);
  const spot = (room, id) => s.spots.find((x) => x.room === room && x.id === id);
  // clues need the mission first
  await approach(page, spot('pizzeria', 'ledger').x, spot('pizzeria', 'ledger').z, 2.1);
  await use(page, mobile, 'spot:ledger');
  check(`${label}: clues wait until Marco explains the plan`, await until(page, () => /מרקו עוד לא/.test(document.querySelector('.toast').textContent)) && (await state(page)).mission.status === 'locked');

  // Marco raises his idea
  check(`${label}: Marco's branch mission starts`, await converse(page, mobile, 'marco', () => window.__game.debugState().mission.status === 'active'));
  check(`${label}: the tracker shows the mission`, (await page.locator('.tracker').innerText()).includes('הסניף'));
  check(`${label}: still inside the pizzeria`, (await state(page)).inside === 'pizzeria');

  // collect the six clues
  for (const id of ['ledger', 'menu', 'oven', 'register', 'letter', 'jar']) {
    const sp = spot('pizzeria', id);
    const reachable = await approach(page, sp.x, sp.z, 2.1);
    const used = reachable && (await use(page, mobile, `spot:${id}`));
    const opened = used && (await until(page, () => !!document.querySelector('.find-card.kind-clue') && !document.querySelector('.find-modal').hidden));
    check(`${label}: clue "${id}" can be reached and read`, opened, reachable ? '' : 'no free spot in reach');
    if (id === 'ledger') await shot(page, `${label}-16-clue`);
    if (opened) await page.click('.card-ok');
  }
  s = await state(page);
  check(`${label}: all clues are in the notebook`, s.mission.clues.length === 6, s.mission.clues.join(','));
  check(`${label}: clues teach concepts`, ['revenue', 'expenses', 'capacity'].every((c) => s.learning.concepts.includes(c)), s.learning.concepts.join(','));

  // calculations in the notebook
  await page.click('.btn-notebook');
  check(`${label}: the notebook opens on the mission`, await page.locator('.nb-tab.on[data-tab="mission"]').isVisible());
  const solve = async (q, value) => {
    await page.fill(`.nb-q[data-q="${q}"] .nb-input`, value);
    await page.click(`.nb-q[data-q="${q}"] .nb-checkbtn`);
  };
  await solve('profit', '1,000');
  check(`${label}: a wrong answer gives a hint`, await until(page, () => !!document.querySelector('.nb-q[data-q="profit"] .nb-bad')));
  await solve('profit', '2,000 ₪');
  check(`${label}: a right answer shows the explanation`, await until(page, () => !!document.querySelector('.nb-q[data-q="profit"].done .nb-explain')));
  await solve('unit', '32');
  await solve('breakEven', '200');
  await solve('payback', '11');
  await solve('interest', 'abc');
  check(`${label}: text that is not a number is refused`, await until(page, () => /מספר/.test(document.querySelector('.nb-q[data-q="interest"] .nb-bad')?.textContent ?? '')));
  await solve('interest', '1200');
  s = await state(page);
  check(`${label}: all calculations are solved`, Object.values(s.mission.answers).filter((a) => a.correct).length === 5);
  await shot(page, `${label}-17-notebook`);

  // advisors: "take me there" from the notebook, then talk
  await page.click('.nb-go[data-npc="daniel"]');
  check(`${label}: "take me there" leaves the building`, await until(page, () => window.__game.debugState().inside === null));
  check(`${label}: Daniel advises on the loan`, await converse(page, mobile, 'daniel', () => window.__game.debugState().social.flags.includes('branch.askDaniel')));
  check(`${label}: Ben advises on the rent`, await converse(page, mobile, 'ben', () => window.__game.debugState().social.flags.includes('branch.askBen')));
  s = await state(page);
  check(`${label}: advisors teach loan, interest and fixed costs`, ['loan', 'interest', 'fixedCost'].every((c) => s.learning.concepts.includes(c)));

  // risks and the recommendation
  await page.click('.tracker');
  check(`${label}: the tracker opens the notebook`, await page.locator('.nb-panel').isVisible());
  for (const r of ['empty', 'contract', 'loan', 'quality']) await page.check(`.nb-risks input[data-risk="${r}"]`);
  await page.click('.nb-risks-submit');
  check(`${label}: the risk report counts real risks`, await until(page, () => /4 מתוך 4/.test(document.querySelector('[data-sec="risks"] .nb-good')?.textContent ?? '')));
  await page.click('.nb-present');
  check(`${label}: a recommendation needs a choice`, await until(page, () => !!document.querySelector('[data-sec="decide"] .nb-bad')));
  await page.check('.nb-options input[data-option="pilot"]');
  await page.check('.nb-reasons input[data-reason="breakEven"]');
  await page.check('.nb-reasons input[data-reason="data"]');
  await page.click('.nb-present');
  check(`${label}: the outcome appears with stars`, await until(page, () => document.querySelector('.nb-stars')?.textContent === '★★★'));
  s = await state(page);
  check(`${label}: the mission is done`, s.mission.status === 'done' && s.mission.choice === 'pilot' && s.social.flags.includes('branch.result.pilot'));
  await shot(page, `${label}-18-outcome`);
  await page.click('.nb-tab[data-tab="concepts"]');
  check(`${label}: the concepts tab explains what was learned`, (await page.locator('.nb-concepts li.found').count()) >= 8);
  await shot(page, `${label}-19-concepts`);
  await page.keyboard.press('Escape');
  check(`${label}: Marco thanks the player afterwards`, await converse(page, mobile, 'marco', () => window.__game.debugState().social.flags.includes('branch.thanked')));

  // the bank: an info board, a discovery inside, and the way out
  s = await state(page);
  const bankDoor = s.doors.find((d) => d.id === 'bank');
  await approach(page, bankDoor.x, bankDoor.z + 0.2, 1.6, bankDoor.y);
  await use(page, mobile, 'door:bank');
  check(`${label}: walking into the bank`, await until(page, () => window.__game.debugState().inside === 'bank' && !window.__game.debugState().fading));
  await settled(page);
  await approach(page, spot('bank', 'rates').x, spot('bank', 'rates').z, 2.1);
  await use(page, mobile, 'spot:rates');
  check(`${label}: the rates board explains interest`, await until(page, () => !!document.querySelector('.find-card.kind-info')));
  await shot(page, `${label}-20-bank`);
  await page.click('.card-ok');
  const shekel = s.curios.find((c) => c.id === 'shekel');
  await approach(page, shekel.x, shekel.z);
  await use(page, mobile, 'curio:shekel');
  await until(page, () => !!document.querySelector('.find-card.kind-curio'));
  await page.click('.card-ok');
  await approach(page, spot('bank', 'exit').x, spot('bank', 'exit').z, 2.1);
  await use(page, mobile, 'spot:exit');
  check(`${label}: the exit leads back to the street`, await until(page, () => window.__game.debugState().inside === null && !window.__game.debugState().fading));
  s = await state(page);
  check(`${label}: outside again, in front of the bank`, dist(s.player, bankDoor) < 3 && (await page.evaluate(() => window.__game.city.root.visible)));
  check(`${label}: two discoveries collected`, s.learning.curiosities.length === 2);

  /* -------------------------------- camera -------------------------------- */
  const c0 = (await state(page)).camera;
  await page.click('.cam-buttons button[aria-label="התקרבות"]').catch(() => page.click('.cam-buttons .icon-btn >> nth=-3'));
  await page.click('.cam-buttons button[aria-label="סיבוב ימינה"]').catch(() => null);
  check(
    `${label}: zoom and rotate buttons move the follow camera`,
    await until(page, (c) => {
      const st = window.__game.cam.state;
      return Math.abs(st.distance - c.distance) > 1 || Math.abs(st.yaw - c.yaw) > 0.3;
    }, c0),
  );
  if (!mobile) {
    const y0 = (await state(page)).camera.yaw;
    const vw = contextOptions.viewport.width;
    const vh = contextOptions.viewport.height;
    await page.mouse.move(vw / 2, vh / 2);
    await page.mouse.down();
    await page.mouse.move(vw / 2 + 120, vh / 2, { steps: 4 });
    await page.mouse.up();
    check(`${label}: dragging orbits the camera around the player`, await until(page, (y) => Math.abs(window.__game.cam.state.yaw - y) > 0.3, y0));
  }

  /* ------------------------- map travel and discovery ---------------------- */
  const tileIndex = { tech: 0, health: 1, energy: 2, food: 3, banking: 5, realEstate: 6, industry: 8 };
  for (const d of districts) {
    await page.click('.btn-map');
    await page.locator('.map-tile').nth(tileIndex[d]).click();
    const ok = await until(page, (id) => window.__game.debugState().zone === id && window.__game.debugState().visited.includes(id) && !window.__game.cam.isFlying, d);
    check(`${label}: map travel to ${d} (discovered)`, ok, `zone=${(await state(page)).zone}`);
    if (['tech', 'energy', 'food', 'industry'].includes(d)) await shot(page, `${label}-06-${d}`);
  }
  s = await state(page);
  check(`${label}: all 7 districts discovered`, districts.every((d) => s.visited.includes(d)), s.visited.join(','));
  const counter = await page.locator('.visit-counter').innerText();
  check(`${label}: discovery counter updates`, counter.includes('7 מתוך 7'), counter);
  await page.click('.btn-map');
  check(`${label}: map marks visited districts`, await page.evaluate((ds) => ds.every((d) => document.querySelector(`.map-tile[data-zone="${d}"]`).classList.contains('visited')), districts));
  await page.keyboard.press('Escape');

  /* ----------------------------- floating labels --------------------------- */
  // walk up to a shop: its sign label should be on screen and tappable
  const shop = s0.pois.find((p) => p.key === 'pizzeria');
  await page.evaluate((id) => window.__game.visitPoi(id), shop.id);
  await settled(page);
  await frames(page, 4);
  const labelInfo = await page.evaluate(() => [...document.querySelectorAll('.poi-label')].filter((el) => !el.hidden).map((el) => el.textContent).join(','));
  console.log(`      visible labels: ${labelInfo}`);
  const labelIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.poi-label')].findIndex((el) => {
      if (el.hidden) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    }),
  );
  if (labelIdx >= 0) await page.locator('.poi-label').nth(labelIdx).click();
  await page.waitForSelector('.info-card:not([hidden])').catch(() => null);
  const labelCard = (await page.locator('.info-card').isVisible()) ? await page.locator('.info-card h3').innerText() : '';
  check(`${label}: tapping a floating label shows its card`, /[֐-׿]/.test(labelCard), labelCard);
  await page.keyboard.press('Escape');
  await page.click('.card-close').catch(() => null);

  /* ------------- phase 5: first quest, XP, coins, bag, settings ------------ */
  s = await state(page);
  check(`${label}: the first quest started by itself`, s.growth.quests.mentor?.status === 'active', JSON.stringify(s.growth.quests));
  check(`${label}: errands, the mission, finds and concepts earned XP and coins`, s.growth.xp > 0 && s.growth.coins > 0, `xp=${s.growth.xp} coins=${s.growth.coins}`);
  check(`${label}: the player card shows the level and the coins`, (await page.locator('.pc-level').innerText()).includes(String(s.growth.level)) && (await page.locator('.pc-coins-n').innerText()) === String(s.growth.coins));
  check(`${label}: the waterfall trail starts closed`, s.growth.trailOpen === false && s.growth.unlocked.length === 0);
  const walkNorth = async () => {
    // panels close with a short animation; the player is frozen until they are gone
    await until(page, () => !window.__game.hud.overlayOpen && !window.__game.dialog.open);
    await page.evaluate(() => {
      window.__game.player.teleport(0, -134, Math.PI);
      window.__game.cam.snapBehind(Math.PI);
    });
    const go = async () => {
      await frames(page, 50);
      return (await state(page)).player;
    };
    if (mobile) return (await withJoystick(page, 0, -55, go));
    await page.keyboard.down('KeyW');
    const p = await go();
    await page.keyboard.up('KeyW');
    return p;
  };
  let north = await walkNorth();
  check(`${label}: the closed gate keeps the player in the city`, north.z > -140.6, `z=${north.z.toFixed(2)}`);
  await shot(page, `${label}-13-gate-closed`);

  // explore the square: the fountain, the market and the exchange
  for (const id of ['fountain', 'plazaMarket', 'exchange']) {
    await page.evaluate((x) => window.__game.visitPoi(x), id);
    await until(page, (x) => window.__game.debugState().growth.quests.mentor.seen.includes(x) || window.__game.debugState().growth.quests.mentor.step > 0, id);
  }
  check(`${label}: exploring the square completes the first step`, await until(page, () => window.__game.debugState().growth.quests.mentor.step === 1));
  await page.click('.btn-quests');
  check(`${label}: the quest log shows the next step`, await page.locator('.ql-quest[data-quest="mentor"] .ql-step[data-step="approach"].now').isVisible());
  check(`${label}: finished steps are ticked`, await page.locator('.ql-quest[data-quest="mentor"] .ql-step[data-step="explore"].done').isVisible());
  await shot(page, `${label}-14-questlog`);
  await page.click('.ql-quest[data-quest="mentor"] .ql-go');
  check(`${label}: "take me there" leads to Oliver, who is now waiting`, await until(page, () => window.__game.debugState().nearNpc === 'oliver' && window.__game.debugState().social.flags.includes('mentor.ready') && !window.__game.cam.isFlying));
  await act(page, mobile);
  check(`${label}: Oliver opens with the mentor challenge`, await until(page, () => window.__game.debugState().line?.nodeId === 'mentor1'));
  await next(page, mobile);
  await next(page, mobile);
  check(`${label}: the money question has three answers`, (await atLine(page, 'mentorQ')) && (await page.locator('.dlg-choice').count()) === 3);
  await shot(page, `${label}-15-challenge`);
  await answer(page, mobile, 0);
  check(`${label}: a wrong answer is explained`, await until(page, () => window.__game.debugState().line?.nodeId === 'mentorSpend'));
  await next(page, mobile);
  await next(page, mobile);
  check(`${label}: and the question comes back`, await atLine(page, 'mentorQ'));
  await answer(page, mobile, 1);
  check(`${label}: the right answer is praised`, await until(page, () => window.__game.debugState().line?.nodeId === 'mentorRight'));
  await next(page, mobile);
  await next(page, mobile);
  await atLine(page, 'hub');
  const byeIdx = (await state(page)).line.choices.find((c) => c.tone === 'bye').index;
  await answer(page, mobile, byeIdx);
  // the goodbye line still needs one more tap to close the conversation
  for (let i = 0; i < 3 && (await page.evaluate(() => !document.querySelector('.dialog').hidden)); i++) await next(page, mobile);
  check(`${label}: "Quest complete!" appears after the talk`, await until(page, () => window.__game.debugState().growth.complete && document.querySelector('.dialog').hidden));
  const qc = await page.locator('.qc-panel').innerText();
  check(`${label}: it lists XP, coins, items and the new area`, qc.includes('משימה הושלמה') && qc.includes('+120') && qc.includes('+30') && qc.includes('סיכת החניך') && qc.includes('שביל המפל'), qc.replace(/\s+/g, ' '));
  await shot(page, `${label}-16-complete`);
  await page.click('.qc-ok');
  s = await state(page);
  check(`${label}: the reward is applied`, s.growth.quests.mentor.status === 'done' && s.growth.items.join() === 'mentorBadge,trailMap' && s.growth.unlocked.join() === 'trail' && s.growth.level >= 2, JSON.stringify(s.growth));
  check(`${label}: the next quest starts and leads the tracker`, s.growth.quests.trail?.status === 'active' && (await page.locator('.tracker').innerText()).includes('המפל'));

  await page.click('.btn-bag');
  check(`${label}: the bag holds the two rewards`, (await page.locator('.bag-slot[data-item]').count()) === 2);
  await page.click('.bag-slot[data-item="trailMap"]');
  check(`${label}: tapping an item explains it`, (await page.locator('.bag-detail').innerText()).includes('המפל'));
  await shot(page, `${label}-17-bag`);
  await page.keyboard.press('Escape');
  await page.click('.btn-settings');
  await page.click('input[data-setting="bubbles"]');
  await page.click('input[data-setting="calm"]');
  s = await state(page);
  check(`${label}: settings change and are kept`, s.settings.bubbles === false && s.settings.calm === true && (await page.evaluate(() => document.querySelector('.hud').classList.contains('calm'))));
  await page.click('input[data-setting="calm"]');
  await page.click('input[data-setting="bubbles"]');
  await page.keyboard.press('Escape');

  north = await walkNorth();
  check(`${label}: the open gate lets the player onto the trail`, north.z < -142, `z=${north.z.toFixed(2)}`);
  await page.evaluate(() => window.__game.player.teleport(0, -190, Math.PI));
  check(`${label}: reaching the waterfall completes the trail quest`, await until(page, () => window.__game.debugState().growth.quests.trail?.status === 'done' && window.__game.debugState().growth.complete));
  await shot(page, `${label}-18-waterfall`);
  await page.click('.qc-ok');
  check(`${label}: the piggy bank is in the bag`, (await state(page)).growth.items.includes('piggyBank'));
  await page.evaluate(() => window.__game.visitPoi('fountain'));
  await settled(page);

  /* ------------------------------ night, help ------------------------------ */
  await page.click('.btn-night');
  check(`${label}: night mode toggles`, await until(page, () => window.__game.atmosphere.nightAmount === 1));
  await shot(page, `${label}-07-night`);
  await page.click('.btn-help');
  check(`${label}: help opens`, await page.locator('.modal-panel', { hasText: 'מדריך' }).isVisible());
  await page.keyboard.press('Escape');
  check(`${label}: help closes with Escape`, !(await page.locator('.modal-panel', { hasText: 'מדריך' }).isVisible()));

  /* ---------------------------- edit character ----------------------------- */
  await page.click('.btn-people');
  await page.click('.people-edit');
  await page.waitForSelector('.creator');
  await page.click('.creator-tab[data-tab="clothes"]');
  await page.click('.creator-body .choice[data-value="shirt"]');
  await page.click('#creator-done');
  check(`${label}: editing the character keeps the game going`, await until(page, () => window.__game.debugState().mode === 'playing' && window.__game.player.look.top === 'shirt'));

  /* ------------------------------ save and load ---------------------------- */
  await page.evaluate(() => window.__game.player.teleport(-40, 52, 1));
  await frames(page, 2);
  await page.click('.btn-save');
  check(`${label}: save shows a confirmation`, await until(page, () => !document.querySelector('.toast').hidden && /נשמר/.test(document.querySelector('.toast').textContent)));
  const saved = (await state(page)).player;
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('investor-city.save')));
  check(`${label}: progress is in local storage`, stored?.version === 4 && stored.growth.items.length === 3 && stored.missions.branch.status === 'done' && stored.learning.curiosities.length === 2 && stored.social.errands.leo === 'done' && stored.character.nickname === 'דני הכריש' && stored.progress.visited.length >= 7);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-continue');
  const sub = await page.locator('.start-sub').innerText();
  check(`${label}: title screen offers to continue`, (await page.locator('#start-continue').innerText()).includes('דני הכריש'), sub);
  await shot(page, `${label}-08-continue`);
  await page.click('#start-continue');
  check(`${label}: continue enters the city`, await until(page, () => window.__game.debugState().mode === 'playing'));
  s = await state(page);
  check(`${label}: position restored`, dist(s.player, saved) < 1, `(${s.player.x.toFixed(1)}, ${s.player.z.toFixed(1)})`);
  check(`${label}: character restored`, s.player.nickname === 'דני הכריש' && s.player.look.top === 'shirt' && s.player.look.hairStyle === 'bun');
  check(`${label}: discoveries and night restored`, s.visited.length >= 7 && s.night === true);
  check(`${label}: relationships and errands restored`, s.social.npcs.leo.rep >= 45 && s.social.npcs.marco.met && s.social.errands.leo === 'done');
  check(`${label}: XP, coins, the bag and the open trail restored`, s.growth.xp > 200 && s.growth.items.length === 3 && s.growth.trailOpen === true);

  /* ------------------------------- new game -------------------------------- */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-new');
  await page.click('#start-new');
  await page.click('#start-new-confirm');
  await page.waitForSelector('.creator');
  check(`${label}: "new character" starts over`, (await state(page)).mode === 'creator' && (await page.evaluate(() => localStorage.getItem('investor-city.save'))) === null);

  check(`${label}: no runtime errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

try {
  await run('desktop', { viewport: { width: 960, height: 540 } }, false);
  await run('phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, true);
} catch (e) {
  check('e2e run completed', false, e.message.split('\n').slice(0, 4).join(' / '));
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
