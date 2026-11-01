/**
 * DATA: the player's home inside (a room in the interiors), and the furniture
 * that can be bought at the mall and shows up there. Positions are in the
 * room's own coordinates (x across, z from the back wall to the door).
 * Models come from `models/meshy/furniture/<id>.glb`; until one loads, a
 * simple coloured block stands in.
 */

export interface FurnitureFit {
  /** The most room the model may take on its widest side, metres (the models are real size). */
  width: number;
  x: number;
  z: number;
  rotY: number;
  /** Stand-in block: width, height, depth and colour. */
  box: [number, number, number, string];
}

export const HOME_ROOM = { w: 12, d: 9 };

export const FURNITURE: Record<string, FurnitureFit> = {
  bed: { width: 2.0, x: -4.6, z: -2.9, rotY: 0, box: [1.1, 0.55, 2, '#7aa6d8'] },
  sofa: { width: 1.8, x: 3.4, z: -0.2, rotY: Math.PI, box: [1.9, 0.8, 0.85, '#e07a5f'] },
  tv: { width: 1.4, x: 3.4, z: -3.9, rotY: 0, box: [1.4, 1.1, 0.45, '#2b2f36'] },
  table: { width: 2.0, x: -2.2, z: 1.4, rotY: 0, box: [1.2, 0.75, 1.2, '#b98b5e'] },
  bookshelf: { width: 1.0, x: -5.6, z: 1.6, rotY: Math.PI / 2, box: [1.1, 1.8, 0.35, '#8a5a3c'] },
  desk: { width: 1.1, x: 5.4, z: 2.6, rotY: -Math.PI / 2, box: [1.3, 0.75, 0.65, '#d9b48a'] },
  rug: { width: 2.0, x: 3.4, z: -2.1, rotY: 0, box: [2.2, 0.03, 2.2, '#f2c14e'] },
  plant: { width: 1.0, x: 5.4, z: -3.9, rotY: 0, box: [0.6, 1.3, 0.6, '#4f9d5a'] },
  fridge: { width: 0.7, x: 0.9, z: -4.0, rotY: 0, box: [0.75, 1.7, 0.7, '#e8eef2'] },
  lamp: { width: 0.62, x: -2.9, z: -3.9, rotY: 0, box: [0.4, 1.6, 0.4, '#f7e3a1'] },
};
export const FURNITURE_IDS = Object.keys(FURNITURE);
