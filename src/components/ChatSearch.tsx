import { useEffect, useRef, useState } from "react";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  session_id: string;
  content: string;
  role: string;
  created_at: string;
}

export function ChatSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || !user) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_messages")
        .select("id, session_id, content, role, created_at")
        .eq("user_id", user.id)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      setResults(data ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, 120);
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + query.length + 60);
    const before = text.slice(start, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length, end);
    return (
      <>
        {start > 0 && "…"}
        {before}
        <mark className="bg-primary/30 text-foreground rounded px-0.5">{match}</mark>
        {after}
        {end < text.length && "…"}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Пошук по чатам..."
        className="pl-9 h-8 text-xs bg-muted/30 border-border/40 focus-visible:ring-primary/40 w-full"
      />
      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-lg border border-border/40 shadow-xl max-h-96 overflow-auto z-50">
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Пошук...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">Нічого не знайдено</div>
          ) : (
            <div className="divide-y divide-border/30">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    navigate(`/chat?session=${r.session_id}`);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left p-3 hover:bg-muted/30 transition-colors flex gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground line-clamp-2">{highlight(r.content)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.role === "user" ? "Ви" : "AI"} · {new Date(r.created_at).toLocaleString("uk-UA")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
