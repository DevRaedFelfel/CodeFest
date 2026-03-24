import { registerPlugin } from '@capacitor/core';

export interface DisplayInfo {
  id: number;
  name: string;
  isDefault: boolean;
  width: number;
  height: number;
}

export interface DisplayPlugin {
  getConnectedDisplays(): Promise<{ count: number; displays: DisplayInfo[] }>;
  isScreenMirroring(): Promise<{ isMirroring: boolean; presentationDisplayCount: number }>;
  addListener(
    eventName: 'displayChanged',
    listenerFunc: (data: { count: number; timestamp: number; isMirroring: boolean }) => void
  ): Promise<{ remove: () => void }>;
}

const Display = registerPlugin<DisplayPlugin>('Display');

export default Display;
