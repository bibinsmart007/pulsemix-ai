import React, { useState, useEffect } from "react";
import { Eye, ShieldAlert, LogOut, MessageSquare, History } from "lucide-react";
import { CloudProject } from "./CloudLibrary";
import ActivityFeed, { ActivityEvent } from "./ActivityFeed";

interface SharedProjectViewerProps {
  isReviewMode: boolean;
  sharedProject: CloudProject | null;
  onExitReviewMode: () => void;
  onToggleReviewPanel: () => void;
  isReviewPanelOpen: boolean;
}

export default function SharedProjectViewer({
  isReviewMode,
  sharedProject,
  onExitReviewMode,
  onToggleReviewPanel,
  isReviewPanelOpen
}: SharedProjectViewerProps) {
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [projectEvents, setProjectEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (isReviewMode && sharedProject && isActivityPanelOpen) {
      fetch(`http://localhost:8000/api/cloud/projects/${sharedProject.id}/activity`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setProjectEvents(data.events);
          }
        })
        .catch(err => console.error("Failed to fetch activity:", err));
    }
  }, [isReviewMode, sharedProject, isActivityPanelOpen]);

  if (!isReviewMode) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-40 bg-amber-500/20 border-b border-amber-500/50 backdrop-blur-md px-6 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-500">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-amber-500 flex items-center gap-2">
            Shared Review Mode
            <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">Read Only</span>
          </h3>
          <p className="text-xs text-amber-500/70">
            Viewing: {sharedProject?.name || "Shared Project"} (Version {sharedProject?.versions[0]?.version_number || "?"})
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsActivityPanelOpen(!isActivityPanelOpen)}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
            isActivityPanelOpen 
              ? 'bg-amber-500 text-amber-950' 
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-500'
          }`}
        >
          <History className="w-4 h-4" />
          {isActivityPanelOpen ? 'Hide Activity' : 'Show Activity'}
        </button>
        <button 
          onClick={onToggleReviewPanel}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
            isReviewPanelOpen 
              ? 'bg-amber-500 text-amber-950' 
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-500'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {isReviewPanelOpen ? 'Hide Comments' : 'Show Comments'}
        </button>
        <button 
          onClick={onExitReviewMode}
          className="px-4 py-2 bg-black/40 hover:bg-black/60 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Exit Review
        </button>
      </div>

      {/* Activity Panel */}
      {isActivityPanelOpen && (
        <div className="absolute right-96 top-full mt-2 w-96 max-h-[80vh] overflow-y-auto bg-surface border border-white/10 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-brand" /> 
            Project Activity
          </h4>
          <ActivityFeed events={projectEvents} />
        </div>
      )}
    </div>
  );
}
