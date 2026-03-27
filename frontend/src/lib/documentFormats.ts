import type { SupportedFormatsResponse } from "@/api/types";

/** Used when GET /documents/supported-formats has not loaded or failed. */
export const FALLBACK_SUPPORTED_FORMATS: SupportedFormatsResponse = {
  parsers: [],
  canonical_mime_types: ["application/pdf"],
  extensions: [".pdf"],
  upload_content_types: ["application/pdf", "application/octet-stream"],
};

/** Human-readable extension list for UI hints (truncated if very long). */
export function formatExtensionsHint(formats: SupportedFormatsResponse, maxShown = 10): string {
  const exts = formats.extensions.filter(Boolean);
  if (exts.length === 0) return ".pdf";
  if (exts.length <= maxShown) return exts.join(", ");
  return `${exts.slice(0, maxShown).join(", ")}, …`;
}

/** Whether the file is allowed client-side before POST (mirrors server registry). */
export function isFileAllowedForIngest(file: File, formats: SupportedFormatsResponse): boolean {
  const lower = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (type && formats.upload_content_types.includes(type)) {
    if (type === "application/octet-stream") {
      return formats.extensions.some((e) => lower.endsWith(e.toLowerCase()));
    }
    return true;
  }
  return formats.extensions.some((e) => lower.endsWith(e.toLowerCase()));
}

export function buildFileInputAccept(formats: SupportedFormatsResponse): string {
  const parts = [...new Set([...formats.extensions, ...formats.upload_content_types])];
  return parts.join(",");
}
