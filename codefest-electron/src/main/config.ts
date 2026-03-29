import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface KioskSettings {
  blockProcesses: boolean;
  processCheckIntervalMs: number;
  displayCheckIntervalMs: number;
  autoSaveIntervalMs: number;
  exitRequiresConfirmation: boolean;
}

export interface AppConfig {
  serverUrl: string;
  allowedOrigins: string[];
  kioskSettings: KioskSettings;
  sessionCode?: string;
  noProcessWatch?: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  serverUrl: 'http://localhost:4200',
  allowedOrigins: [
    'http://localhost:4200',
    'http://localhost:5050',
    'http://192.168.*',
  ],
  kioskSettings: {
    blockProcesses: true,
    processCheckIntervalMs: 2000,
    displayCheckIntervalMs: 5000,
    autoSaveIntervalMs: 30000,
    exitRequiresConfirmation: true,
  },
};

function findConfigFile(): string | null {
  const candidates: string[] = [];

  if (app.isPackaged) {
    // Production: look next to the executable
    candidates.push(path.join(path.dirname(app.getPath('exe')), 'codefest-config.json'));
    candidates.push(path.join(app.getPath('userData'), 'codefest-config.json'));
  }

  // Development: look in project root
  candidates.push(path.join(process.cwd(), 'codefest-config.json'));
  candidates.push(path.join(__dirname, '..', '..', 'codefest-config.json'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseCliArgs(): Partial<AppConfig> {
  const args = process.argv.slice(1);
  const result: Partial<AppConfig> = {};

  for (const arg of args) {
    if (arg.startsWith('--server-url=')) {
      result.serverUrl = arg.split('=')[1];
    } else if (arg === '--no-process-watch') {
      result.noProcessWatch = true;
    } else if (arg.startsWith('--session-code=')) {
      result.sessionCode = arg.split('=')[1];
    }
  }

  return result;
}

export function loadConfig(): AppConfig {
  let fileConfig: Partial<AppConfig> = {};

  const configPath = findConfigFile();
  if (configPath) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
      console.log(`Loaded config from: ${configPath}`);
    } catch (err) {
      console.warn(`Failed to parse config file ${configPath}:`, err);
    }
  } else {
    console.log('No codefest-config.json found, using defaults.');
  }

  const cliConfig = parseCliArgs();

  // Merge: defaults < file < CLI
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    kioskSettings: {
      ...DEFAULT_CONFIG.kioskSettings,
      ...(fileConfig.kioskSettings || {}),
    },
  };

  // CLI overrides
  if (cliConfig.serverUrl) {
    config.serverUrl = cliConfig.serverUrl;
  }
  if (cliConfig.sessionCode) {
    config.sessionCode = cliConfig.sessionCode;
  }
  if (cliConfig.noProcessWatch) {
    config.kioskSettings.blockProcesses = false;
  }

  // Ensure serverUrl is in allowedOrigins
  if (!config.allowedOrigins.includes(config.serverUrl)) {
    config.allowedOrigins.push(config.serverUrl);
  }

  return config;
}

export function isAllowedURL(url: string, config: AppConfig): boolean {
  return config.allowedOrigins.some(origin => {
    if (origin.includes('*')) {
      const pattern = new RegExp('^' + origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\w.-]+'));
      return pattern.test(url);
    }
    return url.startsWith(origin);
  });
}
