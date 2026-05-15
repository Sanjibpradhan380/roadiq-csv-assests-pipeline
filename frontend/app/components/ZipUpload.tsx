"use client";

import React, { useRef, useState, ChangeEvent } from "react";
import axios from "axios";
import { Upload, X, CheckCircle2, AlertCircle } from "lucide-react";

interface ZipUploadProps {
  onUploadSuccess: (sessionId: string) => void;
  isLoading: boolean;
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000";

export const ZipUpload: React.FC<ZipUploadProps> = ({
  onUploadSuccess,
  isLoading,
}) => {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      setZipFile(file);
      setError(null);
      setProgress(0);
    } else {
      setError("Please select a valid .zip file");
    }
  };

  const handleUpload = async () => {
    if (!zipFile) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("zip_file", zipFile);

    try {
      const response = await axios.post(
        `${BACKEND_BASE_URL}/upload-zip`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          },
        }
      );

      if (response.data.success) {
        onUploadSuccess(response.data.session_id);
        setZipFile(null);
        setProgress(0);
        if (zipInputRef.current) zipInputRef.current.value = "";
      } else {
        setError(response.data.message || "Upload failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${zipFile ? "bg-green-500" : "bg-slate-300"}`}></div>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          ZIP File Upload
        </span>
      </div>

      {!zipFile ? (
        <div
          onClick={() => zipInputRef.current?.click()}
          className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50 dark:hover:bg-slate-700 transition-all hover:border-purple-500 group min-h-[12rem]"
        >
          <Upload className="w-12 h-12 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-center">
            Upload ZIP
          </span>
          <span className="text-xs text-slate-500 mt-2 text-center">
            .webp + filter.csv
          </span>
        </div>
      ) : (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {zipFile.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {(zipFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setZipFile(null);
              if (zipInputRef.current) zipInputRef.current.value = "";
            }}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <input
        type="file"
        ref={zipInputRef}
        onChange={handleFileChange}
        accept=".zip"
        className="hidden"
      />

      <button
        onClick={handleUpload}
        disabled={!zipFile || uploading || isLoading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
      >
        {uploading ? `Uploading... ${progress}%` : "Upload ZIP"}
      </button>
    </div>
  );
};
