/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ApiKeyGate } from './ApiKeyGate';
import { GoogleGenAI, Type } from '@google/genai';
import { Loader2, Video, FileText, AlertCircle, CheckCircle2, Wand2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScriptSegment } from './types';

function MainApp() {
  const [script, setScript] = useState('');
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBroll = async () => {
    if (!script.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setSegments([]);
    setIsGenerating(true);

    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");

      const ai = new GoogleGenAI({ apiKey });

      // 1. Analyze script
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: `Analyze the following script and break it down into 3 to 5 logical segments. For each segment, write a highly descriptive, cinematic prompt for a video generation model to create a B-roll clip that visually represents the segment. Keep the prompts focused on visual details, lighting, camera movement, and subject. Do not include audio instructions.

Script:
${script}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The exact text of the script segment." },
                prompt: { type: Type.STRING, description: "The video generation prompt for this segment." }
              },
              required: ["text", "prompt"]
            }
          }
        }
      });

      const parsedSegments = JSON.parse(response.text || '[]');
      const initialSegments: ScriptSegment[] = parsedSegments.map((seg: any, index: number) => ({
        id: `seg-${index}-${Date.now()}`,
        text: seg.text,
        prompt: seg.prompt,
        status: 'pending'
      }));

      setSegments(initialSegments);
      setIsAnalyzing(false);

      // 2. Generate videos sequentially
      for (let i = 0; i < initialSegments.length; i++) {
        await generateVideoForSegment(initialSegments[i].id, initialSegments[i].prompt, apiKey);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze script");
      setIsAnalyzing(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideoForSegment = async (id: string, prompt: string, apiKey: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, status: 'generating' } : s));

    try {
      const ai = new GoogleGenAI({ apiKey });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video URI returned");

      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!response.ok) throw new Error("Failed to download video");
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      setSegments(prev => prev.map(s => s.id === id ? { ...s, status: 'completed', videoUrl } : s));

    } catch (err: any) {
      console.error(`Error generating video for ${id}:`, err);
      setSegments(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: err.message } : s));
      
      if (err.message?.includes("Requested entity was not found")) {
        window.dispatchEvent(new CustomEvent('api-key-error'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">B-Roll Automator</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-medium text-zinc-300">Script Input</h2>
              </div>
              <div className="p-4">
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste your video script here... We'll analyze it and generate matching B-roll clips."
                  className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  disabled={isGenerating}
                />
                <button
                  onClick={generateBroll}
                  disabled={!script.trim() || isGenerating}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:shadow-none"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Script...
                    </>
                  ) : isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating B-Roll...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate B-Roll
                    </>
                  )}
                </button>
                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="popLayout">
              {segments.length === 0 && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500 p-8 text-center"
                >
                  <Video className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-zinc-400 mb-2">No segments yet</p>
                  <p className="max-w-sm">Paste a script and click generate to see the AI break it down and create matching video clips.</p>
                </motion.div>
              )}

              {segments.map((segment, index) => (
                <motion.div
                  key={segment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl flex flex-col sm:flex-row"
                >
                  {/* Video Area */}
                  <div className="sm:w-1/2 bg-black relative aspect-video sm:aspect-auto border-b sm:border-b-0 sm:border-r border-zinc-800 flex items-center justify-center overflow-hidden">
                    {segment.status === 'pending' && (
                      <div className="text-zinc-600 flex flex-col items-center">
                        <Video className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-sm font-medium">Waiting...</span>
                      </div>
                    )}
                    {segment.status === 'generating' && (
                      <div className="text-indigo-400 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 mb-3 animate-spin" />
                        <span className="text-sm font-medium animate-pulse">Generating Video...</span>
                        <span className="text-xs text-zinc-500 mt-2">This may take a few minutes</span>
                      </div>
                    )}
                    {segment.status === 'error' && (
                      <div className="text-red-400 flex flex-col items-center p-4 text-center">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">Generation Failed</span>
                        <span className="text-xs text-red-500/70 mt-1 line-clamp-2">{segment.error}</span>
                      </div>
                    )}
                    {segment.status === 'completed' && segment.videoUrl && (
                      <video
                        src={segment.videoUrl}
                        controls
                        autoPlay
                        loop
                        muted
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="sm:w-1/2 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">
                        Segment {index + 1}
                      </span>
                      {segment.status === 'completed' && (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready
                        </span>
                      )}
                    </div>
                    
                    <div className="mb-4 flex-grow">
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Script Text</h3>
                      <p className="text-zinc-300 text-sm leading-relaxed border-l-2 border-zinc-700 pl-3">
                        "{segment.text}"
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Generated Prompt</h3>
                      <p className="text-zinc-400 text-xs leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                        {segment.prompt}
                      </p>
                    </div>
                    
                    {segment.status === 'completed' && segment.videoUrl && (
                      <a
                        href={segment.videoUrl}
                        download={`broll-segment-${index + 1}.mp4`}
                        className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Clip
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ApiKeyGate>
      <MainApp />
    </ApiKeyGate>
  );
}
