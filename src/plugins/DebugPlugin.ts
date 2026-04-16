import * as Phaser from 'phaser';

/**
 * ScenePlugin that adds a toggleable debug overlay (press D).
 *
 * When active:
 *  - Arcade physics debug is enabled (red body outlines)
 *  - An FPS counter is shown in the top-left corner
 */
export class DebugPlugin extends Phaser.Plugins.ScenePlugin {
  private fpsText?: Phaser.GameObjects.Text;
  private debugKey?: Phaser.Input.Keyboard.Key;
  private active = false;

  boot(): void {
    const events = this.systems!.events;
    events.on('start', this.onSceneStart, this);
    events.once('destroy', this.onSceneDestroy, this);
  }

  private onSceneStart(): void {
    const events = this.systems!.events;
    events.on('update', this.onUpdate, this);
    events.once('shutdown', this.onShutdown, this);

    this.active = !!this.game?.registry.get('debug_mode');

    this.debugKey = this.scene?.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.D,
      false,
    );

    this.createFpsText();
    this.applyDebugState();
  }

  private createFpsText(): void {
    if (!this.scene) return;
    this.fpsText = this.scene.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ff4444',
      backgroundColor: '#00000099',
      padding: { x: 6, y: 3 },
    })
      .setDepth(999)
      .setScrollFactor(0)
      .setVisible(this.active);
  }

  private applyDebugState(): void {
    const world = (this.scene as unknown as { physics: Phaser.Physics.Arcade.ArcadePhysics })
      ?.physics?.world;
    if (!world) return;

    if (this.active) {
      world.drawDebug = true;
      if (!world.debugGraphic) {
        world.createDebugGraphic();
      }
      world.debugGraphic!.setVisible(true);

      // Set red on all existing bodies so outlines render in red
      this.recolorBodies(world, 0xff0000);
    } else {
      world.drawDebug = false;
      if (world.debugGraphic) {
        world.debugGraphic.setVisible(false);
        world.debugGraphic.clear();
      }
    }

    this.fpsText?.setVisible(this.active);
  }

  private recolorBodies(world: Phaser.Physics.Arcade.World, color: number): void {
    for (const b of world.bodies.entries) {
      (b as unknown as Record<string, unknown>).debugBodyColor = color;
    }
    for (const b of world.staticBodies.entries) {
      (b as unknown as Record<string, unknown>).debugBodyColor = color;
    }
  }

  private onUpdate(): void {
    if (this.debugKey && Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.active = !this.active;
      this.game?.registry.set('debug_mode', this.active);
      this.applyDebugState();
    }

    if (this.active && this.game) {
      // Keep bodies red (covers newly-spawned objects)
      const world = (this.scene as unknown as { physics: Phaser.Physics.Arcade.ArcadePhysics })
        ?.physics?.world;
      if (world) this.recolorBodies(world, 0xff0000);

      if (this.fpsText) {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsText.setText(`FPS: ${fps}`);
      }
    }
  }

  private onShutdown(): void {
    this.systems?.events.off('update', this.onUpdate, this);
    this.fpsText?.destroy();
    this.fpsText = undefined;
    this.debugKey = undefined;
  }

  private onSceneDestroy(): void {
    this.onShutdown();
    this.systems?.events.off('start', this.onSceneStart, this);
  }
}
