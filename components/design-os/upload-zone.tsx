"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Image, Video, File } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type UploadedFile = {
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
};

interface UploadZoneProps {
  onFilesChange: (files: UploadedFile[]) => void;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-5 h-5 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (type.startsWith("video/")) return <Video className="w-5 h-5 text-purple-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function getFileCategory(type: string): string {
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("video/")) return "video";
  return "other";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onFilesChange }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setUploading((prev) => [...prev, file.name]);
    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error } = await supabase.storage
        .from("design-files")
        .upload(path, file, { upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("design-files")
        .getPublicUrl(path);

      const uploaded: UploadedFile = {
        file_name: file.name,
        file_url:  urlData.publicUrl,
        file_type: getFileCategory(file.type),
        file_size: file.size,
      };

      setFiles((prev) => {
        const next = [...prev, uploaded];
        onFilesChange(next);
        return next;
      });
    } catch (e: unknown) {
      setErrors((prev) => [...prev, `Failed to upload ${file.name}: ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setUploading((prev) => prev.filter((n) => n !== file.name));
    }
  }, [onFilesChange]);

  const handleFiles = useCallback(
    (selected: FileList | null) => {
      if (!selected) return;
      Array.from(selected).forEach(uploadFile);
    },
    [uploadFile]
  );

  const remove = (idx: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      onFilesChange(next);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
        <p className="text-xs text-gray-500 mt-1">Images, PDFs, Videos, Creatives — any format</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.ai,.psd,.eps,.svg,.zip,.rar"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Uploading indicators */}
      {uploading.map((name) => (
        <div key={name} className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Uploading {name}…
        </div>
      ))}

      {/* Errors */}
      {errors.map((err, i) => (
        <div key={i} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
      ))}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              {fileIcon(f.file_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                <p className="text-xs text-gray-500">{formatSize(f.file_size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
