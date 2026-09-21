# TC-AJ-37 — Canvas black while dialog open, restored on close

## Application Overview

MTG Life Counter PWA — AI Judge modal (features/ai-judge/components/JudgeModal.tsx, fix 38ef911). A MutationObserver on the #ai-judge-modal `open` attribute paints document.documentElement.style.background "#000" while the dialog is open and restores "" on close, preventing a white flash during the mobile keyboard-open height transition. TC-AJ-37 verifies the paint on open and the restore on BOTH close paths (✕ button and Escape), with error collectors on. No /api/judge call — no mock needed. Contract: DESIGN.md §6.4 Keyboard + SPEC §9.x; spec section 1.33 in specs/ai-judge.spec.md.

## Test Scenarios

### 1. AI Judge

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-AJ-37: Canvas black while dialog open, restored on close

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Attach error collectors (pageerror + error-level console, _vercel/* and generic 404 filtered). page.goto("/") — fresh page, modal closed.
    - expect: page URL is http://localhost:3000/
    - expect: document.documentElement.style.background === "" (inline, no paint)
    - expect: document.documentElement.style.backgroundColor === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgba(0, 0, 0, 0)" (transparent, not black)
  2. openJudgeModal(page) — open spellbook belt, click AI Judge button.
    - expect: #ai-judge-modal visible with open attribute
    - expect: document.documentElement.style.background === "rgb(0, 0, 0)" (CSSOM-normalized shorthand — NOT the literal #000)
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 0, 0)" (black)
  3. Click the ✕ close button (getByRole button name 'Close AI Judge').
    - expect: #ai-judge-modal not visible (open attribute gone)
    - expect: document.documentElement.style.background === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgba(0, 0, 0, 0)" (restored)
  4. Reopen via reopenJudgeModal(page) (belt auto-closes on modal close — helper re-opens it if needed).
    - expect: #ai-judge-modal visible
    - expect: document.documentElement.style.backgroundColor === "rgb(0, 0, 0)" (black again)
  5. Press Escape (textarea focused via autoFocus; document-level capture handler closes regardless of focus — no pre-focus needed).
    - expect: #ai-judge-modal not visible
    - expect: document.documentElement.style.background === ""
    - expect: getComputedStyle(document.documentElement).backgroundColor === "rgba(0, 0, 0, 0)" (restored)
  6. Cleanup: assert error collectors empty.
    - expect: errors.pageErrors === []
    - expect: errors.consoleErrors === [] (benign _vercel/* 404s filtered)
