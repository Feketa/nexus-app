import { useEffect, useState } from "react";
import { Play, RotateCcw, FlaskConical, Thermometer, Copy, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const presets = [
  { name: "Підтримка клієнтів", prompt: "Ви — корпоративний AI асистент підтримки компанії NexusAI. Відповідайте чітко, ввічливо та професійно. Використовуйте тільки інформацію з бази знань. Якщо відповідь невідома — чесно повідомте про це." },
  { name: "Технічний консультант", prompt: "Ви — технічний консультант з глибокими знаннями в сфері SaaS та корпоративних технологій. Давайте детальні технічні пояснення з прикладами коду де це доречно." },
  { name: "FAQ Бот", prompt: "Ви — спеціалізований FAQ бот. Відповідайте коротко та по суті. Якщо питання не в базі FAQ — направте користувача до служби підтримки." },
];

const LAB_PROMPT_KEY = "ai-wise-connector:lab-system-prompt";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function PromptLab() {
  const { user } = useAuth();
  const [systemPrompt, setSystemPrompt] = useState(presets[0].prompt);
  const [userMessage, setUserMessage] = useState("Які рівні підтримки доступні для Enterprise плану?");
  const [temperature, setTemperature] = useState([0.3]);
  const [maxTokens, setMaxTokens] = useState([512]);
  const [topP, setTopP] = useState([0.9]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState<number | null>(null);

  useEffect(() => {
    const savedPrompt = localStorage.getItem(LAB_PROMPT_KEY);
    if (savedPrompt) setSystemPrompt(savedPrompt);
  }, []);

  useEffect(() => {
    localStorage.setItem(LAB_PROMPT_KEY, systemPrompt);
  }, [systemPrompt]);

  const handleRun = async () => {
    if (!userMessage.trim()) return;
    setLoading(true);
    setOutput("");
    setTokenCount(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setOutput("❌ Неавторизований доступ");
        return;
      }

      if (!SUPABASE_URL) {
        setOutput("❌ Не налаштовано VITE_SUPABASE_URL");
        return;
      }

      const url = `${SUPABASE_URL}/functions/v1/ai-chat`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: temperature[0],
          max_tokens: maxTokens[0],
          top_p: topP[0],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Помилка сервісу" }));
        setOutput(`❌ ${err.error ?? "Помилка з'єднання з AI"}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setOutput("❌ Помилка читання відповіді"); return; }

      const decoder = new TextDecoder();
      let full = "";
      let totalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; setOutput(full); }
            if (parsed.usage?.total_tokens) totalTokens = parsed.usage.total_tokens;
          } catch { /* skip */ }
        }
      }

      if (totalTokens > 0) setTokenCount(totalTokens);
    } catch (e) {
      setOutput(`❌ ${e instanceof Error ? e.message : "Невідома помилка"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-secondary" />
          Prompt Lab
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Тестуйте системні промпти та параметри моделі</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Prompt Config */}
        <div className="xl:col-span-2 space-y-4">
          {/* Presets */}
          <div className="glass-card rounded-xl p-4">
            <Label className="text-xs text-muted-foreground mb-3 block">Шаблони промптів</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSystemPrompt(p.prompt)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-secondary hover:border-secondary/30 hover:bg-secondary/5 transition-all duration-200"
                >
                  <Wand2 className="w-3 h-3 inline mr-1" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Системний промпт</Label>
              <button onClick={() => navigator.clipboard.writeText(systemPrompt)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[140px] text-xs bg-muted/20 border-border/40 focus-visible:ring-secondary/40 resize-none font-mono leading-relaxed"
              placeholder="Введіть системний промпт..."
            />
            <p className="text-[11px] text-muted-foreground">
              Цей промпт зберігається і буде використаний у наступних запитах у вкладці AI Chat.
            </p>
          </div>

          {/* User Message */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Тестове повідомлення користувача</Label>
            <Textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="min-h-[80px] text-xs bg-muted/20 border-border/40 focus-visible:ring-primary/40 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleRun} disabled={loading || !userMessage.trim()} className="bg-secondary hover:bg-secondary/90 text-white gap-2 flex-1 transition-transform active:scale-95">
              {loading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Генерація...</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Запустити тест</>
              )}
            </Button>
            <Button variant="outline" onClick={() => { setOutput(""); setTokenCount(null); }} className="border-border/40 gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Очистити
            </Button>
          </div>

          {/* Output */}
          <div className="glass-card rounded-xl p-4 min-h-[160px]">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs text-muted-foreground">Відповідь моделі</Label>
              {tokenCount && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {tokenCount} токенів · t={temperature[0]} · top_p={topP[0]}
                </span>
              )}
            </div>
            {loading && !output ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Генерується відповідь...
              </div>
            ) : output ? (
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                {output}
                {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Результат з'явиться тут після запуску тесту...</p>
            )}
          </div>
        </div>

        {/* Right: Parameters */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-6">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-amber-400" /> Параметри моделі
            </h3>

            {[
              { label: "Температура", key: "temp", value: temperature, set: setTemperature, min: 0, max: 2, step: 0.1, color: "text-amber-400", desc: "Креативність відповідей" },
              { label: "Max Tokens", key: "tokens", value: maxTokens, set: setMaxTokens, min: 64, max: 4096, step: 64, color: "text-primary", desc: "Максимальна довжина" },
              { label: "Top-P", key: "topp", value: topP, set: setTopP, min: 0, max: 1, step: 0.05, color: "text-secondary", desc: "Відбір токенів" },
            ].map((p) => (
              <div key={p.key} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">{p.label}</Label>
                    <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${p.color}`}>{p.value[0]}</span>
                </div>
                <Slider
                  min={p.min} max={p.max} step={p.step}
                  value={p.value} onValueChange={p.set}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{p.min}</span><span>{p.max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Model Info */}
          <div className="glass-card rounded-xl p-4 border border-secondary/20 space-y-2">
            <p className="text-xs font-semibold text-secondary">Активна модель</p>
            <p className="text-sm font-bold">Gemini Flash</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>Провайдер</span><span className="text-foreground">Google Gemini</span></div>
              <div className="flex justify-between"><span>Контекстне вікно</span><span className="text-foreground">1M токенів</span></div>
              <div className="flex justify-between"><span>Стрімінг</span><span className="text-emerald-400">Увімкнено</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
