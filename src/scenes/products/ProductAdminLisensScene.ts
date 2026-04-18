import { ProductRoomScene, ProductRoomConfig } from './ProductRoomScene';

export const PRODUCT_ADMIN_LISENS_ID = 'product-admin-lisens';

const CONFIG: ProductRoomConfig = {
  sceneKey: 'ProductAdminLisensScene',
  contentId: PRODUCT_ADMIN_LISENS_ID,
  title: 'ADMIN\n& LISENS',
  titleColor: '#d8c2ff',
  backgroundTint: 0x1a1030,
  // Heavy on server racks — this is the back-office / identity platform.
  decorations: [
    { x: 460, yOffset: -50, spriteKey: 'server_rack' },
    { x: 540, yOffset: -50, spriteKey: 'server_rack' },
    { x: 700, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 840, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 980, yOffset: -50, spriteKey: 'server_rack' },
    { x: 1060, yOffset: -50, spriteKey: 'server_rack' },
  ],
};

export class ProductAdminLisensScene extends ProductRoomScene {
  constructor() { super(CONFIG); }
}
