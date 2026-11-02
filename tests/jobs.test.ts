import { describe, expect, it } from 'vitest';
import { HEADLINES, JOBS, SHIFT } from '../src/content/jobs';
import { makeShift, makeTask, paidToday, payslip, recordShift, sanitizeJobs } from '../src/core/Jobs';
import { mulberry32 } from '../src/world/cityLayout';
import he from '../src/i18n/locales/he.jobs.json';

const dict = he as Record<string, string>;

describe('jobs', () => {
  it('every job has a name and makes tasks with a right answer among the choices', () => {
    for (const job of JOBS) {
      expect(dict[`job.${job.id}.name`], job.id).toBeTruthy();
      for (const hard of [false, true]) {
        const tasks = makeShift(job, 11, hard);
        expect(tasks.length).toBe(SHIFT.tasks);
        for (const task of tasks) {
          expect(dict[task.key], task.key).toBeTruthy();
          expect(dict[task.why], task.why).toBeTruthy();
          expect(task.answer).toBeGreaterThanOrEqual(0);
          expect(task.answer).toBeLessThan(task.choices.length);
          expect(new Set(task.choices).size).toBe(task.choices.length);
          if (typeof task.choices[0] === 'number') expect(task.choices[task.answer]).toBe(task.vars.a);
        }
      }
    }
  });

  it('the maths is right', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const c = makeTask('cashier', rng, i % 2 === 0);
      expect(c.vars.a).toBe(c.vars.paid - c.vars.price);
      expect(c.vars.a).toBeGreaterThanOrEqual(0);
      const p = makeTask('packer', rng, i % 2 === 0);
      expect(Math.floor(p.vars.n / p.vars.per)).toBe(p.vars.a);
      const w = makeTask('teller', rng, i % 2 === 0);
      expect(w.vars.a).toBeGreaterThanOrEqual(0);
    }
  });

  it('news shifts do not repeat a headline', () => {
    const job = JOBS.find((j) => j.kind === 'editor')!;
    const keys = makeShift(job, 3, false).map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(HEADLINES.length).toBeGreaterThanOrEqual(SHIFT.tasks);
  });

  it('payslip: base plus wages, tax from a level, and one paid shift a day', () => {
    const job = JOBS[0];
    const young = payslip(job, 4, 1, false);
    expect(young.gross).toBe(job.base + 4 * job.wage);
    expect(young.tax).toBe(0);
    expect(young.net).toBe(young.gross);
    const older = payslip(job, 4, SHIFT.taxLevel, false);
    expect(older.tax).toBeGreaterThan(0);
    expect(older.net).toBe(older.gross - older.tax);
    expect(payslip(job, 4, 1, true).net).toBe(0);
    const rec = recordShift({}, job.id, 7, 5);
    expect(paidToday(rec, job.id, 7)).toBe(true);
    expect(paidToday(rec, job.id, 8)).toBe(false);
    expect(sanitizeJobs({ [job.id]: { day: 7, shifts: 2, best: 99 }, nope: {} })).toEqual({ [job.id]: { day: 7, shifts: 2, best: SHIFT.tasks } });
  });
});
