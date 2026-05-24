import React from "react";
import { MessageSquare, CheckCircle, Package, Link2, Eye, ShieldAlert, History, ListTodo } from "lucide-react";

export interface ActivityEvent {
  id: number;
  project_id: number;
  version_id: number | null;
  event_type: string;
  actor: string;
  target_id: number | null;
  metadata: any;
  importance: "high" | "normal" | "low";
  created_at: number;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  onEventClick?: (event: ActivityEvent) => void;
}

export default function ActivityFeed({ events, onEventClick }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 p-8 text-center border border-dashed border-white/10 rounded-xl">
        <History className="w-8 h-8 mb-3 opacity-50" />
        <p className="text-sm">No recent activity.</p>
      </div>
    );
  }

  const renderIcon = (type: string) => {
    switch (type) {
      case "comment_added":
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case "comment_resolved":
      case "status_changed":
      case "task_completed":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "package_published":
        return <Package className="w-4 h-4 text-purple-400" />;
      case "link_revoked":
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case "package_opened":
        return <Eye className="w-4 h-4 text-amber-400" />;
      case "task_created":
      case "task_updated":
        return <ListTodo className="w-4 h-4 text-brand" />;
      default:
        return <Link2 className="w-4 h-4 text-neutral-400" />;
    }
  };

  const renderDescription = (event: ActivityEvent) => {
    switch (event.event_type) {
      case "comment_added":
        return <span>Left a comment: <span className="text-white">"{event.metadata?.content}"</span></span>;
      case "comment_resolved":
        return <span>Resolved a comment thread</span>;
      case "status_changed":
        return <span>Changed status to <span className="text-white font-bold">{event.metadata?.new_status}</span></span>;
      case "package_published":
        return <span>Published a <span className="text-white">{event.metadata?.package_type}</span> package</span>;
      case "link_revoked":
        return <span>Revoked access for <span className="text-white">{event.metadata?.recipient_label || "Unknown"}</span></span>;
      case "package_opened":
        return <span>Viewed the <span className="text-white">{event.metadata?.package_type}</span> package</span>;
      case "task_created":
        return <span>Created a task: <span className="text-white">"{event.metadata?.title}"</span></span>;
      case "task_updated":
        return <span>Updated task status to <span className="text-white font-bold">{event.metadata?.status}</span></span>;
      case "task_completed":
        return <span>Completed a task</span>;
      default:
        return <span>{event.event_type}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full relative">
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/10 z-0" />
      {events.map((ev) => (
        <div 
          key={ev.id} 
          onClick={() => onEventClick?.(ev)}
          className={`relative z-10 flex gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${ev.importance === 'high' ? 'bg-white/[0.02]' : ''}`}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-obsidian border border-white/10 shrink-0 mt-0.5 shadow-sm">
            {renderIcon(ev.event_type)}
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm text-neutral-200">{ev.actor}</span>
              <span className="text-[10px] text-white/40 font-mono">
                {new Date(ev.created_at * 1000).toLocaleString(undefined, { 
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                })}
              </span>
            </div>
            <div className="text-xs text-white/60 truncate mt-0.5">
              {renderDescription(ev)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
