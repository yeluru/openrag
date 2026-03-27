import type { StructureNode } from "@/api/types";

export function findSectionLabel(nodes: StructureNode[], id: string | null): string | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n.label || null;
    if (n.children?.length) {
      const inner = findSectionLabel(n.children, id);
      if (inner) return inner;
    }
  }
  return null;
}
