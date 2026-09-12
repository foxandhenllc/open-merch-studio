import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { applyReconciledRuntimeSpend, type LiveDesignSpendReservation } from './runtime-store.js';
import type { ImageUsageReceipt } from './image-usage.js';

/** Commit a redacted usage receipt and its budget correction together, once per reservation. */
export async function reconcileImageUsage(
  reservation: LiveDesignSpendReservation,
  usage: ImageUsageReceipt | undefined
) {
  if (!usage) return; // Missing/invalid usage retains the provisional reservation.
  const event = reservation.event;
  if (!env.databaseUrl || !reservation.allowed || !event)
    throw new HttpError(
      'Image usage could not be recorded. Reserved spend remains counted.',
      503,
      'image_usage_unavailable'
    );
  try {
    await prisma.$transaction(async (tx) => {
      const lock = 'open-merch-studio:live-ai-spend:v1';
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
      const receiptId = `${event.id}:image-usage`;
      const existing = await tx.auditLog.findUnique({ where: { id: receiptId } });
      if (existing) {
        const recorded = existing.metadata as Record<string, unknown>;
        if (Object.entries(usage).some(([key, value]) => recorded[key] !== value))
          throw new Error('Conflicting usage receipt.');
        return;
      }
      if (await tx.aiSpendEvent.findUnique({ where: { id: `${event.id}:released` } }))
        throw new Error('Reservation was released.');
      const stored = await tx.aiSpendEvent.findUniqueOrThrow({ where: { id: event.id } });
      if (stored.sessionId !== event.sessionId || stored.provider !== 'openai')
        throw new Error('Reservation mismatch.');
      await tx.aiSpendEvent.update({
        where: { id: event.id },
        data: { estimatedCostCents: usage.estimatedCostCents },
      });
      await tx.auditLog.create({
        data: {
          id: receiptId,
          actor: 'image-provider',
          action: 'image_usage_recorded',
          target: event.id,
          metadata: usage,
        },
      });
    });
    applyReconciledRuntimeSpend(event.id, usage.estimatedCostCents);
  } catch {
    throw new HttpError(
      'Image usage could not be recorded. Reserved spend remains counted.',
      503,
      'image_usage_unavailable'
    );
  }
}
