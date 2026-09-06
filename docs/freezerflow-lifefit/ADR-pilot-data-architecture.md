# ADR — FreezerFlow LifeFit Pilot Data Architecture

**Status:** PROVISIONAL / no provider spend authorized  
**Date:** 2026-09-05  
**Decision owner:** Pete  
**Purpose:** define the lowest-maintenance path from the current local tester to a standalone multi-user product without coupling FreezerFlow to private SFC infrastructure.

## Decision

Use a **storage-adapter architecture**.

- **Current Pete-first tester adapter:** browser-local storage.
- **Provisional multi-user pilot adapter:** Supabase using managed PostgreSQL + Auth + Storage + Row Level Security.
- The recommendation/rotation/LifeFit engine remains provider-independent.
- No production provider project or paid plan is authorized by this ADR.

## Why Supabase leads for the pilot

FreezerFlow already has an approved PostgreSQL direction. Supabase combines:
- PostgreSQL;
- email/passwordless-capable authentication;
- file/object storage for future inventory photos;
- Postgres Row Level Security;
- migrations and database testing;
- free technical-pilot capacity;
- one managed vendor instead of separate database/auth/storage products.

Current official pricing reviewed 2026-09-05:
- Free: $0, 500 MB database, 50,000 MAU, 1 GB file storage; free projects may pause after one week of inactivity.
- Pro: from $25/month, with larger database/storage quotas and daily database backups.

Production economics must be rechecked before purchase.

## Alternative considered — Cloudflare D1 + R2

Advantages:
- low usage-based database and object-storage cost;
- natural fit with existing Cloudflare hosting;
- scale-to-zero D1 billing;
- R2 has no egress charge.

Reasons not selected as the first pilot path:
- D1 is not PostgreSQL;
- authentication and user authorization require additional architecture;
- it increases custom plumbing for a product whose value is the kitchen decision system, not infrastructure;
- it diverges from the approved build-pack PostgreSQL baseline.

Cloudflare remains suitable for hosting/perimeter access and could be reconsidered later if measured economics justify a migration.

## Required adapter contract

The UI/decision engine may call a storage service exposing logical operations such as:

- loadProfile / saveProfile
- listInventory / addInventory / updateInventory / removeInventory
- reconcileInventory
- listQuickMeals / saveQuickMeal / removeQuickMeal
- recordRecommendation
- recordFeedback
- completeMeal
- undoLastInventoryEvent
- exportUserData
- deleteUserData

No product logic should depend directly on a Supabase SDK object.

## Minimum multi-user schema

### profiles
- user_id
- display_name
- household_size
- life_mode
- created_at / updated_at

### lifefit_profiles
- user_id
- allowed_appliances
- skill_level
- effort_level
- cleanup_tolerance
- meal_emphasis
- avoidances/preferences
- accessibility_preferences
- updated_at

### inventory_items
- id
- user_id / household_id
- item_name
- brand
- role/category
- location
- practical_unit
- servings_left
- opened
- leftover
- use_state / age state
- method
- required_skill
- required_effort
- required_cleanup
- inferred
- source_confidence
- last_confirmed_at
- photo_path
- parent_meal_event_id
- created_at / updated_at

### quick_meals
- id
- user_id
- name
- item/component definition
- execution/prep-card reference
- allowed methods
- shopping-gap rules
- created_at / updated_at

### recommendation_events
- id
- user_id
- recommendation payload/fingerprint
- inventory version
- LifeFit version
- score/reasons
- accepted state
- created_at

### feedback
- id
- user_id
- recommendation_id
- liked
- too_much_work
- repeat_allowed
- reject_reason
- prepared_portions
- leftover_servings_created
- created_at

### inventory_events
Append-oriented event history:
- id
- user_id
- item_id
- event_type
- quantity_before / after
- recommendation_id
- idempotency_key
- created_at

## Authorization requirements

Every exposed table:
1. RLS enabled.
2. Anonymous grants revoked unless explicitly required.
3. Authenticated operations granted only as needed.
4. Row policies require ownership or explicit household membership.
5. Service-role credentials remain server-side and never enter browser source.
6. Authorization tests prove:
   - User A cannot read/write User B inventory.
   - unauthenticated client cannot read private inventory.
   - household member can reach only explicitly shared household rows.
   - removed household member loses access.
   - exported/deleted account data is scoped to the authenticated owner.

## Storage/photo requirements

- Photos stored outside database rows.
- Private buckets by default.
- Object paths namespaced by user/household.
- Storage access controlled by authenticated ownership policy.
- Low-confidence image recognition stays provisional until confirmed.
- Deleting an inventory photo must delete the underlying object, not only its metadata.

## Local-to-cloud migration

1. Keep the current local JSON backup format versioned.
2. Build a storage adapter around current local data.
3. Build Supabase adapter behind the same contract.
4. Import Pete's neutral tester backup into a private test account.
5. Verify recommendation parity between local and cloud adapters.
6. Run cross-user isolation tests.
7. Only then invite another tester.

## Health-data boundary

FreezerFlow is a meal/food organization product, not a diagnostic or treatment system.

- User-selected nutrition preferences may guide ranking.
- Personal medical history is not required for core product operation.
- Do not log sensitive health notes in general event logs.
- A future health-integration tier requires a separate privacy/regulatory review before build or sale.

## Go/no-go gate for backend provisioning

Provision a provider project only when:
- current static tester product spine and accessibility tests pass;
- Pete-first neutral user journey is ready;
- the exact schema/RLS tests are committed;
- free-tier technical pilot is sufficient;
- no paid plan is required merely to start the technical migration.

No provider spend or production customer data is authorized by this ADR.
