import { t } from '../../i18n';
import type { Frame } from '../Frame';
import type { BuildContext } from '../types';

/**
 * Furniture for the five mission buildings, in each room's own coordinates
 * (x across, back wall at -d/2, door at +d/2; see content/interiors.ts).
 * The host stands behind a desk near the back; the mission marker hovers over
 * that desk and an info marker over the room's centrepiece.
 */

function floor(f: Frame, ctx: BuildContext, w: number, d: number, a: string, b: string, tile = 2): void {
  ctx.batch.noCollision(() => {
    f.box(w, 0.04, d, a, {});
    for (let x = -w / 2; x < w / 2; x += tile) for (let z = -d / 2; z < d / 2; z += tile) if (Math.round((x + z) / tile) % 2 === 0) f.box(tile, 0.045, tile, b, { x: x + tile / 2, z: z + tile / 2 });
  });
}

function desk(f: Frame, ctx: BuildContext, x: number, z: number, w: number, top: string, body: string, rotY = 0): void {
  f.box(w, 0.78, 0.8, body, { x, z, rotY });
  ctx.batch.noCollision(() => f.box(w + 0.1, 0.06, 0.9, top, { x, z, y: 0.78, rotY }));
}

function screen(f: Frame, ctx: BuildContext, x: number, z: number, y: number, w: number, h: number, glow: string, rotY = 0): void {
  ctx.batch.noCollision(() => {
    f.box(w + 0.08, h + 0.08, 0.06, '#1d2230', { x, z, y, rotY });
    f.box(w, h, 0.02, glow, { x, z: z + Math.cos(rotY) * 0.04, y: y + 0.04, rotY }, 'glow');
  });
}

/* --------------------- the investment academy (shares) --------------------- */

export function buildExchangeInterior(f: Frame, ctx: BuildContext): void {
  floor(f, ctx, 18, 12, '#e9e2d4', '#dcd2bf');
  ctx.batch.noCollision(() => f.box(2.4, 0.05, 9, '#1f3a6b', { z: 1.5 }));
  // the big share board on the back wall
  f.box(10, 3.0, 0.12, '#141b2d', { z: -5.85, y: 1.9 });
  f.sign(t('room.exchange.board'), 9.4, 0.6, { z: -5.76, y: 3.05 }, { bg: '#141b2d', fg: '#ffd96b' });
  const rows: [string, string][] = [
    ['company.marco', '#7df0c0'],
    ['company.wind', '#7df0c0'],
    ['company.startup', '#ffb0a0'],
    ['company.bank', '#7df0c0'],
    ['company.builder', '#ffb0a0'],
  ];
  rows.forEach(([key, color], i) => {
    const x = -3.6 + (i % 3) * 3.6;
    const y = i < 3 ? 2.35 : 1.55;
    f.sign(`${t(key)} ${color === '#7df0c0' ? '▲' : '▼'}`, 3.2, 0.5, { x: i < 3 ? x : x + 1.8, z: -5.76, y }, { bg: '#141b2d', fg: color });
  });
  // Nina's desk with two screens
  desk(f, ctx, 0, -3.0, 3.2, '#2b3550', '#3a4766');
  screen(f, ctx, -0.6, -3.25, 1.25, 0.7, 0.42, '#3fb6e8');
  screen(f, ctx, 0.6, -3.25, 1.25, 0.7, 0.42, '#7df0c0');
  // rows of trading desks, four screens each, with mesh office chairs
  for (const s of [-1, 1]) {
    for (const z of [-0.6, 2.4]) {
      for (const dx of [-0.85, 0.85]) {
        f.model('trading_desk_monitors', { x: s * 5.6 + dx, z, rotY: Math.PI });
        f.model('office_chair', { x: s * 5.6 + dx, z: z - 0.75, solid: false });
      }
    }
  }
  // a bronze bull and bear on plinths by the door
  for (const [x, col] of [[-6.8, '#b07a3a'], [6.8, '#6d4c2f']] as [number, string][]) {
    f.box(1.2, 0.6, 1.2, '#cfc6b4', { x, z: 4.3 });
    ctx.batch.noCollision(() => f.sphere(0.5, col, { x, z: 4.3, y: 1.0 }, 10));
  }
  f.model('ficus_plant_pot', { x: -8.2, z: -5.2 });
  f.model('ficus_plant_pot', { x: 8.2, z: -5.2 });
}

/* ------------------------ the economics academy ------------------------ */

