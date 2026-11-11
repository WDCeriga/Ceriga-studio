export const PORTFOLIO_IMAGE_LIMIT = 100;
export const isPortfolioImage = (file: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

type Entry = {
  isFile: boolean;
  file: (success: (file: File) => void, error: (error: DOMException) => void) => void;
  createReader: () => { readEntries: (success: (entries: Entry[]) => void, error: (error: DOMException) => void) => void };
};

// Directory readers return batches; keep reading until the browser returns an empty batch.
export async function droppedPortfolioFiles(transfer: DataTransfer): Promise<File[]> {
  const items = Array.from(transfer.items || []);
  const roots = items.map(item => (item as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.()).filter(Boolean) as Entry[];
  if (!roots.length) return Array.from(transfer.files);
  const files: File[] = [];
  async function walk(entry: Entry) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
      if (isPortfolioImage(file)) files.push(file);
      if (files.length > PORTFOLIO_IMAGE_LIMIT) throw new Error(`Choose up to ${PORTFOLIO_IMAGE_LIMIT} images per example. Split larger folders into separate examples.`);
    } else {
      const reader = entry.createReader();
      while (true) {
        const batch = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child);
      }
    }
  }
  for (const root of roots) await walk(root);
  return files;
}

export function uniquePortfolioImages(files: File[]): File[] {
  const seen = new Set<string>();
  return files.filter(file => {
    const key = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
    if (!isPortfolioImage(file) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
