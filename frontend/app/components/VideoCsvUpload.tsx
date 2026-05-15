"use client";

import React, { useState, useRef, ChangeEvent } from "react";
import axios from "axios";
import { Upload, X, Video, FileText, CheckCircle2, AlertCircle } from "lucide-react";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000";
const BACKEND_UPLOAD_URL = `${BACKEND_BASE_URL}/upload`;

export const VideoCsvUpload: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadZipError, setDownloadZipError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (e.target === videoInputRef.current) {
      if (selectedFile.type.startsWith("video/")) {
        setVideoFile(selectedFile);
        setVideoPreviewUrl(URL.createObjectURL(selectedFile));
        setProgress(0);
        setUploadError(null);
      } else {
        alert("Please select a valid video file (MP4, WebM, Ogg).");
      }
    } else if (e.target === csvInputRef.current) {
      if (selectedFile.name.endsWith(".csv") || selectedFile.type === "text/csv") {
        setCsvFile(selectedFile);
        setProgress(0);
        setUploadError(null);

        const reader = new FileReader();
        reader.onload = (event) => {
          const csv = event.target?.result as string;
          const lines = csv.split("\n").slice(0, 5);
          const parsed = lines.map((line) => line.split(","));
          setCsvPreview(parsed);
        };
        reader.readAsText(selectedFile);
      } else {
        alert("Please select a valid CSV file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !csvFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("csv_file", csvFile);
    formData.append("title", title || "Untitled");

    try {
      const response = await axios.post(BACKEND_UPLOAD_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      setUploadSuccess(true);
      setProgress(100);
      setDownloadFilename(response.data?.video_filename || videoFile.name);
      setDownloadError(null);
      setDownloadZipError(null);
    } catch (error) {
      console.error("Upload failed", error);
      setUploadError("Upload failed. Please try again or check the backend server.");
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setVideoFile(null);
    setCsvFile(null);
    setTitle("");
    setVideoPreviewUrl(null);
    setCsvPreview([]);
    setProgress(0);
    setUploadError(null);
    setUploadSuccess(false);
    setDownloadFilename(null);
    setDownloadError(null);
    setDownloadZipError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const downloadFile = (url: string, filename?: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    if (filename) {
      anchor.download = filename;
    }
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDownloadCsv = () => {
    if (!downloadFilename) return;

    setDownloadError(null);
    setDownloadZipError(null);

    const url = `${BACKEND_BASE_URL}/download_filtered_csv?video_filename=${encodeURIComponent(downloadFilename)}`;
    downloadFile(url, `${downloadFilename.replace(/\.[^/.]+$/, "")}_final.csv`);
  };

  const handleDownloadZip = async () => {
    if (!downloadFilename) return;

    setDownloadZipError(null);
    setDownloadError(null);

    try {
      const url = `${BACKEND_BASE_URL}/download_zip?video_filename=${encodeURIComponent(downloadFilename)}`;
      downloadFile(url, `${downloadFilename.replace(/\.[^/.]+$/, "")}_zip.zip`);
    } catch (error: any) {
      setDownloadZipError(
        error.response?.data?.detail || "ZIP download failed. Please try again."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Upload video & CSV</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Here the original video and CSV upload </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${videoFile ? "bg-green-500" : "bg-slate-300"}`}></div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Video File</span>
            </div>

            {!videoFile ? (
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-all hover:border-blue-500 group min-h-[16rem]"
              >
                <Video className="w-12 h-12 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center"> Select a video</span>
                <span className="text-xs text-slate-500 mt-2 text-center">MP4, WebM, or Ogg</span>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg border-2 border-blue-200 dark:border-blue-800">
                <video src={videoPreviewUrl || ""} controls className="w-full h-full" />
                <button
                  type="button"
                  onClick={() => {
                    setVideoFile(null);
                    setVideoPreviewUrl(null);
                    if (videoInputRef.current) videoInputRef.current.value = "";
                  }}
                  className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {videoFile && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="truncate font-medium">{videoFile.name}</p>
                <p>{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${csvFile ? "bg-green-500" : "bg-slate-300"}`}></div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">CSV File</span>
            </div>

            {!csvFile ? (
              <div
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 dark:hover:bg-slate-700 transition-all hover:border-green-500 group min-h-[16rem]"
              >
                <FileText className="w-12 h-12 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Select a CSV</span>
                <span className="text-xs text-slate-500 mt-2 text-center">Requires .csv file</span>
              </div>
            ) : (
              <div className="rounded-3xl border border-green-200 dark:border-green-700 bg-white dark:bg-slate-800 p-4 min-h-[16rem] flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setCsvPreview([]);
                    if (csvInputRef.current) csvInputRef.current.value = "";
                  }}
                  className="self-end p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                >
                  <X size={18} />
                </button>
                <div className="overflow-x-auto flex-1 mt-3">
                  {csvPreview.length > 0 ? (
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {csvPreview.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-green-200 dark:border-slate-600">
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-2 py-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-green-100 dark:border-slate-600"
                              >
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {csvFile && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="truncate font-medium">{csvFile.name}</p>
                <p>{(csvFile.size / 1024).toFixed(2)} KB</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Project title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this upload"
            className="w-full rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 outline-none transition"
          />
        </div>

        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            Upload completed successfully.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !videoFile || !csvFile}
            className="w-full rounded-3xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-4 py-3 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading..." : "Upload Video + CSV"}
          </button>
          <button
            type="button"
            onClick={clearFile}
            disabled={isUploading}
            className="w-full rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold px-4 py-3 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Clear Files
          </button>
        </div>

        {uploadSuccess && downloadFilename && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="w-full rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 transition"
            >
              Download Filtered CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadZip}
              className="w-full rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 transition"
            >
              Download ZIP
            </button>
          </div>
        )}

        {(downloadError || downloadZipError) && (
          <div className="mt-4 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            {downloadError || downloadZipError}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={videoInputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={csvInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />
    </div>
  );
};
