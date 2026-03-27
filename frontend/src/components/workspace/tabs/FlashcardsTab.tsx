import { useCallback, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { humanApiError } from "@/api/client";
import { generateFlashcards } from "@/api/openrag";
import type { FlashcardItem } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useWorkspace } from "@/context/WorkspaceContext";

export function FlashcardsTab({ userId }: { userId: string }) {
  const { scope } = useWorkspace();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await generateFlashcards(userId, {
        scope,
        topic: topic.trim() || null,
        count: 10,
      });
      setCards(res.flashcards);
      setI(0);
      setFlipped(false);
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const card = cards[i];
  const touch = useRef<{ x: number } | null>(null);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight" && i < cards.length - 1) {
        setI((x) => x + 1);
        setFlipped(false);
      }
      if (e.key === "ArrowLeft" && i > 0) {
        setI((x) => x - 1);
        setFlipped(false);
      }
    },
    [cards.length, i],
  );

  return (
    <div
      className="space-y-4"
      tabIndex={0}
      onKeyDown={(e) => onKey(e.nativeEvent)}
      role="region"
      aria-label="Flashcards"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-zinc-500">Topic (optional)</label>
          <Input className="mt-1" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <Button disabled={loading} onClick={() => void generate()}>
          {loading ? <Spinner className="h-4 w-4 text-white" /> : <Layers className="h-4 w-4" />}
          Generate
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {card ? (
        <div
          className="mx-auto max-w-lg"
          onTouchStart={(e) => {
            touch.current = { x: e.touches[0].clientX };
          }}
          onTouchEnd={(e) => {
            const start = touch.current?.x;
            touch.current = null;
            if (start == null) return;
            const dx = e.changedTouches[0].clientX - start;
            if (dx < -48 && i < cards.length - 1) {
              setI((x) => x + 1);
              setFlipped(false);
            }
            if (dx > 48 && i > 0) {
              setI((x) => x - 1);
              setFlipped(false);
            }
          }}
        >
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="relative min-h-[200px] w-full"
            style={{ perspective: "1000px" }}
          >
            <div
              className="relative h-full min-h-[200px] w-full transition-transform duration-300"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 shadow-card"
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Front</p>
                <p className="mt-3 text-center text-lg font-medium text-zinc-900">{card.front}</p>
                <p className="mt-4 text-xs text-zinc-400">Tap to flip · ← → keys</p>
              </div>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50/80 p-6 shadow-card"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600/80">Back</p>
                <p className="mt-3 text-center text-lg text-indigo-950">{card.back}</p>
              </div>
            </div>
          </button>
          <div className="mt-4 flex justify-between text-xs text-zinc-500">
            <Button variant="ghost" className="text-xs" disabled={i === 0} onClick={() => { setI((x) => x - 1); setFlipped(false); }}>
              Previous
            </Button>
            <span>
              {i + 1} / {cards.length}
            </span>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={i >= cards.length - 1}
              onClick={() => {
                setI((x) => x + 1);
                setFlipped(false);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
