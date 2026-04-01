import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";
import type { EnvironmentConfig, EnvironmentValidationIssue } from "../types";

type ScenePreviewProps = {
  interactive?: boolean;
  roomLabel?: string;
  environmentConfig: EnvironmentConfig;
  validationState?: {
    isValid: boolean;
    usedFallback: boolean;
    errors: EnvironmentValidationIssue[];
  };
};

export function ScenePreview({
  interactive = false,
  roomLabel,
  environmentConfig,
  validationState,
}: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new SpaceScene({ interactive, roomLabel, environmentConfig });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 960,
      height: 540,
      parent: containerRef.current,
      scene,
      backgroundColor: "#0b1317",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      game.destroy(true);
    };
  }, [interactive, roomLabel, environmentConfig]);

  return (
    <>
      {validationState && !validationState.isValid ? (
        <div className="schema-alert" role="status">
          <strong>
            Environment validation failed
            {validationState.usedFallback ? " - default template loaded" : ""}
          </strong>
          <ul>
            {validationState.errors.slice(0, 3).map((error) => (
              <li key={`${error.path}-${error.message}`}>
                {error.path}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div ref={containerRef} className="scene-preview" />
    </>
  );
}
