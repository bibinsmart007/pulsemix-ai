import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, History, Key, CheckCircle, Shield, AlertTriangle, Info, Plus } from 'lucide-react';

interface AuditLog {
  id: number;
  project_id: number;
  actor: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  severity: 'low' | 'medium' | 'high';
  before_json: string | null;
  after_json: string | null;
  source_context: string | null;
  timestamp: number;
}

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
}

export default function AuditDrawer({ isOpen, onClose, projectId }: AuditDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, projectId]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/cloud/projects/${projectId}/audit`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface border-l border-white/10 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand" />
            Audit Trail
          </h2>
          <p className="text-xs text-white/50 mt-1">Immutable compliance history</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="text-center text-white/40 italic py-10">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-white/40 italic py-10">No audit records found.</div>
        ) : (
          logs.map((log) => {
            const before = log.before_json ? JSON.parse(log.before_json) : null;
            const after = log.after_json ? JSON.parse(log.after_json) : null;
            const date = new Date(log.timestamp * 1000);

            return (
              <div key={log.id} className="relative pl-6 border-l border-white/10 pb-2">
                <div className="absolute -left-3 top-0 bg-surface rounded-full p-0.5 border border-white/10">
                  {getSeverityIcon(log.severity)}
                </div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{getActionLabel(log.action_type)}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">{date.toLocaleString()}</span>
                </div>
                <div className="text-xs text-white/60 mb-2">
                  <span className="text-white/80 font-medium">{log.actor}</span> modified {log.entity_type} <span className="font-mono text-white/40">{log.entity_id}</span>
                </div>
                
                {/* Diff View */}
                {(before || after) && (
                  <div className="bg-black/30 rounded-lg p-3 text-xs font-mono space-y-1 overflow-x-auto">
                    {before && Object.entries(before).map(([k, v]) => (
                      <div key={`b-${k}`} className="text-red-400/80 flex gap-2">
                        <span>-</span>
                        <span>{k}: {JSON.stringify(v)}</span>
                      </div>
                    ))}
                    {after && Object.entries(after).map(([k, v]) => (
                      <div key={`a-${k}`} className="text-emerald-400/80 flex gap-2">
                        <span>+</span>
                        <span>{k}: {JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
