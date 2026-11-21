// The story of REMISSION: Dr. Adrian Hale made REM-7, a virus that teaches cancer to die. It worked. Then the
// trial patients died, and got up. Nine days later he wakes on the floor of his office.
//
// Each step has an objective, a place it points at, and what happens there. Interactables (E) and triggers
// (walk into a circle) move it on. Scares are triggers too. Notes and tapes are optional, there to be found.
import { W } from './city.js';

export const NOTES = {
  memo1: { title: 'Voice memo - REM-7, day 1', html: `<p class="hand">[Your own voice. You sound so happy.]</p><p>Trial REM-7, day one. Twelve patients, all terminal, all out of options. The virus carries one instruction: find the cell that won't stop dividing, and switch it off.</p><p>Patient 0119 is Noah Reyes. Nine. Leukaemia, third relapse. He asked me if it would hurt. I said no.</p><p>I gave him the first dose myself, a week before the board signed off. If they find out, they find out.</p>` },
  memo2: { title: 'Voice memo - REM-7, day 19', html: `<p>Every patient in full remission. Every one. Noah's bloods are cleaner than mine.</p><p>The only odd thing: wounds close too fast. A cannula site healed over the needle. Tissue doesn't seem to want to stop. I've asked Kaur to run the sequencing again.</p><p class="small">[A long pause.]</p><p>It's fine. It's working.</p>` },
  memo3: { title: 'Voice memo - REM-7, day 31', html: `<p>Patient 0104 died at 3:10 this morning. Heart. At 3:52 she sat up in the cold room and bit the orderly through the hand.</p><p>REM-7 didn't stop the cells dying. It stopped them <b>knowing</b> they had died. They keep going. The body keeps going.</p><p>I've moved the notes home. If the board gets them they'll burn them, and then there's no way back from this.</p><p>Noah has a fever. He keeps asking for me.</p>` },
  brandt: { title: 'Incident report, 9th Precinct', html: `<p>Day 3. Responded to Halcyon Biotech, 14 units. Subjects do not respond to commands, pain or gunfire to center mass. <b>Head shots only.</b></p><p>Day 5. Lost Ortiz and Pell at the hospital. The army took the north side. We have the precinct, the armory and nineteen officers.</p><p>Day 6. Eleven.</p><p>Day 8. Going out for supplies with Brandt. If I'm not back, the armory key is on me. Don't let them have the guns. <span class="small">- Sgt. D. Okafor</span></p>` },
  orders: { title: 'Orders, checkpoint BELL-4', html: `<p>CONTAINMENT DIRECTIVE 7. The quarantine wall is sealed. No civilian is to pass the checkpoint in either direction.</p><p>Priority target: <b>Dr. Adrian Hale</b>, Halcyon Biotech. Bring him in alive. His research is the only route to a countermeasure.</p><p>Secondary: <b>Patient 0119</b> (minor, male). Recover for study. Do not engage at close range. Do not let it near the others.</p><p class="small">Handwritten underneath: "they all go quiet when the kid is near. like they're listening to him."</p>` },
  chart: { title: 'Patient chart, St. Agnes ward A', html: `<p>REYES, Noah. 9 y. Transferred from Halcyon (Dr. Hale), REM-7 trial.</p><p>Day 28: temp 41.2. Day 29: no pulse recorded at 02:14. Day 29, 02:31: <b>patient sitting up, calm, talking.</b> Asked for Dr. Hale. Asked if he was "better now".</p><p>Day 30: patient no longer in bed. Restraints intact. Ward A staff: unaccounted.</p>` },
  mara: { title: 'Tape on the kitchen table', html: `<p class="hand">[Mara. The answering machine tape.]</p><p>Adrian, it's me again. They're saying it on the news, they're saying the name of your company. Are you all right? Please call.</p><p>I went to St. Agnes to look for you. There was a little boy in the corridor in a hospital gown and he knew my name. He said <b>you</b> told him.</p><p>He touched my hand. It's only a scratch. I'm going to lie down. Come home.</p>` },
  notes: { title: 'Your sequencing notes', html: `<p>REM-7 master sequence, revision 14. The original construct, before the board's "improvements".</p><p>In the margin, in your writing: <b>"Reversal possible? Needs the founder strain - the first host's own tissue. 0119."</b></p><p>Underneath, newer, shakier: "If it comes to it, burn this. Burn me with it."</p>` },
  flight: { title: 'Flight log, ARMY 6-2', html: `<p>Day 8, 21:40. Asset 0119 secured in transport case. Lifting from St. Agnes roof.</p><p>21:46. Case is open. Case is OPEN. Sgt. Ruiz says it smiled at him. Ruiz is not talking. Ruiz is</p><p class="small">[The rest is blood.]</p><p class="small">Scratched into the door panel by a fingernail: GOING HOME</p>` },
  gus: { title: 'A note taped to the gun safe', html: `<p>Doc - if you're reading this you came back. I kept your spare key. Mara wouldn't open up.</p><p>Combination's your anniversary, she told me once. Take the .308. It's the one thing I own that ever did any good.</p><p>I'm going to sit down a minute. My arm's gone funny. <span class="small">- Gus</span></p>` },
  shop1: { title: 'Written on a receipt roll', html: `<p>Day 4. Me + Tash in the stockroom. They can't do the door handle. They just lean on it.</p><p>Day 6. Heard a little kid outside singing. Tash wanted to open up. I said kids don't sing at 3am.</p><p>Day 7. Tash opened up.</p>` },
  shop2: { title: 'A flyer, pinned to the counter', html: `<p><b>ST. AGNES RELIEF STATION</b><br>Dr. I. Kaur is broadcasting on 104.1 FM every hour. Do NOT approach the army checkpoints. Do NOT travel at night: <b>the fast ones only come out at night.</b></p><p>If you are bitten, you have about ten days. Come anyway. We may be able to help.</p>` },
};

