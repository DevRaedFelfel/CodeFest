import { contextBridge, ipcRenderer } from 'electron';

// Layer 3: DOM-level Escape key blocking (final fallback)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
  }
});

contextBridge.exposeInMainWorld('codefestKiosk', {
  // === DISPLAY ===
  getDisplayCount: (): Promise<number> =>
    ipcRenderer.invoke('get-display-count'),

  onMonitorWarning: (cb: (show: boolean) => void): void => {
    ipcRenderer.removeAllListeners('show-monitor-warning');
    ipcRenderer.removeAllListeners('hide-monitor-warning');
    ipcRenderer.on('show-monitor-warning', () => cb(true));
    ipcRenderer.on('hide-monitor-warning', () => cb(false));
  },

  // === EXIT ===
  requestExit: (): Promise<void> =>
    ipcRenderer.invoke('request-exit'),

  confirmExit: (): Promise<void> =>
    ipcRenderer.invoke('confirm-exit'),

  cancelExit: (): Promise<void> =>
    ipcRenderer.invoke('cancel-exit'),

  submissionComplete: (): Promise<void> =>
    ipcRenderer.invoke('submission-complete'),

  sessionEndedExit: (): Promise<void> =>
    ipcRenderer.invoke('session-ended-exit'),

  // === EXIT FLOW EVENTS FROM MAIN ===
  onExitConfirmation: (cb: () => void): void => {
    ipcRenderer.removeAllListeners('show-exit-confirmation');
    ipcRenderer.on('show-exit-confirmation', () => cb());
  },

  onSubmitAndExit: (cb: () => void): void => {
    ipcRenderer.removeAllListeners('submit-all-and-exit');
    ipcRenderer.on('submit-all-and-exit', () => cb());
  },

  // === SECURITY EVENTS ===
  onSecurityViolation: (cb: (data: unknown) => void): void => {
    ipcRenderer.removeAllListeners('security-violation');
    ipcRenderer.on('security-violation', (_event, data) => cb(data));
  },

  // === SESSION ===
  reportClientType: (): string => 'electron-windows',

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-app-version'),

  // === ENVIRONMENT CHECKS ===
  runPreExamChecks: (): Promise<unknown[]> =>
    ipcRenderer.invoke('run-pre-exam-checks'),
});
