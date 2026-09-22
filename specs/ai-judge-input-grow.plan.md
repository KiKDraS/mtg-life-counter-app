# AI Judge Input Grow — Test Plan (TC-AJ-25..33)

## Application Overview

Feature branch feature/judge-input-grow changed the AI Judge chat input: the <input type="text"> became an auto-grow <textarea> (aria-label "Ask about a card or rule", placeholder "Ask about a card or rule…", field-sizing:content, max-h-40 cap with internal scroll) and a new submit button (aria-label "Send question", glyph ⏎, disabled on empty draft / streaming / offline). Enter sends, Shift+Enter inserts a newline without sending. This plan covers ONLY the new/changed behaviors; full behavioral coverage for existing paths stays in specs/ai-judge.spec.md TC-AJ-01..24. All behaviors were verified live in Chromium against the running app before writing the spec. Spec doc updated: specs/ai-judge.spec.md §1.21–1.29, header count 20 → 29 tests.

## Test Scenarios

### 1. AI Judge Input Grow

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-AJ-25: Send button — visible, disabled on empty/whitespace draft, enabled after typing

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page).
    - expect: sendButton(page) = getByRole("button", { name: "Send question" }) visible inside modal, bottom-right of input row; glyph ⏎; type submit
  2. Check fresh draft.
    - expect: send button toBeDisabled()
  3. input(page).fill("   ") (whitespace only).
    - expect: send button still toBeDisabled() (trim-empty guard)
  4. input(page).fill("Is this play legal?").
    - expect: send button toBeEnabled(); input value exact

#### 1.2. TC-AJ-26: Click send button submits POST; input cleared

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page).
  2. input(page).fill("Click send test"); click sendButton(page).
    - expect: waitForBodies(page, 1); bodies[0].question exact "Click send test"; sessionId aijudge-0; gameContext undefined
    - expect: input value "" (cleared after send)
  3. Wait done.
    - expect: user bubble "Click send test" + system bubble "When you gain life"; input + send button enabled

#### 1.3. TC-AJ-27: Enter still sends after input→textarea swap (regression pointer)

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal. sendQuestion(page, "Enter still works").
    - expect: waitForBodies(page, 1); question exact. Full coverage in TC-AJ-02 — swap guard only.
  2. Wait done.
    - expect: user + system bubbles render; input + send button enabled

#### 1.4. TC-AJ-28: Shift+Enter inserts newline, does NOT send; Enter then sends multi-line draft

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page).
  2. input(page).fill("line one"); input(page).press("Shift+Enter"); input(page).pressSequentially("line two").
    - expect: input value "line one\nline two" (newline inserted, NOT submitted)
    - expect: POST count stays 0 (expect.poll on judgeBodies length, 1s window)
  3. Press Enter (no Shift).
    - expect: waitForBodies(page, 1); bodies[0].question exact "line one\nline two" (multi-line draft sent intact)

#### 1.5. TC-AJ-29: Textarea grows up with content; soft-wraps — no x-overflow

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page).
  2. Baseline: h0 = input(page).evaluate(el => el.offsetHeight).
    - expect: 1 row baseline (observed 46px @1280x720)
  3. input(page).fill("a\nb\nc").
    - expect: offsetHeight > h0 (grew up; field-sizing: content; observed 86px)
  4. input(page).fill("x".repeat(300)).
    - expect: scrollWidth <= clientWidth (wraps; no x-overflow)
    - expect: offsetHeight > h0 (wrapped lines count)

#### 1.6. TC-AJ-30: Send button disabled while streaming and while offline; re-enabled after state clears

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock STREAM_NEVER_ENDS. Error collectors on. openJudgeModal.
  2. input(page).fill("Stream button test"); click sendButton(page).
    - expect: waitForBodies(page, 1); user bubble; stream bubble "partial "
    - expect: send button toBeDisabled() (isStreaming)
  3. Close via closeButton(page); reopenJudgeModal(page).
    - expect: send button toBeEnabled() (stream reset on close)
  4. input(page).fill("Offline button test"); context.setOffline(true).
    - expect: status alert visible; send button toBeDisabled()
  5. context.setOffline(false).
    - expect: status gone; send button toBeEnabled() (no reload)
  6. Cleanup.
    - expect: no console/page errors

#### 1.7. TC-AJ-31: Send button re-enabled after done; stays functional (click path)

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page). sendQuestion(page, "Done re-enable"); wait done.
    - expect: send button toBeEnabled()
  2. input(page).fill("Second click"); click sendButton(page); wait done.
    - expect: waitForBodies(page, 2); 2 user + 2 system bubbles (button functional after stream end)

#### 1.8. TC-AJ-32: Send button re-enabled after error

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock ERR_429 (200 + error event). openJudgeModal(page).
  2. input(page).fill("Error button test"); click sendButton(page).
    - expect: error bubble exact "The AI Judge is busy. Please wait a moment."
    - expect: send button toBeEnabled(); typing gone

#### 1.9. TC-AJ-33: Auto-grow cap — height stops at 160px (max-h-40), internal scroll

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Mock FULL. openJudgeModal(page). Baseline h0.
  2. input(page).fill("l0\nl1\nl2") (3 lines).
    - expect: offsetHeight > h0 AND < 160 (grew, not yet capped)
  3. input(page).fill(12 lines "line 0".."line 11").
    - expect: offsetHeight === 160 (max-h-40 = 10rem border-box; observed 160px)
    - expect: scrollHeight > clientHeight (internal scroll; observed 264 > 158)
    - expect: computed overflow-y === "auto"
  4. Press Enter (no Shift).
    - expect: waitForBodies(page, 1); bodies[0].question === 12-line text (full multi-line draft sent)
