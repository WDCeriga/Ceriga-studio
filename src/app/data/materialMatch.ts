export type MaterialLike = {
  id: string;
  name: string;
  kind: string;
  colour?: string;
  gsm?: number;
  quantity: number;
  unit: string;
  reorderAt: number;
  notes?: string;
};

export type MaterialMatchResult = {
  material: MaterialLike;
  score: number;
  reasons: string[];
  lowStock: boolean;
};

/** Loose match of order fabric notes / requirements against factory stock. */
export function matchMaterialsToOrder(
  materials: MaterialLike[],
  fabricNotes: string,
  specialRequirements: string[] = [],
): MaterialMatchResult[] {
  const hay = `${fabricNotes} ${specialRequirements.join(' ')}`.toLowerCase();
  const tokens = hay
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const gsmMatch = hay.match(/(\d{2,4})\s*gsm/i);
  const targetGsm = gsmMatch ? Number(gsmMatch[1]) : null;

  const results: MaterialMatchResult[] = [];

  for (const material of materials) {
    const reasons: string[] = [];
    let score = 0;
    const blob = [
      material.name,
      material.colour,
      material.notes,
      material.kind,
      material.gsm != null ? `${material.gsm}gsm` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const token of tokens) {
      if (blob.includes(token)) {
        score += token.length > 4 ? 3 : 1;
        if (!reasons.includes(`Matches “${token}”`)) reasons.push(`Matches “${token}”`);
      }
    }

    if (targetGsm != null && material.gsm != null) {
      const delta = Math.abs(material.gsm - targetGsm);
      if (delta === 0) {
        score += 8;
        reasons.push(`Exact ${material.gsm}gsm`);
      } else if (delta <= 40) {
        score += 4;
        reasons.push(`Near GSM (${material.gsm} vs ${targetGsm})`);
      }
    }

    if (material.kind === 'fabric' && /fleece|terry|twill|jersey|cotton|organic/i.test(hay)) {
      if (/fleece|terry|twill|jersey|cotton|organic/i.test(blob)) score += 2;
    }

    if (score > 0) {
      results.push({
        material,
        score,
        reasons: reasons.slice(0, 3),
        lowStock: material.quantity <= material.reorderAt,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}
