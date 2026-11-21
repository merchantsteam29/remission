// Boots the published site and checks it reaches the title and starts a game with no console errors.
import { open, sleep } from './harness.mjs';
process.env.SH_URL = 'https://merchantsteam29.github.io/remission/';
const { ev, shot, check, done } = await open(import.meta.url);
for (let i = 0; i < 120 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
check(await ev('return document.body.dataset.ready') === '1', 'live site booted');
await ev(`document.getElementById('warnOk').click(); __s.endIntro()`); await sleep(4000);
check(await ev('return __s.mode') === 'play', 'live game starts');
await shot('live');
await done();
