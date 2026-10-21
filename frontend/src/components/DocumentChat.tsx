"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/chat";

type Props = {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  /** Sends a message; resolves to false when it failed, so the text is put back. */
  onSend: (text: string) => Promise<boolean>;
};

export function DocumentChat({ messages, pending, error, onSend }: Props) {
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    // Put the message back so the user can retry without retyping it.
    if (!(await onSend(text))) setInput(text);
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
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-brand-navy">
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
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto rounded-br-sm bg-brand-primary text-white"
                : "rounded-bl-sm bg-slate-100 text-slate-800"
            }`}
          >
            {message.content}
          </p>
        ))}
        {pending && (
          <p role="status" className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gray"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
            <span className="sr-only">The assistant is typing…</span>
          </p>
        )}
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
            className="block w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-md bg-brand-secondary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
