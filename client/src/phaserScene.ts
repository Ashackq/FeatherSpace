import Phaser from "phaser";

export class SpaceScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;

  constructor() {
    super("space-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#091116");

    const graphics = this.add.graphics();
    graphics.fillStyle(0x10202b, 1);
    graphics.fillRoundedRect(60, 60, 840, 420, 28);
    graphics.lineStyle(1, 0x28414f, 0.8);

    for (let x = 100; x <= 860; x += 40) {
      graphics.lineBetween(x, 90, x, 450);
    }

    for (let y = 90; y <= 450; y += 40) {
      graphics.lineBetween(100, y, 860, y);
    }

    this.add.text(94, 94, "Preview Room", {
      color: "#dce8dd",
      fontFamily: "monospace",
      fontSize: "20px",
    });

    this.add.text(94, 122, "Open floor, private table zones, whiteboard anchors", {
      color: "#84a6a1",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    this.add.circle(230, 300, 54, 0x183947, 0.85);
    this.add.circle(490, 210, 44, 0x254f40, 0.8);
    this.add.circle(720, 320, 60, 0x4d5831, 0.85);
    this.add.rectangle(790, 150, 120, 30, 0xe4efe7, 0.92);

    this.player = this.add.circle(160, 170, 14, 0xff7a59) as Phaser.GameObjects.Arc;
    this.tweens.add({
      targets: this.player,
      x: 300,
      y: 250,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
  }
}
