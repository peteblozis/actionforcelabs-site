# SFC Product Testing SOP — Consensus Standard

Status: ACTIVE OPERATING STANDARD for SFC products entering tester mode.

## Governing principle
Build → verify → Pete smoke test → outside usability test → behavior/accuracy validation → Claude independent review → ChatGPT reconciliation → Pete decision → consensus specification → commercialization or stop.

## Evidence tracks must stay separate
1. **Usability track** — can a new user understand and operate the product without help?
2. **Behavior track** — does the product change what a user actually does over time?
3. **Commercial track** — do non-family users demonstrate real willingness to pay or another monetizable behavior?
4. **Accuracy track** — were the product’s falsifiable recommendations correct?

Family testers are valid for usability and defect discovery. Their stated willingness-to-pay answers are not commercial evidence.

## Tester release sequence
1. Internal build and static checks.
2. Deploy candidate.
3. Verify the actual tester route and content, not deployment status alone.
4. Pete receives a fresh test invitation and restarts from the beginning.
5. Fix defects; maximum three smoke-test cycles before a root-cause review.
6. One cold-read comprehension check by a person unfamiliar with the product.
7. Stagger outside testers: forensic/technical first, naive/nontechnical next, remaining testers after fixes.
8. Outside invitations send only after Pete explicitly says READY TO GO.

## READY TO GO means
- entry link opens on phone and desktop
- intended release/version is visible
- all required routes render unique expected content
- known-dead route fails correctly
- primary tester flow completes end-to-end
- feedback path is verified
- no known blocking defect remains
- privacy/freshness disclosure is visible where needed

## Mandatory test telemetry / records
Every test record should include when technically available:
- tester token / cohort
- product
- build SHA
- started_at / completed_at
- step timing
- abandonment / last step
- device, OS, browser, viewport
- help-needed / error flag
- frozen verdict payload: inputs, source observations, timestamps, recommendation, confidence/reasoning
- pre-verdict baseline behavior
- post-verdict intended action
- tester feedback

Durable product price observations should not require durable linkage to a person’s identity.

## Accuracy ledger
Every recommendation that can be evaluated later must create a falsifiable claim and follow-up rule. Example: WAIT because an item is expected to become available below $X within N days. Scheduled follow-up checks the outcome and records PASS / FAIL / INDETERMINATE with evidence. Accuracy is a release and kill criterion, not only a reporting metric.

Initial Fairsight commercialization gates once automated pricing exists:
- exact-variant resolution ≥95% on a hand-labeled representative set
- WAIT verdict validation ≥70% within their stated windows
- zero unresolved materially false statements
- ≥20 non-family users before treating commercial-behavior evidence as meaningful
- Day-30 return rate target ≥20%
- acted-upon verdict rate measured behaviorally
- documented annualized user savings target ≥$100 per active user before strong commercialization claims

## Deployment verification rule
A deploy job marked successful is NOT tester-ready.

Before an invitation can be sent for a build, verification should prove:
- stable tester hostname resolves
- deployed build identity matches intended SHA
- entry page contains expected unique text
- each required route contains unique route-specific text
- a known-dead route returns a real failure, not a silent app-shell 200
- feedback submission completes a synthetic round-trip when server storage is enabled
- verification result is recorded against the exact SHA

**Invite sender rule:** refuse to send an outside-test invite unless a passing verification exists for the exact build being invited.

## Tester UX standard
Consumer-facing tests use this pattern unless the product requires otherwise:
1. Orientation / promise
2. One-click recognizable example
3. Clear “aha” result
4. One personal try using progressive disclosure
5. Three or fewer plain-English feedback questions

No GitHub, Cloudflare, developer vocabulary, URL copying, or setup instructions in the normal tester path.

Every screen should provide a plain-language “Something’s wrong” escape path that captures the current step/state when possible.

## Feedback transport
Primary target: POST to central tester storage. Email/copy is fallback, not primary. Do not infer non-completion from a mailto failure.

## Instrumentation
At small scale, lightweight custom Tester Hub remains the tester-facing system. Behind it, adopt commodity instrumentation rather than rebuilding it. Session replay is permitted only with explicit tester notice/consent and input masking.

## Privacy / trust
- No retailer credentials or account linking in early beta.
- Mask sensitive inputs in replay.
- Publish a simple data-retention statement.
- Display price observation timestamp/freshness and advise checkout confirmation.
- Do not claim personalized pricing from a price difference alone.
- Recommendation logic must not use affiliate commission amount/status.

## Product decision gate
Final outcome after evidence review:
- ADVANCE
- ADVANCE WITH CHANGES
- MORE VALIDATION REQUIRED
- PIVOT
- STOP

Claude independently reviews evidence. ChatGPT independently reviews evidence. Pete resolves disagreement. The resulting consensus becomes the next approved specification.

## Lightweight lane
Internal low-risk copy, layout, instrumentation and diagnostic changes may use a shortened build → verify → Pete smoke-test cycle. Full ceremony is required before a new product/version reaches outside testers or changes consequential recommendation logic.