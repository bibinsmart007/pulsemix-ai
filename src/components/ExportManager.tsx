import React, { useState, useEffect } from 'react';
import { FileAudio, Download, X, Settings2, Play, Music, ListMusic, Loader, History } from 'lucide-react';

interface ExportJob {
  id: number;
  project_id: number;
  version_id: number;
  job_type: string;
  format: string;
  status: string;
  file_url: string | null;
  artifact_label: string;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
  byte_size?: number;
  mime_type?: string;
  retention_policy?: string;
  retention_source?: string;
  expires_at?: number | null;
  status_artifact?: string;
}

interface ExportManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  versionId: number;
  versionNumber: number;
  existingExports: ExportJob[];
  onRefreshExports: () => void;
}

export default function ExportManager({
  isOpen,
  onClose,
  projectId,
  versionId,
  versionNumber,
  existingExports,
  onRefreshExports
}: ExportManagerProps) {
  const [jobType, setJobType] = useState('full_mix');
  const [format, setFormat] = useState('wav');
  const [isExporting, setIsExporting] = useState(false);

  // Poll for active exports
  useEffect(() => {
    const hasRunning = existingExports.some(e => e.status === 'queued' || e.status === 'running');
    if (hasRunning && isOpen) {
      const timer = setInterval(() => {
        onRefreshExports();
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [existingExports, isOpen, onRefreshExports]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/cloud/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: versionId,
          job_type: jobType,
          format: format
        })
      });
      const data = await res.json();
      if (data.success) {
        onRefreshExports();
      } else {
        alert("Export failed: " + data.detail);
      }
    } catch (err) {
      console.error(err);
    }
    setIsExporting(false);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getRetentionBadge = (job: any) => {
    if (!job.status_artifact) return null; // We'll map a.status to status_artifact
    const status = job.status_artifact;
    
    if (status === 'archived') {
      return <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded uppercase font-bold border border-yellow-500/20">Archived</span>;
    }
    if (status === 'purged') {
      return <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded uppercase font-bold border border-red-500/20">Purged</span>;
    }
    
    if (job.expires_at) {
      const days = Math.ceil((job.expires_at - (Date.now() / 1000)) / 86400);
      if (days < 0) {
        return <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded uppercase font-bold border border-red-500/20">Expired</span>;
      }
      return <span className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold">Expires in {days}d</span>;
    }
    return <span className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase font-bold">{job.retention_policy}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-brand" />
              Export & Delivery
            </h2>
            <p className="text-sm text-white/50 mt-1">
              Render audio artifacts for Version {versionNumber}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-[400px]">
          {/* Left Config Panel */}
          <div className="w-full md:w-1/2 p-6 border-r border-white/5 bg-black/20 flex flex-col gap-6">
            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Job Type</label>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setJobType('full_mix')}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${jobType === 'full_mix' ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <Music className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Full Mixdown</div>
                    <div className="text-xs opacity-60">The complete rendered arrangement</div>
                  </div>
                </button>
                <button 
                  onClick={() => setJobType('preview')}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${jobType === 'preview' ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Preview (Fast)</div>
                    <div className="text-xs opacity-60">Lower quality fast render for review</div>
                  </div>
                </button>
                <button 
                  onClick={() => setJobType('stems')}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${jobType === 'stems' ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <ListMusic className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Individual Stems</div>
                    <div className="text-xs opacity-60">Separate multitracks for handoff</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Format</label>
              <div className="flex gap-2">
                {['wav', 'mp3', 'zip'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors uppercase ${format === f ? 'border-brand bg-brand text-black' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="mt-auto w-full py-3 bg-brand hover:bg-brand-hover text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              Queue Render Job
            </button>
          </div>

          {/* Right History Panel */}
          <div className="w-full md:w-1/2 p-6 flex flex-col overflow-hidden">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="w-4 h-4" /> Export History
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {existingExports.length === 0 ? (
                <div className="text-sm text-white/30 italic p-4 text-center border border-white/5 rounded-lg bg-black/20">
                  No exports generated for this version yet.
                </div>
              ) : (
                existingExports.map(job => (
                  <div key={job.id} className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{job.artifact_label}</span>
                      {job.status === 'completed' ? (
                        <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">Ready</span>
                      ) : job.status === 'failed' ? (
                        <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded uppercase">Failed</span>
                      ) : (
                        <span className="text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <Loader className="w-3 h-3 animate-spin" /> {job.status}
                        </span>
                      )}
                    </div>
                    {job.status === 'completed' && job.byte_size && (
                      <div className="mb-2 flex items-center gap-3 text-[10px] text-white/50 font-mono">
                        <span>{formatSize(job.byte_size)}</span>
                        <span>•</span>
                        <span>{job.mime_type?.split('/')[1]?.toUpperCase() || 'UNKNOWN'}</span>
                        <span>•</span>
                        <span className="uppercase">{job.retention_source?.replace('_', ' ')}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">ID: {job.id} • {new Date(job.created_at * 1000).toLocaleTimeString()}</span>
                        {getRetentionBadge({ ...job, status_artifact: job.status_artifact || (job.expires_at ? 'active' : null) })}
                      </div>
                      
                      {job.status === 'completed' && job.file_url && (
                        job.status_artifact === 'archived' || job.status_artifact === 'purged' ? (
                           <span className="text-xs font-bold text-white/30 flex items-center gap-1 cursor-not-allowed">
                             <Download className="w-3 h-3" /> Unavailable
                           </span>
                        ) : (
                          <a 
                            href={job.file_url} 
                            download
                            className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Download
                          </a>
                        )
                      )}
                    </div>
                    {(job.status === 'queued' || job.status === 'running') && (
                      <div className="mt-3 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-brand rounded-full transition-all duration-1000 ${job.status === 'running' ? 'w-1/2 animate-pulse' : 'w-1/4'}`} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