export function buildAcademyInterior(f: Frame, ctx: BuildContext): void {
  floor(f, ctx, 16, 12, '#d8b98f', '#cfae82', 1);
  // chalkboard
  f.box(8, 2.4, 0.1, '#2f5a3e', { z: -5.85, y: 1.8 });
  ctx.batch.noCollision(() => f.box(8.3, 0.12, 0.25, '#8a6a4a', { z: -5.75, y: 0.62 }));
  f.sign(t('room.academy.board'), 7.4, 0.55, { z: -5.78, y: 2.6 }, { bg: '#2f5a3e', fg: '#ffffff' });
  f.sign(t('room.academy.board2'), 7.4, 0.45, { z: -5.78, y: 1.95 }, { bg: '#2f5a3e', fg: '#ffe9a0' });
  f.sign(t('room.academy.board3'), 7.4, 0.45, { z: -5.78, y: 1.4 }, { bg: '#2f5a3e', fg: '#bfe6ff' });
  // the teacher's desk
  desk(f, ctx, 0, -3.3, 2.6, '#a0522d', '#7a3e22');
  ctx.batch.noCollision(() => {
    f.sphere(0.13, '#d8392b', { x: 0.8, z: -3.3, y: 0.95 }, 8);
    f.box(0.5, 0.12, 0.36, '#2f6db5', { x: -0.7, z: -3.3, y: 0.87 });
  });
  // pupils' desks in rows facing the board (an aisle in the middle)
  for (const x of [-5, -3.2, 3.2, 5]) for (const z of [-0.6, 1.4, 3.2]) f.model('classroom_desk_chair', { x, z, rotY: Math.PI });
  // full bookshelves along the side walls
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) f.model('bookshelf_full', { x: s * 7.6, z: -4.0 + k * 0.86, rotY: -s * (Math.PI / 2) });
  // a reading corner: an armchair, the globe and a whiteboard
  f.model('standing_globe', { x: 5.8, z: 4.2, scale: 1.1 });
  f.model('leather_armchair', { x: 6.4, z: 1.6, rotY: -Math.PI / 2, scale: 0.8 });
  f.model('whiteboard_wheels', { x: -6.4, z: 3.6, rotY: Math.PI / 2 });
  f.model('ficus_plant_pot', { x: -7.2, z: 5.0 });
}

/* ---------------------------- the news tower ---------------------------- */

export function buildNewsInterior(f: Frame, ctx: BuildContext): void {
  floor(f, ctx, 14, 10, '#3a3f4f', '#444a5c');
  ctx.batch.noCollision(() => f.box(13.9, 0.6, 0.05, '#d8392b', { z: -4.83, y: 2.9 }));
  // the studio wall of screens
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) screen(f, ctx, -2.4 + i * 2.4, -4.85, 1.4 + k * 1.15, 2.1, 1.0, ['#3fb6e8', '#ffd96b', '#ff8a7a', '#7df0c0', '#a57cf2', '#3fb6e8'][i + k * 3]);
  f.sign(t('room.news.onAir'), 2.2, 0.5, { x: 4.8, z: -4.8, y: 2.6 }, { bg: '#d8392b', fg: '#ffffff' });
  // the anchor desk (Leo's), a studio camera facing it and two softbox lights
  f.model('news_anchor_desk', { z: -2.6 });
  f.model('studio_camera_tripod', { x: 0, z: 1.2, rotY: Math.PI });
  for (const s of [-1, 1]) f.model('studio_softbox_light', { x: s * 2.9, z: 0.0, rotY: Math.PI + s * 0.5 });
  // fact-check corner: a board with pinned notes
  f.box(0.1, 2.0, 3.0, '#c49a6c', { x: -6.85, z: 0.5, y: 1.4 });
  f.sign(t('room.news.check'), 2.6, 0.45, { x: -6.78, z: 0.5, y: 2.2, rotY: Math.PI / 2 }, { bg: '#ffffff', fg: '#20242e' });
  ctx.batch.noCollision(() => {
    for (let i = 0; i < 6; i++) f.box(0.02, 0.36, 0.42, ['#fff36b', '#ffb0a0', '#bfe6ff'][i % 3], { x: -6.78, z: -0.4 + (i % 3) * 0.9, y: 1.1 + Math.floor(i / 3) * 0.55 });
  });
  // the editors' desks
  for (const s of [-1, 1]) {
    f.model('trading_desk_monitors', { x: s * 4.6, z: 1.8, rotY: Math.PI });
    f.model('office_chair', { x: s * 4.6, z: 1.05, solid: false });
  }
  f.model('ficus_plant_pot', { x: 6.2, z: 3.9 });
}

