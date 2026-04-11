import Phaser from "phaser";
import type { EnvironmentConfig, EnvironmentObject, ObjectInteraction, UserState } from "./types";

type SpaceSceneConfig = {
  interactive?: boolean;
  roomLabel?: string;
  environmentConfig: EnvironmentConfig;
  localSimulation?: boolean;
  onPlayerMove?: (x: number, y: number, direction: number) => void;
  onObjectInteract?: (interaction: ObjectInteraction) => void;
};

type SimulatedPeer = {
  avatar: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  angle: number;
  speed: number;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

type RemoteAvatar = {
  avatar: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
};

type GridCell = {
  col: number;
  row: number;
};

type ObjectGridZone = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

type InteractableObject = {
  object: EnvironmentObject;
  zone: ObjectGridZone;
};

type PlacementAnchor = {
  col: number;
  row: number;
  widthCells: number;
  heightCells: number;
};

export class SpaceScene extends Phaser.Scene {
  private readonly interactive: boolean;
  private readonly localSimulation: boolean;
  private readonly roomLabel: string;
  private readonly environmentConfig: EnvironmentConfig;

  private readonly stageFrame = {
    x: 60,
    y: 60,
    width: 1800,
    height: 960,
  };
  private readonly gridColumns = 20;
  private readonly gridRows = 12;
  private readonly onPlayerMove?: (x: number, y: number, direction: number) => void;
  private readonly onObjectInteract?: (interaction: ObjectInteraction) => void;

  private player?: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private playerLabel?: Phaser.GameObjects.Text;
  private proximityRing?: Phaser.GameObjects.Rectangle;
  private proximityLabel?: Phaser.GameObjects.Text;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private interactionHint?: Phaser.GameObjects.Text;
  private objectGridZones = new Map<string, ObjectGridZone>();
  private objectRegistry = new Map<string, EnvironmentObject>();
  private activeInteractableId?: string;
  private joinedTableId?: string;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
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

  private worldBounds = {
    minX: 100,
    maxX: 860,
    minY: 90,
    maxY: 450,
  };

  private readonly mapTextureKey = "space-map-texture";
  private readonly localPlayerTextureKey = "space-player-texture";
  private readonly remotePlayerTextureKey = "space-remote-player-texture";

  constructor(config: SpaceSceneConfig) {
    super("space-scene");
    this.interactive = config.interactive ?? false;
    this.localSimulation = config.localSimulation ?? false;
    this.roomLabel = config.roomLabel ?? "Research Studio";
    this.environmentConfig = config.environmentConfig;
    this.onPlayerMove = config.onPlayerMove;
    this.onObjectInteract = config.onObjectInteract;

    const inset = 0;
    this.worldBounds = {
      minX: this.stageFrame.x + inset,
      maxX: this.stageFrame.x + this.stageFrame.width - inset,
      minY: this.stageFrame.y + inset,
      maxY: this.stageFrame.y + this.stageFrame.height - inset,
    };
  }

  preload(): void {
    const visuals = this.environmentConfig.visuals;

    this.queueSpriteAsset(visuals?.mapImageUrl, this.mapTextureKey);
    this.queueSpriteAsset(visuals?.playerSpriteUrl, this.localPlayerTextureKey);
    this.queueSpriteAsset(visuals?.remotePlayerSpriteUrl, this.remotePlayerTextureKey);

    this.environmentConfig.objects.forEach((object) => {
      const spriteUrl = this.getObjectSpriteUrl(object);
      if (!spriteUrl) {
        return;
      }

      this.queueSpriteAsset(spriteUrl, this.getObjectTextureKey(object.id));
    });
  }

  private queueSpriteAsset(url: string | undefined, key: string): void {
    if (!url || this.textures.exists(key)) {
      return;
    }

    this.load.image(key, url);
  }

  private getObjectTextureKey(objectId: string): string {
    return `space-object-texture-${objectId}`;
  }

  private getObjectSpriteUrl(object: EnvironmentObject): string | undefined {
    if (object.spriteUrl) {
      return object.spriteUrl;
    }

    const defaults = this.environmentConfig.visuals?.artifactSprites;
    if (!defaults) {
      return undefined;
    }

    if (object.type === "private_room") {
      return defaults.private_room ?? defaults.table;
    }

    if (object.type === "table") {
      return defaults.table ?? defaults.private_room;
    }

    if (object.type === "whiteboard") {
      return defaults.whiteboard;
    }

    if (object.type === "notebook") {
      return defaults.notebook;
    }

    if (object.type === "door") {
      return defaults.door;
    }

    return undefined;
  }

  create(): void {
    this.sceneReady = true;

    this.cameras.main.setBackgroundColor("#091116");

    if (this.textures.exists(this.mapTextureKey)) {
      const mapSprite = this.add.image(
        this.stageFrame.x + this.stageFrame.width / 2,
        this.stageFrame.y + this.stageFrame.height / 2,
        this.mapTextureKey,
      );
      mapSprite.setDisplaySize(this.stageFrame.width, this.stageFrame.height);
      mapSprite.setAlpha(0.92);
    }

    const graphics = this.add.graphics();
    const hasMapTexture = this.textures.exists(this.mapTextureKey);
    graphics.fillStyle(0x10202b, hasMapTexture ? 0.26 : 1);
    graphics.fillRoundedRect(
      this.stageFrame.x,
      this.stageFrame.y,
      this.stageFrame.width,
      this.stageFrame.height,
      28,
    );
    if (!hasMapTexture) {
      graphics.lineStyle(1, 0x28414f, 0.8);
    }

    const cellWidth = this.getCellWidth();
    const cellHeight = this.getCellHeight();

    if (!hasMapTexture) {
      for (let col = 0; col <= this.gridColumns; col += 1) {
        const x = this.stageFrame.x + col * cellWidth;
        graphics.lineBetween(x, this.stageFrame.y, x, this.stageFrame.y + this.stageFrame.height);
      }

      for (let row = 0; row <= this.gridRows; row += 1) {
        const y = this.stageFrame.y + row * cellHeight;
        graphics.lineBetween(this.stageFrame.x, y, this.stageFrame.x + this.stageFrame.width, y);
      }
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

    this.add.text(
      94,
      142,
      this.interactive
        ? "Movement active · Grid detection enabled"
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

    this.player = this.createAvatar(
      this.worldBounds.minX + 120,
      this.worldBounds.minY + 90,
      true,
      0xff7a59,
    );
    this.playerLabel = this.add.text(196, 198, "You", {
      color: "#ffe0d5",
      fontFamily: "monospace",
      fontSize: "11px",
    });

    this.proximityRing = this.add.rectangle(this.player.x, this.player.y, cellWidth, cellHeight, 0xff825f, 0.1);
    this.proximityRing.setStrokeStyle(1, 0xff825f, 0.45);
    this.proximityLabel = this.add.text(612, 142, "Nearby peers: 0", {
      color: "#f5be9b",
      fontFamily: "monospace",
      fontSize: "12px",
    });
    this.interactionPrompt = this.add.text(this.player.x, this.player.y - 34, "", {
      color: "#fff2d2",
      fontFamily: "monospace",
      fontSize: "12px",
      backgroundColor: "rgba(10, 18, 22, 0.8)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1);
    this.interactionPrompt.setVisible(false);
    this.interactionHint = this.add.text(612, 158, "", {
      color: "#b9d8cc",
      fontFamily: "monospace",
      fontSize: "11px",
    });

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
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
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
    this.interactionPrompt?.setPosition(this.player.x, this.player.y - 34);

    const playerCell = this.stagePositionToCell(this.player.x, this.player.y);
    const activeInteractable = this.getActiveInteractable(playerCell);

    if (this.interactive && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract(activeInteractable);
    }

    const nearbySimulatedPeers = this.peers.filter((peer) => {
      const peerCell = this.stagePositionToCell(peer.avatar.x, peer.avatar.y);
      return this.isWithinCellRange(peerCell, playerCell, 0, 0);
    }).length;

    const nearbyRemotePeers = Array.from(this.remoteUsers.values()).filter((peer) => {
      const peerCell = this.stagePositionToCell(peer.avatar.x, peer.avatar.y);
      return this.isWithinCellRange(peerCell, playerCell, 0, 0);
    }).length;

    this.proximityLabel.setText(`Nearby peers: ${nearbySimulatedPeers + nearbyRemotePeers}`);

    if (activeInteractable) {
      const actionLabel = this.getInteractionActionLabel(activeInteractable.object.type);
      const tableOccupancy =
        actionLabel === "table"
          ? this.getTableOccupancy(activeInteractable.object.id, activeInteractable.zone)
          : undefined;
      const localJoinedThisTable = this.joinedTableId === activeInteractable.object.id;
      this.activeInteractableId = activeInteractable.object.id;
      this.interactionPrompt?.setText(
        tableOccupancy !== undefined
          ? tableOccupancy >= 6
            ? localJoinedThisTable
              ? "E{interact} table (6/6)"
              : "Table full"
            : `E{interact} table (${tableOccupancy}/6)`
          : `E{interact} ${actionLabel}`,
      );
      this.interactionPrompt?.setVisible(true);
      this.interactionHint?.setText(
        tableOccupancy !== undefined
          ? tableOccupancy >= 6
            ? localJoinedThisTable
              ? "You are part of this table"
              : "No more seats available"
            : localJoinedThisTable
              ? `You are part of this table (${tableOccupancy}/6)`
              : `Join the table: ${tableOccupancy + 1}/6`
          : this.getInteractionHint(activeInteractable.object.type),
      );
      return;
    }

    this.activeInteractableId = undefined;
    this.interactionPrompt?.setVisible(false);
    this.interactionHint?.setText("");
  }

  private getCellWidth(): number {
    return this.stageFrame.width / this.gridColumns;
  }

  private createAvatar(
    x: number,
    y: number,
    isLocal: boolean,
    fallbackColor: number,
  ): Phaser.GameObjects.Arc | Phaser.GameObjects.Image {
    const spriteKey = isLocal ? this.localPlayerTextureKey : this.remotePlayerTextureKey;
    if (this.textures.exists(spriteKey)) {
      const avatar = this.add.image(x, y, spriteKey);
      const size = Math.min(this.getCellWidth(), this.getCellHeight()) * 0.68;
      avatar.setDisplaySize(size, size);
      avatar.setDepth(3);
      return avatar;
    }

    return this.add.circle(x, y, 14, fallbackColor) as Phaser.GameObjects.Arc;
  }

  private createObjectSprite(
    object: EnvironmentObject,
    x: number,
    y: number,
    placement: PlacementAnchor,
  ): Phaser.GameObjects.Image | undefined {
    const spriteUrl = this.getObjectSpriteUrl(object);
    if (!spriteUrl) {
      return undefined;
    }

    const textureKey = this.getObjectTextureKey(object.id);
    if (!this.textures.exists(textureKey)) {
      return undefined;
    }

    const sprite = this.add.image(x, y, textureKey);
    const width = Math.max(34, this.getCellWidth() * placement.widthCells - 12);
    const height = Math.max(34, this.getCellHeight() * placement.heightCells - 12);
    sprite.setDisplaySize(width, height);
    sprite.setDepth(2);
    return sprite;
  }

  private getCellHeight(): number {
    return this.stageFrame.height / this.gridRows;
  }

  private stagePositionToCell(x: number, y: number): GridCell {
    const normalizedX = Phaser.Math.Clamp(x, this.stageFrame.x, this.stageFrame.x + this.stageFrame.width) - this.stageFrame.x;
    const normalizedY = Phaser.Math.Clamp(y, this.stageFrame.y, this.stageFrame.y + this.stageFrame.height) - this.stageFrame.y;
    const col = Phaser.Math.Clamp(Math.floor(normalizedX / this.getCellWidth()), 0, this.gridColumns - 1);
    const row = Phaser.Math.Clamp(Math.floor(normalizedY / this.getCellHeight()), 0, this.gridRows - 1);

    return { col, row };
  }

  private mapPositionToGridAnchor(object: EnvironmentObject): PlacementAnchor {
    const mapWidth = Math.max(this.environmentConfig.map.width, 1);
    const mapHeight = Math.max(this.environmentConfig.map.height, 1);
    const normalizedCol = Phaser.Math.Clamp(Math.floor((object.x / mapWidth) * this.gridColumns), 0, this.gridColumns - 1);
    const normalizedRow = Phaser.Math.Clamp(Math.floor((object.y / mapHeight) * this.gridRows), 0, this.gridRows - 1);

    if (object.type === "whiteboard") {
      return {
        col: Math.min(normalizedCol, this.gridColumns - 2),
        row: normalizedRow,
        widthCells: 2,
        heightCells: 1,
      };
    }

    return {
      col: normalizedCol,
      row: normalizedRow,
      widthCells: 1,
      heightCells: 1,
    };
  }

  private gridCellToStageCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.stageFrame.x + (col + 0.5) * this.getCellWidth(),
      y: this.stageFrame.y + (row + 0.5) * this.getCellHeight(),
    };
  }

  private isWithinCellRange(subject: GridCell, center: GridCell, rangeCols: number, rangeRows: number): boolean {
    return (
      Math.abs(subject.col - center.col) <= rangeCols &&
      Math.abs(subject.row - center.row) <= rangeRows
    );
  }

  private createObjectGridZone(object: EnvironmentObject, stageX: number, stageY: number): ObjectGridZone {
    const anchorCell = this.stagePositionToCell(stageX, stageY);

    if (object.type === "whiteboard") {
      const minCol = anchorCell.col;
      const maxCol = Math.min(this.gridColumns - 1, anchorCell.col + 1);
      const minRow = anchorCell.row;
      const maxRow = anchorCell.row;

      return {
        minCol: Math.max(0, minCol - 1),
        maxCol: Math.min(this.gridColumns - 1, maxCol + 1),
        minRow: Math.max(0, minRow - 1),
        maxRow: Math.min(this.gridRows - 1, maxRow + 1),
      };
    }

    if (object.type === "table" || object.type === "private_room") {
      return {
        minCol: Math.max(0, anchorCell.col - 1),
        maxCol: Math.min(this.gridColumns - 1, anchorCell.col + 1),
        minRow: Math.max(0, anchorCell.row - 1),
        maxRow: Math.min(this.gridRows - 1, anchorCell.row + 1),
      };
    }

    return {
      minCol: anchorCell.col,
      maxCol: anchorCell.col,
      minRow: anchorCell.row,
      maxRow: anchorCell.row,
    };
  }

  private getActiveInteractable(playerCell: GridCell): InteractableObject | undefined {
    const interactables = Array.from(this.objectGridZones.entries())
      .map(([objectId, zone]) => {
        const object = this.objectRegistry.get(objectId);
        if (!object) {
          return undefined;
        }

        return { object, zone };
      })
      .filter((entry): entry is InteractableObject => Boolean(entry));

    const matching = interactables.filter(({ zone }) => {
      return (
        playerCell.col >= zone.minCol &&
        playerCell.col <= zone.maxCol &&
        playerCell.row >= zone.minRow &&
        playerCell.row <= zone.maxRow
      );
    });

    if (matching.length === 0) {
      return undefined;
    }

    matching.sort((left, right) => {
      const leftCenterCol = (left.zone.minCol + left.zone.maxCol) / 2;
      const leftCenterRow = (left.zone.minRow + left.zone.maxRow) / 2;
      const rightCenterCol = (right.zone.minCol + right.zone.maxCol) / 2;
      const rightCenterRow = (right.zone.minRow + right.zone.maxRow) / 2;
      const leftDistance = Math.hypot(playerCell.col - leftCenterCol, playerCell.row - leftCenterRow);
      const rightDistance = Math.hypot(playerCell.col - rightCenterCol, playerCell.row - rightCenterRow);
      return leftDistance - rightDistance;
    });

    return matching[0];
  }

  private getInteractionActionLabel(objectType: string): string {
    if (objectType === "whiteboard") {
      return "whiteboard";
    }

    if (objectType === "notebook") {
      return "book";
    }

    if (objectType === "table" || objectType === "private_room") {
      return "table";
    }

    return "interact";
  }

  private getInteractionHint(objectType: string): string {
    if (objectType === "whiteboard") {
      return "Opens whiteboard placeholder";
    }

    if (objectType === "notebook") {
      return "Opens placeholder book system";
    }

    if (objectType === "table" || objectType === "private_room") {
      return "Joins the table until it reaches 6 people";
    }

    return "";
  }

  private handleInteract(interactable?: InteractableObject): void {
    if (!interactable) {
      return;
    }

    if (interactable.object.type === "table" || interactable.object.type === "private_room") {
      const tableId = interactable.object.id;
      const isAlreadyJoined = this.joinedTableId === tableId;
      const occupancy = this.getTableOccupancy(tableId, interactable.zone);

      if (isAlreadyJoined) {
        this.showPlaceholderOverlay("Table", `Already joined (${occupancy}/6)`);
        return;
      }

      if (occupancy >= 6) {
        this.showPlaceholderOverlay("Table", "Table full");
        return;
      }

      this.joinedTableId = tableId;
      this.showPlaceholderOverlay("Table", `Joined table (${occupancy + 1}/6)`);
      return;
    }

    if (interactable.object.type === "whiteboard") {
      this.showPlaceholderOverlay("Whiteboard", "Placeholder whiteboard");
      return;
    }

    if (interactable.object.type === "notebook") {
      this.showPlaceholderOverlay("Book", "Placeholder book system");
    }
  }

  private getTableOccupancy(tableId: string, zone: ObjectGridZone): number {
    let occupancy = 0;

    if (this.joinedTableId === tableId) {
      occupancy += 1;
    }

    this.remoteUsers.forEach((remote) => {
      const remoteCell = this.stagePositionToCell(remote.avatar.x, remote.avatar.y);
      if (
        remoteCell.col >= zone.minCol &&
        remoteCell.col <= zone.maxCol &&
        remoteCell.row >= zone.minRow &&
        remoteCell.row <= zone.maxRow
      ) {
        occupancy += 1;
      }
    });

    return occupancy;
  }

  private showPlaceholderOverlay(title: string, message: string): void {
    this.interactionHint?.setText(`${title}: ${message}`);
    this.interactionHint?.setAlpha(1);
    this.tweens.add({
      targets: this.interactionHint,
      alpha: 0,
      duration: 1800,
      ease: "Sine.easeOut",
    });
  }

  private isPlayerInsideObjectZone(objectId: string): boolean {
    if (!this.player) {
      return false;
    }

    const zone = this.objectGridZones.get(objectId);
    if (!zone) {
      return false;
    }

    const playerCell = this.stagePositionToCell(this.player.x, this.player.y);
    return (
      playerCell.col >= zone.minCol &&
      playerCell.col <= zone.maxCol &&
      playerCell.row >= zone.minRow &&
      playerCell.row <= zone.maxRow
    );
  }

  private drawEnvironmentObjects(objects: EnvironmentObject[]): void {
    this.objectGridZones.clear();
    this.objectRegistry.clear();

    const drawableWidth = this.worldBounds.maxX - this.worldBounds.minX;
    const drawableHeight = this.worldBounds.maxY - this.worldBounds.minY;

    objects.forEach((object) => {
      this.objectRegistry.set(object.id, object);
      const displayId = object.id.replace(/_/g, " ");
      const placement = this.mapPositionToGridAnchor(object);
      const anchor = this.gridCellToStageCenter(placement.col, placement.row);
      const x = anchor.x;
      const y = anchor.y;
      const zone = this.createObjectGridZone(object, x, y);
      this.objectGridZones.set(object.id, zone);
      const sprite = this.createObjectSprite(object, x, y, placement);

      if (sprite) {
        this.add.text(x, y + this.getCellHeight() * 0.48, object.label ?? displayId, {
          color: "#d6e4dc",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
          backgroundColor: "rgba(8, 14, 18, 0.58)",
          padding: { x: 5, y: 2 },
        }).setOrigin(0.5, 0);

        this.enableObjectInteraction(sprite, object, displayId);
        return;
      }

      if (object.type === "whiteboard") {
        const cellWidth = this.getCellWidth();
        const cellHeight = this.getCellHeight();
        const frameWidth = Math.max(68, cellWidth * placement.widthCells - 16);
        const frameHeight = Math.max(34, cellHeight * placement.heightCells - 14);
        this.add.ellipse(x, y + frameHeight * 0.42, frameWidth * 0.88, 14, 0x000000, 0.24);
        const frame = this.add.rectangle(x, y, frameWidth, frameHeight, 0xdeece5, 0.96);
        frame.setStrokeStyle(3, 0x6f9f95, 0.9);
        const panel = this.add.rectangle(x, y - 2, frameWidth - 18, frameHeight - 14, 0xf4fbf7, 1);
        panel.setStrokeStyle(1, 0x9ab8af, 0.7);
        const tray = this.add.rectangle(x, y + frameHeight * 0.28, frameWidth * 0.68, 6, 0x8fa29c, 0.85);
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

        this.enableObjectInteraction(panel, object, displayId);
        return;
      }

      if (object.type === "notebook") {
        const cellWidth = this.getCellWidth();
        const cellHeight = this.getCellHeight();
        const bookWidth = Math.max(52, cellWidth * placement.widthCells - 18);
        const bookHeight = Math.max(34, cellHeight * placement.heightCells - 18);
        this.add.ellipse(x, y + bookHeight * 0.42, bookWidth * 0.96, 12, 0x000000, 0.22);
        const book = this.add.rectangle(x, y, bookWidth, bookHeight, 0xede4cf, 0.95);
        book.setStrokeStyle(2, 0x9f8f69, 0.9);
        this.add.rectangle(x + bookWidth * 0.06, y, 4, bookHeight - 6, 0xb99f72, 0.8);
        this.add.line(x - bookWidth * 0.22, y - 10, 0, 0, bookWidth * 0.36, 0, 0xc7ba9d, 0.6).setLineWidth(1, 1);
        this.add.line(x - bookWidth * 0.22, y, 0, 0, bookWidth * 0.36, 0, 0xc7ba9d, 0.6).setLineWidth(1, 1);
        this.add.line(x - bookWidth * 0.22, y + 10, 0, 0, bookWidth * 0.36, 0, 0xc7ba9d, 0.6).setLineWidth(1, 1);

        this.add.text(x, y + 36, displayId, {
          color: "#eadfc8",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
        }).setOrigin(0.5, 0);

        this.enableObjectInteraction(book, object, displayId);
        return;
      }

      if (object.type === "door") {
        this.add.ellipse(x, y + 36, 88, 20, 0x000000, 0.22);
        const frame = this.add.rectangle(x, y, 62, 94, 0x3a4d55, 0.95);
        frame.setStrokeStyle(2, 0x7f9ea5, 0.8);
        const slab = this.add.rectangle(x + 4, y + 4, 48, 80, 0x5a7480, 0.92);
        slab.setStrokeStyle(1, 0x9cc2cb, 0.7);
        this.add.circle(x + 18, y + 6, 3, 0xe2cc7d, 1);

        this.add.text(x, y + 56, object.label ?? displayId, {
          color: "#b6d8df",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
          backgroundColor: "rgba(10, 18, 22, 0.72)",
          padding: { x: 6, y: 3 },
        }).setOrigin(0.5, 0);

        this.enableObjectInteraction(slab, object, displayId);
        return;
      }

      if (object.type === "private_room") {
        const tableWidth = Math.max(54, this.getCellWidth() * placement.widthCells - 18);
        const tableHeight = Math.max(30, this.getCellHeight() * placement.heightCells - 20);
        this.add.ellipse(x, y + tableHeight * 0.44, tableWidth * 0.9, 14, 0x000000, 0.22);
        const body = this.add.rectangle(x, y, tableWidth, tableHeight, 0x1d4150, 0.9);
        body.setStrokeStyle(2, 0x6ecdb4, 0.7);
        this.add.rectangle(x, y, tableWidth * 0.68, tableHeight * 0.5, 0x2a6678, 0.28);

        this.add.text(x, y + tableHeight + 8, displayId, {
          color: "#aad8ca",
          fontFamily: "monospace",
          fontSize: "10px",
          align: "center",
          backgroundColor: "rgba(12, 27, 32, 0.65)",
          padding: { x: 6, y: 3 },
        }).setOrigin(0.5, 0);

        this.enableObjectInteraction(body, object, displayId);
        return;
      }

      const footprint = this.add.ellipse(x, y + 22, this.getCellWidth() * 0.85, 24, 0x000000, 0.2);
      footprint.setDepth(0);
      const tableWidth = Math.max(48, this.getCellWidth() - 18);
      const tableHeight = Math.max(28, this.getCellHeight() - 18);
      const table = this.add.rectangle(x, y, tableWidth, tableHeight, 0x596539, 0.92);
      table.setStrokeStyle(2, 0xa5b87a, 0.75);
      this.add.rectangle(x, y, tableWidth * 0.66, tableHeight * 0.54, 0x71814a, 0.78).setStrokeStyle(1, 0xc2cf95, 0.72);

      this.add.text(x, y + 32, displayId, {
        color: "#d2ddbc",
        fontFamily: "monospace",
        fontSize: "10px",
        align: "center",
      }).setOrigin(0.5, 0);

      this.enableObjectInteraction(table, object, displayId);
    });

    this.add.text(610, 104, `Objects rendered: ${objects.length}`, {
      color: "#9dc9b8",
      fontFamily: "monospace",
      fontSize: "11px",
    });
  }

  private enableObjectInteraction(
    target: Phaser.GameObjects.GameObject,
    object: EnvironmentObject,
    displayId: string,
  ): void {
    if (!this.interactive || !this.onObjectInteract) {
      return;
    }

    target.setInteractive({ cursor: "pointer" });
    target.on("pointerdown", () => {
      if (!this.isPlayerInsideObjectZone(object.id)) {
        return;
      }

      this.onObjectInteract?.({
        objectId: object.id,
        objectType: object.type,
        label: object.label ?? displayId,
        targetRoomId: object.targetRoomId,
        spawnX: object.spawnX,
        spawnY: object.spawnY,
      });
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
        const avatar = this.createAvatar(user.x, user.y, false, 0x8ad0b8);
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

      const avatar = this.createAvatar(x, y, false, spec.color);
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

export default SpaceScene;
