import type { PolicyRoute } from './App.types';
import { publicConfig } from './config';
import { WorkbenchStudioApp } from './WorkbenchStudioApp';

const path = () => window.location.pathname.replace(/\/+$/, '') || '/';
const section = (heading: string, body: string) => ({ heading, body });

const policies: Record<string, PolicyRoute> = {
  '/privacy': {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    summary:
      'Open Merch Studio avoids collecting information that is not needed to make and support an order.',
    sections: [
      section(
        'What we collect',
        'Browsing and design exploration do not require an account. Checkout collects the contact, shipping, order, and payment information needed to complete and support an order.'
      ),
      section(
        'Provider processing',
        'Stripe may process payment, Printful may fulfill an approved order, OpenAI may assist with artwork, and an email provider may deliver confirmations.'
      ),
      section(
        'Design prompts',
        'Never enter payment data, passwords, secrets, private customer records, or sensitive personal information into a design prompt.'
      ),
    ],
  },
  '/terms': {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    summary:
      'Create original, rights-cleared designs and review the final product before ordering.',
    sections: [
      section(
        'Design rights',
        'You are responsible for ensuring your prompts and final artwork are original or properly licensed. Do not request protected material you do not have permission to use.'
      ),
      section(
        'Generated output',
        'AI-assisted artwork is a starting point. Review its accuracy, print readiness, and provider mockup before checkout.'
      ),
      section(
        'Orders',
        'Final tax, shipping eligibility, availability, and production timing are confirmed during secure checkout and fulfillment review.'
      ),
    ],
  },
  '/returns': {
    eyebrow: 'Support',
    title: 'Returns And Cancellations',
    summary: 'Custom products require careful review because each item is made for one order.',
    sections: [
      section(
        'Before production',
        'Contact support quickly. An order may be changed or cancelled only while its provider status still allows it.'
      ),
      section(
        'Custom products',
        'Buyer-remorse returns may not be available after a custom item enters production.'
      ),
      section(
        'Damage or mistakes',
        'Contact support with the order number and clear photos if an item is damaged, misprinted, or materially different from the approved order.'
      ),
    ],
  },
  '/content-policy': {
    eyebrow: 'Safety',
    title: 'Content Policy',
    summary:
      'The studio is for original, safe, rights-cleared designs that can be responsibly printed.',
    sections: [
      section(
        'Disallowed requests',
        'Do not submit stolen IP, impersonation, hateful or harassing content, explicit sexual content, illegal goods, private data, or instructions that create real-world harm.'
      ),
      section(
        'Brand and IP review',
        'References to brands, characters, teams, public figures, or protected marks may be blocked or flagged for proof of rights.'
      ),
      section(
        'Production review',
        'Open Merch Studio may pause or refuse artwork that appears unsafe, infringing, unprintable, or outside provider rules.'
      ),
    ],
  },
  '/support': {
    eyebrow: 'Help',
    title: 'Support',
    summary: `For order help or production review, contact ${publicConfig.supportEmail}.`,
    sections: [
      section(
        'What to include',
        'Include the order number, checkout email, product, a short description of the issue, and relevant photos. Never send API keys, passwords, tokens, or payment credentials.'
      ),
      section(
        'Checkout availability',
        'If secure checkout is closed, your design and estimated subtotal remain saved in your guest session.'
      ),
    ],
  },
};

function PolicyPage({ route }: { route: PolicyRoute }) {
  return (
    <main className="policy-shell">
      <header className="policy-hero">
        <a className="back-link" href="/">
          ← Back to studio
        </a>
        <span className="kicker">{route.eyebrow}</span>
        <h1>{route.title}</h1>
        <p>{route.summary}</p>
      </header>
      <section className="policy-content">
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
        <span>Open Merch Studio</span>
      </footer>
    </main>
  );
}

export default function App() {
  const route = policies[path()];
  return route ? <PolicyPage route={route} /> : <WorkbenchStudioApp />;
}
