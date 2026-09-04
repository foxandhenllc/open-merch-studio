import type { PolicyRoute } from '../policies.types';
import { policyRoutes, policyApproval } from '../policies';
import { publicConfig } from '../config';
import { OpenSourceAttribution } from './OpenSourceAttribution';

export function PolicyPage({ route }: { route: PolicyRoute }) {
  const isSupport = route === policyRoutes['/support'];
  return (
    <main className="policy-shell">
      <header className="policy-hero">
        <a className="back-link" href="/">
          ← Back to studio
        </a>
        <span className="kicker">{route.eyebrow}</span>
        <h1>{route.title}</h1>
        <p>
          {route.summary}
          {isSupport && (
            <>
              {' '}
              <a href={`mailto:${publicConfig.supportEmail}`}>{publicConfig.supportEmail}</a>.
            </>
          )}
        </p>
      </header>
      <section className="policy-content">
        <p className="policy-version">
          Policy version {policyApproval.approvedVersion} · Approval record{' '}
          {policyApproval.lastApprovedDate}
          {String(policyApproval.purpose) === 'fixture-only'
            ? ' · Fixture only; not approved for commerce'
            : ''}
        </p>
        {route.sections.map((item) => (
          <article key={item.heading}>
            <h2>{item.heading}</h2>
            <p>{item.body}</p>
          </article>
        ))}
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
