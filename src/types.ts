export type SegmentStatus = 'pending' | 'generating' | 'completed' | 'error';

export interface ScriptSegment {
  id: string;
  text: string;
  prompt: string;
  status: SegmentStatus;
  videoUrl?: string;
  error?: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
