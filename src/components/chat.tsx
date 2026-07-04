"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  interviewId: string;
  initialMessages: ChatMessage[];
  readOnly?: boolean;
};

export function Chat({ interviewId, initialMessages, readOnly = false }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const hasScrolledInitiallyRef = useRef(false);

  const NEAR_BOTTOM_THRESHOLD_PX = 150;

  // Rastrea si el usuario está cerca del final, actualizado por sus propios
  // scrolls (no por el crecimiento del contenido, que no dispara "scroll").
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isNearBottomRef.current) return;

    if (!hasScrolledInitiallyRef.current) {
      // Primera carga: ya arranca abajo del todo, sin animación.
      el.scrollTop = el.scrollHeight;
      hasScrolledInitiallyRef.current = true;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      { id: assistantMsgId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/interview/${interviewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || "Error en la respuesta");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reportReady = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let evt: { type: string; text?: string; error?: string };
          try {
            evt = JSON.parse(json);
          } catch {
            continue;
          }
          if (evt.type === "text" && evt.text) {
            const delta = evt.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            );
          } else if (evt.type === "report_ready") {
            reportReady = true;
          } else if (evt.type === "error") {
            setError(evt.error ?? "Error desconocido");
          }
        }
      }

      if (reportReady) {
        router.push(`/interview/${interviewId}/report`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8"
      >
        <div className="flex flex-col gap-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {isStreaming &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" && (
              <div className="text-sm text-zinc-500">El asesor está pensando…</div>
            )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!readOnly && (
        <form
          onSubmit={send}
          className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50/80 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        >
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Escribe tu respuesta…"
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={isStreaming || input.trim().length === 0}
              className="rounded-2xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Enviar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
