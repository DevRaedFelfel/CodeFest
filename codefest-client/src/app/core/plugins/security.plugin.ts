import { registerPlugin } from '@capacitor/core';

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  androidVersion: string;
  apiLevel: number;
  serialHash: string;
}

export interface SecurityPlugin {
  blockScreenCapture(): Promise<{ blocked: boolean }>;
  isRooted(): Promise<{ isRooted: boolean; indicators: string }>;
  getDeviceInfo(): Promise<DeviceInfo>;
}

const Security = registerPlugin<SecurityPlugin>('Security');

export default Security;
