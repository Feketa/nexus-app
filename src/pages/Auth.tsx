import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Cpu, Mail, Eye, EyeOff, ArrowRight, CheckCircle2, Shield, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "register";

export default function Auth() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setError("✅ Перевірте вашу пошту для підтвердження реєстрації!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Невідома помилка";
      if (msg.includes("Invalid login credentials")) {
        setError("Невірний email або пароль.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Підтвердьте email перед входом.");
      } else if (msg.includes("User already registered")) {
        setError("Цей email вже зареєстровано. Спробуйте увійти.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-dots px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center cyan-glow mb-4">
            <Cpu className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">NexusAI</h1>
          <p className="text-sm text-muted-foreground mt-1">Enterprise Support Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 border border-border/40">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/30 mb-6">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "login" ? "Вхід" : "Реєстрація"}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-4 border
              ${error.startsWith("✅")
                ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
                : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error.replace("✅ ", "")}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Повне ім'я</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Іван Петренко"
                  required
                  className="bg-muted/30 border-border/40 focus-visible:ring-primary/40 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email адреса</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="pl-10 bg-muted/30 border-border/40 focus-visible:ring-primary/40 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Пароль</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) { setError("Введіть email для скидання пароля"); return; }
                      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                      setError("✅ Лист для скидання пароля надіслано на " + email);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Забули пароль?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Мінімум 6 символів"
                  required
                  minLength={6}
                  className="pr-10 bg-muted/30 border-border/40 focus-visible:ring-primary/40 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 font-semibold transition-transform active:scale-95"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : mode === "login" ? (
                <><ArrowRight className="w-4 h-4" /> Увійти</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Створити акаунт</>
              )}
            </Button>
          </form>
        </div>

        {/* Trust indicators */}
        <div className="flex justify-center gap-6 mt-6 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SOC 2 Type II</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> GDPR відповідність</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ISO 27001</span>
        </div>
      </div>
    </div>
  );
}
