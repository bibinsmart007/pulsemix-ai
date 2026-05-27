import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Package, Download, X, Layers, Clock, AlertCircle } from 'lucide-react';

interface ProjectHealthDashboardProps {
  projectId: number;
  onClose: () => void;
}

export function ProjectHealthDashboard({ projectId, onClose }: ProjectHealthDashboardProps) {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8765/api/cloud/projects/${projectId}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHealthData(data.health);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load project health:", err);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!healthData) return null;

  const getApprovalColor = (status: string) => {
    switch(status) {
      case 'approved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'in_review': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-white/60 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand" />
              Project Health & Analytics
            </h2>
            <p className="text-sm text-white/50 mt-1">
              Descriptive metrics and delivery insights for this project.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Alerts Section */}
          {healthData.alert_heuristics && healthData.alert_heuristics.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-2">Attention Required</h3>
              {healthData.alert_heuristics.map((alert: any, idx: number) => (
                <div key={idx} className={`p-4 rounded-xl border flex items-center gap-4 ${
                  alert.severity === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                  alert.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-200'
                }`}>
                  <AlertCircle className={`w-6 h-6 shrink-0 ${
                    alert.severity === 'high' ? 'text-red-400' :
                    alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                  }`} />
                  <div>
                    <div className="font-bold">{alert.message}</div>
                    <div className="text-xs opacity-70">Triggered by descriptive alert heuristics</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tasks Card */}
            <div className="bg-black/20 border border-white/5 p-5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <CheckCircle className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Tasks</span>
              </div>
              <div className="text-3xl font-black">{healthData.tasks.open} <span className="text-sm text-white/30 font-normal">Open</span></div>
              <div className="flex gap-3 text-xs mt-2">
                <span className="text-emerald-400 font-bold">{healthData.tasks.completed} Done</span>
                <span className={healthData.tasks.blocked > 0 ? 'text-red-400 font-bold' : 'text-white/40'}>{healthData.tasks.blocked} Blocked</span>
              </div>
            </div>

            {/* Approvals Card */}
            <div className="bg-black/20 border border-white/5 p-5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <AlertTriangle className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Approval</span>
              </div>
              <div className="mt-1">
                <span className={`px-3 py-1.5 rounded uppercase font-bold text-sm border ${getApprovalColor(healthData.approvals.current_state)}`}>
                  {healthData.approvals.current_state.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-white/40 mt-3">
                Latest Version
              </div>
            </div>

            {/* Deliveries Card */}
            <div className="bg-black/20 border border-white/5 p-5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <Package className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Deliveries</span>
              </div>
              <div className="text-3xl font-black">{healthData.deliveries.total} <span className="text-sm text-white/30 font-normal">Packages</span></div>
              <div className="flex flex-col gap-1 text-xs mt-1">
                <span className="text-brand font-bold">{healthData.deliveries.opened} Opened</span>
                <span className="text-white/40">{healthData.deliveries.unopened} Unopened</span>
                {healthData.deliveries.revoked > 0 && <span className="text-red-400">{healthData.deliveries.revoked} Revoked</span>}
              </div>
            </div>

            {/* Exports Card */}
            <div className="bg-black/20 border border-white/5 p-5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <Download className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Exports</span>
              </div>
              <div className="text-3xl font-black">{healthData.exports.total} <span className="text-sm text-white/30 font-normal">Jobs</span></div>
              <div className="flex flex-col gap-1 text-xs mt-1">
                {healthData.exports.failed > 0 && <span className="text-red-400 font-bold">{healthData.exports.failed} Failed</span>}
                <span className={healthData.exports.expiring_soon > 0 ? 'text-yellow-400 font-bold' : 'text-white/40'}>
                  {healthData.exports.expiring_soon} Expiring Soon
                </span>
                {healthData.exports.running > 0 && <span className="text-brand animate-pulse">{healthData.exports.running} Running</span>}
              </div>
            </div>
          </div>
          
          {/* Activity Window */}
          <div className="bg-black/20 border border-white/5 p-5 rounded-xl">
             <div className="flex items-center gap-2 text-white/50 mb-4">
                <Clock className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Activity Velocity</span>
             </div>
             <div className="flex items-center gap-6">
                <div>
                   <div className="text-4xl font-black text-white">{healthData.activity_window.recent_events_7d}</div>
                   <div className="text-xs text-white/40 mt-1 uppercase tracking-wider font-bold">Events in last 7 days</div>
                </div>
                <div className="flex-1 h-12 bg-white/5 rounded-lg flex items-end overflow-hidden p-1 gap-1">
                   {/* Decorative mock trend bars */}
                   {[40, 20, 60, 80, 50, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-brand/50 rounded-sm hover:bg-brand transition-colors" style={{ height: `${h}%` }}></div>
                   ))}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
