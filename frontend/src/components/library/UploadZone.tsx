import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { SupportedFormatsResponse } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  buildFileInputAccept,
  FALLBACK_SUPPORTED_FORMATS,
  isFileAllowedForIngest,
} from "@/lib/documentFormats";

type Props = {
  onFile: (file: File) => Promise<void>;
  disabled?: boolean;
  /** From GET /documents/supported-formats; until loaded, PDF-only fallback is used. */
  supportedFormats?: SupportedFormatsResponse | null;
};

export function UploadZone({ onFile, disabled, supportedFormats }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const formats = supportedFormats ?? FALLBACK_SUPPORTED_FORMATS;
  const accept = buildFileInputAccept(formats);
  const extHint = formats.extensions.join(", ") || ".pdf";

  const handle = useCallback(
    async (files: FileList | null) => {
      const f = files?.[0];
      if (!f || disabled || busy) return;
      if (!isFileAllowedForIngest(f, formats)) {
        return;
      }
      setBusy(true);
      try {
        await onFile(f);
      } finally {
        setBusy(false);
      }
    },
    [disabled, busy, onFile, formats],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void handle(e.dataTransfer.files);
      }}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-colors ${
        drag
          ? "border-indigo-400 bg-indigo-50/50"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        {busy ? <Spinner className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
      </div>
      <p className="mt-4 text-center text-sm font-medium text-zinc-800">Drop a file here</p>
      <p className="mt-1 text-center text-xs text-zinc-500">
        Supported types: {extHint}
        <span className="block">or choose a file from your device</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void handle(e.target.files)}
      />
      <Button
        variant="primary"
        className="mt-6"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        Browse files
      </Button>
    </div>
  );
}
