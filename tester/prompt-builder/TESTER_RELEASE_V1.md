# Prompt Builder — Tester Release v1

**Status:** READY FOR PROTECTED PREVIEW TESTING

## Tester objective
Use Prompt Builder for at least five real tasks and determine whether the generated prompt is clearer, more complete, and easier to use than the tester's original request.

## Required test mix
1. Business email or message.
2. Research request.
3. Planning/checklist request.
4. Rewrite or summarization request.
5. One task with an explicit format or length constraint.

## Acceptance evidence
For each task record:
- Did the tool preserve the objective? YES/NO
- Was the generated prompt clearer/more complete? YES/NO
- Did Prompt Quality Score respond sensibly? YES/NO
- Was anything important omitted? YES/NO + note
- Was anything invented? YES/NO + note
- Would you use the generated prompt as-is? YES / MINOR EDIT / NO

## Release thresholds
- 20 representative scenarios remain structurally valid.
- >=90% tester rating: clearer/more complete than original.
- Median low-friction completion target: under 90 seconds.
- No critical mobile/accessibility defect.
- No private SageForge instructions exposed.

## Governance
This is a protected tester-preview release only. No public production launch, billing, or customer sale is authorized by this package.
