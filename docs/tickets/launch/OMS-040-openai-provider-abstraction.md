# OMS-040: OpenAI Provider Abstraction

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Make OpenAI integration optional, testable, and replaceable while preserving fixture-mode development.

## User Value
The product can use high-quality AI design features in production and still remain easy to run as OSS.

## Current State
The current design endpoint can return mock drafts, but provider boundaries need production shaping.

## Requirements
- Create provider interfaces for idea assistance, image generation, image editing, and design review.
- Support live OpenAI provider only when configured by deployment environment.
- Keep mock/local provider behavior as the default for clean clones.
- Centralize model selection, quality tier, timeout, retry, and cost estimate policy.

## Implementation Notes
- Add a provider registry with explicit live versus mock mode.
- Call the AI spend policy before any live provider request.
- Keep provider request and response types product-neutral.

## Interfaces/Data Changes
- Design draft endpoints depend on provider interfaces instead of direct provider calls.
- Admin config exposes active provider mode without revealing private values.

## Acceptance Criteria
- The app runs without live provider credentials.
- Provider mode is visible in dev/admin surfaces.
- Live generation paths are blocked when spend policy denies the request.
- Provider-specific errors are normalized before reaching the frontend.

## Test Plan
- Unit test provider registry selection.
- Integration test mock provider clean clone flow.
- Integration test live provider disabled when configuration is missing.

## Dependencies/Blockers
- OMS-021.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Do not commit live provider configuration values or customer prompts used outside fixture tests.

## Launch Risk Notes
Tightly coupling to a live provider will make OSS setup fragile and production spend hard to control.
