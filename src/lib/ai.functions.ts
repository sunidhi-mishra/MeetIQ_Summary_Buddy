import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CALL_1_SYSTEM_PROMPT,
  CALL_2_SYSTEM_PROMPT,
  type MeetingAnalysis,
} from "@/lib/analysis";

const AnalyzeInput = z.object({
  title: z.string().min(1),
  transcript: z.string().min(1),
});

// Reads an SSE stream from the Responses API and returns the final output text.
async function readResponsesStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";

  const handleEvent = (rawEvent: string) => {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    if (payload === "[DONE]") return;
    try {
      const event = JSON.parse(payload);
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        outputText += event.delta;
      }
      if (event.type === "response.completed" && event.response?.output_text) {
        outputText = event.response.output_text;
      }
      if (event.type === "response.failed") {
        throw new Error(event.response?.error?.message ?? "The model call failed.");
      }
    } catch (error) {
      if (error instanceof SyntaxError) return; // ignore partial JSON
      throw error;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      handleEvent(rawEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  return outputText;
}

export const analyzeTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<MeetingAnalysis> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: CALL_1_SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Meeting title: ${data.title}\n\nTranscript:\n${data.transcript}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Analysis request failed (${res.status}). ${detail.slice(0, 200)}`.trim(),
      );
    }

    const raw = await readResponsesStream(res.body);
    if (!raw.trim()) throw new Error("The model returned an empty response.");

    // Strip code fences defensively, then parse the JSON object.
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    let parsed: MeetingAnalysis;
    try {
      parsed = JSON.parse(cleaned) as MeetingAnalysis;
    } catch {
      throw new Error("The model did not return valid JSON. Please try again.");
    }
    if (!parsed.summary || !Array.isArray(parsed.commitments)) {
      throw new Error("The analysis response was incomplete. Please try again.");
    }
    return parsed;
  });

const AskInput = z.object({
  analysisJson: z.string(),
  question: z.string().min(1),
});

export const askMeetingQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }): Promise<string> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: CALL_2_SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Meeting analysis: ${data.analysisJson}\n\nUser question: ${data.question}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Ask request failed (${res.status}). ${detail.slice(0, 200)}`.trim(),
      );
    }

    const raw = await readResponsesStream(res.body);
    if (!raw.trim()) throw new Error("The model returned an empty response.");
    return raw.trim();
  });
