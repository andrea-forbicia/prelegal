"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { todayIso, type NdaForm } from "@/lib/cover-page";
import {
  ChatError,
  GREETING,
  MAX_MESSAGE_LENGTH,
  sendNdaChat,
  type ChatMessage,
} from "@/lib/nda-chat";

type Props = {
  form: NdaForm;
  onFormChange: (form: NdaForm) => void;
};

export function NdaChat({ form, onFormChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  // Abort an in-flight turn when the chat unmounts.
  useEffect(() => () => requestRef.current?.abort(), []);

  // Keep the latest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages(history);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const turn = await sendNdaChat(history, form, todayIso(), controller.signal);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      onFormChange(turn.form);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      // Put the message back so the user can retry without retyping it.
      setMessages(messages);
      setInput(text);
      setError(err instanceof ChatError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-[#032147]">
        Drafting assistant
      </h2>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((message, index) => (
          <p
            key={index}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-[#209dd7] text-white"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            {message.content}
          </p>
        ))}
        {pending && <p className="text-sm text-[#888888]">Thinking…</p>}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Message"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Type your answer…"
            className="block w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white hover:bg-[#5f2e76] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
