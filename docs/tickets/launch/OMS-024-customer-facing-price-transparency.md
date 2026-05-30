# OMS-024: Customer Facing Price Transparency

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-03: Pricing And Studio Pass Economics  
**Critical path:** Yes

## Goal
Show pricing clearly enough that customers understand what they are buying and why.

## User Value
Customers feel the Studio Pass and product pricing are fair, not mysterious add-ons.

## Current State
The current quote UI is functional but not yet customer-polished.

## Requirements
- Show product price, estimated shipping/tax status, Studio Pass credit, and final checkout amount.
- Explain that the Studio Pass applies to purchase when eligible.
- Use estimate labels where final provider or payment values may change at checkout.
- Avoid exposing raw provider cost calculations unless a public transparency page intentionally explains the model.

## Implementation Notes
- Create customer-facing quote summary components.
- Map internal cost lines to plain English labels.
- Add edge copy for unavailable estimates and pass ineligible states.

## Interfaces/Data Changes
- Consumes structured quote response from OMS-023.
- May add frontend formatting helpers for money and estimates.

## Acceptance Criteria
- Quote summary is understandable without reading docs.
- The Studio Pass credit is visible when applied and absent when not eligible.
- Estimate language is accurate for shipping and tax states.
- No internal-only cost labels leak into the customer UI.

## Test Plan
- Component test quote summary permutations.
- E2E test pass credit visible in cart.
- Copy review for estimate labels.

## Dependencies/Blockers
- OMS-023
- OMS-053.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Avoid making tax, delivery, or provider-cost promises the app cannot verify.

## Launch Risk Notes
Ambiguous pricing will reduce conversion and increase support requests.
