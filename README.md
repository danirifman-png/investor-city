# Investor City (עיר המשקיעים)

A 3D adventure game that teaches kids aged 10–16 about money, business and investing.
All player-facing content is in Hebrew (RTL); code and docs are in English.

The project is built in eight phases. **Done so far:** phase 1 (an explorable 3D city with seven districts),
phase 2 (your own character: creator, walking and running, follow camera, saving),
phase 3 (eight characters with personalities, branching conversations, relationships and errands) and
phase 4 (a bright new look, walk-in pizzeria and bank, Marco's second-branch mission with clues,
calculations, advisors, risks and a reasoned recommendation, a notebook of concepts, and
"Did you know?" discoveries around the city).
The playable-prototype pass adds quests with a quest log, XP and levels, coins, a bag, settings,
a "Quest complete!" screen, the first quest "Meet your first mentor" with Oliver's money
challenge, a waterfall trail that unlocks, a lively crowd, a market square and a new countryside.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Test it

```bash
npm run typecheck
npm test                       # unit tests (layout, localization, save, collision, character, dialogue, mission, progression)
npm run build && npm run test:e2e   # drives the real game in Chromium (needs Playwright installed)
```

The end-to-end test plays the game on a desktop and a phone viewport: it creates a character,
walks and runs (keys or joystick), walks into a building wall, interacts with the stock
exchange, talks with Leo, Marco and Oliver (friendly, rude and apologetic answers, a full
errand that runs through two characters), checks the people journal, travels to all seven
districts, edits the character, saves, reloads and continues, and starts a new game.
It also plays Marco's whole mission: finds a "Did you know?" in the city, walks into the
pizzeria, collects the six clues, solves the calculations (including a wrong answer and a
non-number), consults Daniel and Ben, marks risks, presents a recommendation, reads the
outcome and the concepts, hears Marco's thanks, visits the bank and walks out again.
Finally it plays the first quest: finds the trail gate closed, explores the square, follows the
quest log to Oliver, answers his challenge wrong and then right, checks the "Quest complete!"
rewards, the bag and the settings, walks through the open gate and reaches the waterfall. Screenshots land in `e2e/screenshots/`.

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Walk | W A S D / arrows | Joystick |
| Run | Hold Shift | Push the joystick all the way, or the run button |
| Turn the camera | Q / R, drag with the mouse, or the rotate buttons | Drag with one finger, two-finger twist, or the buttons |
| Zoom | Mouse wheel, + / − | Pinch |
| Talk to a character / look at a building | E, Space or Enter when the prompt shows | Tap the prompt or the character's name tag |
| Answer in a conversation | Number keys 1–4 (Enter continues, Esc leaves) | Tap an answer |
| People of the city (journal, errands, edit character) | People button in the toolbar, or click the errand tracker | Same |
| Notebook (mission, concepts, "Did you know?") | Notebook button in the toolbar, or click the mission tracker | Same |
| Enter / leave a building, read a clue or a discovery | E near the green arrow, an orange !, a blue i or a gold ? | Tap the prompt |
| Building info | Click a building or its label | Tap a building or its label |
| Travel | Open the map and pick a district | Same |
| Save | Toolbar button (the game also autosaves) | Same |

Add `?quality=low` or `?quality=high` to the URL to force a graphics level.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organised.
