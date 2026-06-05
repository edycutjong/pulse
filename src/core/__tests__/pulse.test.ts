import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @qvac/sdk
const mockLoadModel = vi.fn();
const mockUnloadModel = vi.fn();
const mockCompletion = vi.fn();
const mockRagIngest = vi.fn();
const mockRagSearch = vi.fn();
const mockTextToSpeech = vi.fn();
const mockStartQVACProvider = vi.fn();
const mockStopQVACProvider = vi.fn();
const mockTranscribe = vi.fn();

vi.mock("@qvac/sdk", () => ({
  loadModel: (...args: any[]) => mockLoadModel(...args),
  unloadModel: (...args: any[]) => mockUnloadModel(...args),
  completion: (...args: any[]) => mockCompletion(...args),
  ragIngest: (...args: any[]) => mockRagIngest(...args),
  ragSearch: (...args: any[]) => mockRagSearch(...args),
  textToSpeech: (...args: any[]) => mockTextToSpeech(...args),
  startQVACProvider: (...args: any[]) => mockStartQVACProvider(...args),
  stopQVACProvider: (...args: any[]) => mockStopQVACProvider(...args),
  transcribe: (...args: any[]) => mockTranscribe(...args),
  LLAMA_3_2_1B_INST_Q4_0: "llama-model",
  GTE_LARGE_FP16: "gte-model",
  TTS_EN_SUPERTONIC_Q8_0: { src: "tts-src" },
  WHISPER_EN_TINY_Q8_0: "whisper-model",
}));

// Mock fs and node:fs modules completely
const mockCSV = "a,b,severity,note,src\nwarfarin,ibuprofen,high,bleeding,interaction/warfarin-nsaid\nmetformin,alcohol,moderate,acidosis,interaction/metformin-alcohol";

vi.mock("node:fs", () => ({
  default: {
    existsSync: () => {
      if ((globalThis as any).fsExistsMock !== undefined) return (globalThis as any).fsExistsMock;
      return true;
    },
    readFileSync: () => {
      if ((globalThis as any).fsReadMock !== undefined) return (globalThis as any).fsReadMock;
      return mockCSV;
    },
  },
  existsSync: () => {
    if ((globalThis as any).fsExistsMock !== undefined) return (globalThis as any).fsExistsMock;
    return true;
  },
  readFileSync: () => {
    if ((globalThis as any).fsReadMock !== undefined) return (globalThis as any).fsReadMock;
    return mockCSV;
  },
}));

vi.mock("fs", () => ({
  default: {
    existsSync: () => {
      if ((globalThis as any).fsExistsMock !== undefined) return (globalThis as any).fsExistsMock;
      return true;
    },
    readFileSync: () => {
      if ((globalThis as any).fsReadMock !== undefined) return (globalThis as any).fsReadMock;
      return mockCSV;
    },
  },
  existsSync: () => {
    if ((globalThis as any).fsExistsMock !== undefined) return (globalThis as any).fsExistsMock;
    return true;
  },
  readFileSync: () => {
    if ((globalThis as any).fsReadMock !== undefined) return (globalThis as any).fsReadMock;
    return mockCSV;
  },
}));

// Import Pulse core files
import {
  loadLLMModel,
  loadEmbeddingModel,
  loadTTSModel,
  unloadQVACModel,
  runCompletion,
  runSaveEmbeddings,
  runRagSearch,
  runTextToSpeech,
  startP2PProvider,
  stopP2PProvider,
} from "../qvac";

import {
  initEmbeddingModel,
  releaseEmbeddingModel,
  ingestDocuments,
  searchMedicalKnowledge,
} from "../rag";

import {
  checkDrugInteractions,
  runTriage,
} from "../triage";

import {
  loadWhisperModel,
  unloadWhisperModel,
  transcribeAudio,
  synthesizeSpeech,
  runVoicePipeline,
} from "../voice";

import {
  estimateTokens,
  recordModelLoad,
  recordModelUnload,
  recordCompletion,
  getAuditLog,
  clearAuditLog,
  getAuditSummary,
} from "../audit";

import { matchInteractions, runTriageCore } from "../triageCore";
import { INTERACTIONS } from "../triageData";

