"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface UploadStatusProps {
  hasSession: boolean;
  onReset: () => void;
}

export const UploadStatus: React.FC<UploadStatusProps> = ({
  hasSession,
  onReset,
}) => {
  if (!hasSession) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
           Upload a ZIP file containing .webp images and _filter.csv to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-green-700 dark:text-green-300">
          ✓ Processing complete! Download your _final.csv
        </p>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          New Upload
        </button>
      </div>
    </div>
  );
};
