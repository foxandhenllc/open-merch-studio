import { OpenSourceAttribution } from './OpenSourceAttribution';
import { foxHenProducts } from '../examples/fox-hen-collection';

function ProductVisual({ product }: { product: (typeof foxHenProducts)[number] }) {
  return (
    <div className={`example-mockup ${product.mockupClass}`}>
      <span className="example-mockup__proof">Printful proof</span>
      <img
        className="example-mockup__primary"
        src={product.mockupImage}
        alt={`${product.name} product preview`}
      />
      {product.reverseMockupImage && (
        <div className="example-mockup__reverse" aria-label="Reverse print preview">
          <span>Reverse</span>
          <img src={product.reverseMockupImage} alt={`${product.name} reverse print preview`} />
        </div>
      )}
    </div>
  );
}

export function FoxHenCollectionPage() {
  return (
    <main className="example-collection">
      <nav className="example-nav" aria-label="Example collection navigation">
        <a className="brand" href="/" aria-label="Open Merch Studio home">
          <span className="brand-symbol">OMS</span>
          <span>
            <b>Open Merch Studio</b>
            <small>Collection proof</small>
          </span>
        </a>
        <div>
          <a href="/">Create your own</a>
          <a href="https://github.com/foxandhenllc/open-merch-studio">View source ↗</a>
        </div>
      </nav>

      <header className="example-hero">
        <div className="example-hero__copy">
          <span className="kicker">Fox &amp; Hen / collection 001</span>
          <h1>One clear system,<br />printed five ways.</h1>
          <p>
            A real five-product capsule built from the catalog already available in Open Merch
            Studio. It uses direct artwork, an original reference-led emblem, print-file cleanup,
            and front-and-back placements.
          </p>
          <div className="example-hero__actions">
            <a className="example-button" href="/">Make your own merch</a>
            <a className="example-text-link" href="https://foxandhenllc.com/merch">
              See the Fox &amp; Hen story ↗
            </a>
          </div>
        </div>
        <div className="example-hero__art" aria-hidden="true">
          <span>Collection 001</span>
          <img src="/examples/fox-and-hen/field-emblem-web.png" alt="" />
          <strong>FOX<br />&amp; HEN</strong>
        </div>
      </header>

      <section className="example-methods" aria-labelledby="example-methods-title">
        <div>
          <span className="kicker">What the studio handled</span>
          <h2 id="example-methods-title">More than a prompt box.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Use supplied artwork</strong><p>Approved Fox &amp; Hen marks were prepared directly for products.</p></li>
          <li><span>02</span><strong>Build from references</strong><p>A bespoke fox-and-hen emblem was developed from the brand palette and visual direction.</p></li>
          <li><span>03</span><strong>Make it printworthy</strong><p>Transparency, safe areas, output dimensions, and legibility were verified before handoff.</p></li>
          <li><span>04</span><strong>Control each placement</strong><p>The tee and tote use separate front and back print files with visible cost impact.</p></li>
        </ol>
      </section>

      <section className="example-products" aria-labelledby="example-products-title">
        <div className="example-section-heading">
          <div>
            <span className="kicker">Five current products</span>
            <h2 id="example-products-title">A collection, not a catalog dump.</h2>
          </div>
          <p>
            These are live Printful-generated product proofs. Suggested retail is editorial
            guidance for the example collection, not a live offer; final store prices and
            shipping appear before purchase.
          </p>
        </div>
        <div className="example-product-grid">
          {foxHenProducts.map((product, index) => (
            <article className="example-product-card" key={product.id}>
              <ProductVisual product={product} />
              <div className="example-product-card__copy">
                <span className="example-product-card__index">0{index + 1}</span>
                <div>
                  <p className="example-product-card__product">{product.product}</p>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                </div>
              </div>
              <dl>
                <div><dt>Placement</dt><dd>{product.placement}</dd></div>
                <div><dt>Retail</dt><dd>{product.suggestedRetail}</dd></div>
              </dl>
              <p className="example-product-card__cost">{product.costNote}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="example-proof">
        <span className="kicker">Open by design</span>
        <h2>Try the workflow. Inspect the code. Build a version you own.</h2>
        <p>
          Open Merch Studio supports direct uploads, reference-led creation, photo cleanup,
          multi-placement previews, live Stripe Checkout, and review-first Printful fulfillment.
        </p>
        <div>
          <a className="example-button example-button--light" href="/">Open the studio</a>
          <a className="example-text-link" href="https://github.com/foxandhenllc/open-merch-studio">
            Fork on GitHub ↗
          </a>
        </div>
      </section>

      <footer className="site-footer example-footer">
        <nav aria-label="Footer links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/returns">Returns</a>
          <a href="/support">Support</a>
        </nav>
        <OpenSourceAttribution />
      </footer>
    </main>
  );
}
