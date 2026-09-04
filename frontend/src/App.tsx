import { policyRoutes } from './policies';
import { PolicyPage } from './components/PolicyPage';
import { OpenSourceAttribution } from './components/OpenSourceAttribution';
import { FoxHenCollectionPage } from './components/FoxHenCollectionPage';
import { WorkbenchStudioApp } from './WorkbenchStudioApp';
import { MiniStorePage } from './components/MiniStorePage';

const path = () => window.location.pathname.replace(/\/+$/, '') || '/';
function NotFoundPage() {
  return (
    <main className="policy-shell">
      <header className="policy-hero">
        <a className="back-link" href="/">
          ← Back to studio
        </a>
        <span className="kicker">Nothing to print here</span>
        <h1>We couldn’t find that page</h1>
        <p>
          The link may be old, or the address may have a typo. Your saved studio work is unchanged.
        </p>
      </header>
      <section className="policy-content">
        <article>
          <h2>Keep creating</h2>
          <p>
            Return to the studio to choose a product, restore saved guest work, or start something
            new.
          </p>
          <a className="back-link" href="/">
            Open the studio →
          </a>
        </article>
      </section>
      <footer className="site-footer">
        <nav aria-label="Footer links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/returns">Returns</a>
          <a href="/content-policy">Content policy</a>
          <a href="/support">Support</a>
        </nav>
        <OpenSourceAttribution />
      </footer>
    </main>
  );
}

export default function App() {
  const currentPath = path();
  const storeMatch = currentPath.match(/^\/stores\/([^/]+)\/([^/]+)$/);
  if (storeMatch) {
    return <MiniStorePage organizationSlug={storeMatch[1]} storefrontSlug={storeMatch[2]} />;
  }
  const route = policyRoutes[currentPath];
  if (route) return <PolicyPage route={route} />;
  if (currentPath === '/examples/fox-and-hen') return <FoxHenCollectionPage />;
  return currentPath === '/' ? <WorkbenchStudioApp /> : <NotFoundPage />;
}
