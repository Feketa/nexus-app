import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbedding } from "../_shared/embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MatchedChunk {
  id: string;
  content: string;
  document_id: string;
  similarity: number;
}

interface RankedChunk extends MatchedChunk {
  lexicalScore: number;
  combinedScore: number;
}

const SEARCH_STOP_WORDS = new Set([
  "який", "яка", "яке", "які", "про", "для", "або", "але", "що", "це", "цей", "ця", "ці",
  "the", "and", "with", "from", "your", "наш", "ваш", "його", "її", "їх", "податок",
]);

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQueryTerms(query: string): string[] {
  return [...new Set(
    normalizeSearchText(query)
      .split(" ")
      .filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term)),
  )];
}

function getLexicalScore(content: string, query: string, queryTerms: string[]): number {
  const normalizedContent = normalizeSearchText(content);
  const normalizedQuery = normalizeSearchText(query);
  let score = 0;
  for (const term of queryTerms) {
    if (normalizedContent.includes(term)) score += 1;
  }
  if (normalizedQuery && normalizedContent.includes(normalizedQuery)) {
    score += 2;
  }
  return score;
}

// Convert OpenAI-style messages → Gemini `contents` + `systemInstruction`
function toGeminiPayload(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  opts: { temperature: number; maxOutputTokens: number; topP: number },
) {
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      topP: opts.topP,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, temperature, max_tokens, top_p, session_id } =
      await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Неавторизований доступ" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Vector RAG ──────────────────────────────────────────────────────────
    let ragContext = "";
    let sources: Array<{
      document_id: string;
      document_name?: string;
      preview: string;
      similarity: string;
    }> = [];

    const { data: allDocs } = await supabase
      .from("documents")
      .select("id, name, status")
      .eq("user_id", user.id)
      .eq("status", "indexed");
    const docList = (allDocs ?? []).map((d) => d.name);
    const indexedDocIds = (allDocs ?? []).map((d) => d.id);

    const lastUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const query = lastUserMsg?.content?.trim() ?? "";

    if (query) {
      try {
        const queryTerms = extractQueryTerms(query);
        const queryEmbedding = await generateEmbedding(query, {
          taskType: "RETRIEVAL_QUERY",
        });

        const { data: chunks, error: rpcError } = await supabase.rpc(
          "match_chunks",
          {
            query_embedding: queryEmbedding as unknown as string,
            match_count: 24,
            similarity_threshold: 0.4,
          },
        );

        if (rpcError) {
          console.error("match_chunks RPC error:", rpcError.message);
        } else if (chunks && chunks.length > 0) {
          const matched = chunks as MatchedChunk[];
          const docIds = [...new Set(matched.map((c) => c.document_id))];
          const { data: docs } = await supabase
            .from("documents")
            .select("id, name")
            .eq("user_id", user.id)
            .in("id", docIds);
          const nameById = new Map(
            (docs ?? []).map((d: { id: string; name: string }) => [d.id, d.name]),
          );
          const filteredMatched = matched
            .filter((chunk) => nameById.has(chunk.document_id))
            .slice(0, 12);

          const rankedById = new Map<string, RankedChunk>(
            filteredMatched.map((chunk) => {
              const lexicalScore = getLexicalScore(chunk.content, query, queryTerms);
              return [chunk.id, {
                ...chunk,
                lexicalScore,
                combinedScore: chunk.similarity + lexicalScore * 0.45,
              }];
            }),
          );

          if (indexedDocIds.length > 0 && queryTerms.length > 0) {
            const { data: candidateChunks, error: lexicalError } = await supabase
              .from("document_chunks")
              .select("id, content, document_id")
              .in("document_id", indexedDocIds)
              .limit(200);

            if (lexicalError) {
              console.error("RAG lexical query error:", lexicalError.message);
            } else {
              for (const candidate of candidateChunks ?? []) {
                if (!nameById.has(candidate.document_id)) continue;
                const lexicalScore = getLexicalScore(candidate.content, query, queryTerms);
                if (lexicalScore <= 0) continue;
                const previous = rankedById.get(candidate.id);
                const similarity = previous?.similarity ?? 0;
                rankedById.set(candidate.id, {
                  id: candidate.id,
                  content: candidate.content,
                  document_id: candidate.document_id,
                  similarity,
                  lexicalScore,
                  combinedScore: similarity + lexicalScore * 0.45,
                });
              }
            }
          }

          const rankedChunks = [...rankedById.values()]
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, 5);

          if (rankedChunks.length > 0) {
            console.log(
              `RAG: ranked ${rankedChunks.length} user chunks, top score=${rankedChunks[0].combinedScore.toFixed(3)}`,
            );

            ragContext = "\n\n=== КОНТЕКСТ З БАЗИ ЗНАНЬ ===\n";
            for (const c of rankedChunks) {
              const docName = nameById.get(c.document_id) ?? "Документ";
              ragContext += `\n[Джерело: ${docName}]\n${c.content}\n---\n`;
            }
            ragContext += "=== КІНЕЦЬ КОНТЕКСТУ ===\n";

            sources = rankedChunks.map((c) => ({
              document_id: c.document_id,
              document_name: nameById.get(c.document_id),
              preview: c.content.slice(0, 160),
              similarity: `${Math.round(c.similarity * 100)}%`,
            }));
          }
        }
      } catch (ragErr) {
        console.error("RAG error (non-fatal):", String(ragErr).slice(0, 200));
      }
    }

    const docsBlock = docList.length > 0
      ? `\n\n=== ДОСТУПНІ ДОКУМЕНТИ В БАЗІ ЗНАНЬ (${docList.length}) ===\n${docList.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n=== КІНЕЦЬ СПИСКУ ===`
      : "\n\n=== БАЗА ЗНАНЬ ПОРОЖНЯ — жодного документа не завантажено ===";

    const systemPrompt = `Ви — корпоративний AI асистент підтримки компанії NexusAI.

КРИТИЧНІ ПРАВИЛА (порушення = неправильна відповідь):
1. Відповідайте ВИКЛЮЧНО українською мовою.
2. ЗАБОРОНЕНО вигадувати назви документів, політик чи регламентів. Використовуйте ТІЛЬКИ ті назви, що є у блоці "ДОСТУПНІ ДОКУМЕНТИ" нижче.
3. Якщо користувач питає "які документи є" / "що в базі знань" / "які файли" — перерахуйте РІВНО ті файли зі списку нижче, без додавання вигаданих категорій.
4. Якщо в "КОНТЕКСТ З БАЗИ ЗНАНЬ" немає інформації для відповіді — чесно скажіть: "У завантажених документах немає інформації за цим запитом" і запропонуйте звернутись до спеціаліста.
5. Якщо база знань порожня — скажіть про це прямо, не вигадуйте контент.
6. При відповіді на основі контексту — обовʼязково посилайтесь на назву документа з [Джерело: ...].
7. Структуруйте відповіді: заголовки, списки, чіткість.${docsBlock}${ragContext}`;

    const MODEL = "gemini-2.5-flash";
    const payload = toGeminiPayload(messages, systemPrompt, {
      temperature: temperature ?? 0.7,
      maxOutputTokens: max_tokens ?? 1024,
      topP: top_p ?? 0.9,
    });

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini API error:", response.status, text.slice(0, 400));
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Перевищено ліміт запитів Gemini. Спробуйте пізніше." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Помилка AI сервісу. Спробуйте пізніше." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sourcesHeader = encodeURIComponent(JSON.stringify(sources));
    const encoder = new TextEncoder();

    // Re-emit Gemini SSE as OpenAI-compatible SSE so the frontend stays unchanged.
    const transformed = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        const emit = (delta: string) => {
          const chunk = {
            choices: [{ delta: { content: delta } }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payloadStr = trimmed.slice(5).trim();
              if (!payloadStr) continue;
              try {
                const json = JSON.parse(payloadStr);
                const parts = json?.candidates?.[0]?.content?.parts ?? [];
                for (const p of parts) {
                  if (typeof p?.text === "string" && p.text) {
                    fullText += p.text;
                    emit(p.text);
                  }
                }
              } catch {
                // ignore
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));

          if (session_id && fullText.trim()) {
            try {
              const { data: session } = await supabase
                .from("chat_sessions")
                .select("user_id")
                .eq("id", session_id)
                .maybeSingle();

              if (session?.user_id) {
                await supabase.from("chat_messages").insert({
                  session_id,
                  user_id: session.user_id,
                  role: "assistant",
                  content: fullText,
                  sources: sources.length > 0 ? sources : null,
                });
              }
            } catch (e) {
              console.error("Persist assistant message failed:", String(e).slice(0, 200));
            }
          }
        } catch (e) {
          console.error("Stream tee error:", String(e).slice(0, 200));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformed, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-RAG-Sources": sourcesHeader,
      },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Невідома помилка",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
