import { ProductRoomScene, ProductRoomConfig } from './ProductRoomScene';

export const PRODUCT_ROAD_ID = 'product-isy-road';

const CONFIG: ProductRoomConfig = {
  sceneKey: 'ProductIsyRoadScene',
  contentId: PRODUCT_ROAD_ID,
  title: 'ISY ROAD',
  titleColor: '#cfe6ff',
  backgroundTint: 0x0a2030,
  // 3D-design CAD stations down the room.
  decorations: [
    { x: 480, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 620, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 800, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 940, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 1080, yOffset: -36, spriteKey: 'desk_monitor' },
  ],
};

export class ProductIsyRoadScene extends ProductRoomScene {
  constructor() { super(CONFIG); }
}
