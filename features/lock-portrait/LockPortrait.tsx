import { FullscreenEnforcer } from "./FullscreenEnforcer";

export function LockPortrait() {
  return (
    <>
      <FullscreenEnforcer />
      <div className="fixed inset-0 z-50 hidden flex-col items-center justify-center bg-black px-6 text-center pointer-coarse:landscape:flex">
        <svg
          className="mb-6 size-16 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-3xl font-black text-white">
          Portrait Mode Required
        </h2>
        <p className="mt-4 max-w-sm text-lg text-white/70">
          Rotate your device to continue. The game table is optimized
          exclusively for vertical orientation.
        </p>
      </div>
    </>
  );
}
