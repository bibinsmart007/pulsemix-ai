import React, { useState, useEffect } from "react";
import { X, MessageSquare, CheckCircle, Clock, ShieldAlert, ListTodo, User } from "lucide-react";

export interface ProjectComment {
  id: number;
  version_id: number;
  target_type: string;
  target_id: string | null;
  timestamp_ms: number | null;
  boundary_index: number | null;
  content: string;
  is_resolved: number;
  created_at: number;
}

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

interface ReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersionId: number | null;
  activeSessions: any[];
  onSetFocus: (target: string | null) => void;
}

export default function ReviewPanel({
  isOpen,
  onClose,
  currentVersionId,
  activeSessions,
  onSetFocus
}: ReviewPanelProps) {
  const [newComment, setNewComment] = useState("");
  const [targetType, setTargetType] = useState("project");
  
  const [localComments, setLocalComments] = useState<ProjectComment[]>([]);
  const [localTasks, setLocalTasks] = useState<ReviewTask[]>([]);
  
  const loadData = React.useCallback(async () => {
    if (!currentVersionId) return;
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(`http://localhost:8000/api/cloud/versions/${currentVersionId}/comments`).then(r => r.json()),
        fetch(`http://localhost:8000/api/cloud/versions/${currentVersionId}/tasks`).then(r => r.json())
      ]);
      if (cRes.success) setLocalComments(cRes.comments);
      if (tRes.success) setLocalTasks(tRes.tasks);
    } catch (e) {
      console.error(e);
    }
  }, [currentVersionId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentVersionId) return;
    await fetch(`http://localhost:8000/api/cloud/versions/${currentVersionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: null,
        timestamp_ms: null,
        boundary_index: null,
        content: newComment
      })
    });
    setNewComment("");
    await loadData();
  };

  const handleResolveComment = async (commentId: number) => {
    await fetch(`http://localhost:8000/api/cloud/comments/${commentId}/resolve`, { method: "PUT" });
    await loadData();
  };

  const handleCreateTask = async (commentId: number, title: string) => {
    if (!currentVersionId) return;
    await fetch(`http://localhost:8000/api/cloud/versions/${currentVersionId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        comment_id: commentId,
        assignee_type: "role",
        assignee_label: "editor"
      })
    });
    await loadData();
  };

  const handleUpdateTask = async (taskId: number, updates: any) => {
    await fetch(`http://localhost:8000/api/cloud/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    await loadData();
  };

  const activeComments = localComments.filter(c => c.is_resolved === 0);
  const resolvedComments = localComments.filter(c => c.is_resolved === 1);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-surface border-l border-white/10 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right-full duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand" />
          <h2 className="font-bold text-white">Review Comments</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {activeComments.length === 0 && resolvedComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 text-center px-4">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No comments yet. Start the conversation below.</p>
          </div>
        ) : (
          <>
            {activeComments.map(comment => (
              <div 
                key={comment.id} 
                className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                onMouseEnter={() => onSetFocus(`comment_${comment.id}`)}
                onMouseLeave={() => onSetFocus(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-brand uppercase tracking-wider">{comment.target_type}</span>
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(comment.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleResolveComment(comment.id)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 text-[10px] uppercase font-bold rounded flex items-center gap-1 transition-all"
                  >
                    <CheckCircle className="w-3 h-3" /> Resolve
                  </button>
                </div>
                <p className="text-sm text-white/90">{comment.content}</p>
                {/* Soft Lock presence indicator */}
                {(() => {
                  const viewingSessions = activeSessions.filter(s => s.focus_target === `comment_${comment.id}` || s.focus_target === `task_${localTasks.find(t => t.comment_id === comment.id)?.id}`);
                  if (viewingSessions.length > 0) {
                    return (
                      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {viewingSessions.map(s => s.user_label).join(", ")} {viewingSessions.length === 1 ? "is" : "are"} viewing this
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Task UI */}
                {(() => {
                  const task = localTasks.find(t => t.comment_id === comment.id);
                  if (task) {
                    return (
                      <div className="mt-3 p-2 bg-black/50 border border-white/5 rounded flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-brand flex items-center gap-1"><ListTodo className="w-3 h-3" /> Task</span>
                          <select 
                            value={task.status} 
                            onChange={(e) => handleUpdateTask(task.id, { status: e.target.value })}
                            className="bg-black text-[10px] uppercase border border-white/10 rounded px-1 text-white/70 outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-white/40" />
                          <select 
                            value={task.assignee_label || ""}
                            onChange={(e) => handleUpdateTask(task.id, { assignee_label: e.target.value })}
                            className="bg-transparent text-xs text-white outline-none"
                          >
                            <option value="editor">Editor</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="client">Client</option>
                          </select>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <button 
                        onClick={() => handleCreateTask(comment.id, comment.content.substring(0, 30) + "...")}
                        className="mt-2 text-[10px] uppercase font-bold text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <ListTodo className="w-3 h-3" /> Convert to Task
                      </button>
                    );
                  }
                })()}
              </div>
            ))}

            {resolvedComments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Resolved</h3>
                <div className="flex flex-col gap-2">
                  {resolvedComments.map(comment => (
                    <div 
                      key={comment.id} 
                      className="opacity-50 hover:opacity-100 transition-opacity bg-black/20 border border-white/5 rounded-lg p-3 cursor-pointer"
                      onMouseEnter={() => onSetFocus(`comment_${comment.id}`)}
                      onMouseLeave={() => onSetFocus(null)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{comment.target_type}</span>
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Resolved
                        </span>
                      </div>
                      <p className="text-sm text-white/60 line-through">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-black/40 flex flex-col gap-3">
        <div className="flex gap-2">
          <select 
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg text-xs text-white px-2 py-1 outline-none focus:border-brand"
          >
            <option value="project">Project Level</option>
            <option value="track">Selected Track</option>
            <option value="timeline">Timeline</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!currentVersionId}
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!newComment.trim() || !currentVersionId}
            className="px-4 py-2 bg-brand hover:bg-brand-light text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post
          </button>
        </div>
        {!currentVersionId && (
          <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
            <ShieldAlert className="w-3 h-3" />
            Save a cloud version first to comment
          </p>
        )}
      </form>
    </div>
  );
}
