import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";
import type { EnvironmentConfig, EnvironmentValidationIssue, ObjectInteraction, UserState } from "../types";

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
  onObjectInteract?: (interaction: ObjectInteraction) => void;
};

export function ScenePreview({
  interactive = false,
  roomLabel,
  environmentConfig,
  validationState,
  localSimulation = false,
  remoteUsers = [],
  onPlayerMove,
  onObjectInteract,
}: ScenePreviewProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const onObjectInteractRef = useRef(onObjectInteract);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const environmentFingerprint = useMemo(
    () =>
      JSON.stringify({
        version: environmentConfig.version,
        map: environmentConfig.map,
        communication: environmentConfig.communication,
        objects: environmentConfig.objects,
      }),
    [environmentConfig],
  );

  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

  useEffect(() => {
    onObjectInteractRef.current = onObjectInteract;
  }, [onObjectInteract]);

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
      onObjectInteract: (interaction) => {
        onObjectInteractRef.current?.(interaction);
      },
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: containerRef.current,
      scene,
      backgroundColor: "#0b1317",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      gameRef.current = null;
      game.destroy(true);
    };
  }, [environmentConfig, environmentFingerprint, interactive, localSimulation, roomLabel]);

  useEffect(() => {
    sceneRef.current?.setRemoteUsers(remoteUsers);
  }, [remoteUsers]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
      gameRef.current?.scale.refresh();
    };

    const handleResize = () => {
      gameRef.current?.scale.refresh();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;

  const toggleFullscreen = async () => {
    if (!shellRef.current || !fullscreenSupported) {
      return;
    }

    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }

    await shellRef.current.requestFullscreen();
  };

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
      <div ref={shellRef} className={`scene-preview-shell ${isFullscreen ? "scene-preview-shell-fullscreen" : ""}`}>
        <div className="scene-preview-toolbar">
          <span className="scene-preview-badge">{roomLabel ?? "Room preview"}</span>
          {fullscreenSupported ? (
            <button className="button button-secondary scene-fullscreen-button" type="button" onClick={toggleFullscreen}>
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          ) : null}
        </div>
        <div ref={containerRef} className="scene-preview" />
      </div>
    </>
  );
}
