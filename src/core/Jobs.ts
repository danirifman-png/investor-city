import { HEADLINES, JOBS, SHIFT, type JobDef, type JobKind } from '../content/jobs';
import { mulberry32 } from '../world/cityLayout';

/**
 * Jobs around the city (content/jobs): the tasks of a shift, its payslip, and
 * which jobs paid today. Pure logic with no DOM.
 *
 * Each task is a question from the job with four answers (two for the news
 * editor). Numbers grow with the player's level.
 */

export interface JobTask {
  /** Locale key of the question and its values. */
  key: string;
  vars: Record<string, number>;
  /** Answers shown on the buttons: numbers, or locale keys for words. */
  choices: (number | string)[];
  answer: number;
  /** Locale key explaining the answer (with the same vars plus `a`, the answer). */
  why: string;
}

const pick = (rng: () => number, lo: number, hi: number, step = 1) => lo + Math.floor(rng() * ((hi - lo) / step + 1)) * step;

function numberChoices(rng: () => number, answer: number, spread: number): { choices: number[]; answer: number } {
  const set = new Set<number>([answer]);
  const offsets = [spread, -spread, spread * 2, -spread * 2, 1, -1, 10, -10];
  while (set.size < 4) {
    const o = offsets[Math.floor(rng() * offsets.length)];
    const v = answer + o;
    if (v >= 0) set.add(v);
  }
  const choices = [...set].sort(() => rng() - 0.5);
  return { choices, answer: choices.indexOf(answer) };
}

/** One task of a job. `hard` makes the numbers bigger. */
export function makeTask(kind: JobKind, rng: () => number, hard: boolean, used: Set<number> = new Set()): JobTask {
  const big = hard ? 10 : 1;
  switch (kind) {
    case 'teller': {
      const bal = pick(rng, 20, 90) * big;
      if (rng() < 0.5) {
        const dep = pick(rng, 5, 40) * big;
        const a = bal + dep;
        return { key: 'job.task.deposit', vars: { bal, dep, a }, ...numberChoices(rng, a, 5 * big), why: 'job.why.deposit' };
      }
      const w = pick(rng, 5, Math.max(6, Math.floor(bal / big) - 5)) * big;
      const a = bal - w;
      return { key: 'job.task.withdraw', vars: { bal, w, a }, ...numberChoices(rng, a, 5 * big), why: 'job.why.withdraw' };
    }
    case 'cashier': {
      const price = pick(rng, 3, hard ? 95 : 18);
      const paid = price <= 20 ? 20 : price <= 50 ? 50 : 100;
      const a = paid - price;
      return { key: 'job.task.change', vars: { price, paid, a }, ...numberChoices(rng, a, hard ? 5 : 2), why: 'job.why.change' };
    }
    case 'packer': {
      const per = pick(rng, hard ? 6 : 4, hard ? 12 : 6);
      const boxes = pick(rng, 3, hard ? 12 : 8);
      const extra = hard ? pick(rng, 0, per - 1) : 0;
      const n = per * boxes + extra;
      return { key: hard ? 'job.task.packLeft' : 'job.task.pack', vars: { per, n, a: boxes, left: extra }, ...numberChoices(rng, boxes, 1), why: 'job.why.pack' };
    }
    case 'pharmacy': {
      const perDay = pick(rng, 1, hard ? 4 : 3);
      const days = pick(rng, hard ? 7 : 3, hard ? 14 : 7);
      const a = perDay * days;
      return { key: 'job.task.pills', vars: { perDay, days, a }, ...numberChoices(rng, a, perDay), why: 'job.why.pills' };
    }
    case 'agent': {
      const rent = pick(rng, hard ? 30 : 5, hard ? 90 : 12) * (hard ? 10 : 1);
      const months = hard ? 12 : pick(rng, 2, 6);
      const a = rent * months;
      return { key: 'job.task.rent', vars: { rent, months, a }, ...numberChoices(rng, a, rent), why: 'job.why.rent' };
    }
    case 'builder': {
      const price = pick(rng, hard ? 12 : 3, hard ? 40 : 9);
      const n = pick(rng, hard ? 10 : 2, hard ? 30 : 9);
      const a = price * n;
      return { key: 'job.task.materials', vars: { price, n, a }, ...numberChoices(rng, a, price), why: 'job.why.materials' };
    }
    case 'analyst': {
      if (!hard) {
        const from = pick(rng, 10, 60);
        const up = pick(rng, 2, 15) * (rng() < 0.3 ? -1 : 1);
        const to = from + up;
        return { key: 'job.task.stockMove', vars: { from, to, a: Math.abs(up) }, ...numberChoices(rng, Math.abs(up), 2), why: up >= 0 ? 'job.why.stockUp' : 'job.why.stockDown' };
      }
      const from = pick(rng, 2, 10) * 10;
      const pct = pick(rng, 1, 5) * 10;
      const to = from + (from * pct) / 100;
      return { key: 'job.task.stockPct', vars: { from, to, a: pct }, ...numberChoices(rng, pct, 10), why: 'job.why.stockPct' };
    }
    case 'editor': {
      let i = Math.floor(rng() * HEADLINES.length);
      for (let k = 0; k < HEADLINES.length && used.has(i); k++) i = (i + 1) % HEADLINES.length;
      used.add(i);
      return { key: `job.news.${i}`, vars: { a: 0 }, choices: ['job.real', 'job.fake'], answer: HEADLINES[i].real ? 0 : 1, why: `job.news.${i}.why` };
    }
  }
}

/** All the tasks of one shift. */
export function makeShift(job: JobDef, seed: number, hard: boolean): JobTask[] {
  const rng = mulberry32(seed >>> 0);
  const used = new Set<number>();
  return Array.from({ length: SHIFT.tasks }, () => makeTask(job.kind, rng, hard, used));
}

export interface Payslip {
  right: number;
  tasks: number;
  base: number;
  wages: number;
  gross: number;
  tax: number;
  net: number;
  /** False for a second shift at the same place on the same day (practice, no pay). */
  paid: boolean;
}

export function payslip(job: JobDef, right: number, level: number, paidToday: boolean): Payslip {
  const wages = right * job.wage;
  const gross = job.base + wages;
  const tax = level >= SHIFT.taxLevel ? Math.round(gross * SHIFT.tax) : 0;
  const paid = !paidToday;
  return { right, tasks: SHIFT.tasks, base: job.base, wages, gross, tax, net: paid ? gross - tax : 0, paid };
}

/** Per job: the last day a shift was paid, and how many shifts in all. */
export type JobRecord = Record<string, { day: number; shifts: number; best: number }>;

export function recordShift(rec: JobRecord, id: string, day: number, right: number): JobRecord {
  const r = rec[id] ?? { day: -1, shifts: 0, best: 0 };
  return { ...rec, [id]: { day, shifts: r.shifts + 1, best: Math.max(r.best, right) } };
}

export const paidToday = (rec: JobRecord, id: string, day: number): boolean => rec[id]?.day === day;

export function sanitizeJobs(raw: unknown): JobRecord {
  const out: JobRecord = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!JOBS.some((j) => j.id === id) || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.floor(x) : d);
    out[id] = { day: n(r.day, -1), shifts: Math.max(0, n(r.shifts, 0)), best: Math.max(0, Math.min(SHIFT.tasks, n(r.best, 0))) };
  }
  return out;
}