describe("Pulse Core Module", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (globalThis as any).fsExistsMock = undefined;
    (globalThis as any).fsReadMock = undefined;
    await releaseEmbeddingModel();
    await unloadWhisperModel();
  });

  describe("qvac.ts wrapper tests", () => {
    it("should load LLM Model successfully", async () => {
      mockLoadModel.mockResolvedValue("mock-llm-id");
      const id = await loadLLMModel();
      expect(id).toBe("mock-llm-id");
      expect(mockLoadModel).toHaveBeenCalledWith({
        modelSrc: "llama-model",
        modelType: "llamacpp-completion",
      });

      // Test object modelSrc parameter to cover ternary branch
      const idObj = await loadLLMModel({ src: "obj-llama-model" });
      expect(idObj).toBe("mock-llm-id");
    });

    it("should load LLM Model with delegate options", async () => {
      mockLoadModel.mockResolvedValue("mock-llm-id");
      const id = await loadLLMModel("custom-src", {
        providerPublicKey: "pubkey",
        timeout: 10000,
        fallbackToLocal: false,
      });
      expect(id).toBe("mock-llm-id");
      expect(mockLoadModel).toHaveBeenCalledWith({
        modelSrc: "custom-src",
        modelType: "llamacpp-completion",
        delegate: {
          providerPublicKey: "pubkey",
          timeout: 10000,
          fallbackToLocal: false,
        },
      });
    });

    it("should load LLM Model with delegate options and defaults", async () => {
      mockLoadModel.mockResolvedValue("mock-llm-id");
      const id = await loadLLMModel("custom-src", {
        providerPublicKey: "pubkey"
      });
      expect(id).toBe("mock-llm-id");
      expect(mockLoadModel).toHaveBeenCalledWith({
        modelSrc: "custom-src",
        modelType: "llamacpp-completion",
        delegate: {
          providerPublicKey: "pubkey",
          timeout: 30000,
          fallbackToLocal: true
        }
      });
    });


    it("should load Embedding Model successfully", async () => {
      mockLoadModel.mockResolvedValue("mock-embed-id");
      const id = await loadEmbeddingModel();
      expect(id).toBe("mock-embed-id");

      // Test object modelSrc parameter to cover ternary branch
      const idObj = await loadEmbeddingModel({ src: "obj-embed-model" });
      expect(idObj).toBe("mock-embed-id");
    });

    it("should load TTS Model successfully", async () => {
      mockLoadModel.mockResolvedValue("mock-tts-id");
      const id = await loadTTSModel();
      expect(id).toBe("mock-tts-id");
    });

    it("should handle model loading failures", async () => {
      mockLoadModel.mockRejectedValue(new Error("Load failed"));
      await expect(loadLLMModel()).rejects.toThrow("Load failed");
      await expect(loadEmbeddingModel()).rejects.toThrow("Load failed");
      await expect(loadTTSModel()).rejects.toThrow("Load failed");
    });

    it("should unload Model successfully", async () => {
      mockUnloadModel.mockResolvedValue(undefined);
      await unloadQVACModel("mock-id");
      expect(mockUnloadModel).toHaveBeenCalledWith({ modelId: "mock-id" });
    });

    it("should log error when unloading fails but not throw", async () => {
      mockUnloadModel.mockRejectedValue(new Error("Unload failed"));
      await expect(unloadQVACModel("mock-id")).resolves.not.toThrow();
    });

    it("should run Completion successfully with text", async () => {
      mockCompletion.mockResolvedValue({ text: Promise.resolve("hello") });
      const res = await runCompletion({
        modelId: "mock-id",
        history: [{ role: "user", content: "hi" }],
      });
      expect(res.text).toBe("hello");
    });

    it("should run Completion successfully with stream", async () => {
      const mockStream = { tokenStream: "stream-obj" };
      mockCompletion.mockReturnValue(mockStream);
      const res = await runCompletion({
        modelId: "mock-id",
        history: [{ role: "user", content: "hi" }],
        stream: true,
      });
      expect(res.tokenStream).toBe("stream-obj");
    });

    it("should run Completion with images if provided", async () => {
      mockCompletion.mockResolvedValue({ text: Promise.resolve("image-processed") });
      const img = new Uint8Array([1, 2, 3]);
      const res = await runCompletion({
        modelId: "mock-id",
        history: [{ role: "user", content: "hi" }],
        images: [img],
      });
      expect(res.text).toBe("image-processed");
      expect(mockCompletion).toHaveBeenCalledWith({
        modelId: "mock-id",
        history: [{ role: "user", content: "hi" }],
        images: [img],
        stream: false,
      });

      // Test empty images array to cover the empty branch check
      const resEmpty = await runCompletion({
        modelId: "mock-id",
        history: [{ role: "user", content: "hi" }],
        images: [],
      });
      expect(resEmpty.text).toBe("image-processed");
    });

    it("should handle runCompletion failures", async () => {
      mockCompletion.mockRejectedValue(new Error("Inference failed"));
      await expect(
        runCompletion({
          modelId: "mock-id",
          history: [],
        })
      ).rejects.toThrow("Inference failed");
    });

    it("should save embeddings successfully", async () => {
      mockRagIngest.mockResolvedValue({ success: true });
      const res = await runSaveEmbeddings({
        modelId: "mock-id",
        documents: ["doc1"],
        chunk: true,
      });
      expect(res).toEqual({ success: true });
    });

    it("should handle save embeddings failure", async () => {
      mockRagIngest.mockRejectedValue(new Error("Ingest failed"));
      await expect(
        runSaveEmbeddings({
          modelId: "mock-id",
          documents: [],
        })
      ).rejects.toThrow("Ingest failed");
    });

    it("should search RAG successfully", async () => {
      mockRagSearch.mockResolvedValue([{ content: "found" }]);
      const res = await runRagSearch({
        modelId: "mock-id",
        query: "test",
      });
      expect(res).toEqual([{ content: "found" }]);
    });

    it("should handle RAG search failure", async () => {
      mockRagSearch.mockRejectedValue(new Error("Search failed"));
      await expect(
        runRagSearch({
          modelId: "mock-id",
          query: "test",
        })
      ).rejects.toThrow("Search failed");
    });

    it("should synthesize TTS successfully", async () => {
      mockLoadModel.mockResolvedValue("mock-tts-id");
      mockTextToSpeech.mockReturnValue({ buffer: Promise.resolve(new Uint8Array([9, 9])) });
      mockUnloadModel.mockResolvedValue(undefined);

      const buffer = await runTextToSpeech({ text: "say hi" });
      expect(buffer).toEqual(new Uint8Array([9, 9]));
    });

    it("should handle TTS failure", async () => {
      mockLoadModel.mockResolvedValue("mock-tts-id");
      mockTextToSpeech.mockReturnValue({ buffer: Promise.reject(new Error("TTS failed")) });
      await expect(runTextToSpeech({ text: "say hi" })).rejects.toThrow("TTS failed");
    });

    it("should start and stop P2P Provider successfully", async () => {
      mockStartQVACProvider.mockResolvedValue({ success: true });
      const res = await startP2PProvider({
        topic: "test-topic",
        firewall: { mode: "allow", publicKeys: ["key"] },
      });
      expect(res).toEqual({ success: true });

      mockStopQVACProvider.mockResolvedValue(undefined);
      await stopP2PProvider();
      expect(mockStopQVACProvider).toHaveBeenCalled();
    });

    it("should handle P2P failures", async () => {
      mockStartQVACProvider.mockRejectedValue(new Error("Start failed"));
      await expect(startP2PProvider({ topic: "test" })).rejects.toThrow("Start failed");

      mockStopQVACProvider.mockRejectedValue(new Error("Stop failed"));
      await expect(stopP2PProvider()).rejects.toThrow("Stop failed");
    });
  });

  describe("rag.ts tests", () => {
    it("should manage Embedding Model loading lifecycle", async () => {
      mockLoadModel.mockResolvedValue("embed-lifecycle-id");
      
      // Release when null
      await releaseEmbeddingModel();

      const id1 = await initEmbeddingModel();
      const id2 = await initEmbeddingModel();
      expect(id1).toBe("embed-lifecycle-id");
      expect(id2).toBe("embed-lifecycle-id");
      expect(mockLoadModel).toHaveBeenCalledTimes(1);

      await releaseEmbeddingModel();
      expect(mockUnloadModel).toHaveBeenCalledWith({ modelId: "embed-lifecycle-id" });
    });

    it("should ingest documents successfully", async () => {
      mockLoadModel.mockResolvedValue("embed-lifecycle-id");
      mockRagIngest.mockResolvedValue({ success: true });
      await expect(ingestDocuments(["hello text"], false)).resolves.not.toThrow();
    });

    it("should handle ingestion failures", async () => {
      mockLoadModel.mockResolvedValue("embed-lifecycle-id");
      mockRagIngest.mockRejectedValue(new Error("Ingest failed"));
      await expect(ingestDocuments(["hello text"])).rejects.toThrow("Ingest failed");
    });

    it("should search knowledge base and map properties", async () => {
      mockLoadModel.mockResolvedValue("embed-lifecycle-id");
      mockRagSearch.mockResolvedValue([
        { id: "doc-1", content: "protocol content", source: "protocol.txt", score: 0.9 },
        { text: "protocol text", metadata: { source: "meta.txt" } },
        {}
      ]);
      const res = await searchMedicalKnowledge("cough", 3);
      expect(res).toHaveLength(3);
      expect(res[0]).toEqual({
        id: "doc-1",
        content: "protocol content",
        source: "protocol.txt",
        score: 0.9,
        metadata: undefined,
      });
      expect(res[1]).toEqual({
        id: "result-1",
        content: "protocol text",
        source: "meta.txt",
        score: undefined,
        metadata: { source: "meta.txt" },
      });
      expect(res[2]).toEqual({
        id: "result-2",
        content: "",
        source: "unknown_source",
        score: undefined,
        metadata: undefined,
      });
    });

    it("should return fallback data on RAG search failure", async () => {
      mockLoadModel.mockResolvedValue("embed-lifecycle-id");
      mockRagSearch.mockRejectedValue(new Error("Search failed"));
      const res = await searchMedicalKnowledge("headache");
      expect(res).toHaveLength(2);
      expect(res[0].id).toBe("fallback-1");
      expect(res[1].id).toBe("fallback-2");
    });
  });

  describe("triage.ts tests", () => {
    it("should check drug interactions correctly", () => {
      const found1 = checkDrugInteractions("I took warfarin and ibuprofen", ["warfarin"]);
      expect(found1).toHaveLength(1);
      expect(found1[0].drugA).toBe("warfarin");
      expect(found1[0].drugB).toBe("ibuprofen");

      const found2 = checkDrugInteractions("I took metformin", ["alcohol"]);
      expect(found2).toHaveLength(1);

      const foundEmpty = checkDrugInteractions("nothing", ["nothing"]);
      expect(foundEmpty).toHaveLength(0);
    });

    it("should return empty interactions if file does not exist", () => {
      (globalThis as any).fsExistsMock = false;
      const res = checkDrugInteractions("warfarin", ["warfarin"]);
      expect(res).toHaveLength(0);
    });

    it("should return empty interactions if file is empty or headers only", () => {
      (globalThis as any).fsReadMock = "a,b,severity,note,src";
      const res = checkDrugInteractions("warfarin", ["warfarin"]);
      expect(res).toHaveLength(0);
    });

    it("should fall back to empty string if row cell is missing", () => {
      (globalThis as any).fsReadMock = "a,b,severity,note,src\nwarfarin,ibuprofen,high,bleeding";
      const res = checkDrugInteractions("warfarin and ibuprofen", ["warfarin"]);
      expect(res).toHaveLength(1);
      expect(res[0].src).toBe(""); // missing fifth cell falls back to empty string
    });

    it("should parse drug_a and drug_b headers correctly from CSV", () => {
      (globalThis as any).fsReadMock = "drug_a,drug_b,severity,note,src\nwarfarin,ibuprofen,high,bleeding,interaction/warfarin-nsaid";
      const res = checkDrugInteractions("warfarin and ibuprofen", ["warfarin"]);
      expect(res).toHaveLength(1);
      expect(res[0].drugA).toBe("warfarin");
      expect(res[0].drugB).toBe("ibuprofen");
    });

    it("should run triage with successful JSON parsing", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([{ content: "protocol info", source: "protocol-1" }]);
      
      const mockResultJSON = JSON.stringify({
        triageLevel: "routine",
        assessment: "Minor cough review.",
        drugInteractions: [],
        likelyCauses: ["Mild cold"],
        recommendations: ["Rest"],
        watchFor: ["Fever"],
        sources: []
      });
      mockCompletion.mockResolvedValue({ text: Promise.resolve(mockResultJSON) });

      const res = await runTriage("cough", []);
      expect(res.triageLevel).toBe("routine");
      expect(res.assessment).toBe("Minor cough review.");
      expect(res.sources).toContain("protocol-1");
    });

    it("should inject local drug interaction warnings and upgrade triage level to urgent", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([{ content: "protocol info", source: "protocol-1" }]);
      
      const mockResultJSON = JSON.stringify({
        triageLevel: "routine",
        assessment: "Patient takes warfarin.",
        drugInteractions: [],
        likelyCauses: ["Cough"],
        recommendations: [],
        watchFor: [],
        sources: []
      });
      mockCompletion.mockResolvedValue({ text: Promise.resolve(mockResultJSON) });

      const res = await runTriage("I took ibuprofen", ["warfarin"]);
      expect(res.triageLevel).toBe("urgent");
      expect(res.drugInteractions).toHaveLength(1);
      expect(res.drugInteractions[0]).toContain("warfarin and ibuprofen");
      expect(res.sources).toContain("interaction/warfarin-nsaid");
    });

    it("should not inject warning if LLM already returned drug interactions", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([]);
      
      const mockResultJSON = JSON.stringify({
        triageLevel: "routine",
        assessment: "Review of warfarin.",
        drugInteractions: ["Already reported interaction"],
        likelyCauses: [],
        recommendations: [],
        watchFor: [],
        sources: ["interaction/warfarin-nsaid"]
      });
      mockCompletion.mockResolvedValue({ text: Promise.resolve(mockResultJSON) });

      const res = await runTriage("I took ibuprofen", ["warfarin"]);
      expect(res.triageLevel).toBe("routine"); // not overridden to urgent
      expect(res.drugInteractions).toEqual(["Already reported interaction"]);
    });

    it("should not duplicate source if it is already in parsed sources", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([]);
      
      const mockResultJSON = JSON.stringify({
        triageLevel: "routine",
        assessment: "Review of warfarin.",
        drugInteractions: [],
        likelyCauses: [],
        recommendations: [],
        watchFor: [],
        sources: ["interaction/warfarin-nsaid"]
      });
      mockCompletion.mockResolvedValue({ text: Promise.resolve(mockResultJSON) });

      const res = await runTriage("I took ibuprofen", ["warfarin"]);
      expect(res.triageLevel).toBe("urgent"); // upgraded to urgent
      expect(res.sources).toEqual(["interaction/warfarin-nsaid"]); // not duplicated
      expect(res.sources).toHaveLength(1);
    });

    it("should handle LLM parsing failure and fall back gracefully", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([]);
      
      // Test when JSON parse fails
      mockCompletion.mockResolvedValueOnce({ text: Promise.resolve("INVALID_JSON") });
      const res1 = await runTriage("chest pain and arm pain", []);
      expect(res1.triageLevel).toBe("emergency");

      mockCompletion.mockResolvedValueOnce({ text: Promise.resolve("INVALID_JSON") });
      const res2 = await runTriage("headache and blur", []);
      expect(res2.triageLevel).toBe("urgent");

      mockCompletion.mockResolvedValueOnce({ text: Promise.resolve("INVALID_JSON") });
      const res3 = await runTriage("mild cough", []);
      expect(res3.triageLevel).toBe("routine");

      // Test when runCompletion itself throws
      mockCompletion.mockRejectedValueOnce(new Error("Inference error"));
      const res4 = await runTriage("mild cough", []);
      expect(res4.triageLevel).toBe("routine");
      expect(res4.assessment).toContain("fallback");
    });

    it("should map local interactions to sources in catch block if local interactions exist", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockRagSearch.mockResolvedValue([]);
      mockCompletion.mockRejectedValue(new Error("Inference failed"));

      const res = await runTriage("I took ibuprofen", ["warfarin"]);
      expect(res.triageLevel).toBe("urgent");
      expect(res.sources).toContain("interaction/warfarin-nsaid");
      expect(res.drugInteractions).toHaveLength(1);
    });
  });

  describe("voice.ts tests", () => {
    it("should manage Whisper model loading lifecycle", async () => {
      mockLoadModel.mockResolvedValue("whisper-lifecycle-id");
      
      // Release when null
      await unloadWhisperModel();

      const id1 = await loadWhisperModel();
      expect(id1).toBe("whisper-lifecycle-id");

      // Test caching
      const id2 = await loadWhisperModel();
      expect(id2).toBe("whisper-lifecycle-id");

      await unloadWhisperModel();
      expect(mockUnloadModel).toHaveBeenCalledWith({ modelId: "whisper-lifecycle-id" });
    });

    it("should transcribe audio buffer correctly", async () => {
      mockLoadModel.mockResolvedValue("whisper-id");
      // Test object return
      mockTranscribe.mockResolvedValue({ text: "transcribed text" });
      const text1 = await transcribeAudio(new Uint8Array([1, 2]));
      expect(text1).toBe("transcribed text");

      // Test array return
      mockTranscribe.mockResolvedValue([{ text: "hello" }, { text: "world" }]);
      const text2 = await transcribeAudio(new Uint8Array([1, 2]));
      expect(text2).toBe("hello world");

      // Test array return with missing texts
      mockTranscribe.mockResolvedValue([{ text: undefined }, {}]);
      const text3 = await transcribeAudio(new Uint8Array([1, 2]));
      expect(text3).toBe(" ");

      // Test object return with missing text
      mockTranscribe.mockResolvedValue({});
      const text4 = await transcribeAudio(new Uint8Array([1, 2]));
      expect(text4).toBe("");
    });

    it("should handle transcription failure", async () => {
      mockLoadModel.mockResolvedValue("whisper-id");
      mockTranscribe.mockRejectedValue(new Error("Transcribe failed"));
      await expect(transcribeAudio(new Uint8Array([1]))).rejects.toThrow("Transcribe failed");
    });

    it("should synthesize speech successfully", async () => {
      mockLoadModel.mockResolvedValue("mock-tts-id");
      mockTextToSpeech.mockReturnValue({ buffer: Promise.resolve(new Uint8Array([1, 2])) });
      const buffer = await synthesizeSpeech("say hi");
      expect(buffer).toEqual(new Uint8Array([1, 2]));
    });

    it("should handle synthesizeSpeech failure", async () => {
      mockLoadModel.mockResolvedValue("mock-tts-id");
      mockTextToSpeech.mockReturnValue({ buffer: Promise.reject(new Error("TTS failed")) });
      await expect(synthesizeSpeech("say hi")).rejects.toThrow("TTS failed");
    });

    it("should run full voice pipeline successfully", async () => {
      mockLoadModel.mockResolvedValue("model-id");
      mockTranscribe.mockResolvedValue({ text: "my symptoms" });
      mockTextToSpeech.mockReturnValue({ buffer: Promise.resolve(new Uint8Array([3, 4])) });

      const callback = vi.fn().mockResolvedValue("triage report");
      const res = await runVoicePipeline(new Uint8Array([1, 2]), callback);

      expect(res.transcription).toBe("my symptoms");
      expect(res.responseText).toBe("triage report");
      expect(res.responseAudio).toEqual(new Uint8Array([3, 4]));
      expect(callback).toHaveBeenCalledWith("my symptoms");
    });
  });
});

