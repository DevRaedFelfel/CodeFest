import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codefest.app',
  appName: 'CodeFest',
  webDir: 'dist/codefest-client/browser',
  android: {
    allowMixedContent: true,
  },
  server: {
    // Set this to your server IP when deploying to devices
    // e.g., url: 'http://192.168.1.100:4200'
    androidScheme: 'https',
  },
};

export default config;