/* ---------------------------- the startup hub ---------------------------- */

export function buildStartupInterior(f: Frame, ctx: BuildContext): void {
  floor(f, ctx, 16, 12, '#f4efe6', '#ebe3d5');
  // colourful wall stripes and an idea board
  ctx.batch.noCollision(() => {
    ['#ff7a59', '#ffc94a', '#4fc79a', '#3fb6e8', '#a57cf2'].forEach((c, i) => f.box(3.2, 3.2, 0.05, c, { x: -6.4 + i * 3.2, z: -5.83, y: 1.6 }));
  });
  f.box(6, 2.0, 0.08, '#ffffff', { z: -5.75, y: 1.8 });
  f.sign(t('room.startup.board'), 5.6, 0.5, { z: -5.7, y: 2.5 }, { bg: '#ffffff', fg: '#ff7a59' });
  ctx.batch.noCollision(() => {
    for (let i = 0; i < 8; i++) f.box(0.5, 0.5, 0.02, ['#fff36b', '#ffb0a0', '#bfe6ff', '#c8f7c5'][i % 4], { x: -2.2 + (i % 4) * 1.45, z: -5.68, y: 1.45 + Math.floor(i / 4) * -0.62 });
  });
  // Maya's standing desk with a laptop
  desk(f, ctx, 0, -3.1, 2.4, '#ffffff', '#4fc79a');
  ctx.batch.noCollision(() => f.box(0.6, 0.03, 0.42, '#c0c7d4', { z: -3.1, y: 0.83 }));
  screen(f, ctx, 0, -3.35, 1.1, 0.56, 0.36, '#bfe6ff', -0.0);
  // beanbags in the lounge
  for (const [x, z, r] of [[-5.6, 2.6, 0.6], [-3.9, 3.7, -0.4], [5.2, 3.6, 2.6]] as const) f.model('beanbag', { x, z, rotY: r, solid: false });
  // a ping-pong table
  f.model('ping_pong_table', { x: 4.6, z: -0.4, rotY: Math.PI / 2, scale: 1.25 });
  // shared tables with chairs, and a whiteboard on wheels
  desk(f, ctx, -4.6, -0.6, 3.0, '#ffffff', '#ffc94a');
  for (const dx of [-0.8, 0.8]) f.model('office_chair', { x: -4.6 + dx, z: 0.2, rotY: Math.PI, solid: false });
  f.model('whiteboard_wheels', { x: 2.2, z: 3.8, rotY: Math.PI + 0.3 });
  f.model('ficus_plant_pot', { x: -7.0, z: -5.0 });
  f.model('ficus_plant_pot', { x: 7.0, z: -5.0 });
}

/* ------------------------- the estate agency ------------------------- */

export function buildEstateInterior(f: Frame, ctx: BuildContext): void {
  floor(f, ctx, 14, 10, '#f6efe4', '#efe5d6');
  ctx.batch.noCollision(() => f.box(4, 0.05, 3, '#e46f8e', { z: 1.6 }));
  // listings on the back wall: little houses with prices
  for (let i = 0; i < 4; i++) {
    const x = -4.5 + i * 3;
    f.box(2.2, 1.6, 0.06, '#ffffff', { x, z: -4.85, y: 1.9 });
    ctx.batch.noCollision(() => {
      f.box(1.0, 0.6, 0.02, ['#f5d38a', '#bfe6ff', '#c8f7c5', '#ffd0dc'][i], { x, z: -4.8, y: 1.85 });
      f.box(1.2, 0.3, 0.02, '#c4553f', { x, z: -4.8, y: 2.3 });
    });
    f.sign(t(`room.estate.listing${i}`), 2.0, 0.32, { x, z: -4.79, y: 1.32 }, { bg: '#ffffff', fg: '#e46f8e' });
  }
  // Ben's desk
  f.model('reception_desk', { z: -2.4, scale: 1.3 });
  // a model of a new neighbourhood on a table
  f.model('architectural_model_table', { x: -4.2, z: 1.2, scale: 1.3 });
  // a sofa and an armchair for clients
  f.model('modern_sofa', { x: 4.4, z: 3.2, rotY: Math.PI });
  f.model('leather_armchair', { x: 2.0, z: 2.0, rotY: -Math.PI / 2 - 0.3, scale: 0.75, solid: false });
  f.model('ficus_plant_pot', { x: 6.0, z: -4.0 });
  f.model('ficus_plant_pot', { x: -6.0, z: -4.0 });
}