describe("triageCore (mobile path — bundled interactions, no fs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bundled INTERACTIONS constant mirrors the CSV (22 rows)", () => {
    expect(INTERACTIONS).toHaveLength(22);
    expect(INTERACTIONS[0]).toMatchObject({ a: "warfarin", b: "ibuprofen", src: "interaction/warfarin-nsaid" });
  });

  it("matchInteractions finds a hit from the bundled data without fs", () => {
    const hits = matchInteractions("I took ibuprofen", ["warfarin"], INTERACTIONS);
    expect(hits).toHaveLength(1);
    expect(hits[0].drugA).toBe("warfarin");
    expect(hits[0].drugB).toBe("ibuprofen");
    expect(hits[0].src).toBe("interaction/warfarin-nsaid");

    expect(matchInteractions("nothing here", ["nothing"], INTERACTIONS)).toHaveLength(0);
  });

  it("runTriageCore runs the real engine against the bundled constant", async () => {
    mockLoadModel.mockResolvedValue("model-id");
    mockRagSearch.mockResolvedValue([{ content: "protocol info", source: "protocol-1" }]);
    mockCompletion.mockResolvedValue({
      text: Promise.resolve(JSON.stringify({
        triageLevel: "routine",
        assessment: "Minor review.",
        drugInteractions: [],
        likelyCauses: ["Cough"],
        recommendations: ["Rest"],
        watchFor: ["Fever"],
        sources: [],
      })),
    });

    const res = await runTriageCore("cough", [], INTERACTIONS);
    expect(res.triageLevel).toBe("routine");
    expect(res.sources).toContain("protocol-1");
  });

  it("runTriageCore escalates to urgent when the bundled DB catches an interaction the LLM missed", async () => {
    mockLoadModel.mockResolvedValue("model-id");
    mockRagSearch.mockResolvedValue([{ content: "protocol info", source: "protocol-1" }]);
    mockCompletion.mockResolvedValue({
      text: Promise.resolve(JSON.stringify({
        triageLevel: "routine",
        assessment: "Patient takes warfarin.",
        drugInteractions: [],
        likelyCauses: ["Cough"],
        recommendations: [],
        watchFor: [],
        sources: [],
      })),
    });

    const res = await runTriageCore("I took ibuprofen", ["warfarin"], INTERACTIONS);
    expect(res.triageLevel).toBe("urgent");
    expect(res.drugInteractions[0]).toContain("warfarin and ibuprofen");
    expect(res.sources).toContain("interaction/warfarin-nsaid");
  });
});

