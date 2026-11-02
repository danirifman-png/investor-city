import { mulberry32 } from '../world/cityLayout';

/**
 * Working the counter: customers arrive over a short business day, wait in
 * line, and leave happy when served or unhappy when they wait too long. The
 * player makes each order by doing the recipe's steps in order, then serves
 * it from the stock prepared in the morning. Pure logic with no DOM; the
 * world (customers walking) and the panel follow its events.
 *
 * How many people come is decided by the business rules (weather, city
 * event, price); here they are split into customers with small orders.
 */

export type RecipeStep = 'squeeze' | 'sugar' | 'ice' | 'pour' | 'dough' | 'sauce' | 'cheese' | 'oven' | 'slice';

export interface Recipe {
  id: 'lemonade' | 'pizza';
  steps: RecipeStep[];
  /** Steps that take time on their own (seconds), like baking. */
  waits?: Partial<Record<RecipeStep, number>>;
}

export const RECIPES: Record<Recipe['id'], Recipe> = {
  lemonade: { id: 'lemonade', steps: ['squeeze', 'sugar', 'ice', 'pour'] },
  pizza: { id: 'pizza', steps: ['dough', 'sauce', 'cheese', 'oven', 'slice'], waits: { oven: 3 } },
};

export const SERVICE = {
  /** Length of the business day, in real seconds. */
  seconds: 75,
  minCustomers: 4,
  maxCustomers: 16,
  /** Seconds a customer is willing to wait in line. */
  patience: [18, 28] as [number, number],
  /** More people than this in line and newcomers walk away. */
  maxLine: 6,
};

export interface ServiceOrder {
  id: number;
  /** Arrival time, seconds from the opening. */
  at: number;
  /** Cups (or slices) this customer wants. */
  cups: number;
  patience: number;
  /** Which look (0..9) the customer has. */
  look: number;
}

/** Splits `demand` cups into customers arriving over the day (deterministic for a seed). */
export function planService(demand: number, seed: number, seconds = SERVICE.seconds): ServiceOrder[] {
  const d = Math.max(0, Math.round(demand));
  if (d === 0) return [];
  const rng = mulberry32(seed >>> 0);
  const n = Math.max(1, Math.min(d, Math.max(SERVICE.minCustomers, Math.min(SERVICE.maxCustomers, Math.round(d / 3)))));
  const cups = Array.from({ length: n }, () => Math.floor(d / n));
  for (let r = d - Math.floor(d / n) * n; r > 0; r--) cups[Math.floor(rng() * n)]++;
  // arrivals: spread over the day with a busy middle (a gentle lunch rush)
  const open = seconds - 16;
  const times = Array.from({ length: n }, () => {
    const u = (rng() + rng() + rng()) / 3;
    return 2 + u * open;
  }).sort((a, b) => a - b);
  times[0] = Math.min(times[0], 2.5);
  const [p0, p1] = SERVICE.patience;
  return times.map((at, i) => ({ id: i, at, cups: cups[i], patience: p0 + rng() * (p1 - p0), look: Math.floor(rng() * 10) }));
}

export type ServiceEvent =
  | { kind: 'arrive'; order: ServiceOrder }
  | { kind: 'served'; order: ServiceOrder; cups: number }
  | { kind: 'left'; order: ServiceOrder; why: 'waited' | 'line' | 'empty' };

export interface Waiting {
  order: ServiceOrder;
  waited: number;
}

/** One business day at the counter. */
export class ServiceRun {
  time = 0;
  /** People in line, the first is being served. */
  readonly line: Waiting[] = [];
  /** Recipe steps done for the order in hand. */
  progress = 0;
  /** Seconds left on a step that takes time (the oven). */
  waiting = 0;
  sold = 0;
  served = 0;
  leftWaiting = 0;
  leftLine = 0;
  private next = 0;

  constructor(
    readonly orders: ServiceOrder[],
    public stock: number,
    readonly recipe: Recipe,
    readonly seconds = SERVICE.seconds,
  ) {}

  /** The order in hand is made and can be served. */
  get ready(): boolean {
    return this.progress >= this.recipe.steps.length && this.waiting <= 0;
  }

  get nextStep(): RecipeStep | null {
    return this.progress < this.recipe.steps.length ? this.recipe.steps[this.progress] : null;
  }

  /** Customers still to come or waiting. */
  get remaining(): number {
    return this.orders.length - this.next + this.line.length;
  }

  get over(): boolean {
    return (this.time >= this.seconds && this.line.length === 0) || (this.next >= this.orders.length && this.line.length === 0) || (this.stock <= 0 && this.line.length === 0 && this.time > 3);
  }

  /** Advances time; returns what happened. */
  update(dt: number): ServiceEvent[] {
    const out: ServiceEvent[] = [];
    this.time += dt;
    if (this.waiting > 0) this.waiting = Math.max(0, this.waiting - dt);
    while (this.next < this.orders.length && this.orders[this.next].at <= this.time) {
      const order = this.orders[this.next++];
      if (this.line.length >= SERVICE.maxLine) {
        this.leftLine += order.cups;
        out.push({ kind: 'left', order, why: 'line' });
      } else {
        this.line.push({ order, waited: 0 });
        out.push({ kind: 'arrive', order });
      }
    }
    // after closing time nobody new comes; whoever is in line still waits
    if (this.time >= this.seconds) this.next = this.orders.length;
    for (let i = this.line.length - 1; i >= 0; i--) {
      const w = this.line[i];
      w.waited += dt;
      if (w.waited >= w.order.patience) {
        this.line.splice(i, 1);
        this.leftWaiting += w.order.cups;
        out.push({ kind: 'left', order: w.order, why: 'waited' });
      }
    }
    return out;
  }

  /** Does a recipe step. Returns false when it is not the next one (or the oven is busy). */
  step(s: RecipeStep): boolean {
    if (this.waiting > 0 || s !== this.nextStep) return false;
    this.progress++;
    this.waiting = this.recipe.waits?.[s] ?? 0;
    return true;
  }

  /** Serves the first in line with what was made. Null when nothing is ready or nobody waits. */
  serve(): ServiceEvent | null {
    const first = this.line[0];
    if (!first || !this.ready) return null;
    this.line.shift();
    this.progress = 0;
    const cups = Math.min(first.order.cups, this.stock);
    this.stock -= cups;
    if (cups === 0) {
      this.leftWaiting += first.order.cups;
      return { kind: 'left', order: first.order, why: 'empty' };
    }
    this.sold += cups;
    this.served++;
    return { kind: 'served', order: first.order, cups };
  }

  /** Whoever is still in line when the day ends goes home. */
  close(): ServiceEvent[] {
    const out: ServiceEvent[] = this.line.splice(0).map((w) => ({ kind: 'left' as const, order: w.order, why: 'waited' as const }));
    this.next = this.orders.length;
    return out;
  }
}