export const CAST_LINES = {}; // (filled below for reference)

export const ENDINGS = {
  remission: { title: 'REMISSION', lines: [
    'You give Ines the dose. She doesn\'t argue. She just takes it, and her hands shake.',
    'By morning you can\'t feel your fingers. By noon you can\'t remember her name, only that she was kind.',
    'Ines keeps her promise. She does it quickly.',
    'Eleven weeks later, the first reversed patient opens his eyes in St. Agnes and asks where he is. Then a hundred. Then the wall comes down.',
    'There is a plaque at Halcyon now. It has your name on it, and Noah\'s. Someone keeps leaving flowers.',
  ], foot: 'You gave the cure away.' },
  relapse: { title: 'RELAPSE', lines: [
    'You take the dose. It burns all the way up your arm, and then it doesn\'t, and you can feel your fingers again.',
    'Ines tries to culture more from what is left. The founder strain is gone: you used it. Noah is gone: you shot him.',
    'You walk out of St. Agnes into a city of millions who will never stop walking.',
    'You were always going to make it. That was the whole idea.',
  ], foot: 'You kept the cure for yourself.' },
};
export const DEATHS = {
  bitten: { title: 'BITTEN', learn: 'They\'re slow by day. Back off, aim for the head, and don\'t let two get close at once. V (or B) shoves them back.' },
  torn: { title: 'TORN APART', learn: 'At night the fast ones hunt by sight. Keep your flashlight off when you can, and stay off the open avenues.' },
  growth: { title: 'CRUSHED', learn: 'The Growths are slow but hit like a truck. Keep moving and empty a magazine into the head.' },
  mass: { title: 'TAKEN BACK', learn: 'Shoot the glowing tumours on the Mass. Stay out of reach of its arms when they rear up.' },
};

