import { useEffect, useState } from 'react';
import type { PublicCollection } from '@open-merch-studio/collection-drafts';
import { merchantConfig } from '../generated/merchant-config';
import { OpenSourceAttribution } from '../components/OpenSourceAttribution';
import './published-collections.css';

export function PublishedCollectionsPage({ id }: { id?: string }) {
  const [collections, setCollections] = useState<PublicCollection[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch(`/api/collections${id ? `/${encodeURIComponent(id)}` : ''}`, {
      cache: 'no-store',
      credentials: 'omit',
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'This collection is no longer published.'
              : 'The collection is temporarily unavailable. Please try again later.'
          );
        const envelope = await response.json();
        if (!envelope.success) throw new Error('The collection is unavailable.');
        if (active) setCollections(id ? [envelope.data] : envelope.data);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'The collection is unavailable.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="published-collections">
      <header className="published-collections-brand">
        <a href="/">{merchantConfig.brand.displayName}</a>
        <a href="/collections">Collections</a>
      </header>
      <div className="published-collections-intro">
        <span>Collection preview</span>
        <h1>{id ? (collections?.[0]?.title ?? 'Collection') : 'Our collections'}</h1>
        <p>
          Explore the artwork and planned pieces. Ordering is not available from these pages yet.
        </p>
      </div>
      {error && (
        <p role="alert" className="published-collection-message">
          {error}
        </p>
      )}
      {!error && !collections && <p aria-busy="true">Opening collection…</p>}
      {collections?.length === 0 && <p>No collections are published yet.</p>}
      {collections?.map((collection) => (
        <section className="published-collection" key={collection.id} aria-label={collection.title}>
          {!id && (
            <h2>
              <a href={collection.url}>{collection.title}</a>
            </h2>
          )}
          {collection.description && (
            <p className="published-collection-description">{collection.description}</p>
          )}
          <div className="published-collection-products">
            {collection.products.map((product) => (
              <article key={product.id}>
                <div className="published-collection-images">
                  {product.artwork.map((artwork) => (
                    <figure key={artwork.previewUrl}>
                      <img
                        src={artwork.previewUrl}
                        alt={artwork.label}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                          event.currentTarget.parentElement?.setAttribute(
                            'data-unavailable',
                            'true'
                          );
                        }}
                      />
                      <figcaption>
                        {artwork.label} · {artwork.widthInches} × {artwork.heightInches} in planned
                        artwork
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <h3>{product.title}</h3>
                <p>
                  {product.productTitle} · {product.variantName}
                </p>
                {product.plannedPriceCents !== null && (
                  <p className="published-collection-price">
                    Planned product price{' '}
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      product.plannedPriceCents / 100
                    )}
                  </p>
                )}
                <p className="published-collection-note">
                  Artwork preview. Product appearance, shipping, tax, and final price will be
                  confirmed when ordering opens.
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
      <footer>
        <a href="/support">Contact & support</a>
        <OpenSourceAttribution />
      </footer>
    </main>
  );
}
