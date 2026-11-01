import { t } from '../../i18n';
import type { Frame } from '../Frame';
import type { BuildContext } from '../types';

/**
 * Furniture for the walk-in rooms, in each room's own coordinates (see
 * content/interiors.ts: x across, back wall at -d/2, door at +d/2). Walls are
 * added by Interiors.ts. Everything a clue or discovery points at is a real
 * object here, so the markers hover over something you can recognise.
 */

/* ------------------------------ pizzeria ------------------------------ */

export function buildPizzeriaInterior(f: Frame, ctx: BuildContext): void {
  // checkered floor (walkable, no collision)
  ctx.batch.noCollision(() => {
    for (let x = -7; x < 7; x++) {
      for (let z = -5; z < 5; z++) {
        f.box(1, 0.04, 1, (x + z) % 2 === 0 ? '#f4ece0' : '#c4473a', { x: x + 0.5, z: z + 0.5 });
      }
    }
  });

  // service counter with a marble top; the ledger and the register sit on it
  f.box(5.6, 1.0, 0.9, '#8a5a3b', { x: 1.6, z: -1.2 });
  f.box(5.8, 0.08, 1.0, '#ebe5da', { x: 1.6, z: -1.2, y: 1.0 });
  ctx.batch.noCollision(() => {
    // ledger: a red book with cream pages
    f.box(0.55, 0.07, 0.4, '#7a2a2a', { x: 0.2, z: -1.2, y: 1.08, rotY: 0.2 });
    f.box(0.5, 0.05, 0.36, '#f5f0e2', { x: 0.2, z: -1.2, y: 1.12, rotY: 0.2 });
    // register with a glowing screen
    f.box(0.6, 0.32, 0.5, '#3a3f4a', { x: 3.4, z: -1.2, y: 1.08 });
    f.box(0.42, 0.22, 0.04, '#7df0c0', { x: 3.4, z: -0.98, y: 1.42, rotX: -0.3 }, 'glow');
    // pizza on a stand
    f.cyl(0.36, 0.36, 0.05, '#e9b45a', { x: 1.8, z: -1.2, y: 1.18 }, 20);
    f.cyl(0.32, 0.32, 0.055, '#d8392b', { x: 1.8, z: -1.2, y: 1.2 }, 20);
  });

  // kitchen: prep table and shelves along the back wall
  f.box(4.2, 0.9, 0.8, '#c9ced6', { x: 3.2, z: -4.45 });
  ctx.batch.noCollision(() => {
    for (let i = 0; i < 4; i++) f.cyl(0.18, 0.18, 0.3, ['#e9b45a', '#d8392b', '#7cc04b', '#f5f0e2'][i], { x: 1.6 + i * 1.0, z: -4.45, y: 0.9 }, 10);
    f.box(4.2, 0.06, 0.4, '#a3774f', { x: 3.2, z: -4.75, y: 2.2 });
    for (let i = 0; i < 5; i++) f.box(0.35, 0.45, 0.3, ['#f2c14e', '#e34b4b', '#ffffff', '#4fc79a', '#f08a4b'][i], { x: 1.6 + i * 0.8, z: -4.75, y: 2.26 });
  });

  // the brick pizza oven (wood fired) in the corner
  f.model('pizza_oven_brick', { x: -4.6, z: -3.75 });
  ctx.batch.noCollision(() => {
    // oven sticker: max 260 a month
    f.box(0.5, 0.3, 0.02, '#fff3c4', { x: -3.45, z: -2.82, y: 0.55 });
    // flour sacks
    for (let i = 0; i < 3; i++) f.box(0.55, 0.7, 0.4, '#efe6d2', { x: -6.35, z: -2.6 + i * 0.6, rotY: 0.3 * i });
  });

  // the menu board on the left wall, facing the room
  f.box(0.08, 1.7, 2.6, '#2b2f36', { x: -6.8, z: 0.4, y: 1.4 });
  f.sign(t('room.pizzeria.menuTitle'), 2.2, 0.5, { x: -6.74, z: 0.4, y: 2.62, rotY: Math.PI / 2 }, { bg: '#2b2f36', fg: '#ffd96b' });
  f.sign(t('room.pizzeria.menuLine'), 2.3, 0.45, { x: -6.74, z: 0.4, y: 2.05, rotY: Math.PI / 2 }, { bg: '#2b2f36', fg: '#ffffff' });
  f.sign(t('room.pizzeria.menuNote'), 2.0, 0.36, { x: -6.74, z: 0.4, y: 1.55, rotY: Math.PI / 2 }, { bg: '#2b2f36', fg: '#9fd0ec' });

  // bistro tables with bentwood chairs; the letter waits on the left one
  f.model('bistro_table_chairs', { x: -3.6, z: 2.2 });
  f.model('bistro_table_chairs', { x: 3.4, z: 2.6, rotY: Math.PI });
  ctx.batch.noCollision(() => {
    f.box(0.32, 0.01, 0.42, '#ffffff', { x: -3.6, z: 2.2, y: 0.76, rotY: -0.4 });
    f.box(0.1, 0.012, 0.06, '#3d7be0', { x: -3.52, z: 2.08, y: 0.765, rotY: -0.4 });
  });

  // savings jar on a wall shelf (right wall)
  f.box(0.5, 0.08, 1.6, '#a3774f', { x: 6.6, z: 0.4, y: 1.3 });
  ctx.batch.noCollision(() => {
    f.cyl(0.18, 0.18, 0.4, '#bfe6ff', { x: 6.55, z: 0.4, y: 1.38 }, 14, 'glass');
    f.cyl(0.15, 0.15, 0.18, '#f5b80f', { x: 6.55, z: 0.4, y: 1.38 }, 12);
    f.box(0.02, 0.18, 0.26, '#fff8d6', { x: 6.34, z: 0.4, y: 1.5 });
    // framed photo (the bitcoin pizza story) on the right wall, behind the counter
    f.box(0.06, 0.9, 1.1, '#6b4a2f', { x: 6.82, z: -3.4, y: 1.6 });
    f.box(0.02, 0.7, 0.9, '#f2c14e', { x: 6.78, z: -3.4, y: 1.7 });
    f.cyl(0.25, 0.25, 0.02, '#d8392b', { x: 6.76, z: -3.4, y: 1.95, rotZ: Math.PI / 2 }, 16);
    // newspaper clipping by the door (the pizza principle)
    f.box(0.04, 0.8, 0.6, '#f5f0e2', { x: -6.82, z: 3.4, y: 1.7 });
    for (let i = 0; i < 4; i++) f.box(0.02, 0.05, 0.45, '#9aa3b5', { x: -6.79, z: 3.4, y: 1.95 - i * 0.14 });
  });
  for (const x of [-2.4, 2.4]) f.model('ficus_plant_pot', { x, z: 4.2, scale: 0.75 });
}

