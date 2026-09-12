import type { AdminSection } from './admin.types';
const guidance: Partial<
  Record<AdminSection, { task: string; effect: string; next: string; section: AdminSection }>
> = {
  profile: {
    task: 'Edit → save a private draft → review → publish → redeploy',
    effect:
      'The preview responds as you type. Save keeps your work private. Publish prepares the saved profile for hosting; only a successful redeploy updates the storefront.',
    next: 'Connect your accounts',
    section: 'connections',
  },
  connections: {
    task: 'Choose a service → supply your values → save → redeploy → verify',
    effect:
      'Saving a key does not prove it works. Redeploy applies it to new requests; account checks and live payment authorization remain separate. Start with storage and printing; AI is optional.',
    next: 'Prepare a collection',
    section: 'collections',
  },
  collections: {
    task: 'Draft → review artwork → publish preview → prepare prints → enable ordering',
    effect:
      'Saving a collection never changes its public version. Publishing makes that version visible. Prices and print layouts need separate sales approval before customers can order.',
    next: 'Review installation & launch',
    section: 'installation',
  },
  artwork: {
    task: 'Choose a model and spending limits only if you want AI creation',
    effect:
      'Saved model and limit changes apply to new artwork requests immediately. Existing artwork, products, orders, and allowances already granted stay unchanged.',
    next: 'Return to your setup path',
    section: 'overview',
  },
  orders: {
    task: 'Open an order → inspect its saved prints → record your review',
    effect:
      'Review notes do not refund a payment or start production. A fulfillment retry is a separate confirmed action; production still needs manual review in Printful.',
    next: 'Return to your setup path',
    section: 'overview',
  },
};
export function AdminSectionGuide({
  section,
  navigate,
}: {
  section: AdminSection;
  navigate: (section: AdminSection) => void;
}) {
  const guide = guidance[section];
  if (!guide) return null;
  return (
    <aside className="admin-workflow-guide" aria-label="How this step works">
      <strong>{guide.task}</strong>
      <p>{guide.effect}</p>
      <button className="admin-text-link" onClick={() => navigate('overview')}>
        ← My setup path
      </button>
      <button className="admin-text-link" onClick={() => navigate(guide.section)}>
        After this: {guide.next} →
      </button>
    </aside>
  );
}
export function ChangeVisibilityGuide() {
  return (
    <section className="admin-section" aria-label="When changes reach customers">
      <h2>What changes the storefront?</h2>
      <dl className="admin-detail-list">
        <div>
          <dt>Profile & account values</dt>
          <dd>
            Save privately → review the profile → publish → redeploy → verify. Saved connection
            values also need redeployment.
          </dd>
        </div>
        <div>
          <dt>Collections</dt>
          <dd>
            Save privately → review → publish preview. Ordering needs its own approval after print
            layouts and prices are checked.
          </dd>
        </div>
        <div>
          <dt>Artwork model & limits</dt>
          <dd>Save → applies to new requests immediately. No redeployment.</dd>
        </div>
      </dl>
    </section>
  );
}
