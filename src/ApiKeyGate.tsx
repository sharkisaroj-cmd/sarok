import React, { useState, useEffect } from 'react';
import { Key } from 'lucide-react';

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      } else {
        setHasKey(true); // Fallback for local dev
      }
    };
    checkKey();

    const handleApiError = () => {
      setHasKey(false);
    };
    window.addEventListener('api-key-error', handleApiError);
    return () => window.removeEventListener('api-key-error', handleApiError);
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition as per instructions
      setHasKey(true);
    }
  };

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-800 shadow-2xl">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-4">API Key Required</h1>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            This application uses the Veo video generation model, which requires a paid Google Cloud API key.
            <br /><br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">
              Learn more about billing
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
