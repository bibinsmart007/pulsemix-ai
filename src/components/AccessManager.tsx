import React, { useState } from "react";
import { X, ExternalLink, Key, Clock, Copy, Trash2, Eye, Download, ShieldAlert, Link as LinkIcon } from "lucide-react";

export interface PublishLink {
  publish_token: string;
  package_type: string;
  notes: string;
  created_at: number;
  recipient_label?: string;
  is_revoked: number;
  expires_at: number | null;
  allow_download: number;
  has_password: boolean;
  views: number;
}

interface AccessManagerProps {
  isOpen: boolean;
  onClose: () => void;
  activeLinks: PublishLink[];
  onRevoke: (token: string) => Promise<void>;
}

export default function AccessManager({ isOpen, onClose, activeLinks, onRevoke }: AccessManagerProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/public/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    await onRevoke(token);
    setRevokingToken(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <LinkIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Access & Links</h2>
              <p className="text-sm text-white/50">Manage active publish links and view access metrics</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <LinkIcon className="w-12 h-12 mb-4 opacity-50" />
              <p>No active links for this version.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activeLinks.map((link) => {
                const isExpired = link.expires_at && (Date.now() / 1000) > link.expires_at;
                const isRevoked = link.is_revoked === 1;
                const isDead = isExpired || isRevoked;

                return (
                  <div key={link.publish_token} className={`border rounded-xl p-4 transition-colors ${isDead ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-black/20 hover:border-white/20'}`}>
                    <div className="flex items-start justify-between gap-4">
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                            link.package_type === 'shared_release' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand/20 text-brand'
                          }`}>
                            {link.package_type.replace('_', ' ')}
                          </span>
                          
                          {isRevoked ? (
                            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-red-500/20 text-red-400 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Revoked
                            </span>
                          ) : isExpired ? (
                            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-red-500/20 text-red-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Expired
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-medium text-white truncate text-lg">
                          {link.recipient_label || "Unnamed Recipient"}
                        </h3>
                        {link.notes && (
                          <p className="text-sm text-white/60 mt-1 line-clamp-2">{link.notes}</p>
                        )}
                        
                        <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> 
                            {new Date(link.created_at * 1000).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> 
                            {link.views} views
                          </span>
                          {link.has_password && (
                            <span className="flex items-center gap-1 text-amber-400/80">
                              <Key className="w-3.5 h-3.5" /> Password
                            </span>
                          )}
                          {link.allow_download === 1 && (
                            <span className="flex items-center gap-1 text-blue-400/80">
                              <Download className="w-3.5 h-3.5" /> Downloadable
                            </span>
                          )}
                          {link.expires_at && !isExpired && (
                            <span className="flex items-center gap-1 text-amber-400/80">
                              <Clock className="w-3.5 h-3.5" /> 
                              Expires {new Date(link.expires_at * 1000).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleCopyLink(link.publish_token)}
                            className="p-2 hover:bg-white/10 rounded border border-white/10 text-white/70 hover:text-white transition-colors tooltip"
                            title="Copy Link"
                          >
                            {copiedToken === link.publish_token ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a 
                            href={`/public/${link.publish_token}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 hover:bg-white/10 rounded border border-white/10 text-white/70 hover:text-white transition-colors tooltip"
                            title="Open Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        
                        {!isDead && (
                          <button 
                            onClick={() => handleRevoke(link.publish_token)}
                            disabled={revokingToken === link.publish_token}
                            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors flex items-center gap-1 mt-2"
                          >
                            {revokingToken === link.publish_token ? (
                              <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Revoke Access
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Ensure Check is available for the copied token state
import { Check } from "lucide-react";
