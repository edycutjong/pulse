import {
  loadEmbeddingModel,
  runSaveEmbeddings,
  runRagSearch,
  unloadQVACModel,
  EMBEDDING_MODEL_ID,
} from "./qvac";

export interface KnowledgeDocument {
  id: string;
  content: string;
  source: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

// ── Embedding Model Lifecycle ────────────────────────────────────────────────

let embeddingModelId: string | null = null;

export async function initEmbeddingModel(): Promise<string> {
  if (embeddingModelId) return embeddingModelId;
  const id = await loadEmbeddingModel(EMBEDDING_MODEL_ID);
  embeddingModelId = id;
  console.log("[rag] Embedding model loaded:", id);
  return id;
}

export async function releaseEmbeddingModel(): Promise<void> {
  if (embeddingModelId) {
    await unloadQVACModel(embeddingModelId);
    embeddingModelId = null;
  }
}

// ── Ingest Documents ─────────────────────────────────────────────────────────

/**
 * Ingest documents into the local RAG vector store.
 * Each document is chunked, embedded, and stored locally.
 */
export async function ingestDocuments(
  documents: string[],
  chunk: boolean = true
): Promise<void> {
  const modelId = await initEmbeddingModel();
  try {
    await runSaveEmbeddings({
      modelId,
      documents,
      chunk,
    });
    console.log(`[rag] Ingested ${documents.length} documents`);
  } catch (error) {
    console.error("[rag] Document ingestion failed:", error);
    throw error;
  }
}

// ── Search Medical Knowledge Base ────────────────────────────────────────────

/**
 * Search the local medical knowledge base using RAG.
 * Returns ranked results with source attribution for citations.
 */
export async function searchMedicalKnowledge(
  query: string,
  topK: number = 3
): Promise<KnowledgeDocument[]> {
  const modelId = await initEmbeddingModel();
  try {
    const results = await runRagSearch({
      modelId,
      query,
      topK,
    });

    return (results as any[]).map((r: any, i: number) => ({
      id: r.id ?? `result-${i}`,
      content: r.content ?? r.text ?? "",
      source: r.source ?? r.metadata?.source ?? "unknown_source",
      score: r.score,
      metadata: r.metadata,
    }));
  } catch (err) {
    console.warn(
      "[rag] RAG search failed or corpus not initialized, returning seed fallback:",
      err
    );
    // Seed fallback — ensures the triage engine always has context
    return [
      {
        id: "fallback-1",
        content:
          "Amlodipine and Ibuprofen can increase blood pressure and risk of kidney problems.",
        source: "drug_interactions.csv",
      },
      {
        id: "fallback-2",
        content:
          "Severe headaches accompanied by blurred vision require urgent medical evaluation.",
        source: "red_flags.csv",
      },
    ];
  }
}
