import { useCallback, useEffect, useState } from "react";
import { Search, Database, Hash, FileText, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DocRow {
  id: string;
  name: string;
  file_type: string;
  chunks: number;
  status: string;
  created_at: string;
  file_size: number;
}

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDocs([]);
      setLoading(false);
      return;
    }

    setDocs((data as DocRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadDocuments();

    const channel = supabase
      .channel(`documents-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadDocuments();
        },
      )
      .subscribe();

    const handleFocus = () => loadDocuments();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadDocuments();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [user, loadDocuments]);

  const filtered = docs.filter(
    (d) =>
      search === "" ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.file_type.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === "indexed" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : s === "processing" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : "text-destructive bg-destructive/10 border-destructive/20";

  const statusLabel = (s: string) =>
    s === "indexed" ? "Проіндексовано"
    : s === "processing" ? "Обробка..."
    : "Помилка";

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">База знань</h1>
          <p className="text-sm text-muted-foreground mt-1">Завантажені документи та їх статус індексації</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="glass-card px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground">
            <Hash className="w-3 h-3 inline mr-1" />
            {docs.length} документів
          </span>
          <span className="glass-card px-3 py-1.5 rounded-lg border border-primary/20 text-primary">
            <Database className="w-3 h-3 inline mr-1" />
            Сховище
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Пошук по документах..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/30 border-border/40 focus-visible:ring-primary/40"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="font-semibold text-base mb-1">
            {search ? "Нічого не знайдено" : "База знань порожня"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {search ? "Спробуйте інший запит" : "Завантажте документи у розділі «Document Vault»"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Знайдено: <span className="text-foreground font-medium">{filtered.length}</span> документів
          </p>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Документ", "Тип", "Розмір", "Статус", "Дата", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <>
                      <tr
                        key={doc.id}
                        onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                        className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-3.5 h-3.5 text-secondary" />
                            </div>
                            <p className="text-sm font-medium max-w-[220px] truncate">{doc.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-mono text-muted-foreground uppercase">{doc.file_type}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{formatSize(doc.file_size)}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColor(doc.status)}`}>
                            {statusLabel(doc.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(doc.created_at)}</td>
                        <td className="px-5 py-3">
                          {expanded === doc.id
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </td>
                      </tr>
                      {expanded === doc.id && (
                        <tr key={`${doc.id}-exp`} className="border-b border-border/20 bg-muted/10">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="glass rounded-xl p-4 border border-border/40 space-y-2">
                              <p className="text-xs font-semibold text-primary">Деталі документа</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Назва</p>
                                  <p className="font-medium truncate">{doc.name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Тип</p>
                                  <p className="font-medium uppercase">{doc.file_type}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Чанків</p>
                                  <p className="font-medium">{doc.chunks}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Статус</p>
                                  <p className={`font-medium ${doc.status === "indexed" ? "text-emerald-400" : "text-amber-400"}`}>
                                    {statusLabel(doc.status)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
