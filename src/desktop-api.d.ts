export {};

declare global {
  interface Window {
    desktopStudio?: {
      getTtsKeyStatus: () => Promise<boolean>;
      saveTtsApiKey: (apiKey: string) => Promise<boolean>;
      synthesizeTts: (payload: {
        text: string;
        voiceType: string;
        speedRatio: number;
        bundledApiKey?: string;
        bundledResourceId?: string;
        bundledEndpoint?: string;
      }) => Promise<{audioBase64: string}>;
    };
  }
}
