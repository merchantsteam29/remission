# REMISSION

Dr. Adrian Hale made a cure for cancer. Twelve patients, twelve remissions. Then they stopped dying, and so did everyone else.

An open-world, first-person zombie horror shooter for the browser. Nothing to install: open `index.html` through a web server (or install it as an app from the title screen).

**Play:** https://merchantsteam29.github.io/remission/

## The game

- **An overrun city** to walk across: a 7 × 7 grid of blocks inside the army's quarantine wall. Towers, wrecked cars, burning cars, a bus, the park with the helicopter crash, the army checkpoint on Bell Street, corner shops, and five buildings you can go into: Halcyon Biotech, the 9th Precinct, St. Agnes Hospital, your apartment building (Harrow Court), and the shops.
- **The story** in eight chapters: wake up in your office at Halcyon nine days after the outbreak, get guns, find Dr. Ines Kaur, go home for your notes (and Mara), find Noah, the first patient, and go back to where it started. A boss (the Mass), notes and voice memos to find, and two endings.
- **Five guns:** M19 pistol (semi-auto), K-9 SMG (submachine gun), service rifle (automatic), hunting rifle .308 (sniper, scoped, goes through three), and the door gun (heavy: a minigun torn off the helicopter that spins up). Plus a knife to shove them back.
- **Day and night:** a full day is 20 minutes. By night the fog comes in, the runners come out and hunt by sight (your flashlight gives you away), and things happen in the dark: something under the car, something behind you, a child down the street, a voice on the radio.
- **Jump scares**, placed and random: lockers, a corridor where the lights go out, a body bag, the bathroom mirror at home.
- **A gore slider, 0 to 100:** Off (no blood at all, the dead just fall), Low, Medium (limbs come off, heads come off), High (heads burst, pieces, blood on your screen), Extreme (as much as it can, bodies stay in the street). Set on the first screen and in Settings.
- Checkpoints, mouse and keyboard, controllers (Xbox, PlayStation, Steam Deck / Steam Controller), touch screens, progress sync and achievements, installable as an app.

## Controls

| | Keyboard / mouse | Controller |
|---|---|---|
| Move / look | WASD / mouse | sticks |
| Run / jump | Shift / Space | L3 / A |
| Fire / aim | left / right click | RT / LT |
| Reload | R | X |
| Switch gun | 1-5, Q, wheel | Y, D-pad ← → |
| Knife | V, middle click | B, R3 |
| Use | E | A |
| Flashlight | F | LB |
| Medkit | H | RB, D-pad ↑ |
| Map | M | View, D-pad ↓ |

## Files

- `js/city.js` the city: blocks, towers, interiors, props, lights, and the 0.5 m height grid that walking, bullets, sight and paths all use
- `js/zombies.js` the dead: rigs, hit capsules, dismemberment, the AI, the shared flow field
- `js/weapons.js` the five guns: models, firing, recoil, reloads, tracers
- `js/boss.js` the Mass
- `js/story.js` chapters, objectives, conversations, notes, triggers, scares, endings
- `js/main.js` the loop: player, day/night, lights, HUD, map, saves, menus
- `js/gore.js`, `js/tex.js`, `js/audio.js` (all sound is synthesised), `js/input.js`, `js/voice.js`

## Running and testing

```
node serve.js              # http://localhost:8080
node tools/smoke.mjs       # boot + look around the city
node tools/play.mjs        # the whole story, every gun, the boss, an ending, a death
node tools/fight.mjs       # a horde at gore 100, day and night
node tools/ui.mjs          # menus, gore slider, controllers, scope, map, phone layout
node tools/icons.mjs       # icons and cover.png
```

The tests need Chrome. Headless Chrome renders in software, so they wait on game state rather than fixed times.
