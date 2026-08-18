import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/open_merch_studio_test';

const {
  getRuntimeSettings,
  releaseLiveDesignSpend,
  reserveLiveDesignSpend,
  updateRuntimeSettings,
} = await import('../services/runtime-store.js');
const { HttpError } = await import('../middleware.js');

type ReservationDb = Parameters<typeof reserveLiveDesignSpend>[1];

type StoredSession = {
  id: string;
  status: string;
  freeDraftsUsed: number;
  freeDraftLimit: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredPass = {
  id: string;
  sessionId: string;
  status: string;
  priceCents: number;
  creditCents: number;
  includedRoughDrafts: number;
  includedEdits: number;
  includedFinals: number;
  roughDraftsUsed: number;
  editsUsed: number;
  finalsUsed: number;
  appliedOrderId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

function createReservationDb(options: { pass?: StoredPass } = {}) {
  const sessions = new Map<string, StoredSession>();
  const passes = new Map<string, StoredPass>();
  if (options.pass) passes.set(options.pass.id, { ...options.pass });
  const events: Array<{
    id: string;
    sessionId: string;
    designAssetId?: string;
    action: string;
    provider: string;
    estimatedCostCents: number;
    createdAt: Date;
  }> = [];
  let advisoryLockCalls = 0;
  let lockTail = Promise.resolve();

  const db = {
    async $transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
      let release: (() => void) | undefined;
      const tx = {
        async $queryRaw(query: TemplateStringsArray) {
          assert.match(
            query.join(''),
            /pg_advisory_xact_lock[\s\S]*::text AS locked/,
            'the advisory lock must return a Prisma-supported scalar type'
          );
          advisoryLockCalls += 1;
          const previous = lockTail;
          lockTail = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          return [];
        },
        studioSession: {
          async upsert(args: {
            where: { id: string };
            create: Pick<StoredSession, 'id' | 'status' | 'freeDraftsUsed' | 'freeDraftLimit'>;
          }) {
            const existing = sessions.get(args.where.id);
            if (existing) return { ...existing };
            const now = new Date();
            const created = { ...args.create, createdAt: now, updatedAt: now };
            sessions.set(created.id, created);
            return { ...created };
          },
          async update(args: {
            where: { id: string };
            data: {
              freeDraftLimit?: number;
              freeDraftsUsed?: { increment?: number; decrement?: number };
            };
          }) {
            const existing = sessions.get(args.where.id);
            assert.ok(existing);
            const updated: StoredSession = {
              ...existing,
              freeDraftLimit: args.data.freeDraftLimit ?? existing.freeDraftLimit,
              freeDraftsUsed:
                existing.freeDraftsUsed +
                (args.data.freeDraftsUsed?.increment ?? 0) -
                (args.data.freeDraftsUsed?.decrement ?? 0),
              updatedAt: new Date(),
            };
            sessions.set(updated.id, updated);
            return { ...updated };
          },
          async findUniqueOrThrow(args: { where: { id: string } }) {
            const existing = sessions.get(args.where.id);
            assert.ok(existing);
            return { ...existing };
          },
        },
        studioPass: {
          async findFirst(args: { where: { sessionId: string } }) {
            return (
              Array.from(passes.values()).find(
                (pass) => pass.sessionId === args.where.sessionId && pass.status !== 'expired'
              ) ?? null
            );
          },
          async update(args: {
            where: { id: string };
            data: {
              roughDraftsUsed?: { increment?: number; decrement?: number };
              editsUsed?: { increment?: number; decrement?: number };
              finalsUsed?: { increment?: number; decrement?: number };
            };
          }) {
            const existing = passes.get(args.where.id);
            assert.ok(existing);
            const updated: StoredPass = {
              ...existing,
              roughDraftsUsed:
                existing.roughDraftsUsed +
                (args.data.roughDraftsUsed?.increment ?? 0) -
                (args.data.roughDraftsUsed?.decrement ?? 0),
              editsUsed:
                existing.editsUsed +
                (args.data.editsUsed?.increment ?? 0) -
                (args.data.editsUsed?.decrement ?? 0),
              finalsUsed:
                existing.finalsUsed +
                (args.data.finalsUsed?.increment ?? 0) -
                (args.data.finalsUsed?.decrement ?? 0),
            };
            passes.set(updated.id, updated);
            return { ...updated };
          },
        },
        aiSpendEvent: {
          async aggregate(args: { where: { sessionId?: string; createdAt?: { gte: Date } } }) {
            const total = events
              .filter(
                (event) =>
                  (!args.where.sessionId || event.sessionId === args.where.sessionId) &&
                  (!args.where.createdAt || event.createdAt >= args.where.createdAt.gte)
              )
              .reduce((sum, event) => sum + event.estimatedCostCents, 0);
            return { _sum: { estimatedCostCents: total } };
          },
          async create(args: {
            data: {
              id: string;
              sessionId: string;
              designAssetId?: string;
              action: string;
              provider: string;
              estimatedCostCents: number;
              createdAt?: Date;
            };
          }) {
            events.push({ ...args.data, createdAt: args.data.createdAt ?? new Date() });
            return args.data;
          },
          async findUnique(args: { where: { id: string } }) {
            return events.find((event) => event.id === args.where.id) ?? null;
          },
          async update(args: { where: { id: string }; data: { designAssetId?: string } }) {
            const event = events.find((candidate) => candidate.id === args.where.id);
            assert.ok(event);
            Object.assign(event, args.data);
            return event;
          },
        },
      };
      try {
        return await callback(tx);
      } finally {
        release?.();
      }
    },
  };

  return {
    db: db as unknown as ReservationDb,
    events,
    sessions,
    passes,
    get advisoryLockCalls() {
      return advisoryLockCalls;
    },
  };
}

test('concurrent reservations cannot cross per-session or daily budgets', async () => {
  const before = getRuntimeSettings();
  try {
    updateRuntimeSettings({ dailyAiBudgetCents: 206, perSessionBudgetCents: 206 });
    const perSession = createReservationDb();
    const sameSession = await Promise.all([
      reserveLiveDesignSpend(
        {
          sessionId: 'sess_concurrent_cap',
          action: 'rough_draft',
          provider: 'openai',
          estimatedCostCents: 206,
        },
        perSession.db
      ),
      reserveLiveDesignSpend(
        {
          sessionId: 'sess_concurrent_cap',
          action: 'rough_draft',
          provider: 'openai',
          estimatedCostCents: 206,
        },
        perSession.db
      ),
    ]);
    assert.deepEqual(sameSession.map((result) => result.allowed).sort(), [false, true]);
    assert.equal(perSession.events.length, 1);
    assert.equal(perSession.sessions.get('sess_concurrent_cap')?.freeDraftsUsed, 1);
    assert.equal(perSession.advisoryLockCalls, 2);

    updateRuntimeSettings({ dailyAiBudgetCents: 206, perSessionBudgetCents: 1000 });
    const daily = createReservationDb();
    const differentSessions = await Promise.all([
      reserveLiveDesignSpend(
        {
          sessionId: 'sess_daily_a',
          action: 'rough_draft',
          provider: 'openai',
          estimatedCostCents: 206,
        },
        daily.db
      ),
      reserveLiveDesignSpend(
        {
          sessionId: 'sess_daily_b',
          action: 'rough_draft',
          provider: 'openai',
          estimatedCostCents: 206,
        },
        daily.db
      ),
    ]);
    assert.deepEqual(differentSessions.map((result) => result.allowed).sort(), [false, true]);
    assert.equal(daily.events.length, 1);
    assert.equal(daily.advisoryLockCalls, 2);
  } finally {
    updateRuntimeSettings({
      dailyAiBudgetCents: before.dailyAiBudgetCents,
      perSessionBudgetCents: before.perSessionBudgetCents,
    });
  }
});

test('a durable reservation consumes one revision allowance and one spend event', async () => {
  const before = getRuntimeSettings();
  try {
    updateRuntimeSettings({ dailyAiBudgetCents: 1000, perSessionBudgetCents: 1000 });
    const pass: StoredPass = {
      id: 'pass_revision',
      sessionId: 'sess_revision',
      status: 'purchased',
      priceCents: 500,
      creditCents: 500,
      includedRoughDrafts: 8,
      includedEdits: 2,
      includedFinals: 1,
      roughDraftsUsed: 0,
      editsUsed: 0,
      finalsUsed: 0,
      appliedOrderId: null,
      createdAt: new Date(),
      expiresAt: null,
    };
    const fixture = createReservationDb({ pass });
    const result = await reserveLiveDesignSpend(
      {
        sessionId: pass.sessionId,
        action: 'edit',
        provider: 'openai',
        estimatedCostCents: 212,
      },
      fixture.db
    );
    assert.equal(result.allowed, true);
    assert.equal(result.allowance.editsRemaining, 1);
    assert.equal(fixture.passes.get(pass.id)?.editsUsed, 1);
    assert.equal(fixture.events.length, 1);
    assert.equal(fixture.events[0]?.estimatedCostCents, 212);
  } finally {
    updateRuntimeSettings({
      dailyAiBudgetCents: before.dailyAiBudgetCents,
      perSessionBudgetCents: before.perSessionBudgetCents,
    });
  }
});

test('a failed provider request restores allowance and offsets spend exactly once', async () => {
  const before = getRuntimeSettings();
  try {
    updateRuntimeSettings({ dailyAiBudgetCents: 1000, perSessionBudgetCents: 1000 });
    const fixture = createReservationDb();
    const reservation = await reserveLiveDesignSpend(
      {
        sessionId: 'sess_failed_provider',
        action: 'rough_draft',
        provider: 'openai',
        estimatedCostCents: 206,
      },
      fixture.db
    );
    assert.equal(reservation.allowed, true);
    assert.equal(reservation.allowance.freeDraftsRemaining, 2);

    const firstRelease = await releaseLiveDesignSpend(
      reservation,
      { designAssetId: 'asset_failed_provider' },
      fixture.db
    );
    const secondRelease = await releaseLiveDesignSpend(
      reservation,
      { designAssetId: 'asset_failed_provider' },
      fixture.db
    );

    assert.equal(firstRelease.freeDraftsRemaining, 3);
    assert.equal(secondRelease.freeDraftsRemaining, 3);
    assert.equal(fixture.sessions.get('sess_failed_provider')?.freeDraftsUsed, 0);
    assert.deepEqual(
      fixture.events.map((event) => event.estimatedCostCents),
      [206, -206]
    );
    assert.ok(fixture.events.every((event) => event.designAssetId === 'asset_failed_provider'));
  } finally {
    updateRuntimeSettings({
      dailyAiBudgetCents: before.dailyAiBudgetCents,
      perSessionBudgetCents: before.perSessionBudgetCents,
    });
  }
});

test('database errors fail closed before a provider callback can run', async () => {
  let providerCalls = 0;
  const failingDb = {
    async $transaction() {
      throw new Error('database unavailable');
    },
  } as unknown as ReservationDb;

  await assert.rejects(
    async () => {
      await reserveLiveDesignSpend(
        {
          sessionId: 'sess_db_failure',
          action: 'rough_draft',
          provider: 'openai',
          estimatedCostCents: 206,
        },
        failingDb
      );
      providerCalls += 1;
    },
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.errorCode, 'live_ai_spend_reservation_failed');
      return true;
    }
  );
  assert.equal(providerCalls, 0);
});
