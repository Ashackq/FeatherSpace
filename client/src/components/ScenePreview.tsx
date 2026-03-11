import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { SpaceScene } from "../phaserScene";

export function ScenePreview() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new SpaceScene();
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
  }, []);

  return <div ref={containerRef} className="scene-preview" />;
}
