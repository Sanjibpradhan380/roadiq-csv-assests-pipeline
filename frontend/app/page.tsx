"use client";

import React, { useState } from "react";
import { VideoCsvUpload } from "./components/VideoCsvUpload";
import { ZipUpload } from "./components/ZipUpload";
import { DownloadFinalCsv } from "./components/DownloadFinalCsv";
import { UploadStatus } from "./components/UploadStatus";

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleUploadSuccess = (newSessionId: string) => {
    setIsProcessing(true);
    setSessionId(newSessionId);
    setIsProcessing(false);
  };

  const handleCleanupComplete = () => {
    setSessionId(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r flex flex-col items-center from-purple-600 via-fuchsia-600 to-blue-600 px-6 py-6 sm:px-8 sm:py-8">
            <h1 className=" text-3xl sm:text-4xl font-bold text-white mb-2">
              Pavment Pipeline
            </h1>
            <h3 className=" text-center text-sm  sm:text-base text-purple-100 max-w-2xl">
               Automates the extraction of localized image assets from video files <br /> based on
filtered tracking data
            </h3>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <VideoCsvUpload />
            <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">ZIP Upload</h2>
              <ZipUpload onUploadSuccess={handleUploadSuccess} isLoading={isProcessing} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
              <UploadStatus hasSession={!!sessionId} onReset={handleCleanupComplete} />
            </div>

            {sessionId ? (
              <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                <DownloadFinalCsv sessionId={sessionId} onCleanupComplete={handleCleanupComplete} />
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Ready to download</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  After a successful ZIP upload, the download  _final.csv will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">How it works</h2>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li>✓ Video + CSV upload and download zip which will contain images and filte.csv.</li>
            <li>✓ Upload zip after delete unwanted .webp,contained .webp and filter.csv , then generates _final.csv on demand.</li>
            <li>✓ The download _final.csv only appears after a successful ZIP upload.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
