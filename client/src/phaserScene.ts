import Phaser from "phaser";
import type { UserState } from "./types";

type SpaceSceneConfig = {
  interactive?: boolean;
  roomLabel?: string;
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
  private remoteUsers = new Map<string, RemoteAvatar>();
  private sceneReady = false;
  private pendingRemoteUsers: UserState[] = [];

  private readonly worldBounds = {
    minX: 100,
    maxX: 860,
    minY: 90,
    maxY: 450,
  };

  constructor(config: SpaceSceneConfig = {}) {
    super("space-scene");
    this.interactive = config.interactive ?? false;
    this.localSimulation = config.localSimulation ?? false;
    this.roomLabel = config.roomLabel ?? "Research Studio";
    this.onPlayerMove = config.onPlayerMove;
  }

  create(): void {
    this.sceneReady = true;

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

    this.add.text(94, 94, this.roomLabel, {
      color: "#dce8dd",
      fontFamily: "monospace",
      fontSize: "20px",
    });

    this.add.text(94, 122, "Open floor, private table zones, whiteboard anchors", {
      color: "#84a6a1",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    this.add.text(94, 142, this.interactive ? "Movement active" : "Preview mode", {
      color: this.interactive ? "#99e1c7" : "#6f8f8a",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    if (this.interactive) {
      this.add.text(610, 122, "Move: WASD or Arrow Keys", {
        color: "#c2d6ce",
        fontFamily: "monospace",
        fontSize: "12px",
      });
    }

    this.add.circle(230, 300, 54, 0x183947, 0.85);
    this.add.circle(490, 210, 44, 0x254f40, 0.8);
    this.add.circle(720, 320, 60, 0x4d5831, 0.85);
    this.add.rectangle(790, 150, 120, 30, 0xe4efe7, 0.92);

    this.player = this.add.circle(220, 180, 14, 0xff7a59) as Phaser.GameObjects.Arc;
    this.playerLabel = this.add.text(196, 198, "You", {
      color: "#ffe0d5",
      fontFamily: "monospace",
      fontSize: "11px",
    });

    this.proximityRing = this.add.circle(this.player.x, this.player.y, 90, 0xff825f, 0.08);
    this.proximityRing.setStrokeStyle(1, 0xff825f, 0.3);
    this.proximityLabel = this.add.text(612, 142, "Nearby peers: 0", {
      color: "#f5be9b",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    if (this.localSimulation) {
      this.createSimulatedPeers();
    }

    if (this.interactive) {
      this.cursors = this.input.keyboard?.createCursorKeys();
      if (this.input.keyboard) {
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
      }

      if (this.player.x !== previousX || this.player.y !== previousY) {
        const dx = this.player.x - previousX;
        const dy = this.player.y - previousY;
        const direction = Math.atan2(dy, dx);
        this.onPlayerMove?.(this.player.x, this.player.y, direction);
      }
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, this.worldBounds.minX, this.worldBounds.maxX);
    this.player.y = Phaser.Math.Clamp(this.player.y, this.worldBounds.minY, this.worldBounds.maxY);

    this.playerLabel.setPosition(this.player.x - 24, this.player.y + 18);
    this.proximityRing.setPosition(this.player.x, this.player.y);

    const nearbySimulatedPeers = this.peers.filter((peer) => {
      return Phaser.Math.Distance.Between(peer.avatar.x, peer.avatar.y, this.player!.x, this.player!.y) <= 90;
    }).length;

    const nearbyRemotePeers = Array.from(this.remoteUsers.values()).filter((peer) => {
      return Phaser.Math.Distance.Between(peer.avatar.x, peer.avatar.y, this.player!.x, this.player!.y) <= 90;
    }).length;

    this.proximityLabel.setText(`Nearby peers: ${nearbySimulatedPeers + nearbyRemotePeers}`);
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
