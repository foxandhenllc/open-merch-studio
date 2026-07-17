import type { PolicyRoute } from './App.types';
import { publicConfig } from './config';
import { WorkbenchStudioApp } from './WorkbenchStudioApp';

const path = () => window.location.pathname.replace(/\/+$/, '') || '/';
const section = (heading: string, body: string) => ({ heading, body });
const effectiveDate = 'Effective July 17, 2026. Last updated July 17, 2026.';
const operatorDisclosure = 'Open Merch Studio is operated by FoxAndHen LLC.';

const policies: Record<string, PolicyRoute> = {
  '/privacy': {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    summary:
      'Open Merch Studio collects and uses information to operate the studio, fulfill orders, provide support, protect the service, and meet legal obligations.',
    sections: [
      section('Effective date', effectiveDate),
      section(
        'Who operates the service',
        `${operatorDisclosure} Contact us at ${publicConfig.supportEmail}.`
      ),
      section(
        'What we collect',
        'You can browse and explore designs without creating an account. We process the design prompts, artwork, product and variant choices, guest-session references, previews, quotes, and basic request or device information needed to operate, secure, and restore the studio. When you order, we process the contact, shipping, order, tax, and payment-status information needed to complete and support the purchase. Stripe collects payment-card details in hosted Checkout; Open Merch Studio receives payment status and transaction references, not your full card number.'
      ),
      section(
        'How we use information',
        'We use information to restore your session, generate and prepare artwork, create product previews and quotes, process payment, review and fulfill orders, prevent misuse, troubleshoot the service, provide support, and comply with tax, accounting, fraud-prevention, and other legal obligations.'
      ),
      section(
        'Service providers',
        'Vercel hosts and helps monitor the service. OpenAI generates and reviews AI-assisted artwork. remove.bg may prepare transparent print files. Stripe processes payment, tax, and Checkout information. Printful creates product previews and prints and ships approved orders. We provide information to these companies for the listed purposes, and their own privacy terms also apply to their processing.'
      ),
      section(
        'Artwork and marketing',
        'We do not publish or use your prompts or artwork in advertising, social media, or other marketing without your separate permission. We use them only as reasonably needed to generate, preview, print, fulfill, and support your order.'
      ),
      section(
        'Retention and deletion',
        `This browser may keep your product choices, prompt, guest-session ID, and saved design, mockup, and quote references for up to 30 days. Choosing Start fresh deletes that browser copy sooner. Server-side design, order, transaction, support, security, and audit records are retained only as long as reasonably needed for fulfillment, customer support, fraud prevention, tax and accounting, dispute handling, and legal compliance. Email ${publicConfig.supportEmail} to request access, correction, or deletion. Some records may need to be retained for transaction security or where required by law.`
      ),
      section(
        'Design prompts',
        'Do not enter payment-card data, passwords, API keys, private customer records, health information, or other sensitive personal information into a design prompt.'
      ),
      section(
        'Age',
        `The service is intended for adults and is not directed to anyone under 18. If you believe a minor provided personal information, contact ${publicConfig.supportEmail}.`
      ),
    ],
  },
  '/terms': {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    summary:
      'These Terms govern use of Open Merch Studio and purchases of custom physical products.',
    sections: [
      section('Effective date', effectiveDate),
      section(
        'Seller and agreement',
        `${operatorDisclosure} By using the studio or placing an order, you agree to these Terms and the Privacy Policy, Returns and Refunds Policy, and Content Policy.`
      ),
      section(
        'Eligibility and availability',
        'You must be at least 18 years old and able to enter into a binding agreement to place an order. At launch, Open Merch Studio accepts orders for delivery only to eligible addresses within the United States.'
      ),
      section(
        'Design rights',
        'You are responsible for ensuring that your prompts, uploads, instructions, and selected artwork are original or that you have permission to use them. Do not request or submit trademarks, copyrighted works, likenesses, private information, or other protected material unless you have the rights and permissions required to use and print it.'
      ),
      section(
        'AI-assisted output',
        'AI-assisted artwork may contain mistakes, unexpected details, or similarities to other material. It may not be unique or eligible for intellectual-property protection. You must review the final artwork, spelling, product, color, size, placement, and available mockups before ordering.'
      ),
      section(
        'Limited order license',
        'You retain the rights you hold in prompts and artwork you provide. You grant Open Merch Studio and its service providers limited, non-exclusive permission to host, copy, resize, adapt, transmit, and otherwise process that material only as reasonably needed to generate artwork, create previews, prepare print files, produce and deliver an order, provide support, handle refunds or claims, and protect the service. We will not use your artwork in marketing without separate permission.'
      ),
      section(
        'Prices, payment, and taxes',
        'The studio displays a pre-tax estimate. Stripe Checkout shows the final charge, including applicable tax, before you pay. FoxAndHen LLC remains responsible for applicable tax registration, filing, and remittance. Completing payment places the order subject to Open Merch Studio\'s post-payment artwork and fulfillment review; payment does not guarantee acceptance for production.'
      ),
      section(
        'Fulfillment review',
        'After payment, Open Merch Studio creates and manually reviews a Printful fulfillment draft for the selected product, artwork, print file, and delivery details. The draft is not automatically confirmed for production. If we cannot fulfill the order as submitted, we will cancel it and issue a full refund. We may also pause, reject, or refund an order that violates the Content Policy, appears unlawful or infringing, cannot be printed reliably, or cannot be fulfilled as ordered.'
      ),
      section(
        'Shipping and delays',
        'Delivery dates are estimates unless we expressly identify a guaranteed date. If we cannot ship within the time communicated to you, we will provide a revised shipping date and the option to accept the delay or cancel for a full refund, as required by applicable law. We will not substitute a materially different product without your approval.'
      ),
      section(
        'Returns and cancellations',
        'Custom products are made for one order and are subject to the Returns and Refunds Policy. Review your artwork, product, color, size, and shipping information carefully before paying.'
      ),
    ],
  },
  '/returns': {
    eyebrow: 'Support',
    title: 'Returns and Refunds Policy',
    summary: 'Every product is made for one order. Review all details carefully before paying.',
    sections: [
      section('Effective date', effectiveDate),
      section(
        'Post-payment review',
        'After payment, Open Merch Studio reviews the order before confirming its fulfillment draft for production. If we cannot fulfill the selected product and artwork as ordered, we will cancel the order and issue a full refund.'
      ),
      section(
        'Changes and cancellations',
        `Email ${publicConfig.supportEmail} immediately if you need to request a change or cancellation. We will try to help before production begins, but production can begin quickly and a requested change or cancellation is not guaranteed after the order has been confirmed for production.`
      ),
      section(
        'Buyer remorse and size selection',
        'Because products are made to order, we do not accept returns, exchanges, or refunds for buyer remorse, an incorrectly selected size or color, or a change of mind after production begins. This does not affect claims for damaged, defective, misprinted, incorrect, or materially different products.'
      ),
      section(
        'Damaged, defective, misprinted, or incorrect items',
        `Email ${publicConfig.supportEmail} within 30 days after receiving the product. Include the order number, a description of the problem, and clear photos showing the item and issue. If the claim is approved, we will arrange an appropriate replacement or refund without additional product or shipping charges.`
      ),
      section(
        'Packages lost in transit',
        `Email ${publicConfig.supportEmail} no later than 30 days after the estimated delivery date if tracking has stopped or the package has not arrived. Include the order number and current tracking information. We will investigate and, when the package is confirmed lost, arrange an appropriate replacement or refund.`
      ),
      section(
        'Shipping delays and inability to fulfill',
        'If we cannot ship within the time communicated to you, we will offer a revised shipping date and the choice to accept the delay or cancel for a full refund. If the order cannot be fulfilled, we will cancel it and refund all amounts paid for the unshipped order.'
      ),
      section(
        'Refund timing',
        'We initiate approved or legally required refunds to the original payment method within seven business days. Your bank or card issuer may take additional time to post the credit.'
      ),
      section(
        'How to request help',
        `Email ${publicConfig.supportEmail} before returning or mailing any product. Include your order number, Checkout email, product, a description of the issue, and relevant photos. Do not send payment credentials or passwords. This policy does not limit rights that cannot be waived under applicable law.`
      ),
    ],
  },
  '/content-policy': {
    eyebrow: 'Safety',
    title: 'Content Policy',
    summary:
      'The studio is for original, safe, rights-cleared designs that can be responsibly printed.',
    sections: [
      section('Effective date', effectiveDate),
      section(
        'Rights-cleared content',
        'Submit only prompts, images, names, marks, likenesses, and other material that you created or have permission to use and reproduce on merchandise. References to brands, characters, teams, public figures, or protected marks may be blocked or require proof of permission.'
      ),
      section(
        'Prohibited content',
        'Do not submit content that infringes intellectual-property or privacy rights; impersonates or deceives others; promotes hatred, harassment, violence, illegal goods, or real-world harm; contains explicit sexual material; exploits minors; reveals private data; or otherwise violates applicable law or provider rules.'
      ),
      section(
        'Review and enforcement',
        'Open Merch Studio may use automated and manual review and may block generation or Checkout, request more information, pause production, or refuse an order that appears unsafe, unlawful, infringing, deceptive, unprintable, or outside fulfillment-provider rules.'
      ),
      section(
        'Paid orders',
        'If a policy issue is identified after payment but before production, we may cancel the affected order and issue a full refund. Payment does not require Open Merch Studio or a fulfillment provider to produce prohibited content.'
      ),
      section(
        'Questions',
        `If you are unsure whether you have permission to use particular material, obtain permission before submitting it. Contact ${publicConfig.supportEmail} with policy questions, but Open Merch Studio cannot provide legal advice about ownership or licensing.`
      ),
    ],
  },
  '/support': {
    eyebrow: 'Help',
    title: 'Support',
    summary: 'For order help, a privacy request, or production review, email us at',
    sections: [
      section(
        'What to include',
        'Include the order number, checkout email, product, a short description of the issue, and relevant photos. Never send API keys, passwords, tokens, or payment credentials.'
      ),
      section(
        'Checkout availability',
        'If secure checkout is closed, your design and estimated subtotal remain saved in your guest session.'
      ),
      section(
        'Seller and policy contact',
        `${operatorDisclosure} For order, privacy, policy, or production questions, email ${publicConfig.supportEmail}.`
      ),
    ],
  },
};

function PolicyPage({ route }: { route: PolicyRoute }) {
  const isSupport = route === policies['/support'];
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
        <span>Open Merch Studio</span>
      </footer>
    </main>
  );
}

export default function App() {
  const currentPath = path();
  const route = policies[currentPath];
  if (route) return <PolicyPage route={route} />;
  return currentPath === '/' ? <WorkbenchStudioApp /> : <NotFoundPage />;
}
