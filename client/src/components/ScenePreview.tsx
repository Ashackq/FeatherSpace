import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";
import type { UserState } from "../types";

type ScenePreviewProps = {
  interactive?: boolean;
  roomLabel?: string;
  localSimulation?: boolean;
  remoteUsers?: UserState[];
  onPlayerMove?: (x: number, y: number, direction: number) => void;
};

export function ScenePreview({
  interactive = false,
  roomLabel,
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
  }, [interactive, localSimulation, roomLabel]);

  useEffect(() => {
    sceneRef.current?.setRemoteUsers(remoteUsers);
  }, [remoteUsers]);

  return <div ref={containerRef} className="scene-preview" />;
}
