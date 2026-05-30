# OMS-093: Security Privacy And Credential Scan

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-09: Deployment And Paid Beta Launch  
**Critical path:** Yes

## Goal
Verify public repo readiness and paid beta privacy hygiene before launch.

## User Value
Customers and contributors can trust that the project handles credentials and private data responsibly.

## Current State
The repo has a public-readiness security doc, but every new launch feature needs the same discipline.

## Requirements
- Scan public docs, source, fixtures, and examples for credential-like values before commit and deploy.
- Review logs and analytics payloads for unnecessary customer data.
- Confirm provider values stay in deployment configuration, not repo files.
- Document any known residual privacy risk before launch.

## Implementation Notes
- Add or document a repeatable scan command for launch review.
- Keep private ops files outside the public repo.
- Review .env.example whenever integrations are added.

## Interfaces/Data Changes
- CI or local scan command.
- Launch audit report references scan output.

## Acceptance Criteria
- Public repo scan is clean or every finding is a documented false positive.
- Private operator notes are outside the public repo.
- No live provider values appear in docs, fixtures, source, or tests.
- Privacy review is recorded before paid beta activation.

## Test Plan
- Run credential pattern scan.
- Run git diff review for provider values.
- Review analytics event payload samples.

## Dependencies/Blockers
- OMS-072
- OPS-001.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Keep private operational details out of public GitHub issues and docs.

## Launch Risk Notes
A credential or private data leak would undermine both OSS and commerce goals.
