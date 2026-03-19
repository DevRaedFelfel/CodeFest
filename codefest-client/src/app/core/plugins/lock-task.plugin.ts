import { registerPlugin } from '@capacitor/core';

export interface LockTaskPlugin {
  startLockTask(): Promise<{ success: boolean; level: number }>;
  stopLockTask(options: { pin: string }): Promise<{ success: boolean }>;
  isInLockTaskMode(): Promise<{ isLocked: boolean }>;
  isDeviceOwner(): Promise<{ isDeviceOwner: boolean }>;
}

const LockTask = registerPlugin<LockTaskPlugin>('LockTask');

export default LockTask;
