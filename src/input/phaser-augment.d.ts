import type { InputService } from './InputService';
import type { MusicPlugin } from '../plugins/MusicPlugin';
import type { DebugPlugin } from '../plugins/DebugPlugin';

declare module 'phaser' {
  namespace Scene {
    interface Scene {
      inputs: InputService;
      music: MusicPlugin;
      debug: DebugPlugin;
    }
  }
  interface Scene {
    inputs: InputService;
    music: MusicPlugin;
    debug: DebugPlugin;
  }
}
