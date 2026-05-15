"use client";

import React, { useState } from "react";
import axios from "axios";
import { Download, Loader, AlertCircle } from "lucide-react";

interface DownloadFinalCsvProps {
  sessionId: string | null;
  onCleanupComplete?: () => void;
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000";

export const DownloadFinalCsv: React.FC<DownloadFinalCsvProps> = ({
  sessionId,
  onCleanupComplete,
}) => {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!sessionId) return;

    setDownloading(true);
    setError(null);

    try {
      // First, get the correct filename
      const filenameResponse = await axios.get(
        `${BACKEND_BASE_URL}/get-final-csv-filename?session_id=${encodeURIComponent(
          sessionId
        )}`
      );
      const filename = filenameResponse.data.filename;

      // Then download the file
      const response = await axios.get(
        `${BACKEND_BASE_URL}/download-final-csv?session_id=${encodeURIComponent(
          sessionId
        )}`,
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Cleanup session after successful final CSV download
      try {
        await axios.post(
          `${BACKEND_BASE_URL}/cleanup-session`,
          null,
          {
            params: { session_id: sessionId },
          }
        );

        if (onCleanupComplete) {
          onCleanupComplete();
        }
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Download failed. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!sessionId) return;

    setDownloading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${BACKEND_BASE_URL}/download-uploaded-zip?session_id=${encodeURIComponent(
          sessionId
        )}`,
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `uploaded-${sessionId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "ZIP download failed. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          Download Results
        </span>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
        <p className="text-sm text-green-700 dark:text-green-300 mb-4">
          ✓ ZIP file processed successfully! Your _final.csv is ready to download.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download _final.csv
              </>
            )}
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download Uploaded ZIP
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
};
