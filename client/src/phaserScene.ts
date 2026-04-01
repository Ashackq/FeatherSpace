import Phaser from "phaser";
import type { EnvironmentConfig, EnvironmentObject, UserState } from "./types";

type SpaceSceneConfig = {
  interactive?: boolean;
  roomLabel?: string;
  environmentConfig: EnvironmentConfig;
  localSimulation?: boolean;
  onPlayerMove?: (x: number, y: number, direction: number) => void;
};

type SimulatedPeer = {
  avatar: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  angle: number;
  speed: number;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

type RemoteAvatar = {
  avatar: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
};

export class SpaceScene extends Phaser.Scene {
  private readonly interactive: boolean;
  private readonly localSimulation: boolean;
  private readonly roomLabel: string;
  private readonly environmentConfig: EnvironmentConfig;

  private readonly stageFrame = {
    x: 60,
    y: 60,
    width: 840,
    height: 420,
  };
  private readonly onPlayerMove?: (x: number, y: number, direction: number) => void;

  private player?: Phaser.GameObjects.Arc;
  private playerLabel?: Phaser.GameObjects.Text;
  private proximityRing?: Phaser.GameObjects.Arc;
  private proximityLabel?: Phaser.GameObjects.Text;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private peers: SimulatedPeer[] = [];
  private talkRadiusPx = 90;
  private remoteUsers = new Map<string, RemoteAvatar>();
  private sceneReady = false;
  private pendingRemoteUsers: UserState[] = [];

  private worldBounds = {
    minX: 100,
    maxX: 860,
    minY: 90,
    maxY: 450,
  };

  constructor(config: SpaceSceneConfig) {
    super("space-scene");
    this.interactive = config.interactive ?? false;
    this.localSimulation = config.localSimulation ?? false;
    this.roomLabel = config.roomLabel ?? "Research Studio";
    this.environmentConfig = config.environmentConfig;
    this.onPlayerMove = config.onPlayerMove;

    const mapScaleX = this.stageFrame.width / Math.max(this.environmentConfig.map.width, 1);
    const mapScaleY = this.stageFrame.height / Math.max(this.environmentConfig.map.height, 1);
    const mapScale = Math.min(mapScaleX, mapScaleY);

    this.talkRadiusPx = Math.max(22, this.environmentConfig.communication.talkRadius * mapScale);

    const inset = 24;
    this.worldBounds = {
      minX: this.stageFrame.x + inset,
      maxX: this.stageFrame.x + this.stageFrame.width - inset,
      minY: this.stageFrame.y + inset,
      maxY: this.stageFrame.y + this.stageFrame.height - inset,
    };
  }

  create(): void {
    this.sceneReady = true;

    this.cameras.main.setBackgroundColor("#091116");

    const graphics = this.add.graphics();
    graphics.fillStyle(0x10202b, 1);
    graphics.fillRoundedRect(
      this.stageFrame.x,
      this.stageFrame.y,
      this.stageFrame.width,
      this.stageFrame.height,
      28,
    );
    graphics.lineStyle(1, 0x28414f, 0.8);

    const gridStepX = Math.max(24, Math.floor(this.stageFrame.width / 20));
    const gridStepY = Math.max(24, Math.floor(this.stageFrame.height / 12));

    for (let x = this.worldBounds.minX; x <= this.worldBounds.maxX; x += gridStepX) {
      graphics.lineBetween(x, this.worldBounds.minY, x, this.worldBounds.maxY);
    }

    for (let y = this.worldBounds.minY; y <= this.worldBounds.maxY; y += gridStepY) {
      graphics.lineBetween(this.worldBounds.minX, y, this.worldBounds.maxX, y);
    }

    this.add.text(94, 94, this.roomLabel, {
      color: "#dce8dd",
      fontFamily: "monospace",
      fontSize: "20px",
    });

    this.add.text(94, 122, "Open floor, lounge islands, private zones, whiteboard anchors", {
      color: "#84a6a1",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    this.add.text(
      94,
      142,
      this.interactive
        ? `Movement active · Talk radius ${this.environmentConfig.communication.talkRadius}`
        : "Preview mode",
      {
      color: this.interactive ? "#99e1c7" : "#6f8f8a",
      fontFamily: "monospace",
      fontSize: "12px",
      },
    );

    if (this.interactive) {
      this.add.text(610, 122, "Move: WASD or Arrow Keys", {
        color: "#c2d6ce",
        fontFamily: "monospace",
        fontSize: "12px",
      });
    }

    this.drawEnvironmentObjects(this.environmentConfig.objects);

    this.player = this.add.circle(this.worldBounds.minX + 120, this.worldBounds.minY + 90, 14, 0xff7a59) as Phaser.GameObjects.Arc;
    this.playerLabel = this.add.text(196, 198, "You", {
      color: "#ffe0d5",
      fontFamily: "monospace",
      fontSize: "11px",
    });

    this.proximityRing = this.add.circle(this.player.x, this.player.y, this.talkRadiusPx, 0xff825f, 0.08);
    this.proximityRing.setStrokeStyle(1, 0xff825f, 0.3);
    this.proximityLabel = this.add.text(612, 142, "Nearby peers: 0", {
      color: "#f5be9b",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    // Publish initial position so remote peers can render this user before first movement input.
    this.onPlayerMove?.(this.player.x, this.player.y, 0);

    if (this.localSimulation) {
      this.createSimulatedPeers();
    }

    if (this.interactive) {
      this.cursors = this.input.keyboard?.createCursorKeys();
      if (this.input.keyboard) {
        this.input.keyboard.addCapture([
          Phaser.Input.Keyboard.KeyCodes.UP,
          Phaser.Input.Keyboard.KeyCodes.DOWN,
          Phaser.Input.Keyboard.KeyCodes.LEFT,
          Phaser.Input.Keyboard.KeyCodes.RIGHT,
          Phaser.Input.Keyboard.KeyCodes.W,
          Phaser.Input.Keyboard.KeyCodes.A,
          Phaser.Input.Keyboard.KeyCodes.S,
          Phaser.Input.Keyboard.KeyCodes.D,
        ]);

        this.wasd = {
          up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
      }
    } else {
      this.tweens.add({
        targets: this.player,
        x: 320,
        y: 260,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }

    if (this.pendingRemoteUsers.length > 0) {
      const queuedUsers = this.pendingRemoteUsers;
      this.pendingRemoteUsers = [];
      this.setRemoteUsers(queuedUsers);
    }
  }

  update(_: number, deltaMs: number): void {
    if (this.localSimulation) {
      this.updateSimulatedPeers(deltaMs);
    }

    this.updateRemoteUsers(deltaMs);

    if (!this.player || !this.playerLabel || !this.proximityRing || !this.proximityLabel) {
      return;
    }

    const previousX = this.player.x;
    const previousY = this.player.y;
    let moved = false;

    if (this.interactive) {
      const delta = deltaMs / 1000;
      const speed = 170;

      let moveX = 0;
      let moveY = 0;

      if (this.cursors?.left.isDown || this.wasd?.left.isDown) moveX -= 1;
      if (this.cursors?.right.isDown || this.wasd?.right.isDown) moveX += 1;
      if (this.cursors?.up.isDown || this.wasd?.up.isDown) moveY -= 1;
      if (this.cursors?.down.isDown || this.wasd?.down.isDown) moveY += 1;

      if (moveX !== 0 || moveY !== 0) {
        const magnitude = Math.hypot(moveX, moveY);
        this.player.x += (moveX / magnitude) * speed * delta;
        this.player.y += (moveY / magnitude) * speed * delta;
        moved = true;
      }
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, this.worldBounds.minX, this.worldBounds.maxX);
    this.player.y = Phaser.Math.Clamp(this.player.y, this.worldBounds.minY, this.worldBounds.maxY);

    if (this.interactive && moved && (this.player.x !== previousX || this.player.y !== previousY)) {
      const dx = this.player.x - previousX;
      const dy = this.player.y - previousY;
      const direction = Math.atan2(dy, dx);
      this.onPlayerMove?.(this.player.x, this.player.y, direction);
    }

    this.playerLabel.setPosition(this.player.x - 24, this.player.y + 18);
    this.proximityRing.setPosition(this.player.x, this.player.y);

    const nearbySimulatedPeers = this.peers.filter((peer) => {
      return (
        Phaser.Math.Distance.Between(peer.avatar.x, peer.avatar.y, this.player!.x, this.player!.y) <=
        this.talkRadiusPx
      );
    }).length;

    const nearbyRemotePeers = Array.from(this.remoteUsers.values()).filter((peer) => {
      return (
        Phaser.Math.Distance.Between(peer.avatar.x, peer.avatar.y, this.player!.x, this.player!.y) <=
        this.talkRadiusPx
      );
    }).length;

    this.proximityLabel.setText(`Nearby peers: ${nearbySimulatedPeers + nearbyRemotePeers}`);
  }

  private mapXToStageX(value: number): number {
    const width = Math.max(this.environmentConfig.map.width, 1);
    const ratio = Phaser.Math.Clamp(value / width, 0, 1);
    const drawableWidth = this.worldBounds.maxX - this.worldBounds.minX;
    return this.worldBounds.minX + ratio * drawableWidth;
  }

  private mapYToStageY(value: number): number {
    const height = Math.max(this.environmentConfig.map.height, 1);
    const ratio = Phaser.Math.Clamp(value / height, 0, 1);
    const drawableHeight = this.worldBounds.maxY - this.worldBounds.minY;
    return this.worldBounds.minY + ratio * drawableHeight;
  }

  private drawEnvironmentObjects(objects: EnvironmentObject[]): void {
    const drawableWidth = this.worldBounds.maxX - this.worldBounds.minX;
    const drawableHeight = this.worldBounds.maxY - this.worldBounds.minY;
    const scaleX = drawableWidth / Math.max(this.environmentConfig.map.width, 1);
    const scaleY = drawableHeight / Math.max(this.environmentConfig.map.height, 1);
    const mapScale = Math.min(scaleX, scaleY);

    objects.forEach((object) => {
      const displayId = object.id.replace(/_/g, " ");
      const x = Phaser.Math.Clamp(
        this.mapXToStageX(object.x),
        this.worldBounds.minX,
        this.worldBounds.maxX,
      );
      const y = Phaser.Math.Clamp(
        this.mapYToStageY(object.y),
        this.worldBounds.minY,
        this.worldBounds.maxY,
      );

      if (object.type === "whiteboard") {
        this.add.ellipse(x, y + 30, 126, 24, 0x000000, 0.24);
        const frame = this.add.rectangle(x, y, 136, 62, 0xdeece5, 0.96);
        frame.setStrokeStyle(3, 0x6f9f95, 0.9);
        const panel = this.add.rectangle(x, y - 4, 118, 42, 0xf4fbf7, 1);
        panel.setStrokeStyle(1, 0x9ab8af, 0.7);
        const tray = this.add.rectangle(x, y + 24, 92, 7, 0x8fa29c, 0.85);
        tray.setStrokeStyle(1, 0x6f827c, 0.9);

        const scribble = this.add.graphics();
        scribble.lineStyle(2, 0x78b0a3, 0.65);
        scribble.beginPath();
        scribble.moveTo(x - 38, y - 6);
        scribble.lineTo(x + 22, y - 10);
        scribble.lineTo(x + 34, y - 1);
        scribble.strokePath();

        this.add.text(x, y + 40, displayId, {
          color: "#b7cac3",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
        }).setOrigin(0.5, 0);
        return;
      }

      if (object.type === "private_room") {
        const radius = Math.max(26, (object.radius ?? 120) * mapScale);
        const shell = this.add.circle(x, y, radius + 12, 0x305362, 0.22);
        shell.setStrokeStyle(2, 0x6ecdb4, 0.28);
        const body = this.add.circle(x, y, radius, 0x1d4150, 0.9);
        body.setStrokeStyle(2, 0x6ecdb4, 0.7);
        this.add.circle(x, y, Math.max(16, radius * 0.45), 0x2a6678, 0.28);

        this.add.text(x, y + radius + 10, displayId, {
          color: "#aad8ca",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
          backgroundColor: "rgba(12, 27, 32, 0.65)",
          padding: { x: 6, y: 3 },
        }).setOrigin(0.5, 0);
        return;
      }

      if (object.type === "lounge_room") {
        const radius = Math.max(30, (object.radius ?? 110) * mapScale);
        this.add.ellipse(x, y + radius + 14, radius * 1.7, 26, 0x000000, 0.2);

        const rug = this.add.ellipse(x, y + 6, radius * 2.05, radius * 1.38, 0x5a3c7a, 0.25);
        rug.setStrokeStyle(2, 0xb79ad9, 0.55);

        const seating = this.add.circle(x, y, radius, 0x6b4a90, 0.95);
        seating.setStrokeStyle(3, 0xd8b8f1, 0.78);

        this.add.circle(x - radius * 0.34, y + 2, Math.max(14, radius * 0.26), 0x7d5aa6, 0.85);
        this.add.circle(x + radius * 0.34, y + 2, Math.max(14, radius * 0.26), 0x7d5aa6, 0.85);
        this.add.circle(x, y - 2, Math.max(12, radius * 0.22), 0x9f7ac8, 0.9);
        this.add.circle(x, y - radius * 0.18, Math.max(7, radius * 0.12), 0xf2e8a8, 0.95);

        this.add.text(x, y + radius + 10, displayId, {
          color: "#eadcfb",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
          backgroundColor: "rgba(28, 18, 42, 0.7)",
          padding: { x: 6, y: 3 },
        }).setOrigin(0.5, 0);
        return;
      }

      const footprint = this.add.ellipse(x, y + 22, 96, 24, 0x000000, 0.2);
      footprint.setDepth(0);
      const table = this.add.rectangle(x, y, 86, 48, 0x596539, 0.92);
      table.setStrokeStyle(2, 0xa5b87a, 0.75);
      this.add.rectangle(x, y, 58, 26, 0x71814a, 0.78).setStrokeStyle(1, 0xc2cf95, 0.72);

      this.add.text(x, y + 32, displayId, {
        color: "#d2ddbc",
        fontFamily: "monospace",
        fontSize: "10px",
        align: "center",
      }).setOrigin(0.5, 0);
    });

    this.add.text(610, 104, `Objects rendered: ${objects.length}`, {
      color: "#9dc9b8",
      fontFamily: "monospace",
      fontSize: "11px",
    });
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
    this.playerLabel?.setPosition(x - 24, y + 18);
    this.proximityRing?.setPosition(x, y);
  }

  setRemoteUsers(users: UserState[]): void {
    if (!this.sceneReady) {
      this.pendingRemoteUsers = users;
      return;
    }

    const activeIds = new Set(users.map((user) => user.userId));

    for (const [userId, sprite] of this.remoteUsers.entries()) {
      if (!activeIds.has(userId)) {
        sprite.avatar.destroy();
        sprite.label.destroy();
        this.remoteUsers.delete(userId);
      }
    }

    users.forEach((user) => {
      const existing = this.remoteUsers.get(user.userId);
      if (!existing) {
        const avatar = this.add.circle(user.x, user.y, 11, 0x8ad0b8, 1) as Phaser.GameObjects.Arc;
        const label = this.add.text(user.x - 26, user.y + 14, user.userId.slice(0, 6), {
          color: "#ccdbd3",
          fontFamily: "monospace",
          fontSize: "10px",
        });

        this.remoteUsers.set(user.userId, { avatar, label, targetX: user.x, targetY: user.y });
        return;
      }

      existing.targetX = user.x;
      existing.targetY = user.y;
    });
  }

  private updateRemoteUsers(deltaMs: number): void {
    const delta = Math.min(1, deltaMs / 1000);
    const lerpFactor = Math.min(1, delta * 10);

    this.remoteUsers.forEach((remote) => {
      const nextX = Phaser.Math.Linear(remote.avatar.x, remote.targetX, lerpFactor);
      const nextY = Phaser.Math.Linear(remote.avatar.y, remote.targetY, lerpFactor);

      remote.avatar.setPosition(nextX, nextY);
      remote.label.setPosition(nextX - 26, nextY + 14);
    });
  }

  private createSimulatedPeers(): void {
    const specs = [
      { name: "Mira", color: 0x8ad0b8, centerX: 330, centerY: 250, radiusX: 46, radiusY: 32, speed: 0.6 },
      { name: "Jon", color: 0xd4d9d4, centerX: 540, centerY: 198, radiusX: 58, radiusY: 36, speed: 0.45 },
      { name: "Sara", color: 0xd0b386, centerX: 720, centerY: 318, radiusX: 50, radiusY: 28, speed: 0.52 },
    ];

    this.peers = specs.map((spec, index) => {
      const angle = (Math.PI * 2 * (index + 1)) / specs.length;
      const x = spec.centerX + Math.cos(angle) * spec.radiusX;
      const y = spec.centerY + Math.sin(angle) * spec.radiusY;

      const avatar = this.add.circle(x, y, 11, spec.color, 1) as Phaser.GameObjects.Arc;
      const label = this.add.text(x - 18, y + 14, spec.name, {
        color: "#ccdbd3",
        fontFamily: "monospace",
        fontSize: "10px",
      });

      return {
        avatar,
        label,
        angle,
        speed: spec.speed,
        centerX: spec.centerX,
        centerY: spec.centerY,
        radiusX: spec.radiusX,
        radiusY: spec.radiusY,
      };
    });
  }

  private updateSimulatedPeers(deltaMs: number): void {
    const delta = deltaMs / 1000;

    this.peers.forEach((peer) => {
      peer.angle += peer.speed * delta;
      const x = peer.centerX + Math.cos(peer.angle) * peer.radiusX;
      const y = peer.centerY + Math.sin(peer.angle) * peer.radiusY;

      peer.avatar.setPosition(x, y);
      peer.label.setPosition(x - 18, y + 14);
    });
  }
}
