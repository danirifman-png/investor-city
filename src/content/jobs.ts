/**
 * DATA: jobs around the city. Each place has a short shift of real tasks from
 * that job (a bank teller adds a deposit, a cashier gives change, an editor
 * spots fake news...). A shift pays a wage per task done right plus a base,
 * with tax taken off on a payslip. Text in he.jobs.json under `job.<id>.*`.
 * Rules and task makers in core/Jobs.
 */

export type JobKind = 'teller' | 'cashier' | 'packer' | 'pharmacy' | 'agent' | 'analyst' | 'editor' | 'builder';

export interface JobDef {
  id: string;
  kind: JobKind;
  /** The building (POI key) where the job is. */
  poi: string;
  /** Paid for showing up. */
  base: number;
  /** Paid for each task done right. */
  wage: number;
  minLevel: number;
}

export const JOBS: JobDef[] = [
  { id: 'bankTeller', kind: 'teller', poi: 'bank', base: 6, wage: 3, minLevel: 1 },
  { id: 'marketCashier', kind: 'cashier', poi: 'market', base: 5, wage: 3, minLevel: 1 },
  { id: 'mallCashier', kind: 'cashier', poi: 'mall', base: 5, wage: 3, minLevel: 1 },
  { id: 'warehousePacker', kind: 'packer', poi: 'warehouses', base: 6, wage: 3, minLevel: 2 },
  { id: 'factoryPacker', kind: 'packer', poi: 'factory', base: 6, wage: 3, minLevel: 2 },
  { id: 'pharmacyHelper', kind: 'pharmacy', poi: 'pharmacy', base: 6, wage: 3, minLevel: 2 },
  { id: 'hospitalClerk', kind: 'pharmacy', poi: 'hospital', base: 7, wage: 3, minLevel: 3 },
  { id: 'newsEditor', kind: 'editor', poi: 'newsTower', base: 7, wage: 4, minLevel: 2 },
  { id: 'estateAgent', kind: 'agent', poi: 'realEstateAgency', base: 8, wage: 4, minLevel: 3 },
  { id: 'siteManager', kind: 'builder', poi: 'construction', base: 8, wage: 4, minLevel: 3 },
  { id: 'stockAnalyst', kind: 'analyst', poi: 'exchange', base: 9, wage: 5, minLevel: 4 },
];

export const JOB_BY_POI: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.poi, j]));

export const SHIFT = {
  tasks: 6,
  /** Income tax on a payslip, from this level (younger players get paid in full). */
  tax: 0.1,
  taxLevel: 4,
  /** Working is tiring. */
  energy: 8,
};

/** Headlines for the news editor: true ones and fake ones (`job.news.<i>`). */
export const HEADLINES: { real: boolean }[] = [
  { real: true },
  { real: false },
  { real: true },
  { real: false },
  { real: true },
  { real: false },
  { real: true },
  { real: false },
  { real: true },
  { real: false },
  { real: false },
  { real: true },
];