// a step: main objective, sub-lines, where the marker points
export function createStory(g) {
  const S = { step: 0, flags: {}, notes: {}, talked: {} };
  const M = W.marks;
  const steps = [
    /* 0 */ { main: 'Wake up', sub: ['Find something to defend yourself with', 'Security is across the hall'], at: () => M.lockers },
    /* 1 */ { main: 'Get out of Halcyon', sub: ['The lobby is to the north'], at: () => M.halcyonDoor },
    /* 2 */ { main: 'The 9th Precinct', sub: ['Kaur: the police armory, west on 2nd Avenue'], at: () => M.precinctDoor },
    /* 3 */ { main: 'The armory', sub: ['Find the armory key', 'Sgt. Okafor went out for supplies'], at: () => S.flags.key ? M.armory : M.okafor },
    /* 4 */ { main: 'Checkpoint BELL-4', sub: ['The army checkpoint on Bell Street', 'Rifles in the tent'], at: () => M.tent },
    /* 5 */ { main: 'Hold the checkpoint', sub: ['They heard the floodlights come on'], at: () => M.checkpoint },
    /* 6 */ { main: 'St. Agnes Hospital', sub: ['Dr. Ines Kaur is in the isolation lab'], at: () => S.flags.inHospital ? M.glass : M.hospitalDoor },
    /* 7 */ { main: 'Go home', sub: ['Your notes: Harrow Court, north-west', 'Mara'], at: () => S.flags.home ? M.notes : M.apartmentDoor },
    /* 8 */ { main: 'The helicopter', sub: ['Noah\'s bracelet last pinged in the park', 'Where the army helicopter came down'], at: () => M.heli },
    /* 9 */ { main: 'He went home', sub: ['Back to Halcyon', 'The cold storage, where the trial ward was'], at: () => S.flags.storageOpen ? M.mass : M.halcyonDoor },
    /* 10 */ { main: 'The Mass', sub: ['Shoot the tumours, then what is inside'], at: () => M.mass },
    /* 11 */ { main: 'Take what you came for', sub: ['A sample of the founder strain'], at: () => M.mass },
    /* 12 */ { main: 'St. Agnes', sub: ['Bring the sample and the notes to Kaur'], at: () => M.glass },
  ];
  M.okafor = { x: -78, z: 9 };
  const CH = [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 7, 7, 8]; // which chapter each step belongs to
  const CH_TITLES = ['', 'I. WAKE', 'II. THE PRECINCT', 'III. BELL STREET', 'IV. ST. AGNES', 'V. HARROW COURT', 'VI. THE PARK', 'VII. HALCYON', 'VIII. REMISSION'];
  const chapter = () => CH[S.step] || 1;

  function go(n) {
    const oldCh = chapter();
    S.step = n; g.objective(true);
    if (chapter() !== oldCh) g.chapterCard(CH_TITLES[chapter()]);
    enter(n);
    g.checkpoint();
  }
  // what's placed in the world when a step starts (also re-run when you load at that step)
  function enter(n) {
    if (n === 1) { // the lobby has guests
      g.spawn('walker', -8, 97, { state: 'idle', outfit: 'doctor', scripted: true });
      g.spawn('walker', 6, 99, { state: 'idle', scripted: true, feeding: true });
      g.spawn('walker', 14, 95, { state: 'wander', outfit: 'patient', scripted: true });
    }
    if (n === 2) { g.corpse(M.okafor.x, M.okafor.z, 1.2, 'cop', { face: true }); }
    if (n === 3) {
      if (!S.flags.key) g.corpse(M.okafor.x, M.okafor.z, 1.2, 'cop', { face: true });
      g.spawn('walker', -98, -8, { outfit: 'cop', scripted: true }); g.spawn('walker', -110, -10, { outfit: 'cop', scripted: true, feeding: true });
      g.spawn('walker', -121, -11, { outfit: 'cop', scripted: true }); g.spawn('walker', -108, 10, { scripted: true });
    }
    if (n === 4 || n === 5) {
      g.corpse(M.checkpoint.x + 3, M.checkpoint.z - 4, 0.3, 'soldier'); g.corpse(M.checkpoint.x - 4.5, M.checkpoint.z + 2, 2.1, 'soldier', { missing: ['armL'] });
      g.corpse(M.checkpoint.x + 0.5, M.checkpoint.z + 7.5, 4, 'soldier', { face: true });
    }
    if (n === 6) {
      g.spawn('walker', 98, -118, { outfit: 'doctor', scripted: true }); g.spawn('walker', 100, -104, { outfit: 'patient', scripted: true });
      g.spawn('walker', 124, -124, { outfit: 'patient', scripted: true, feeding: true }); g.spawn('runner', 128, -126, { outfit: 'patient', scripted: true, state: 'idle' });
      g.corpse(110, -97, 1, 'doctor'); g.corpse(97, -126, 0.4, 'patient');
    }
    if (n === 7) {
      g.spawn('walker', -112, -160, { scripted: true }); g.spawn('walker', -112, -178, { scripted: true, feeding: true });
      if (!S.flags.gusDone) S.gus = g.spawn('walker', -99.5, -158.5, { outfit: 'gus', scripted: true, state: 'idle', heading: 0 });
    }
    if (n === 8) { g.corpse(M.heli.x + 2.5, M.heli.z + 3, 1, 'soldier', { missing: ['head'] }); g.corpse(M.heli.x - 2, M.heli.z + 4.5, 2.5, 'soldier'); }
    if (n === 9 || n === 10 || n === 11) {
      g.door('storage', true); S.flags.storageOpen = true;
      g.spawn('walker', -12, 105, { scripted: true, outfit: 'patient' }); g.spawn('walker', 12, 105, { scripted: true, outfit: 'doctor' }); g.spawn('runner', 0, 98, { scripted: true, outfit: 'patient' });
    }
    if (n === 10 || n === 11) g.boss(n === 11);
    if (n === 12) { /* Kaur waits */ }
  }

  // ---------- things you use ----------
  const I = [
    { id: 'pistol', at: () => M.lockers, label: 'Open the guard\'s locker', when: () => S.step === 0, use() {
      g.give('pistol'); g.ammo('pistol', 24); g.toast('M19 PISTOL  -  SEMI-AUTO'); g.hint('Click to fire, right click to aim, R to reload. Aim for the head.');
      // the next locker bursts open
      setTimeout(() => { const z = g.spawn('walker', 4.4, 114.6, { outfit: 'guard', scripted: true, state: 'chase', heading: Math.PI }); g.scare(z, 0.8); }, 1400);
      go(1);
    } },
    { id: 'memo2', at: () => M.labB, label: 'Play the voice memo', when: () => !S.notes.memo2, use() { g.note('memo2'); } },
    { id: 'memo1', at: () => M.office, label: 'Play the voice memo on your desk', when: () => !S.notes.memo1, use() { g.note('memo1'); } },
    { id: 'okafor', at: () => M.okafor, label: 'Search Sgt. Okafor', when: () => (S.step === 2 || S.step === 3) && !S.flags.key, use() {
      S.flags.key = true; g.toast('ARMORY KEY'); g.note('brandt'); if (S.step === 2) go(3); else g.objective(true);
    } },
    { id: 'armoryDoor', at: () => M.armoryDoor, label: () => S.flags.key ? 'Unlock the armory' : 'Locked. The armory.', when: () => !S.flags.armoryOpen, use() {
      if (!S.flags.key) { g.hint('The armory is locked. Sgt. Okafor had the key.'); if (S.step === 2) go(3); return; }
      g.door('armory', true); S.flags.armoryOpen = true; g.sfx('door');
    } },
    { id: 'smg', at: () => M.armory, label: 'Take the K-9 SMG', when: () => S.flags.armoryOpen && !S.flags.smg, use() {
      S.flags.smg = true; g.give('smg'); g.ammo('smg', 96); g.ammo('pistol', 36); g.toast('K-9 SMG  -  SUBMACHINE GUN');
      g.radio([['KAUR', 'Adrian. If you have guns now, use them to get to me. St. Agnes, the north-east. I am in the isolation lab.'], ['KAUR', 'The army had a checkpoint on Bell Street. They are all dead now, but their rifles aren\'t.']], () => go(4));
    } },
    { id: 'rifle', at: () => M.tent, label: 'Take the service rifle', when: () => S.step === 4, use() {
      g.give('rifle'); g.ammo('rifle', 90); g.toast('SERVICE RIFLE  -  AUTOMATIC'); g.note('orders');
      g.floodlights(); setTimeout(() => { g.horde(10, 0.25); go(5); S.flags.holdT = 40; }, 1600);
    } },
    { id: 'chart', at: () => M.wardA, label: 'Read the chart', when: () => !S.notes.chart, use() { g.note('chart'); } },
    { id: 'kaur', at: () => M.glass, label: 'Talk to Dr. Kaur', when: () => S.step === 6 || S.step === 12, use() { S.step === 6 ? kaur1() : kaur2(); } },
    { id: 'maratape', at: () => ({ x: -118, z: -185.8 }), label: 'Play the tape', when: () => !S.notes.mara && S.flags.home, use() { g.note('mara'); } },
    { id: 'notes', at: () => M.notes, label: 'Take your notes', when: () => S.step === 7 && !S.flags.notes, use() {
      S.flags.notes = true; g.note('notes'); g.toast('SEQUENCING NOTES');
      setTimeout(() => g.radio([['KAUR', 'Adrian, listen. The army fitted every trial patient with an ID bracelet. Noah\'s pinged two days ago.'], ['KAUR', 'The park, in the middle of the city. Where their helicopter came down. Be careful. It\'s dark soon.']], () => go(8)), 2500);
    } },
    { id: 'gussafe', at: () => M.gusSafe, label: 'Open Gus\'s gun safe', when: () => S.step >= 7 && !S.flags.sniper, use() {
      S.flags.sniper = true; g.give('sniper'); g.ammo('sniper', 15); g.toast('HUNTING RIFLE .308  -  SNIPER'); g.note('gus'); g.hint('Right click to look through the scope. It goes through three of them.');
    } },
    { id: 'minigun', at: () => M.heli, label: 'Tear the door gun off its mount', when: () => S.step === 8, use() {
      g.give('minigun'); g.ammo('minigun', 200); g.toast('DOOR GUN  -  HEAVY WEAPON'); g.note('flight'); g.hint('Hold fire (or aim) to spin it up. You move slower carrying it.');
      setTimeout(() => { g.horde(14, 0.4); g.noah(M.park.x - 14, M.park.z + 16, { dur: 3 }); }, 2500);
      setTimeout(() => g.radio([['KAUR', 'Going home. Adrian, he means Halcyon. He means you.']], () => go(9)), 9000);
    } },
    { id: 'sample', at: () => ({ x: M.mass.x, z: M.mass.z - 3.3 }), label: 'Take a sample of the founder strain', when: () => S.step === 11, use() {
      S.flags.sample = true; g.toast('FOUNDER STRAIN SAMPLE'); g.say('HALE', 'I\'m sorry, Noah. I said it wouldn\'t hurt.', 4);
      setTimeout(() => go(12), 3000);
    } },
    // the shops' notes
    { id: 'shop1', at: () => M.shop0, label: 'Read the receipt roll', when: () => !S.notes.shop1 && !!M.shop0, use() { g.note('shop1'); } },
    { id: 'shop2', at: () => M.shop3, label: 'Read the flyer', when: () => !S.notes.shop2 && !!M.shop3, use() { g.note('shop2'); } },
    { id: 'memo3', at: () => M.study && { x: M.study.x + 0.5, z: M.study.z + 3 }, label: 'Play the voice memo', when: () => !S.notes.memo3 && S.flags.home, use() { g.note('memo3'); } },
  ];

  // ---------- conversations ----------
  function kaur1() {
    if (S.talked.k1) return; S.talked.k1 = true;
    g.talk([
      ['KAUR', 'Adrian. Oh, thank God. Stay on that side of the glass. I am not taking chances with anybody, not even you.'],
      ['HALE', 'Ines. How bad is it?'],
      ['KAUR', 'The whole city. The army walled it off on day five. They\'re waiting for us to finish dying so they can burn it.'],
      ['KAUR', 'REM-7 isn\'t a virus any more, it\'s a program. It tells dead tissue to keep running. But programs can be rewritten.'],
      ['KAUR', 'I need two things. Your original sequence. Not the board\'s version. Yours.'],
      ['HALE', 'It\'s at my flat. In the study.'],
      ['KAUR', 'And tissue from the founder strain. The first host. You know who that is.'],
      ['HALE', 'Noah.'],
      ['KAUR', 'He walked out of ward A on day thirty, Adrian. Bring me your notes first. Then we find him.'],
    ], () => go(7));
  }
  function kaur2() {
    if (S.talked.k2) return; S.talked.k2 = true;
    g.talk([
      ['KAUR', 'Put it in the hatch. Slowly.'],
      ['KAUR', 'It\'s viable. Adrian, it\'s viable. Give me an hour.'],
      ['NARRATOR', 'An hour. You sit against the glass. Your arm itches under the bandage you don\'t remember putting on.'],
      ['KAUR', 'There\'s one dose. One. It will take weeks to grow more from it, and the culture has to come from this one.'],
      ['KAUR', 'Adrian, roll up your sleeve.'],
      ['HALE', 'Day nine. It\'s a bite. I think it happened in the office, the first night. I think I knew.'],
      ['KAUR', 'Then you understand. If I culture it, millions of people get to wake up. If you take it, you do.'],
    ], () => g.choice());
  }

  // ---------- triggers: walk into these ----------
  const T = [
    { id: 'leaveHalcyon', at: () => ({ x: 0, z: 89 }), r: 4, when: () => S.step === 1, run() {
      g.radio([['KAUR', 'This is Doctor Ines Kaur, St. Agnes Hospital. If anyone can hear this, the hospital is safe. Come to the west door.'], ['KAUR', 'Adrian, if you are alive, if you are still at Halcyon. I need you. Get guns. The police precinct on 2nd Avenue had an armory.']], () => go(2));
    } },
    { id: 'precinctNear', at: () => M.precinctDoor, r: 7, when: () => S.step === 2, run() { go(3); g.hint('The precinct. The armory will be locked.'); } },
    { id: 'flicker', at: () => M.flicker, r: 2.2, when: () => S.step >= 2 && !S.flags.flickered, run() {
      S.flags.flickered = true; g.lightsOut(M.flicker.x, M.flicker.z, 14, 2.4);
      setTimeout(() => { const z = g.spawn('walker', M.flicker.x - 2.2, M.flicker.z, { outfit: 'cop', scripted: true, state: 'chase', heading: Math.PI / 2 }); g.scare(z, 0.9); }, 2400);
    } },
    { id: 'inHospital', at: () => ({ x: 99, z: -112 }), r: 5, when: () => S.step === 6 && !S.flags.inHospital, run() { S.flags.inHospital = true; g.objective(true); } },
    { id: 'gurney', at: () => M.gurney, r: 2.0, when: () => S.step >= 6 && !S.flags.gurney, run() {
      S.flags.gurney = true;
      const z = g.spawn('walker', M.gurney.x - 2.8, M.gurney.z - 5.5, { outfit: 'patient', scripted: true, state: 'chase' }); g.scare(z, 1);
    } },
    { id: 'home', at: () => ({ x: -112, z: -151 }), r: 3, when: () => S.step === 7 && !S.flags.home, run() { S.flags.home = true; g.objective(true); g.say('HALE', 'Mara? Mara, it\'s me.', 3); } },
    { id: 'mirror', at: () => M.bath, r: 1.7, when: () => S.flags.home && !S.flags.mara, run() {
      S.flags.mara = true;
      g.say('MARA', 'Adrian?', 2); g.whisper();
      setTimeout(() => { const z = g.spawn('walker', -116.5, -166, { outfit: 'mara', scripted: true, state: 'chase', heading: Math.PI }); z.hp = 140; g.scare(z, 1); g.say('HALE', 'No. No no no.', 3); }, 1500);
    } },
    { id: 'gus', at: () => ({ x: -103, z: -169 }), r: 3, when: () => S.flags.home && S.gus && S.gus.state !== 'dead' && !S.flags.gusDone, run() {
      S.flags.gusDone = true; if (S.gus) { S.gus.state = 'chase'; S.gus.seen = 1; }
    } },
    { id: 'parkNoah', at: () => ({ x: M.park.x, z: M.park.z + 20 }), r: 10, when: () => S.step === 8 && !S.flags.parkNoah, run() { S.flags.parkNoah = true; g.noah(M.heli.x + 6, M.heli.z - 10, { dur: 2.5, giggle: true }); } },
    { id: 'halcyonNoah', at: () => ({ x: 0, z: 101 }), r: 3, when: () => S.step === 9 && !S.flags.halNoah, run() {
      S.flags.halNoah = true; g.lightsOut(0, 105, 30, 1.6); g.noah(0, 110.5, { dur: 1.5, face: true });
      setTimeout(() => g.noahBehind(), 6000);
    } },
    { id: 'massRoom', at: () => ({ x: 0, z: 118 }), r: 2.5, when: () => S.step === 9, run() { go(10); } },
  ];

  function update(dt) {
    const P = g.P;
    for (const t of T) {
      if (!t.when()) continue;
      const a = t.at(); if (!a) continue;
      if (Math.hypot(P.x - a.x, P.z - a.z) < t.r) t.run();
    }
    if (S.step === 5) { // hold the checkpoint
      S.flags.holdT -= dt;
      if (S.flags.holdT < 25 && !S.flags.wave2) { S.flags.wave2 = true; g.horde(8, 0.35); }
      if (S.flags.holdT <= 0 && (g.liveNear(25) <= 3 || S.flags.holdT < -40)) { g.radio([['KAUR', 'I heard that from here. Adrian, come to the hospital. Please hurry.']], () => go(6)); S.flags.holdT = 9999; }
    }
  }
  function objective() {
    const s = steps[S.step] || steps[0];
    return { main: s.main, sub: s.sub, at: s.at ? s.at() : null };
  }
  return { S, steps, I, T, go, enter, update, objective, chapter, CH_TITLES, kaur1, kaur2 };
}
