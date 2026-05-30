# OMS-020: Studio Pass Pricing Model

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-03: Pricing And Studio Pass Economics  
**Critical path:** Yes

## Goal
Implement the $5 Studio Pass as the simple customer-facing way to unlock meaningful design work.

## User Value
Customers can try the creative flow without surprise fees, and the pass value carries into a purchase.

## Current State
The backend has an internal AI design fee placeholder, but no customer-facing Studio Pass model.

## Requirements
- Define Studio Pass as $5 and apply that amount to the final merchandise purchase when the same session converts.
- Allow free low-cost ideation before the pass is required.
- Define included allowance as 8 rough drafts, or 4 rough drafts plus 2 edits, or 1 high-quality print-ready final.
- Show pass status in the studio and quote summary without exposing provider cost details.

## Implementation Notes
- Add a Studio Pass domain concept separate from internal cost accounting.
- Track pass purchase, available allowance, consumed allowance, and applied-to-order state.
- Keep current internal AI design allocation for quote math until replaced by ledger-backed values.

## Interfaces/Data Changes
- May add studioPassId to studio sessions, quotes, and checkout metadata.
- Stripe integration in OMS-053 must sell and apply the pass.

## Acceptance Criteria
- A customer sees free start, pass price, included allowance, and apply-to-purchase behavior before paying.
- A purchased pass can reduce the final eligible order total once.
- The pass cannot be applied to unrelated sessions without an intentional claim flow.
- Fixture mode can simulate a purchased pass.

## Test Plan
- Unit test pass purchase and redemption states.
- Quote test with and without pass credit.
- E2E test free start to pass to order.

## Dependencies/Blockers
- OMS-021
- OMS-052
- OMS-053.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Do not imply unlimited generation or guaranteed final artwork quality.

## Launch Risk Notes
Confusing pass rules could feel like a hidden fee instead of a fair creative deposit.
