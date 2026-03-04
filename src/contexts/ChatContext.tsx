import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; chunk: string; score: number }[];
  streaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatContextType {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  loadingSessions: boolean;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<string | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  updateSessionTitle: (sessionId: string, firstMessage: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSessions((data as Session[]) ?? []);
    setLoadingSessions(false);
  }, [user]);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    setActiveSessionId(sessionId);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources as Message["sources"] ?? undefined,
        }))
      );
    }
  }, [user]);

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "Нова сесія" })
      .select()
      .single();
    if (error || !data) return null;
    const newSession = data as Session;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    return newSession.id;
  }, [user]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("session_id", sessionId);
    await supabase.from("chat_sessions").delete().eq("id", sessionId).eq("user_id", user.id);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [user, activeSessionId]);

  const updateSessionTitle = useCallback(async (sessionId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");
    await supabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", sessionId);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
  }, []);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        messages,
        loadingSessions,
        loadSessions,
        loadSession,
        createSession,
        deleteSession,
        setMessages,
        setActiveSessionId,
        updateSessionTitle,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