/* -------------------------------- bank -------------------------------- */

export function buildBankInterior(f: Frame, ctx: BuildContext): void {
  ctx.batch.noCollision(() => {
    f.box(16, 0.04, 12, '#ece6da', {});
    // marble pattern and a red carpet from the door to the desk
    for (let x = -8; x < 8; x += 2) for (let z = -6; z < 6; z += 2) if ((x + z) % 4 === 0) f.box(2, 0.045, 2, '#ddd5c6', { x: x + 1, z: z + 1 });
    f.box(2.2, 0.05, 8.2, '#8a2b3a', { z: 1.4 });
    f.box(15.9, 0.6, 0.05, '#c9b27a', { z: -5.83, y: 0.3 });
  });

  // Daniel's desk: a reception desk with a white front and an oak top
  f.model('reception_desk', { z: -2.2, scale: 1.3 });
  f.sign(t('room.bank.deskSign'), 2.2, 0.4, { z: -1.6, y: 0.62 }, { bg: '#c9b27a', fg: '#2b1d0e' });

  // pillars along the side walls
  for (const x of [-7.3, 7.3]) for (const z of [-3.5, 2.5]) f.cyl(0.38, 0.42, 3.4, '#fbf7ee', { x, z }, 14);

  // teller windows on the left, with a queue of brass posts in front
  for (const z of [0.6, 2.6]) f.model('bank_teller_counter', { x: -7.05, z, rotY: Math.PI / 2, scale: 0.62 });
  for (const z of [-0.4, 1.6, 3.6]) f.model('brass_queue_post', { x: -5.2, z, solid: false });

  // the vault door on the back wall (left), and the interest-rate board (right)
  f.model('vault_door', { x: -5.5, z: -5.45 });
  f.box(3.2, 2.0, 0.1, '#1f2a44', { x: 3.4, z: -5.8, y: 1.6 });
  f.sign(t('room.bank.ratesTitle'), 2.8, 0.45, { x: 3.4, z: -5.72, y: 3.1 }, { bg: '#1f2a44', fg: '#ffd96b' });
  f.sign(t('room.bank.rateSave'), 2.8, 0.4, { x: 3.4, z: -5.72, y: 2.55 }, { bg: '#1f2a44', fg: '#7df0c0' });
  f.sign(t('room.bank.rateBusiness'), 2.8, 0.4, { x: 3.4, z: -5.72, y: 2.05 }, { bg: '#1f2a44', fg: '#ffb0a0' });
  f.sign(t('room.bank.rateHome'), 2.8, 0.4, { x: 3.4, z: -5.72, y: 1.55 }, { bg: '#1f2a44', fg: '#ffffff' });

  // coin display case (the history of the shekel)
  f.box(0.9, 1.0, 0.9, '#6b4a2f', { x: 5.5, z: -2.5 });
  ctx.batch.noCollision(() => {
    f.box(0.86, 0.45, 0.86, '#bfe6ff', { x: 5.5, z: -2.5, y: 1.0 }, 'glass');
    for (let i = 0; i < 3; i++) f.cyl(0.12, 0.12, 0.03, i === 1 ? '#c0c7d4' : '#e7b83c', { x: 5.25 + i * 0.25, z: -2.5, y: 1.05 }, 14);
  });
  // leather armchairs by the door, a globe and tall plants
  for (const x of [-4.6, 4.6]) f.model('leather_armchair', { x, z: 4.5, rotY: Math.PI, scale: 0.8 });
  f.model('standing_globe', { x: 6.3, z: 0.4 });
  for (const x of [-7.2, 7.2]) f.model('ficus_plant_pot', { x, z: 5.1 });
}


