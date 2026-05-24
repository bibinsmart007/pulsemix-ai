import React, { useState } from "react";
import { X, Globe, Lock, Clock, Download, Eye, Link as LinkIcon, AlertTriangle, Check } from "lucide-react";

export interface PublishConfig {
  packageType: string;
  notes: string;
  allowDownload: boolean;
  password?: string;
  expiresHours?: number;
  recipientLabel?: string;
}

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (config: PublishConfig) => void;
  isLoading?: boolean;
}

export default function PublishModal({ isOpen, onClose, onPublish, isLoading = false }: PublishModalProps) {
  const [packageType, setPackageType] = useState<string>("private_preview");
  const [notes, setNotes] = useState<string>("");
  const [allowDownload, setAllowDownload] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [expiresHours, setExpiresHours] = useState<number | "">("");
  const [recipientLabel, setRecipientLabel] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPublish({
      packageType,
      notes,
      allowDownload,
      password: password || undefined,
      expiresHours: expiresHours === "" ? undefined : Number(expiresHours),
      recipientLabel: recipientLabel || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Globe className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Publish Package</h2>
              <p className="text-sm text-white/50">Generate a secure external link for review or delivery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/80">Package Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPackageType("private_preview")}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                  packageType === "private_preview" 
                    ? "bg-brand/20 border-brand text-brand" 
                    : "bg-black/20 border-white/10 text-white/70 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span className="font-bold text-sm">Private Preview</span>
                </div>
                <span className="text-xs opacity-70">For internal drafts & feedback</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPackageType("shared_release")}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                  packageType === "shared_release" 
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                    : "bg-black/20 border-white/10 text-white/70 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  <span className="font-bold text-sm">Approved Release</span>
                </div>
                <span className="text-xs opacity-70">Final approved delivery</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/80">Recipient Label (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Client A, Agency Team"
              value={recipientLabel}
              onChange={(e) => setRecipientLabel(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/80">Release Notes / Message</label>
            <textarea 
              placeholder="What changed in this version?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-brand transition-colors min-h-[80px]"
            />
          </div>

          <div className="p-4 bg-black/30 border border-white/5 rounded-xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Access Controls
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/60">Password Protection</label>
                <input 
                  type="password" 
                  placeholder="Optional password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/60">Expiration (Hours)</label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-2.5 text-white/40" />
                  <input 
                    type="number" 
                    placeholder="Never"
                    value={expiresHours}
                    onChange={(e) => setExpiresHours(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group mt-2">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${allowDownload ? 'bg-brand border-brand' : 'bg-black/50 border-white/20 group-hover:border-white/40'}`}>
                {allowDownload && <Check className="w-3 h-3 text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
              <span className="text-sm text-white/80 group-hover:text-white transition-colors">Allow recipients to download audio</span>
            </label>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3 bg-brand hover:bg-brand-light text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating Link...
                </>
              ) : (
                <>
                  Generate Publish Link
                </>
              )}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}
