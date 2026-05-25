import React from "react";
import { X, Cloud, Clock, Copy, GitBranch, ArrowRight, Share2, ListTodo, AlertTriangle, CheckSquare, Download } from "lucide-react";
import ActivityFeed, { ActivityEvent } from "./ActivityFeed";
import ExportManager from "./ExportManager";
import AuditDrawer from "./AuditDrawer";
import { ProjectHealthDashboard } from "./ProjectHealthDashboard";

export interface ReviewTask {
  id: number;
  comment_id: number | null;
  project_id: number;
  version_id: number;
  title: string;
  assignee_type: string | null;
  assignee_id: number | null;
  assignee_label: string | null;
  status: string;
  priority: string;
  due_at: number | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface CloudVersion {
  version_number: number;
  id: number;
  created_at: number;
}

export interface CloudProject {
  id: number;
  name: string;
  share_token: string;
  created_at: number;
  versions: CloudVersion[];
}

interface CloudLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  activePlaylistId: number | null;
  cloudProject: CloudProject | null;
  onSaveCloudVersion: () => void;
  onLoadSharedProject: (token: string) => void;
  onViewPublishLinks: (versionId: number) => void;
  onPublishVersion: (versionId: number) => void;
  activeSessions: any[];
}

export default function CloudLibrary({
  isOpen,
  onClose,
  activePlaylistId,
  cloudProject,
  onSaveCloudVersion,
  onLoadSharedProject,
  onViewPublishLinks,
  onPublishVersion,
  activeSessions
}: CloudLibraryProps) {
  const [importToken, setImportToken] = React.useState("");
  const [projectEvents, setProjectEvents] = React.useState<ActivityEvent[]>([]);
  const [projectTasks, setProjectTasks] = React.useState<ReviewTask[]>([]);
  const [taskFilter, setTaskFilter] = React.useState<"all" | "open" | "completed">("open");

  const [isAdminMode, setIsAdminMode] = React.useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = React.useState(false);
  const [isHealthDashboardOpen, setIsHealthDashboardOpen] = React.useState(false);

  const [isExportManagerOpen, setIsExportManagerOpen] = React.useState(false);
  const [exportVersionId, setExportVersionId] = React.useState<number | null>(null);
  const [exportVersionNumber, setExportVersionNumber] = React.useState<number | null>(null);
  const [exportsList, setExportsList] = React.useState<any[]>([]);

  const refreshExports = React.useCallback(() => {
    if (cloudProject) {
      fetch(`http://localhost:8000/api/cloud/projects/${cloudProject.id}/exports`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setExportsList(data.exports);
          }
        })
        .catch(err => console.error("Failed to fetch exports:", err));
    }
  }, [cloudProject]);

  React.useEffect(() => {
    if (isOpen && cloudProject) {
      fetch(`http://localhost:8000/api/cloud/projects/${cloudProject.id}/activity`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setProjectEvents(data.events);
          }
        })
        .catch(err => console.error("Failed to fetch activity:", err));
        
      fetch(`http://localhost:8000/api/cloud/projects/${cloudProject.id}/tasks`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setProjectTasks(data.tasks);
          }
        })
        .catch(err => console.error("Failed to fetch tasks:", err));

      refreshExports();
    }
  }, [isOpen, cloudProject, refreshExports]);

  const handleOpenExport = (versionId: number, versionNumber: number) => {
    setExportVersionId(versionId);
    setExportVersionNumber(versionNumber);
    setIsExportManagerOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Cloud Library & Versions</h2>
              <p className="text-sm text-white/50">Manage cloud saves and collaborate</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {cloudProject && (
              <button 
                onClick={() => setIsHealthDashboardOpen(true)}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 text-white flex items-center gap-1 transition-colors"
              >
                Project Health
              </button>
            )}
            {isAdminMode && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("http://localhost:8000/api/admin/retention/sweep", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      alert(`Sweep Complete: ${data.swept.artifacts_archived} artifacts archived, ${data.swept.packages_expired} packages expired.`);
                      refreshExports();
                    }
                  } catch (e) {
                    alert("Sweep failed.");
                  }
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
              >
                Run Retention Sweep
              </button>
            )}
            <button 
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${isAdminMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
            >
              Admin Mode {isAdminMode ? 'ON' : 'OFF'}
            </button>
            {isAdminMode && cloudProject && (
              <button 
                onClick={() => setIsAuditDrawerOpen(true)}
                className="text-xs font-bold px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                View Audit Logs
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          
          {/* Current Project */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/40">Current Project</h3>
            {activePlaylistId ? (
              <div className="bg-black/20 border border-white/5 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-lg text-white mb-1">
                      {cloudProject?.name || "Unsaved Cloud Project"}
                    </h4>
                    {cloudProject && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded border border-white/10">
                          ID: {cloudProject.id}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-brand bg-brand/10 px-2 py-1 rounded border border-brand/20 cursor-pointer" onClick={() => navigator.clipboard.writeText(cloudProject.share_token)}>
                          <Copy className="w-3 h-3" />
                          Share Token: {cloudProject.share_token.slice(0,8)}...
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={onSaveCloudVersion}
                    className="px-4 py-2 bg-brand hover:bg-brand-light text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <Cloud className="w-4 h-4" />
                    Save New Version
                  </button>
                </div>

                {/* Action Queue */}
                {cloudProject && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                        <ListTodo className="w-4 h-4" /> Action Queue
                      </h5>
                      <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                        <button onClick={() => setTaskFilter("all")} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${taskFilter === "all" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}>All</button>
                        <button onClick={() => setTaskFilter("open")} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${taskFilter === "open" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}>Open</button>
                        <button onClick={() => setTaskFilter("completed")} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${taskFilter === "completed" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}>Completed</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {projectTasks.filter(t => taskFilter === "all" || (taskFilter === "open" && t.status !== "done") || (taskFilter === "completed" && t.status === "done")).length === 0 ? (
                        <div className="text-sm text-white/30 italic p-4 text-center border border-white/5 rounded-lg bg-black/20">No tasks found</div>
                      ) : (
                        projectTasks.filter(t => taskFilter === "all" || (taskFilter === "open" && t.status !== "done") || (taskFilter === "completed" && t.status === "done")).map(task => {
                          const viewingSessions = activeSessions.filter(s => s.focus_target === `task_${task.id}`);
                          return (
                          <div key={task.id} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              {task.status === "done" ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : task.status === "blocked" ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <div className="w-4 h-4 rounded-sm border-2 border-white/20" />}
                              <div className="flex flex-col">
                                <span className={`text-sm ${task.status === "done" ? "text-white/40 line-through" : "text-white"}`}>{task.title}</span>
                                <span className="text-[10px] text-white/40 flex items-center gap-2 mt-1">
                                  {task.assignee_label && <span className="bg-brand/20 text-brand px-1.5 py-0.5 rounded uppercase">{task.assignee_label}</span>}
                                  {task.priority === "high" && <span className="text-red-400">High Priority</span>}
                                  <span>Version {cloudProject.versions.find(v => v.id === task.version_id)?.version_number || "?"}</span>
                                  {viewingSessions.length > 0 && (
                                    <span className="bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      {viewingSessions.length} active
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                            <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs font-bold text-white transition-colors">
                              View
                            </button>
                          </div>
                        )})
                      )}
                    </div>
                  </div>
                )}

                {cloudProject && cloudProject.versions && cloudProject.versions.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <GitBranch className="w-4 h-4" /> Version History
                    </h5>
                    <div className="flex flex-col gap-3 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-white/5">
                      {cloudProject.versions.slice().reverse().map((v, i) => (
                        <div key={v.id} className="flex gap-4 relative">
                          <div className={`w-6 h-6 rounded-full border-4 border-surface flex items-center justify-center shrink-0 z-10 ${i === 0 ? 'bg-brand' : 'bg-white/20'}`} />
                          <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-3 flex items-center justify-between group hover:border-white/20 transition-colors">
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                Version {v.version_number}
                                {i === 0 && <span className="text-[10px] uppercase tracking-wider bg-brand/20 text-brand px-1.5 py-0.5 rounded">Latest</span>}
                              </div>
                              <div className="text-xs text-white/40 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(v.created_at * 1000).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleOpenExport(v.id, v.version_number)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-white flex items-center gap-1 transition-colors"
                              >
                                <Download className="w-3 h-3" /> Export
                              </button>
                              <button 
                                onClick={() => onViewPublishLinks(v.id)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-white flex items-center gap-1 transition-colors"
                              >
                                <Share2 className="w-3 h-3" /> Links
                              </button>
                              <button 
                                onClick={() => onPublishVersion(v.id)}
                                className="px-3 py-1.5 bg-brand hover:bg-brand-light rounded text-xs text-white flex items-center gap-1 transition-colors"
                              >
                                <ArrowRight className="w-3 h-3" /> Publish
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/20 border border-white/5 rounded-xl p-8 text-center text-white/40">
                <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No active playlist. Create a mix to save it to the cloud.</p>
              </div>
            )}
          </div>

          {/* Import Shared Project & Activity Feed (Row Layout) */}
          <div className="flex gap-6 pt-6 border-t border-white/5">
            {/* Collaborate Column */}
            <div className="flex flex-col gap-4 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/40">Collaborate</h3>
              <div className="bg-black/20 border border-white/5 rounded-xl p-5">
                <h4 className="font-bold text-white mb-2">Open Shared Project</h4>
                <p className="text-sm text-white/50 mb-4">Paste a share token to load a collaborator's project for review and commenting.</p>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Paste Share Token here..."
                    value={importToken}
                    onChange={(e) => setImportToken(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  />
                  <button 
                    onClick={() => onLoadSharedProject(importToken)}
                    disabled={!importToken.trim()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>

            {/* Activity Feed Column */}
            <div className="flex flex-col gap-4 flex-1 max-h-[300px]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/40">Recent Activity</h3>
              <div className="bg-black/20 border border-white/5 rounded-xl flex-1 overflow-y-auto p-4">
                <ActivityFeed events={projectEvents} />
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {cloudProject && exportVersionId !== null && exportVersionNumber !== null && (
        <ExportManager
          isOpen={isExportManagerOpen}
          onClose={() => setIsExportManagerOpen(false)}
          projectId={cloudProject.id}
          versionId={exportVersionId}
          versionNumber={exportVersionNumber}
          existingExports={exportsList.filter(e => e.version_id === exportVersionId)}
          onRefreshExports={refreshExports}
        />
      )}
      {cloudProject && (
        <AuditDrawer
          isOpen={isAuditDrawerOpen}
          onClose={() => setIsAuditDrawerOpen(false)}
          projectId={cloudProject.id}
        />
      )}
      {isHealthDashboardOpen && cloudProject && (
        <ProjectHealthDashboard
          projectId={cloudProject.id}
          onClose={() => setIsHealthDashboardOpen(false)}
        />
      )}
    </div>
  );
}
