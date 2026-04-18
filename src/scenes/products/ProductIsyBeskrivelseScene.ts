import { ProductRoomScene, ProductRoomConfig } from './ProductRoomScene';

export const PRODUCT_BESKRIVELSE_ID = 'product-isy-beskrivelse';

const CONFIG: ProductRoomConfig = {
  sceneKey: 'ProductIsyBeskrivelseScene',
  contentId: PRODUCT_BESKRIVELSE_ID,
  title: '   ISY\nBESKRIVELSE',
  titleColor: '#ffd6a8',
  backgroundTint: 0x2a1a0a,
  // Workstations evoking spec-writing — long row of desks.
  decorations: [
    { x: 480, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 620, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 760, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 900, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 1040, yOffset: -36, spriteKey: 'desk_monitor' },
  ],
};

export class ProductIsyBeskrivelseScene extends ProductRoomScene {
  constructor() { super(CONFIG); }
}
