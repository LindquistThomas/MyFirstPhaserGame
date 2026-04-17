import * as Phaser from 'phaser';

/** Smaller elevator platform used inside level scenes. */
export function generateRoomElevatorSprite(scene: Phaser.Scene): void {
  const w = 72;
  const h = 12;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0x00aaff); gfx.fillRect(0, 0, w, h);
  gfx.fillStyle(0x0088cc); gfx.fillRect(3, 3, w - 6, h - 6);
  gfx.fillStyle(0x00ccff);
  gfx.fillRect(0, 0, w, 2);
  gfx.fillRect(0, 0, 4, h);
  gfx.fillRect(w - 4, 0, 4, h);
  gfx.generateTexture('room_elevator_platform', w, h);
  gfx.destroy();
}