/* -------------------------------- home --------------------------------- */

/** The player's home: a small kitchen corner; the rest is furnished with what the player buys (see Interiors.setFurniture). */
export function buildHomeInterior(f: Frame, ctx: BuildContext): void {
  // kitchen counter with a sink and a little stove along the back wall
  f.box(2.6, 0.9, 0.65, '#f4f1ea', { x: -1.0, z: -4.1 });
  f.box(2.7, 0.06, 0.72, '#8fb8c9', { x: -1.0, z: -4.1, y: 0.9 });
  ctx.batch.noCollision(() => {
    f.box(0.6, 0.05, 0.4, '#c9d3da', { x: -1.6, z: -4.1, y: 0.94 });
    f.cyl(0.03, 0.03, 0.35, '#c9d3da', { x: -1.6, z: -4.35, y: 0.94 }, 8);
    for (const x of [-0.3, 0.05]) f.cyl(0.13, 0.13, 0.02, '#3a3f4a', { x, z: -4.1, y: 0.94 }, 14);
    f.box(2.6, 0.5, 0.35, '#f4f1ea', { x: -1.0, z: -4.3, y: 1.9 });
    // a welcome mat and a coat hook by the door
    f.box(1.4, 0.02, 0.8, '#b5583a', { x: 0, z: 3.7 });
  });
}
