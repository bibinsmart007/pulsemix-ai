import { useState, useEffect, useCallback, useRef } from "react";

export interface ActiveSession {
  session_id: string;
  user_label: string;
  project_id: number;
  version_id: number | null;
  action: string;
  focus_target: string | null;
  last_seen_ms: number;
}

export function usePresence(
  projectId: number | null,
  versionId: number | null,
  userLabel: string
) {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [action, setAction] = useState("viewing");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const pingPresence = useCallback(async () => {
    if (!projectId) return;

    try {
      await fetch("http://localhost:8000/api/cloud/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_label: userLabel,
          project_id: projectId,
          version_id: versionId,
          action,
          focus_target: focusTarget,
        }),
      });

      const res = await fetch(`http://localhost:8000/api/cloud/presence/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.sessions);
      }
    } catch (e) {
      console.error("Presence ping failed", e);
    }
  }, [projectId, versionId, userLabel, action, focusTarget]);

  useEffect(() => {
    if (!projectId) {
      setActiveSessions([]);
      return;
    }

    // Initial ping
    pingPresence();

    // Setup polling every 5 seconds
    heartbeatRef.current = setInterval(() => {
      pingPresence();
    }, 5000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [pingPresence, projectId]);

  return {
    activeSessions,
    setAction,
    setFocusTarget,
  };
}
