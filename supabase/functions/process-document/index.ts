import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbeddingsBatch } from "../_shared/embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function splitIntoChunks(text: string, chunkSize = 400, overlap = 40): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 20) {
      chunks.push(chunk.trim());
    }
    i += chunkSize - overlap;
  }
  return chunks;
}

function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGarbage(text: string): boolean {
  if (!text || text.length < 10) return true;
  const readable = (text.match(/[\x20-\x7E\u0400-\u04FF\u2000-\u206F]/g) || []).length;
  return readable / text.length < 0.4;
}

async function extractTextFromTxt(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder("utf-8").decode(buffer);
}

async function extractTextFromPdfNative(buffer: ArrayBuffer): Promise<string> {
  try {
    // Import pdfjs-dist with legacy build that works without a Worker in Deno
    const pdfjs = await import(
      "https://esm.sh/pdfjs-dist@4.9.155/legacy/build/pdf.mjs"
    );

    // Disable worker entirely for Deno environment
    pdfjs.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    console.log(`PDF has ${numPages} pages`);

    const pageTexts: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: { str?: string }) => item.str ?? "")
        .join(" ");
      pageTexts.push(pageText);
    }

    const result = pageTexts.join("\n\n").trim();
    console.log(
      `pdfjs-dist: ${result.length} chars, garbage=${isGarbage(result)}`
    );

    if (result.length > 20 && !isGarbage(result)) {
      return result;
    }
    return "";
  } catch (e) {
    console.warn("pdfjs-dist failed:", String(e).slice(0, 300));
    return "";
  }
}

/**
 * Use Gemini Vision via Lovable AI Gateway to OCR the PDF.
 * This handles encoded/scanned PDFs that native text extraction can't read.
 */
async function extractTextWithGeminiVision(
  buffer: ArrayBuffer,
  docName: string
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — cannot use Gemini Vision");
    return "";
  }

  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
  }
  const base64 = btoa(binary);

  console.log(`Gemini Vision: sending ${bytes.byteLength} bytes`);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Витягни весь текст з цього PDF документу "${docName}". Поверни тільки сирий текст без markdown форматування. Якщо є таблиці — передай їх як текст.`,
            },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini Vision error ${res.status}:`, errText.slice(0, 300));
    return "";
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const extracted = parts.map((p: { text?: string }) => p.text ?? "").join("");
  console.log(`Gemini Vision extracted ${extracted.length} chars`);
  return extracted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log(`Processing: ${doc.name} (${doc.file_type})`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      throw new Error(`Failed to download: ${downloadError?.message}`);
    }

    const buffer = await fileData.arrayBuffer();

    let extractedText = "";

    if (doc.file_type === "PDF") {
      // Step 1: Try pdfjs-dist native extraction
      extractedText = await extractTextFromPdfNative(buffer);

      // Step 2: Fallback to Gemini Vision if native fails or returns garbage
      if (!extractedText || extractedText.length < 50) {
        console.log("Native extraction failed → Gemini Vision OCR");
        extractedText = await extractTextWithGeminiVision(buffer, doc.name);
      }
    } else {
      extractedText = await extractTextFromTxt(buffer);
    }

    if (!extractedText || extractedText.length < 10) {
      extractedText = `Документ: ${doc.name}. Файл завантажено але текст не вдалось витягнути автоматично.`;
    }

    console.log(`Final text: ${extractedText.length} chars`);

    const chunks = splitIntoChunks(extractedText, 400, 40);
    const chunkCount = Math.max(chunks.length, 1);
    console.log(`Created ${chunkCount} chunks`);

    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    const chunkRows = chunks.map((content, idx) => ({
      document_id: documentId,
      user_id: doc.user_id,
      content: sanitize(content),
      chunk_index: idx,
    }));

    if (chunkRows.length > 0) {
      const { data: inserted, error: chunksError } = await supabase
        .from("document_chunks")
        .insert(chunkRows)
        .select("id, content");

      if (chunksError) {
        console.error("Failed to insert chunks:", chunksError.message);
      } else if (inserted && inserted.length > 0) {
        // Generate embeddings in batches and update rows
        console.log(`Generating embeddings for ${inserted.length} chunks...`);
        const BATCH = 20;
        let embedded = 0;

        for (let i = 0; i < inserted.length; i += BATCH) {
          const batch = inserted.slice(i, i + BATCH);
          const vectors = await generateEmbeddingsBatch(
            batch.map((c) => c.content),
            5,
            {
              taskType: "RETRIEVAL_DOCUMENT",
              title: doc.name,
            },
          );

          await Promise.all(
            batch.map((c, idx) => {
              const vec = vectors[idx];
              if (!vec || vec.length === 0) return Promise.resolve();
              embedded++;
              return supabase
                .from("document_chunks")
                .update({ embedding: vec as unknown as string })
                .eq("id", c.id);
            }),
          );
        }
        console.log(`Embedded ${embedded}/${inserted.length} chunks`);
      }
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "indexed",
        chunks: chunkCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError)
      throw new Error(`Failed to update document: ${updateError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks: chunkCount,
        textLength: extractedText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-document error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
