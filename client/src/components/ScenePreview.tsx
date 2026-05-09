import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import SpaceScene from "../phaserScene";
import { MobileControls } from "./MobileControls";
import type { EnvironmentValidationIssue, ObjectInteraction, ResolvedEnvironmentConfig, UserState } from "../types";

type ScenePreviewProps = {
  interactive?: boolean;
  roomLabel?: string;
  environmentConfig: ResolvedEnvironmentConfig;
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

// ScenePreview: Embeds a Phaser-powered spatial scene preview.
//
// Renders a live or simulated room map, showing users and objects.
// Handles both interactive and read-only modes, and can simulate remote users.
// Integrates Phaser game engine with React, and exposes hooks for player/object events.

function ScenePreview({
  interactive = false,
  roomLabel,
  environmentConfig,
  validationState,
  localSimulation = false,
  remoteUsers = [],
  onPlayerMove,
  onObjectInteract,
}: ScenePreviewProps) {
  // Refs for DOM nodes and Phaser/scene instances
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const onObjectInteractRef = useRef(onObjectInteract);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Used to detect when environment config changes (deep compare)
  const environmentFingerprint = useMemo(
    () =>
      JSON.stringify({
        version: environmentConfig.version,
        map: environmentConfig.map,
        visuals: environmentConfig.visuals,
        communication: environmentConfig.communication,
        objects: environmentConfig.objects,
        activeRoom: environmentConfig.activeRoom,
      }),
    [environmentConfig],
  );

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

  useEffect(() => {
    onObjectInteractRef.current = onObjectInteract;
  }, [onObjectInteract]);

  // (Re)create Phaser scene/game when environment or mode changes
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // Clear the container to ensure old canvas is removed before creating new one
    containerRef.current.innerHTML = "";

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

    const canvas = game.canvas;
    // FocusCanvas: focus canvas.
    const focusCanvas = () => {
      if (!canvas) {
        return;
      }
      canvas.setAttribute("tabindex", "0");
      canvas.style.outline = "none";
      canvas.focus();
    };

    if (canvas) {
      canvas.addEventListener("pointerdown", focusCanvas);
    }

    window.requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      focusCanvas();
      sceneRef.current?.refreshInputCapture();
    });

    return () => {
      sceneRef.current = null;
      gameRef.current = null;
      if (canvas) {
        canvas.removeEventListener("pointerdown", focusCanvas);
      }
      game.destroy(true);
    };
  }, [environmentConfig, environmentFingerprint, interactive, localSimulation, roomLabel]);

  useEffect(() => {
    sceneRef.current?.setRemoteUsers(remoteUsers);
  }, [remoteUsers]);

  useEffect(() => {
    // HandleFullscreenChange: handle fullscreen change.
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
      gameRef.current?.scale.refresh();
    };

    // HandleResize: handle resize.
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

  // Toggle the preview shell in and out of browser fullscreen mode.
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
        <div className="scene-canvas-wrap">
          <div ref={containerRef} className="scene-preview" />
          {interactive && <MobileControls sceneRef={sceneRef} />}
        </div>
      </div>
    </>
  );
}

export { ScenePreview };
export default ScenePreview;
