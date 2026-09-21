# TC-AJ-37 — Canvas black permanently via globals.css (no JS paint, no restore)

## Application Overview

MTG Life Counter PWA — AI Judge modal (features/ai-judge/components/JudgeModal.tsx). The document canvas is black permanently via `app/globals.css` (`html { background-color: var(--color-ui-belt) }`, #000) — no JS paint/restore. TC-AJ-37 verifies computed `rgb(0, 0, 0)` on fresh page, while open, and after BOTH close paths (✕ button and Escape), with inline style never set, and error collectors on. No /api/judge call — no mock needed. Contract: DESIGN.md §6.4 Keyboard + SPEC §9.10; spec section 1.33 in specs/ai-judge.spec.md.

## Test Scenarios

### 1. AI Judge

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-AJ-37: Canvas black permanently via globals.css (no JS paint, no restore)

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Attach error collectors (pageerror + error-level console, _vercel/* and generic 404 filtered). page.goto("/") — fresh page, modal closed.
    - expect: page URL is http://localhost:3000/
    - expect: document.documentElement.style.background === "" (inline, never set)
    - expect: document.documentElement.style.backgroundColor === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (permanent CSS via globals.css --color-ui-belt)
  2. openJudgeModal(page) — open spellbook belt, click AI Judge button.
    - expect: #ai-judge-modal visible with open attribute
    - expect: document.documentElement.style.background === "" (still no inline)
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (black)
  3. Click the ✕ close button (getByRole button name 'Close AI Judge').
    - expect: #ai-judge-modal not visible (open attribute gone)
    - expect: document.documentElement.style.background === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (STILL black — no restore path exists)
  4. Reopen via reopenJudgeModal(page) (belt auto-closes on modal close — helper re-opens it if needed).
    - expect: #ai-judge-modal visible
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (black)
  5. Press Escape (textarea focused via autoFocus; document-level capture handler closes regardless of focus — no pre-focus needed).
    - expect: #ai-judge-modal not visible
    - expect: document.documentElement.style.background === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (STILL black)
  6. Cleanup: assert error collectors empty.
    - expect: errors.pageErrors === []
    - expect: errors.consoleErrors === [] (benign _vercel/* 404s filtered)
