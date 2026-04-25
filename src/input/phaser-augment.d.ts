import type { InputService } from './InputService';
import type { MusicPlugin } from '../plugins/MusicPlugin';
import type { DebugPlugin } from '../plugins/DebugPlugin';
import type { ScopedEventBus } from '../plugins/ScopedEventBus';

declare module 'phaser' {
  namespace Scene {
    interface Scene {
      inputs: InputService;
      music: MusicPlugin;
      debug: DebugPlugin;
      scopedEvents: ScopedEventBus;
    }
  }
  interface Scene {
    inputs: InputService;
    music: MusicPlugin;
    debug: DebugPlugin;
    scopedEvents: ScopedEventBus;
  }
}
