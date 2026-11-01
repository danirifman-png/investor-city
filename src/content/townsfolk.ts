/**
 * DATA: the friendly people who walk around the city. Each has a model, a
 * walking pace and three short lines (`town.<id>.0..2` in he.town.json),
 * mostly small everyday money ideas from their own job.
 */
export interface TownsfolkDef {
  id: string;
  model: string;
  /** Metres per second while walking. */
  pace: number;
  /** Extra collision room (the musician's guitar). */
  radius?: number;
}

export const TOWNSFOLK: TownsfolkDef[] = [
  { id: 'grandma', model: 'models/meshy/townsfolk/grandma.glb', pace: 0.9 },
  { id: 'grandpa', model: 'models/meshy/townsfolk/grandpa.glb', pace: 0.95 },
  { id: 'baker', model: 'models/meshy/townsfolk/baker.glb', pace: 1.2 },
  { id: 'mail_carrier', model: 'models/meshy/townsfolk/mail_carrier.glb', pace: 1.35 },
  { id: 'officer', model: 'models/meshy/townsfolk/officer.glb', pace: 1.15 },
  { id: 'nurse', model: 'models/meshy/townsfolk/nurse.glb', pace: 1.25 },
  { id: 'gardener', model: 'models/meshy/townsfolk/gardener.glb', pace: 1.0 },
  { id: 'teen_girl', model: 'models/meshy/townsfolk/teen_girl.glb', pace: 1.3 },
  { id: 'jogger', model: 'models/meshy/townsfolk/jogger.glb', pace: 3.1 },
  { id: 'musician', model: 'models/meshy/townsfolk/musician.glb', pace: 1.05, radius: 0.55 },
];

export const TOWN_LINES = 3;
