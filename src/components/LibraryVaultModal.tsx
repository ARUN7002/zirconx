/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  X,
  Trash2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  FileCheck,
  Download,
} from 'lucide-react';
import { VaultItem } from '../types';
import { computeFileHash } from '../services/db';

interface LibraryVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultItems: VaultItem[];
  onUploadItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const LibraryVaultModal: React.FC<LibraryVaultModalProps> = ({
  isOpen,
  onClose,
  vaultItems,
  onUploadItem,
  onDeleteItem,
}) => {
  const MAX_FILE_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes (50 MB)

  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<VaultItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const totalBytes = vaultItems.reduce((acc, item) => acc + item.fileSizeBytes, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleProcessFile = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      if (file.size >= MAX_FILE_BYTES) {
        throw new Error(
          `Vault rule violation: "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(
            1
          )} MB. Maximum allowed size is 50 MB.`
        );
      }

      const isPdfExtension = file.name.toLowerCase().endsWith('.pdf');
      const isPdfMime = file.type === 'application/pdf' || file.type === '';
      if (!isPdfExtension && !isPdfMime) {
        throw new Error('Vault rule violation: Only PDF documents are supported in the MVP.');
      }

      const hash = await computeFileHash(file);
      const isDuplicate = vaultItems.some((item) => item.fileHash === hash);
      if (isDuplicate) {
        throw new Error(`Duplicate document: This exact PDF is already secured in the Zircon Vault.`);
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read PDF file locally.'));
        reader.readAsDataURL(file);
      });

      const vaultId = 'vault_' + Math.random().toString(36).substring(2, 9);
      const newVaultItem: VaultItem = {
        id: vaultId,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: 'application/pdf',
        blobKey: vaultId,
        fileHash: hash,
        createdAt: Date.now(),
        isPermanent: true,
        dataUrl,
      };

      await onUploadItem(newVaultItem);
      setSuccessMsg(`"${file.name}" (${formatFileSize(file.size)}) permanently secured in Zircon Vault.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleProcessFile(e.target.files[0]);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      await onDeleteItem(id);
      setDeleteConfirmId(null);
      if (selectedPreviewItem?.id === id) {
        setSelectedPreviewItem(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl glass-card rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00F5A0]/15 border border-[#00F5A0]/30 flex items-center justify-center text-[#00F5A0]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Zircon PDF Vault</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00F5A0]/15 text-emerald-800 dark:text-[#00F5A0] border border-[#00F5A0]/30">
                  Permanent · No Expiry
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Local-only offline repository · Strict 50 MB limit per PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage HUD Banner */}
        <div className="px-6 py-3 bg-white/40 dark:bg-zinc-950/70 border-b border-white/10 dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#00F5A0]" />
            <span>
              <strong className="text-slate-900 dark:text-zinc-200 font-mono">{vaultItems.length}</strong> PDF documents secured
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>
              Total: <strong className="text-emerald-800 dark:text-[#00F5A0]">{totalMB} MB</strong>
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">|</span>
            <span className="text-slate-500 dark:text-zinc-400">Max 50 MB/file</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-rose-200 text-xs animate-in slide-in-from-top-1">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-[#00F5A0]/20 border border-[#00F5A0]/40 rounded-2xl text-emerald-800 dark:text-[#00F5A0] text-xs animate-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-[#00F5A0] shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[#00F5A0] bg-[#00F5A0]/15 scale-[1.01]'
                : 'border-black/10 dark:border-white/10 hover:border-[#00F5A0]/50 bg-white/30 dark:bg-zinc-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-zinc-900 border border-black/10 dark:border-white/10 flex items-center justify-center text-[#00F5A0] shadow-sm">
                <UploadCloud className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                {isProcessing ? 'Validating and securing PDF...' : 'Drop PDF file here, or browse local device'}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                PDF format only · Maximum 50 MB · 100% private on-device storage
              </div>
            </div>
          </div>

          {/* Secured Document List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              <span>Secured Vault Documents</span>
              <span>Permanence: Verified</span>
            </div>

            {vaultItems.length === 0 ? (
              <div className="p-8 text-center bg-white/30 dark:bg-zinc-950/40 rounded-2xl border border-black/5 dark:border-white/10 text-slate-500 dark:text-zinc-400 text-xs">
                <FileText className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                No documents in vault yet. Import critical PDFs for safe local custody.
              </div>
            ) : (
              <div className="space-y-2">
                {vaultItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-white/50 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 rounded-2xl hover:border-[#00F5A0]/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                          {item.fileName}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                          <span>{formatFileSize(item.fileSizeBytes)}</span>
                          <span>•</span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 dark:text-[#00F5A0] font-semibold">Permanent</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewItem(item)}
                        className="p-2 rounded-xl text-slate-400 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-[#00F5A0] hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                        title="View PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {item.dataUrl && (
                        <a
                          href={item.dataUrl}
                          download={item.fileName}
                          className="p-2 rounded-xl text-slate-400 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                          title="Save copy to device"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}

                      {deleteConfirmId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => confirmDelete(item.id)}
                            className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                          title="Delete PDF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sandboxed Offline PDF Viewer Drawer */}
        {selectedPreviewItem && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-lg flex flex-col p-2 sm:p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between p-3 bg-white/90 dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-t-2xl">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-[#00F5A0] shrink-0" />
                <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {selectedPreviewItem.fileName}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  ({formatFileSize(selectedPreviewItem.fileSizeBytes)})
                </span>
              </div>
              <button
                onClick={() => setSelectedPreviewItem(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-white/50 dark:bg-zinc-950 border border-t-0 border-black/10 dark:border-white/10 rounded-b-2xl overflow-hidden relative">
              {selectedPreviewItem.dataUrl ? (
                <iframe
                  src={selectedPreviewItem.dataUrl}
                  title={selectedPreviewItem.fileName}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-zinc-400 text-sm">
                  <span>Document preview is securely held in offline storage.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
