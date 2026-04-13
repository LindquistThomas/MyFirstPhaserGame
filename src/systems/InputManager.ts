import * as Phaser from 'phaser';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  interact: boolean;
}

export class InputManager {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private jumpJustPressedFlag = false;
  private interactJustPressedFlag = false;

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) return;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  getState(): InputState {
    return {
      left: this.cursors?.left?.isDown || this.wasd?.A?.isDown || false,
      right: this.cursors?.right?.isDown || this.wasd?.D?.isDown || false,
      up: this.cursors?.up?.isDown || this.wasd?.W?.isDown || false,
      down: this.cursors?.down?.isDown || this.wasd?.S?.isDown || false,
      jump: this.spaceKey?.isDown || this.cursors?.up?.isDown || this.wasd?.W?.isDown || false,
      interact: this.interactKey?.isDown || false,
    };
  }

  isJumpJustPressed(): boolean {
    const jumpDown = this.spaceKey?.isDown || this.cursors?.up?.isDown || this.wasd?.W?.isDown || false;
    if (jumpDown && !this.jumpJustPressedFlag) {
      this.jumpJustPressedFlag = true;
      return true;
    }
    if (!jumpDown) {
      this.jumpJustPressedFlag = false;
    }
    return false;
  }

  isInteractJustPressed(): boolean {
    const interactDown = this.interactKey?.isDown || false;
    if (interactDown && !this.interactJustPressedFlag) {
      this.interactJustPressedFlag = true;
      return true;
    }
    if (!interactDown) {
      this.interactJustPressedFlag = false;
    }
    return false;
  }
}
