// Shared util: generate 768-dim embeddings via Google Gemini API directly.
// Lovable AI Gateway doesn't support embedding models — only chat completions.
// Model: gemini-embedding-001 with reduced output dimensionality = 768 to match pgvector(768).

const MODEL = "gemini-embedding-001";
type EmbeddingTaskType = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" | "SEMANTIC_SIMILARITY";

interface EmbeddingOptions {
  taskType?: EmbeddingTaskType;
  title?: string;
}

export async function generateEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  // Trim & cap input — embedding models have token limits.
  const input = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!input) throw new Error("Empty input for embedding");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text: input }] },
      taskType: options.taskType,
      title: options.title,
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Embedding API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const vec = data?.embedding?.values;
  if (!Array.isArray(vec)) {
    throw new Error("Embedding response missing embedding.values");
  }
  return vec;
}

/** Generate embeddings for many texts with limited concurrency. */
export async function generateEmbeddingsBatch(
  texts: string[],
  concurrency = 5,
  options: EmbeddingOptions = {},
): Promise<number[][]> {
  const out: number[][] = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const i = cursor++;
      try {
        out[i] = await generateEmbedding(texts[i], options);
      } catch (e) {
        console.error(`embedding[${i}] failed:`, String(e).slice(0, 200));
        out[i] = [];
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, texts.length) }, worker),
  );
  return out;
}
