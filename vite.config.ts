import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const bundledTtsConfig = {
    mode: env.DOUBAO_TTS_MODE || 'api-key',
    apiKey: env.DOUBAO_API_KEY || '',
    resourceId: env.DOUBAO_RESOURCE_ID || 'seed-tts-2.0',
    voiceType: env.DOUBAO_VOICE_TYPE || 'zh_female_xiaohe_uranus_bigtts',
    endpoint: env.DOUBAO_TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
  };

  return {
    base: './',
    plugins: [react()],
    define: {
      __BUNDLED_TTS_CONFIG__: JSON.stringify(bundledTtsConfig)
    },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:4177'
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
