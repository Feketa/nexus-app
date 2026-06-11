import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, FileText, Trash2, CheckCircle2, Clock, AlertCircle, Download, Filter, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DocFile {
  id: string;
  name: string;
  size: string;
  file_path: string;
  file_type: string;
  status: "indexed" | "processing" | "error";
  chunks: number;
  created_at: string;
  user_id: string;
}

const statusConfig = {
  indexed: { label: "Індексовано", icon: CheckCircle2, class: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  processing: { label: "Обробка...", icon: Clock, class: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  error: { label: "Помилка", icon: AlertCircle, class: "text-destructive bg-destructive/10 border-destructive/20" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function DocumentVault() {
  const { user } = useAuth();
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const filesRef = useRef(files);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Помилка завантаження документів"); return; }
    const mapped = (data || []).map((d) => ({
      id: d.id,
      name: d.name,
      size: formatSize(d.file_size),
      file_path: d.file_path,
      file_type: d.file_type,
      status: d.status as "indexed" | "processing" | "error",
      chunks: d.chunks,
      created_at: new Date(d.created_at).toLocaleDateString("uk-UA"),
      user_id: d.user_id,
    }));
    filesRef.current = mapped;
    setFiles(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;

    fetchDocuments();
    // Poll every 3 seconds while any local document is still processing
    const interval = setInterval(() => {
      if (filesRef.current.some((f) => f.status === "processing")) {
        fetchDocuments();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const uploadFiles = async (fileList: File[]) => {
    if (!user) { toast.error("Необхідна авторизація"); return; }
    const allowed = fileList.filter((f) => f.name.match(/\.(pdf|txt)$/i));
    if (allowed.length === 0) { toast.error("Тільки PDF та TXT файли"); return; }

    setUploading(true);
    for (const file of allowed) {
      // Sanitize file name for Supabase Storage (ASCII only, no special chars)
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "file";
      const safeName = `${baseName}.${ext}`;
      const filePath = `${user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Помилка завантаження ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: insertedDoc, error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.name.split(".").pop()?.toUpperCase() || "FILE",
        status: "processing",
        chunks: 0,
      }).select("id").single();

      if (dbError) {
        toast.error(`Помилка запису ${file.name}: ${dbError.message}`);
      } else {
        toast.success(`${file.name} завантажено — починаємо індексацію...`);
        // Trigger processing in background
        if (insertedDoc?.id) {
          supabase.functions.invoke("process-document", {
            body: { documentId: insertedDoc.id },
          }).then(({ error }) => {
            if (error) {
              console.error("Process document error:", error);
            }
          });
        }
      }
    }

    await fetchDocuments();
    setUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }, [user]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    uploadFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDelete = async (file: DocFile) => {
    if (!user) {
      toast.error("Необхідна авторизація");
      return;
    }

    const confirmDelete = window.confirm(`Видалити документ \"${file.name}\"?`);
    if (!confirmDelete) return;

    const { data, error } = await supabase.functions.invoke("delete-document", {
      body: { documentId: file.id },
    });

    if (error) {
      const message = (error as { message?: string }).message ?? "Помилка видалення";
      toast.error(message);
      console.error("Delete document error:", error);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    toast.success(`${file.name} видалено`);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const handleDownload = async (file: DocFile) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(file.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Помилка отримання посилання");
  };

  const handleReindex = async (file: DocFile) => {
    toast.info(`Переіндексація ${file.name}...`);
    await supabase.from("documents").update({ status: "processing", chunks: 0 }).eq("id", file.id);
    await fetchDocuments();
    const { error } = await supabase.functions.invoke("process-document", {
      body: { documentId: file.id },
    });
    if (error) toast.error(`Помилка переіндексації: ${error.message}`);
  };

  const filteredFiles = search.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;
  const totalChunks = files.reduce((a, f) => a + f.chunks, 0);
  const indexedCount = files.filter((f) => f.status === "indexed").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Сховище документів</h1>
          <p className="text-sm text-muted-foreground mt-1">Завантажуйте PDF та TXT для RAG-індексації</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="glass-card px-3 py-1.5 rounded-lg border border-border/40">
            {indexedCount} / {files.length} проіндексовано
          </span>
          <span className="glass-card px-3 py-1.5 rounded-lg border border-primary/20 text-primary">
            {totalChunks.toLocaleString()} чанків
          </span>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 cursor-pointer
          ${dragOver
            ? "border-primary/60 bg-primary/5 cyan-glow scale-[1.01]"
            : "border-border/40 hover:border-primary/30 hover:bg-muted/20"
          }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.txt"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300
          ${dragOver ? "bg-primary/20 scale-110" : "bg-muted/50"}`}>
          {uploading
            ? <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <Upload className={`w-7 h-7 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          }
        </div>
        <h3 className="font-semibold text-sm mb-1">
          {uploading ? "Завантаження..." : dragOver ? "Відпустіть файли" : "Перетягніть файли сюди"}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">або клікніть для вибору • PDF, TXT до 50 МБ</p>
        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 pointer-events-none">
          <Upload className="w-3.5 h-3.5 mr-2" /> Обрати файли
        </Button>
      </div>

      {/* Files Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 gap-4">
          <h3 className="font-semibold text-sm whitespace-nowrap">Завантажені документи</h3>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук документів..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/30 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Документів ще немає</p>
            <p className="text-xs mt-1">Завантажте перший PDF або TXT файл</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40">
                  {["Документ", "Тип", "Розмір", "Чанки", "Статус", "Завантажено", "Дії"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Нічого не знайдено
                    </td>
                  </tr>
                ) : filteredFiles.map((f) => {
                  const sc = statusConfig[f.status];
                  return (
                    <tr key={f.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-xs font-medium truncate max-w-[200px]">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono">{f.file_type}</Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{f.size}</td>
                      <td className="px-5 py-3 text-xs font-mono text-primary">{f.chunks || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${sc.class}`}>
                          <sc.icon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{f.created_at}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReindex(f)}
                            title="Переіндексувати (згенерувати embeddings)"
                            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(f)}
                            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(f)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
