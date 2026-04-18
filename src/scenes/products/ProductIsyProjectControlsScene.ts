import { ProductRoomScene, ProductRoomConfig } from './ProductRoomScene';

/** Door identifier (matches infoContent + ProductsHallScene door config). */
export const PRODUCT_PROJECT_CONTROLS_ID = 'product-isy-project-controls';

const CONFIG: ProductRoomConfig = {
  sceneKey: 'ProductIsyProjectControlsScene',
  contentId: PRODUCT_PROJECT_CONTROLS_ID,
  title: 'ISY PROJECT\n  CONTROLS',
  titleColor: '#ffe6b8',
  backgroundTint: 0x1a2a3a,
  // KPI dashboards + project-management workstations.
  decorations: [
    { x: 460, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 600, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 760, yOffset: -36, spriteKey: 'desk_monitor' },
    { x: 900, yOffset: -22, spriteKey: 'monitor_dash' },
    { x: 1060, yOffset: -50, spriteKey: 'server_rack' },
  ],
};

export class ProductIsyProjectControlsScene extends ProductRoomScene {
  constructor() { super(CONFIG); }
}
