"use client";

/**
 * @description
 * DESIGN §6.4.0 — full-width offline alert row, above the input. BG `MANA.b`
 * (`#666565`), text `#FAF8F5`. Rendered only while the chat is in the
 * offline state; history stays visible and read-only.
 *
 * @see DESIGN.md §6.4.0
 * @see SPEC.md §9.10
 */
export function OfflineAlert() {
  return (
    <div
      role="status"
      className="w-full bg-mana-b px-4 py-2 text-center text-sm text-ui-textLight"
    >
      You&apos;re offline — AI Judge needs internet.
    </div>
  );
}
