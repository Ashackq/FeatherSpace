import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";

type ScenePreviewProps = {
  interactive?: boolean;
  roomLabel?: string;
};

export function ScenePreview({ interactive = false, roomLabel }: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new SpaceScene({ interactive, roomLabel });
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
  }, [interactive, roomLabel]);

  return <div ref={containerRef} className="scene-preview" />;
}