describe("Audit Log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuditLog();
  });

  it("estimates tokens from text length (~4 chars/token)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("records model load / unload / completion events", () => {
    recordModelLoad("medpsy", "llamacpp-completion", 120);
    recordCompletion({ modelId: "medpsy", totalMs: 200, tokenCount: 40, streamed: false });
    recordModelUnload("medpsy");

    const log = getAuditLog();
    expect(log).toHaveLength(3);
    expect(log[0]).toMatchObject({ type: "model_load", modelId: "medpsy", loadMs: 120 });
    expect(log[1]).toMatchObject({ type: "completion", tokenCount: 40, tokensPerSec: 200, streamed: false });
    expect(log[2]).toMatchObject({ type: "model_unload", modelId: "medpsy" });
  });

  it("summarizes active models and average metrics", () => {
    recordModelLoad("medpsy", "llamacpp-completion", 100);
    recordModelLoad("gte", "embeddings", 50);
    recordCompletion({ modelId: "medpsy", ttftMs: 80, totalMs: 100, tokenCount: 50, streamed: true });
    recordModelUnload("gte"); // loaded then unloaded → not active

    const s = getAuditSummary();
    expect(s.loads).toBe(2);
    expect(s.unloads).toBe(1);
    expect(s.completions).toBe(1);
    expect(s.activeModels).toEqual(["medpsy"]);
    expect(s.avgTtftMs).toBe(80);
    expect(s.avgTokensPerSec).toBeCloseTo(500, 0);
  });

  it("auto-records a completion event from runCompletion (non-stream)", async () => {
    mockCompletion.mockResolvedValue({ text: Promise.resolve("a triage assessment of some length") });
    await runCompletion({ modelId: "medpsy", history: [{ role: "user", content: "headache" }] });

    const completions = getAuditLog().filter((e) => e.type === "completion");
    expect(completions).toHaveLength(1);
    expect(completions[0].streamed).toBe(false);
    expect(completions[0].tokenCount).toBeGreaterThan(0);
  });

  it("captures a true TTFT from a real token stream", async () => {
    async function* fakeStream() {
      yield "as";
      yield "sess";
    }
    mockCompletion.mockReturnValue({ tokenStream: fakeStream() });

    const res = await runCompletion({ modelId: "medpsy", history: [], stream: true });
    const out: string[] = [];
    for await (const t of res.tokenStream as AsyncGenerator<string>) out.push(t);
    expect(out).toEqual(["as", "sess"]);

    const completions = getAuditLog().filter((e) => e.type === "completion");
    expect(completions).toHaveLength(1);
    expect(completions[0].streamed).toBe(true);
    expect(completions[0].tokenCount).toBe(2);
  });

  it("records load + unload through the qvac wrappers", async () => {
    mockLoadModel.mockResolvedValue("loaded-id");
    mockUnloadModel.mockResolvedValue(undefined);

    await loadLLMModel();
    await unloadQVACModel("loaded-id");

    const s = getAuditSummary();
    expect(s.loads).toBe(1);
    expect(s.unloads).toBe(1);
    expect(s.activeModels).toEqual([]);
  });
});
