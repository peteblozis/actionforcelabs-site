# FreezerFlow LifeFit — Tester Deployment Contract

**Status:** pre-deployment contract  
**Target:** protected tester environment  
**Public commercialization:** not authorized by this document

## Purpose

FreezerFlow LifeFit is a standalone customer-facing product. The tester build may share ActionForge Labs hosting infrastructure during development, but the product package must not depend on unrelated private application APIs, private orchestration logic, private credentials, or internal administration routes.

## Tested-package boundary

The deployable tester artifact is limited to:

`tester/freezerflow-lifefit/**`

The build workflow must:
1. run FreezerFlow source-contract tests;
2. package only the FreezerFlow tester directory;
3. stamp `build-meta.json` and the artifact manifest with the exact source SHA;
4. fail if private/internal paths enter the package;
5. upload the package as a versioned build artifact.

## Tester access boundary

The tester URL must be protected before external testing.

Minimum requirements:
- deny by default;
- allowlisted tester identities only;
- no anonymous fallback;
- no public indexing;
- tester session separated from admin privileges;
- Pete = admin/testing owner;
- external testers = standard tester only;
- application authorization must eventually be server-side when a backend is introduced.

## Runtime boundary

The FreezerFlow browser application must not call unrelated private APIs.

For the current static MVP:
- local browser state is acceptable for source/UI testing;
- no personal health profile is committed in source;
- no secrets are required in the browser;
- no billing;
- no production customer data.

Before multi-user testing:
- add a dedicated FreezerFlow backend/data store;
- define account ownership and row-level authorization;
- isolate secrets by environment;
- define audit events;
- add retention/delete/export behavior;
- verify backup/restore.

## Deployment evidence required

A tester deployment may be promoted to **DEPLOYMENT PASS** only when all of the following are recorded:

- exact source SHA;
- exact artifact/build manifest;
- deployment identifier;
- deployment timestamp;
- protected tester URL;
- access policy evidence;
- package boundary pass;
- source-contract pass;
- no-secret/public-exposure pass.

## Live URL evidence required

A deployment becomes **LIVE-URL PASS** only after a fresh-session test verifies:

1. unauthorized user is denied;
2. authorized tester can open the route;
3. build identity shown on screen matches the tested artifact source SHA;
4. LifeFit profile can be saved;
5. inventory can be added;
6. disallowed cooking methods are rejected;
7. low-confidence inferred inventory requires confirmation;
8. one Best Next Meal is produced;
9. Cook Mode shows non-fabricated instructions and applicable safety target;
10. accepted meal updates inventory;
11. undo works;
12. large/spacious view works on mobile;
13. no private/internal terminology appears in the tester surface.

## User pass

Pete is the first human-release tester for this build lane.

Outside tester release is blocked until Pete completes the exact deployed candidate and the defects he finds are either:
- fixed and converted to regression tests; or
- explicitly accepted as known limitations that do not violate safety, privacy, or the core product promise.

## Commercial separation

Before sale, FreezerFlow must have a dedicated product runtime/data boundary independent of unrelated internal systems. Hosting-provider reuse is acceptable; private system dependency is not.
