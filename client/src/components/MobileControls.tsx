// MobileControls: On-screen touch controls for the spatial room experience.
//
// Renders a D-pad for movement and two action buttons (E = interact, SPACE = push-to-talk).
// Shown automatically on touch/coarse-pointer devices via CSS media query.
// Uses pointer capture so dragging off a button still releases the key cleanly.

import type { RefObject } from "react";
import type SpaceScene from "../phaserScene";

type MobileControlsProps = {
  // Reference to the live Phaser scene so we can inject virtual key events
  sceneRef: RefObject<SpaceScene | null>;
};

// Keys represented by each D-pad direction
const DPAD_DIRECTIONS = [
  { label: "▲", keys: ["arrowup", "w"], className: "mobile-dpad-up" },
  { label: "◄", keys: ["arrowleft", "a"], className: "mobile-dpad-left" },
  { label: "►", keys: ["arrowright", "d"], className: "mobile-dpad-right" },
  { label: "▼", keys: ["arrowdown", "s"], className: "mobile-dpad-down" },
] as const;

// A single directional button on the D-pad
function DPadButton({
  label,
  keys,
  className,
  sceneRef,
}: {
  label: string;
  keys: readonly string[];
  className: string;
  sceneRef: RefObject<SpaceScene | null>;
}) {
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Capture the pointer so pointerup fires even if finger drifts off button
    e.currentTarget.setPointerCapture(e.pointerId);
    keys.forEach((k) => sceneRef.current?.pressKey(k));
  };

  const release = () => {
    keys.forEach((k) => sceneRef.current?.releaseKey(k));
  };

  return (
    <button
      className={`mobile-dpad-btn ${className}`}
      type="button"
      aria-label={`Move ${label}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {label}
    </button>
  );
}

export function MobileControls({ sceneRef }: MobileControlsProps) {
  // Trigger the interact action (equivalent to pressing E)
  const handleInteractDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    sceneRef.current?.triggerInteract();
  };

  // Dispatch synthetic Space keydown — useRtcAudio listens on window for PTT
  const handleSpaceDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }),
    );
  };

  // Release Space PTT on pointer up / leave / cancel
  const handleSpaceUp = () => {
    window.dispatchEvent(
      new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true }),
    );
  };

  return (
    <div className="mobile-controls" aria-hidden="true">
      {/* Left: D-pad for WASD movement */}
      <div className="mobile-dpad">
        {DPAD_DIRECTIONS.map(({ label, keys, className }) => (
          <DPadButton
            key={className}
            label={label}
            keys={keys}
            className={className}
            sceneRef={sceneRef}
          />
        ))}
        {/* Centre pip — no interaction */}
        <div className="mobile-dpad-center" />
      </div>

      {/* Right: action buttons */}
      <div className="mobile-action-btns">
        <button
          className="mobile-action-btn mobile-action-e"
          type="button"
          aria-label="Interact (E)"
          onPointerDown={handleInteractDown}
        >
          E
        </button>
        <button
          className="mobile-action-btn mobile-action-space"
          type="button"
          aria-label="Push to talk (Space)"
          onPointerDown={handleSpaceDown}
          onPointerUp={handleSpaceUp}
          onPointerLeave={handleSpaceUp}
          onPointerCancel={handleSpaceUp}
        >
          SPACE
        </button>
      </div>
    </div>
  );
}
