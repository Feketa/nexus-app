import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, BookOpen, Copy, ThumbsUp, ThumbsDown,
  Sparkles, AlertCircle, Plus, Trash2, Search, MessageSquare, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { toast } from "sonner";

const suggestions = [
  "Яка процедура ескалації для Enterprise клієнтів?",
  "Як налаштувати SSO інтеграцію?",
  "Що входить у план Enterprise?",
  "Де знайти документацію API?",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const LAB_PROMPT_KEY = "ai-wise-connector:lab-system-prompt";

// ─── Message rendering ────────────────────────────────────────────────────────
function MessageContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <h2 key={i} className="text-base font-bold mt-0 mb-2 text-foreground">{line.slice(3)}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-primary">{line.slice(4)}</h3>;
        if (line.startsWith("> "))
          return <blockquote key={i} className="border-l-2 border-primary/50 pl-3 my-2 text-muted-foreground italic text-sm">{line.slice(2)}</blockquote>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} className="ml-4 text-sm mb-1 list-disc text-foreground/90">{line.slice(2)}</li>;
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 text-sm mb-1 list-decimal text-foreground/90">{line.replace(/^\d+\.\s/, "")}</li>;
        if (line.trim() === "") return <br key={i} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/);
        return (
          <p key={i} className="text-sm mb-1 text-foreground/90 leading-relaxed">
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**")
                ? <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg, onCopy }: { msg: ReturnType<typeof useChat>["messages"][0]; onCopy: (t: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5
        ${isUser
          ? "bg-gradient-to-br from-primary to-secondary"
          : "bg-gradient-to-br from-secondary/30 to-primary/30 border border-border/60"
        }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-primary" />}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed
          ${isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "glass-card rounded-tl-sm"
          }`}>
          {msg.streaming ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-sm">NexusAI генерує відповідь...</span>
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed">{msg.content}</p>
          ) : (
            <MessageContent content={msg.content} />
          )}
        </div>

        {msg.sources && msg.sources.length > 0 && (
          <div className="w-full glass-card rounded-xl p-3 border border-secondary/20">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-secondary" />
              <span className="text-xs font-semibold text-secondary">Джерела цитування</span>
            </div>
            <div className="space-y-1.5">
              {msg.sources.map((s, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                  <span className="text-xs font-bold text-secondary/70 mt-0.5 w-4">[{i + 1}]</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.chunk}</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 whitespace-nowrap">{(s.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isUser && !msg.streaming && msg.content && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCopy(msg.content)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Копіювати"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Sidebar ──────────────────────────────────────────────────────────
function HistorySidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  loadingSessions,
}: {
  sessions: ReturnType<typeof useChat>["sessions"];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loadingSessions: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "щойно";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} хв тому`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} год тому`;
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-r border-border/40 h-full">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-border/40">
        <Button
          onClick={onNew}
          size="sm"
          className="w-full gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl"
          variant="ghost"
        >
          <Plus className="w-4 h-4" />
          Нова сесія
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Пошук по чатам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/30 border-border/40 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {loadingSessions ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {search ? "Нічого не знайдено" : "Немає збережених сесій"}
            </p>
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`group flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-all duration-150
                ${activeSessionId === s.id
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/30 border border-transparent"
                }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate leading-snug ${activeSessionId === s.id ? "text-primary" : "text-foreground"}`}>
                  {s.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/60">{formatDate(s.updated_at)}</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIChat() {
  const { user, session } = useAuth();
  const {
    sessions, activeSessionId, messages,
    loadingSessions, loadSessions, loadSession,
    createSession, deleteSession, setMessages,
    setActiveSessionId, updateSessionTitle,
  } = useChat();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getLabPrompt = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(LAB_PROMPT_KEY)?.trim() ?? "";
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewSession = useCallback(async () => {
    await createSession();
  }, [createSession]);

  const handleSelectSession = useCallback(async (id: string) => {
    await loadSession(id);
  }, [loadSession]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id);
    toast.success("Сесію видалено");
  }, [deleteSession]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);

    // Create session if none active
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) {
        toast.error("Не вдалося створити сесію");
        return;
      }
    }

    const userMsg = { id: Date.now().toString(), role: "user" as const, content: text };
    const streamId = (Date.now() + 1).toString();
    const streamMsg = { id: streamId, role: "assistant" as const, content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, streamMsg]);
    setLoading(true);

    // Save user message to DB
    if (user) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        session_id: sessionId,
        role: "user",
        content: text,
      });
    }

    // Update session title from first user message
    const currentMessages = messages;
    if (currentMessages.filter((m) => m.role === "user").length === 0) {
      await updateSessionTitle(sessionId, text);
    }

    try {
      const labPrompt = getLabPrompt();
      const apiMessages = [
        ...(labPrompt ? [{ role: "system" as const, content: labPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        userMsg,
      ];

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Перевищено ліміт запитів. Спробуйте пізніше.");
        else if (resp.status === 402) toast.error("Недостатньо кредитів AI.");
        else toast.error(data.error || "Помилка сервера");
        setMessages((prev) => prev.filter((m) => m.id !== streamId));
        setLoading(false);
        return;
      }

      if (!resp.body) throw new Error("Немає тіла відповіді");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunk) {
              fullContent += chunk;
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: fullContent, streaming: false } : m)
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message to DB
      if (user && fullContent) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          session_id: sessionId,
          role: "assistant",
          content: fullContent,
        });
        // Refresh sessions to update timestamps
        await loadSessions();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError("Не вдалося підключитися до AI. Перевірте з'єднання.");
      setMessages((prev) => prev.filter((m) => m.id !== streamId));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(input);
    setInput("");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Скопійовано");
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* History Sidebar */}
      <HistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        loadingSessions={loadingSessions}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-border/40 glass flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary/30 to-primary/30 border border-border/60 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">NexusAI Асистент</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Онлайн · Gemini Flash
              {activeSessionId && (
                <span className="ml-2 truncate max-w-[200px] text-muted-foreground/60">
                  · {sessions.find((s) => s.id === activeSessionId)?.title ?? ""}
                </span>
              )}
            </p>
          </div>
          <span className="text-xs glass-card px-2.5 py-1 rounded-lg border border-secondary/20 text-secondary flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-3 h-3" /> AI активний
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-border/40 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Чим можу допомогти?</h3>
                <p className="text-sm text-muted-foreground mt-1">Задайте будь-яке питання щодо підтримки</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onCopy={handleCopy} />
          ))}
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="px-5 py-2 flex gap-2 overflow-x-auto scrollbar-thin">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full glass-card border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 px-5 pb-5 pt-2">
          <div className="glass-card rounded-2xl border border-border/60 p-3 flex gap-3 items-end focus-within:border-primary/40 transition-colors">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Запитайте що-небудь... (Enter для надсилання)"
              className="flex-1 bg-transparent border-0 resize-none text-sm focus-visible:ring-0 min-h-[44px] max-h-[160px] p-0 placeholder:text-muted-foreground/50"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="icon"
              className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 transition-transform active:scale-95"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground/50 mt-2">
            NexusAI може помилятися. Перевіряйте важливу інформацію.
          </p>
        </div>
      </div>
    </div>
  );
}
