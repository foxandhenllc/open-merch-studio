# OMS-021: AI Credit Ledger And Spend Caps

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-03: Pricing And Studio Pass Economics  
**Critical path:** Yes

## Goal
Track internal AI spend exposure for every design action and stop runaway generation before it becomes expensive.

## User Value
The shop can stay generous with exploration without needing to overcharge customers.

## Current State
The app can create mock design drafts but does not yet track internal generation allowance or cost exposure.

## Requirements
- Create an internal ledger for design actions, provider, model tier, estimated cost, customer session, and allowance bucket.
- Support per-session, per-account, per-IP, and daily aggregate caps.
- Block or downgrade generation when caps are reached.
- Keep ledger values operator-facing only.

## Implementation Notes
- Add persistence for design spend events and session allowance state.
- Add a server-side policy service that authorizes each generation request before provider calls.
- Use source anchors for current OpenAI pricing checks but store configured local estimates so tests are deterministic.

## Interfaces/Data Changes
- Design draft endpoints should call an authorization service before provider execution.
- Admin reporting in OMS-071 reads ledger data.

## Acceptance Criteria
- Every generation path records a ledger event in live and mock modes.
- Exceeded caps return customer-safe guidance and do not call live providers.
- Operators can configure daily and per-session limits without code changes.
- Tests prove pass allowance and free allowance are counted separately.

## Test Plan
- Unit test cap decisions.
- Integration test generation request blocked before provider call.
- Regression test ledger recording in mock mode.

## Dependencies/Blockers
- OMS-020
- OMS-040.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Do not log prompts or uploads in a way that exposes private user content beyond what the product needs.

## Launch Risk Notes
Without caps, unpaid traffic can create avoidable OpenAI image spend.
