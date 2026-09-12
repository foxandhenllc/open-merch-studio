import { useState } from 'react';
import { streamerSteps, streamerProducts, streamerPanels } from './streamer-story';
import './streamer-demo.css';
const photo = '/examples/streamer/night-shift-merch.png';
function StorePreview({ stage = 3, small = false }: { stage?: number; small?: boolean }) {
  return (
    <div
      className={`night-store ${small ? 'night-store--small' : ''}`}
      aria-label="Streamer storefront preview"
    >
      {stage === 0 ? (
        <div className="night-empty">
          <span>BEFORE SETUP</span>
          <h2>No store published.</h2>
          <p>Identity, artwork and collections are empty.</p>
        </div>
      ) : (
        <>
          <header className="night-header">
            <a href="/examples/streamer" className="night-wordmark">
              ☾ NIGHT SHIFT
            </a>
            <span>THE AFTER HOURS DROP</span>
          </header>
          <section className="night-hero">
            {stage >= 2 && (
              <img
                src={photo}
                alt="Illustrative Night Shift moon-emote tee, mug and sticker on a late-night gaming desk"
              />
            )}
            <div className="night-hero-copy">
              <span>FOR THE ONE-MORE-GAME CROWD</span>
              <h1>
                Late games.
                <br />
                Good people.
              </h1>
              <p>
                A little piece of the channel,
                <br />
                away from the chat.
              </p>
              {stage >= 2 ? (
                <a href={small ? '#configured-values' : '#the-drop'} className="night-cta">
                  {stage === 3 ? 'Explore the drop' : 'Inspect the draft'} ↓
                </a>
              ) : (
                <span className="night-draft-label">Identity preview · collection not added</span>
              )}
            </div>
          </section>
          {stage >= 2 && (
            <section className="night-drop" id={small ? undefined : 'the-drop'}>
              <div className="night-drop-heading">
                <h2>The After Hours Drop</h2>
                <p>One original emote. Three ways to take it with you.</p>
              </div>
              <div className="night-products">
                {streamerProducts.map((product) => (
                  <article key={product.name}>
                    <div
                      className="night-product-photo"
                      role="img"
                      aria-label={`Illustrative ${product.name}`}
                      style={{
                        backgroundImage: `url(${photo})`,
                        backgroundPosition: product.position,
                        backgroundSize: product.size,
                      }}
                    />
                    <div className="night-product-name">
                      <h3>{product.name}</h3>
                      <span>{product.price}</span>
                    </div>
                    <p>{product.detail}</p>
                    <span className="night-product-state">
                      {stage === 3
                        ? 'Shown as published · demo purchase disabled'
                        : 'Private draft · not visible to fans'}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
export function StreamerDemo({ admin = false }: { admin?: boolean }) {
  const [step, setStep] = useState(0);
  const [panel, setPanel] = useState(0);
  const current = streamerSteps[step];
  const selected = streamerPanels[panel];
  return (
    <div className={`streamer-demo ${admin ? 'streamer-demo--admin' : ''}`}>
      <div className="streamer-demo-bar">
        <strong>Fictional example · read-only</strong>
        <span>Separate from your store. No accounts, payments or fulfillment.</span>
        <a href="/admin/">Back to my blank store →</a>
      </div>
      {!admin ? (
        <>
          <StorePreview />
          <section className="night-story">
            <span>FROM EMOTE TO MERCH</span>
            <h2>The artwork already belonged to the community.</h2>
            <p>
              The owner uploaded their original channel emote, chose three products, reviewed the
              prints, and published a focused collection. No automatic clip scanning or Twitch
              connection is implied.
            </p>
            <a className="night-cta" href="/examples/streamer/admin">
              Open the read-only admin →
            </a>
          </section>
          <footer className="night-footer">
            Fictional Night Shift channel. AI-generated illustrative mockups, not supplier proofs.
            Prices are examples. Built as an Open Merch Studio walkthrough.
          </footer>
        </>
      ) : (
        <>
          <header className="streamer-admin-heading">
            <div>
              <span>OWNER WORKSPACE / NIGHT SHIFT</span>
              <h1>How this store came together.</h1>
              <p>
                Walk through the setup in order. Compare what the owner changed with what fans could
                see at that point.
              </p>
            </div>
            <a href="/examples/streamer">Open finished storefront ↗</a>
          </header>
          <main className="streamer-admin-main">
            <section className="streamer-walkthrough" aria-label="Streamer setup sequence">
              <div className="streamer-sequence">
                <h2>Setup sequence</h2>
                <ol>
                  {streamerSteps.map((item, index) => (
                    <li key={item.title}>
                      <button
                        aria-current={step === index ? 'step' : undefined}
                        onClick={() => setStep(index)}
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <article className="streamer-step-detail">
                <span className="streamer-kicker">
                  STEP {step + 1} / {streamerSteps.length} · {current.where}
                </span>
                <h2>{current.title}</h2>
                <p>{current.action}</p>
                <dl>
                  <div>
                    <dt>Before</dt>
                    <dd>{current.before}</dd>
                  </div>
                  <div>
                    <dt>After the owner’s action</dt>
                    <dd>{current.after}</dd>
                  </div>
                </dl>
                <p className="streamer-impact">
                  <strong>What fans see:</strong> {current.visible}.
                </p>
                <div className="streamer-step-buttons">
                  <button disabled={step === 0} onClick={() => setStep(step - 1)}>
                    ← Previous step
                  </button>
                  <button
                    disabled={step === streamerSteps.length - 1}
                    onClick={() => setStep(step + 1)}
                  >
                    Next step →
                  </button>
                </div>
              </article>
            </section>
            <section className="streamer-comparison" aria-label="Admin to storefront comparison">
              <div className="streamer-preview-title">
                <h2>Store result at step {step + 1}</h2>
                <span>
                  {current.stage === 3 ? 'Finished illustration' : 'Owner preview · not public'}
                </span>
              </div>
              <StorePreview stage={current.stage} small />
              <p className="streamer-asset-note">
                Illustrative mockup. The same image is used to show the visual relationship;
                production needs supplier-specific mockups and a physical sample.
              </p>
            </section>
            <section className="streamer-inspector" id="configured-values">
              <header>
                <span className="streamer-kicker">FINISHED CONFIGURATION</span>
                <h2>Inspect every part of the owner workspace.</h2>
                <p>
                  These are read-only example values. There is no save, publish, connect, or order
                  action behind this page.
                </p>
              </header>
              <nav aria-label="Read-only admin sections">
                {streamerPanels.map((item, index) => (
                  <button
                    key={item.id}
                    aria-current={panel === index ? 'page' : undefined}
                    onClick={() => setPanel(index)}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
              <div role="region" aria-label={`${selected.title} example values`}>
                <h3>{selected.title}</h3>
                <dl>
                  {selected.rows.map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="streamer-impact">
                  <strong>Effect on the store:</strong> {selected.impact}
                </p>
              </div>
            </section>
          </main>
          <footer className="night-footer">
            A mock configured store, not a live installation or completed client case study. Your
            own installation remains untouched.
          </footer>
        </>
      )}
    </div>
  );
}
