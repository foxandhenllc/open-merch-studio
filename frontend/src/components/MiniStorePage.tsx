import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { PublicStorefront } from '../types/storefront';
import { OpenSourceAttribution } from './OpenSourceAttribution';

export function MiniStorePage({
  organizationSlug,
  storefrontSlug,
}: {
  organizationSlug: string;
  storefrontSlug: string;
}) {
  const [store, setStore] = useState<PublicStorefront | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .storefront(organizationSlug, storefrontSlug)
      .then((result) => {
        if (active) setStore(result.data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [organizationSlug, storefrontSlug]);

  if (failed) {
    return (
      <main className="mini-store mini-store--message">
        <h1>Storefront unavailable</h1>
        <p>This collection may still be in review or no longer published.</p>
        <a href="/">Open Merch Studio</a>
      </main>
    );
  }
  if (!store) {
    return (
      <main className="mini-store mini-store--message" aria-busy="true">
        <p>Opening collection…</p>
      </main>
    );
  }
  const { brand } = store.organization;
  return (
    <main
      className="mini-store"
      style={
        {
          '--store-ink': brand.primaryColor,
          '--store-accent': brand.accentColor,
        } as React.CSSProperties
      }
    >
      <header className="mini-store__header">
        <a href="/" className="mini-store__oms">
          Made with Open Merch Studio
        </a>
        {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.displayName} /> : <b>{brand.displayName}</b>}
        {brand.shortDescription && <span>{brand.shortDescription}</span>}
      </header>
      <section className="mini-store__hero">
        <div>
          <span className="kicker">{brand.displayName} collection</span>
          <h1>{store.collection.title}</h1>
          {store.collection.description && <p>{store.collection.description}</p>}
        </div>
        {store.collection.heroImageUrl && (
          <img src={store.collection.heroImageUrl} alt={`${store.collection.title} collection`} />
        )}
      </section>
      <section className="mini-store__products" aria-label="Products">
        {store.products.map((product) => (
          <article key={product.id}>
            {product.mockupUrl ? <img src={product.mockupUrl} alt="" /> : <div aria-hidden="true" />}
            <span>{product.productTitle}</span>
            <h2>{product.title}</h2>
            <p>
              {product.variantName} · {product.placementCodes.length}{' '}
              {product.placementCodes.length === 1 ? 'print area' : 'print areas'}
            </p>
          </article>
        ))}
      </section>
      <section className="mini-store__cta">
        <div>
          <span className="kicker">Make it yours</span>
          <h2>Build a product, then keep creating.</h2>
          <p>Use your own artwork, create from references, or prepare an image for print.</p>
        </div>
        <a className="button button--primary" href="/">
          Open the studio
        </a>
      </section>
      <footer className="site-footer">
        {brand.websiteUrl && <a href={brand.websiteUrl}>Visit {brand.displayName}</a>}
        <OpenSourceAttribution />
      </footer>
    </main>
  );
}
