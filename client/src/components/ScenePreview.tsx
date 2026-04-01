import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";
import type { EnvironmentConfig, EnvironmentValidationIssue, UserState } from "../types";

type ScenePreviewProps = {
  interactive?: boolean;
  roomLabel?: string;
  environmentConfig: EnvironmentConfig;
  validationState?: {
    isValid: boolean;
    usedFallback: boolean;
    errors: EnvironmentValidationIssue[];
  };
  localSimulation?: boolean;
  remoteUsers?: UserState[];
  onPlayerMove?: (x: number, y: number, direction: number) => void;
};

export function ScenePreview({
  interactive = false,
  roomLabel,
  environmentConfig,
  validationState,
  localSimulation = false,
  remoteUsers = [],
  onPlayerMove,
}: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const onPlayerMoveRef = useRef(onPlayerMove);

  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new SpaceScene({
      interactive,
      roomLabel,
      environmentConfig,
      localSimulation,
      onPlayerMove: (x, y, direction) => {
        onPlayerMoveRef.current?.(x, y, direction);
      },
    });
    sceneRef.current = scene;
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
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [environmentConfig, interactive, localSimulation, roomLabel]);

  useEffect(() => {
    sceneRef.current?.setRemoteUsers(remoteUsers);
  }, [remoteUsers]);

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
