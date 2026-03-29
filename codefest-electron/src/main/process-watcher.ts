import { BrowserWindow } from 'electron';
import { exec } from 'child_process';

const DANGEROUS_PROCESSES = [
  'taskmgr.exe',
  'cmd.exe',
  'powershell.exe',
  'regedit.exe',
  'msconfig.exe',
  'snippingtool.exe',
  'screenclippinghost.exe',
  'sharex.exe',
];

let watcherInterval: ReturnType<typeof setInterval> | null = null;

function getRunningProcesses(): Promise<string[]> {
  return new Promise((resolve) => {
    exec('tasklist /fo csv /nh', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const processes = stdout
        .split('\n')
        .map(line => {
          // CSV format: "process.exe","PID","Session Name","Session#","Mem Usage"
          const match = line.match(/^"([^"]+)"/);
          return match ? match[1].toLowerCase() : '';
        })
        .filter(name => name.length > 0);

      resolve(processes);
    });
  });
}

export function startProcessWatcher(
  win: BrowserWindow,
  checkIntervalMs: number = 2000
): void {
  watcherInterval = setInterval(async () => {
    if (win.isDestroyed()) {
      stopProcessWatcher();
      return;
    }

    const processes = await getRunningProcesses();
    const violations = DANGEROUS_PROCESSES.filter(dp =>
      processes.includes(dp)
    );

    if (violations.length > 0) {
      // Log to renderer → server via SignalR
      win.webContents.send('security-violation', {
        type: 'DangerousProcess',
        processes: violations,
        timestamp: new Date().toISOString(),
      });

      // Force focus back to kiosk
      win.focus();
      win.moveTop();
    }
  }, checkIntervalMs);
}

export function stopProcessWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}
