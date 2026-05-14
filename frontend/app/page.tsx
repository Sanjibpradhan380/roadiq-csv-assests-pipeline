"use client";

import React, { useState, useRef, ChangeEvent } from 'react';
import axios from 'axios';
import { Upload, X, Video, FileText, CheckCircle2 } from 'lucide-react';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000';
const BACKEND_UPLOAD_URL = `${BACKEND_BASE_URL}/upload`;

const VideoUpload = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
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

    // Determine if it's video or CSV based on input ref
    if (e.target === videoInputRef.current) {
      if (selectedFile.type.startsWith('video/')) {
        setVideoFile(selectedFile);
        setVideoPreviewUrl(URL.createObjectURL(selectedFile));
        setProgress(0);
        setUploadError(null);
      } else {
        alert("Please select a valid video file (MP4, WebM, Ogg).");
      }
    } else if (e.target === csvInputRef.current) {
      if (selectedFile.name.endsWith('.csv') || selectedFile.type === 'text/csv') {
        setCsvFile(selectedFile);
        setProgress(0);
        setUploadError(null);

        // Parse CSV for preview
        const reader = new FileReader();
        reader.onload = (event) => {
          const csv = event.target?.result as string;
          const lines = csv.split('\n').slice(0, 5);
          const parsed = lines.map(line => line.split(','));
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
    formData.append('video', videoFile);
    formData.append('csv_file', csvFile);
    formData.append('title', title || 'Untitled');

    try {
      const response = await axios.post(BACKEND_UPLOAD_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
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
    } catch (error) {
      console.error('Upload failed', error);
      setUploadError('Upload failed. Please try again or check the backend server.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setVideoFile(null);
    setCsvFile(null);
    setTitle('');
    setVideoPreviewUrl(null);
    setCsvPreview([]);
    setProgress(0);
    setUploadError(null);
    setUploadSuccess(false);
    setDownloadFilename(null);
    setDownloadError(null);
    setDownloadZipError(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const downloadFile = (url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDownloadCsv = () => {
    if (!downloadFilename) return;

    setDownloadError(null);
    setDownloadZipError(null);

    const url = `${BACKEND_BASE_URL}/download_filtered_csv?video_filename=${encodeURIComponent(downloadFilename)}`;
    downloadFile(url);
  };

  const handleDownloadZip = () => {
    if (!downloadFilename) return;

    setDownloadZipError(null);
    setDownloadError(null);

    const url = `${BACKEND_BASE_URL}/download_zip?video_filename=${encodeURIComponent(downloadFilename)}`;
    downloadFile(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 px-6 py-6 sm:px-8 sm:py-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Upload Video & CSV Data</h2>
            <p className="text-sm sm:text-base text-purple-100 max-w-2xl">Upload your video and tracking CSV to generate filtered screenshots, bounding boxes, and downloadable exports.</p>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Required Notice */}
            <div className={`mb-6 rounded-lg p-4 border-l-4 transition-all ${videoFile && csvFile ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'}`}>
              <p className={`text-sm font-medium ${videoFile && csvFile ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {videoFile && csvFile ? '✓ Both files selected - Ready to upload!' : '⚠️ Please select BOTH a video file and a CSV file to proceed'}
              </p>
            </div>

            {/* Hidden File Inputs */}
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

            {/* Files Display Grid - Always Visible */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              {/* Video Upload/Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${videoFile ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Video File</span>
                </div>

                {!videoFile ? (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-all hover:border-blue-500 group min-h-[18rem]"
                  >
                    <Video className="w-12 h-12 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-center">Click to Select Video</span>
                    <span className="text-xs text-slate-500 mt-2 text-center">MP4, WebM, or Ogg</span>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg border-2 border-blue-200 dark:border-blue-800">
                    <video src={videoPreviewUrl || ''} controls className="w-full h-full" />
                    <button
                      onClick={() => {
                        setVideoFile(null);
                        setVideoPreviewUrl(null);
                        if (videoInputRef.current) videoInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full transition-colors font-medium"
                    >
                      Change
                    </button>
                  </div>
                )}

                {videoFile && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <p className="truncate font-medium">{videoFile.name}</p>
                    <p className="text-xs">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                )}
              </div>

              {/* CSV Upload/Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${csvFile ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">CSV File</span>
                </div>

                {!csvFile ? (
                  <div
                    onClick={() => csvInputRef.current?.click()}
                    className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 dark:hover:bg-slate-700 transition-all hover:border-green-500 group min-h-[18rem]"
                  >
                    <FileText className="w-12 h-12 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-center">Click to Select CSV</span>
                    <span className="text-xs text-slate-500 mt-2 text-center">Spreadsheet data file</span>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border-2 border-green-200 dark:border-green-700 min-h-64 relative overflow-hidden flex flex-col">
                    <button
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview([]);
                        if (csvInputRef.current) csvInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors z-10"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => csvInputRef.current?.click()}
                      className="absolute top-2 left-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-full transition-colors font-medium z-10"
                    >
                      Change
                    </button>

                    {csvPreview.length > 0 ? (
                      <div className="overflow-x-auto flex-1 mt-6">
                        <table className="w-full text-xs border-collapse">
                          <tbody>
                            {csvPreview.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-green-200 dark:border-slate-600">
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className="px-2 py-1 text-slate-700 dark:text-slate-200 truncate max-w-xs bg-white dark:bg-slate-800 border border-green-100 dark:border-slate-600"
                                  >
                                    {cell.trim()}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center flex-1">
                        <FileText className="w-8 h-8 text-green-400 opacity-50" />
                      </div>
                    )}

                    {csvFile && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                        <p className="truncate font-medium">{csvFile.name}</p>
                        <p className="text-xs">{(csvFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 dark:border-slate-700 my-6"></div>

            {/* Title Input */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-700 mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Project Title/Description (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your project a name"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none transition"
              />
            </div>

            {/* Progress Bar */}
            {progress > 0 && (
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2 mb-6">
                <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-300">Both files uploaded successfully!</p>
              </div>
            )}

            {/* Button Container */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={handleUpload}
                disabled={isUploading || progress === 100 || !videoFile || !csvFile}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                  progress === 100
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : !videoFile || !csvFile
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : isUploading
                    ? 'bg-blue-600 text-white opacity-75'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg'
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : progress === 100 ? (
                  <>
                    <CheckCircle2 size={20} />
                    Uploaded Successfully
                  </>
                ) : !videoFile || !csvFile ? (
                  <>
                    <Upload size={20} />
                    Select Both Files First
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Upload Both Files
                  </>
                )}
              </button>

              <button
                onClick={clearFile}
                disabled={isUploading}
                className="py-3 px-6 rounded-lg font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all w-full sm:w-auto"
              >
                Clear All
              </button>
            </div>

            {uploadSuccess && downloadFilename && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={handleDownloadCsv}
                  className="w-full py-3 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                >
                  Download CSV
                </button>
                <button
                  onClick={handleDownloadZip}
                  className="w-full py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all"
                >
                  Download ZIP
                </button>
                {(downloadError || downloadZipError) && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                    {downloadError || downloadZipError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Cards */}
        {!videoFile && !csvFile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <Video className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Video File</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Support for MP4, WebM, and Ogg formats. Upload your video content or tutorial.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-1">CSV Data</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Upload your dataset or spreadsheet in CSV format for processing.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUpload;