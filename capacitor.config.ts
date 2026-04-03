import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lexiquest.app',
  appName: 'LexiQuest',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-3271133689051975~6391196608',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '78991956591-f98ijc9qi1741bmlqnf7s6ti2q5p8eeb.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
