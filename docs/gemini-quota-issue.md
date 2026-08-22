# Gemini image generation — stuck on free-tier quota despite paid billing

**Status:** Open, escalated to Google (live support chat + developer forum). Not fixable
from our side — everything on the app/config side is confirmed correct.

## The problem

Calls to `gemini-3.1-flash-image` (the model Viola House uses for illustration)
fail with a hard `429 RESOURCE_EXHAUSTED`, citing **free-tier** quota — `limit: 0` —
even though the linked billing account is a genuine **paid** account, not a free
trial.

### Confirmed facts (as of 2026-08-22)

- Correct Google account: **`copperhh@gmail.com`** (not `cdcorry23@gmail.com` —
  this was a real source of confusion mid-troubleshooting, see Timeline).
- Two separate Gemini projects reproduce the identical error:
  - `gen-lang-client-0151804612` — "Viola House 2"
  - `gen-lang-client-0275920174` — "Default Gemini Project"
- Both have the **same billing account** linked: "My Billing Account"
  (`01B748-4456A9-46184A`), status **Tier 1 · Prepay**.
- That billing account is **not** a free trial — confirmed via
  Cloud Console → Billing → "Paid account" popup: *"Your account was upgraded
  from free trial on May 26, 2026."*
- `GEMINI_API_KEY` in Vercel (prod) is valid and correctly wired — confirmed via
  `/api/write` (text generation) working live in production. Only the **image**
  model is affected.
- Google's own Billing Support AI chat initially claimed the account still had
  an active Free Trial (which would explain the free-tier lock) — that
  diagnosis is **factually wrong** for this account, per the confirmation above.
- Tried and ruled out as workarounds (all fail the same way or worse):
  - Waiting ~24h+ (the "usually self-resolves" window from Google's own dev
    forum reports) — no change after multiple days.
  - Creating a second, brand-new project and linking the *same* paid billing
    account to it — identical `limit: 0` error.
  - Alternate model IDs (`gemini-2.5-flash-image`, `gemini-3.1-flash-lite-image`,
    `gemini-3-pro-image`) — all rejected outright as unrecognized
    (`400 unexpected model name format`) on this account/SDK, so not a viable
    substitute; `gemini-3.1-flash-image` is the only recognized image model ID.

### Exact current error (captured live, 2026-08-22T16:51:32Z)

```json
{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-flash-image\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_input_token_count","quotaId":"GenerateContentInputTokensPerModelPerMinute-FreeTier","quotaDimensions":{"location":"global","model":"gemini-3.1-flash-image"}},{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaDimensions":{"model":"gemini-3.1-flash-image","location":"global"}},{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaDimensions":{"model":"gemini-3.1-flash-image","location":"global"}}]}]}}
```

Every quota violation is tagged `-FreeTier`, despite the account being paid.
That mismatch is the crux of the bug.

## Escalation channels (both opened 2026-08-22)

1. **Google AI Developer Forum** — reply posted on the closest matching public
   thread describing the same symptom (Tier 1 billing active, `limit: 0` on
   this exact model):
   https://discuss.ai.google.dev/t/tier-1-paid-project-blocked-by-free-tier-quota-limit-0-on-gemini-3-1-flash-image-matches-long-running-pattern-in-this-category/177717
2. **Google Cloud billing live chat** — escalated from the AI agent to a human
   agent ("Shoeb A"), case opened under `copperhh@gmail.com`, referencing
   billing account `01B748-4456A9-46184A` and both project IDs above.

## What still works today (no dependency on this bug)

Viola House is fully usable without AI illustration:
- Writing + autosave + offline persistence
- AI **writing** helper (confirmed working — separate from the broken image
  model, uses `gemini-3.7-flash`)
- Page splitting
- **Uploading your own art** per page and as the cover (bypasses AI entirely)
- KDP PDF export (interior + cover), verified against real books
- The in-app "Publishing Day" KDP walkthrough guide

## Next steps

- Wait for a reply on either the forum post or the live support case.
- Don't retry alternate models or new projects again — already ruled out above.
- Once Google confirms/fixes: just re-test `POST /api/illustrate` (`mode:
  "reference"`) against https://viola-house.vercel.app — no code or config
  change should be needed on our side.

## Re-check log

- **2026-08-22** (later same day): re-tested `POST /api/illustrate`
  (`mode: "reference"`) directly against prod. Still `429
  RESOURCE_EXHAUSTED`, still `generate_content_free_tier_requests limit: 0`
  on `gemini-3.1-flash-image`. No change — still purely waiting on Google.

## New lead: unfunded Prepay balance (2026-08-22, Google Cloud Billing Support chat)

Craig opened the in-console "Chat with Billing Support" AI on
`gen-lang-client-0151804612` ("Viola House 2") and got a plausible new
explanation, distinct from the earlier "provisioning-sync bug" theory:

> When you linked a billing account, the project transitioned from Free
> Tier to Paid Tier — so free-tier quota is set to 0 by design. The
> billing account is Tier 1 (Prepay) with a **net cost of $0.00**. Prepay
> accounts require a **positive, pre-funded balance** to make requests;
> Free Trial promotional credit cannot cover this. Fix: Console → Billing
> → Overview → Make a Payment / Add Funds to deposit the minimum required
> balance — paid quota then initializes automatically.

This fits the symptom (quota pinned at exactly 0, tagged FreeTier) better
than a transient sync bug. **Not yet verified** — Google's AI chat carries
its own accuracy disclaimer, so confirm the actual balance via the Billing
Report link before funding anything. This is a real money transaction, so
it's on Craig to do (not something the AI/assistant can do on his behalf).

**Next step:** check Billing Report for `01B748-4456A9-46184A` — if
balance is genuinely $0, add funds via Cloud Console, then re-test
`POST /api/illustrate`.
