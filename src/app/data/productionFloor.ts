import { getFactoryWorkspace } from './manufacturerPortalMock';

/** Shared production floor + QC photos — factory, brand, and superadmin all read this. */

export type ProductionStage = 'cut' | 'sew' | 'finish' | 'pack' | 'ship' | 'done';

export type ProductionPhoto = {
  id: string;
  url: string;
  caption: string;
  stage: ProductionStage;
  uploadedAt: string;
  uploadedBy: string;
  /** When true, brand + Ceriga can see it. */
  published: boolean;
};

export type ProductionJob = {
  id: string;
  /** Factory portal order id */
  factoryOrderId: string;
  /** Brand / user orders portal id (optional link) */
  brandOrderId?: string;
  /** Superadmin order id (optional link) */
  superadminOrderId?: string;
  brandName: string;
  productName: string;
  garmentType: string;
  stage: ProductionStage;
  dueAt: string;
  units: number;
  assigneeId?: string;
  assigneeName?: string;
  notes?: string;
  photos: ProductionPhoto[];
  updatedAt: string;
};

export const PRODUCTION_STAGES: ProductionStage[] = [
  'cut',
  'sew',
  'finish',
  'pack',
  'ship',
  'done',
];

export const PRODUCTION_STAGE_LABEL: Record<ProductionStage, string> = {
  cut: 'Cut',
  sew: 'Sew',
  finish: 'Finish',
  pack: 'Pack',
  ship: 'Ship',
  done: 'Done',
};

export function getProductionStorageKey(): string {
  if (typeof window === 'undefined') return 'ceriga_production_floor_v7';
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email) {
        const safeEmail = parsed.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        return `ceriga_production_floor_${safeEmail}`;
      }
    }
  } catch {
    /* ignore */
  }
  return 'ceriga_production_floor_v7';
}

export const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop',
];

export function seedJobs(): ProductionJob[] {
  return [
    {
      id: 'job-210',
      factoryOrderId: 'ord-m-210',
      brandOrderId: 'ord-001',
      brandName: 'Acme Clothing',
      productName: 'Crewneck sweat restock',
      garmentType: 'Sweatshirts',
      stage: 'sew',
      dueAt: '2026-04-20',
      units: 300,
      assigneeId: 'tm3',
      assigneeName: 'Tom Reed',
      notes: 'Same trim as PO-228',
      updatedAt: '2026-04-12',
      photos: [
        {
          id: 'ph-1',
          url: SAMPLE_PHOTOS[0],
          caption: 'Cut complete — panels checked',
          stage: 'cut',
          uploadedAt: '2026-04-09T10:00:00Z',
          uploadedBy: 'Tom Reed',
          published: true,
        },
        {
          id: 'ph-2',
          url: SAMPLE_PHOTOS[1],
          caption: 'Sew line — body assembled',
          stage: 'sew',
          uploadedAt: '2026-04-11T15:30:00Z',
          uploadedBy: 'Tom Reed',
          published: true,
        },
      ],
    },
    {
      id: 'job-204',
      factoryOrderId: 'ord-m-204',
      brandOrderId: 'ord-004',
      superadminOrderId: 'ord-1005',
      brandName: 'Blank Collective',
      productName: 'Heavyweight zip-up capsule',
      garmentType: 'Zip-ups',
      stage: 'pack',
      dueAt: '2026-04-16',
      units: 150,
      assigneeId: 'tm3',
      assigneeName: 'Tom Reed',
      updatedAt: '2026-04-11',
      photos: [
        {
          id: 'ph-3',
          url: SAMPLE_PHOTOS[2],
          caption: 'QC hangtag + polybag',
          stage: 'pack',
          uploadedAt: '2026-04-11T09:00:00Z',
          uploadedBy: 'Priya Shah',
          published: true,
        },
      ],
    },
    {
      id: 'job-172',
      factoryOrderId: 'ord-m-172',
      brandOrderId: 'ord-003',
      brandName: 'Urban Layer Ltd',
      productName: 'Jogger first drop',
      garmentType: 'Joggers',
      stage: 'done',
      dueAt: '2026-02-05',
      units: 120,
      assigneeId: 'tm1',
      assigneeName: 'James Hale',
      updatedAt: '2026-02-03',
      photos: [
        {
          id: 'ph-4',
          url: SAMPLE_PHOTOS[3],
          caption: 'Final QC — ready to ship',
          stage: 'done',
          uploadedAt: '2026-02-02T16:00:00Z',
          uploadedBy: 'James Hale',
          published: true,
        },
      ],
    },
    {
      id: 'job-1002',
      factoryOrderId: 'ord-1002',
      brandOrderId: 'ord-002',
      superadminOrderId: 'ord-1002',
      brandName: 'Acme Clothing',
      productName: 'Oversized hoodie run',
      garmentType: 'Hoodies',
      stage: 'cut',
      dueAt: '2026-04-22',
      units: 250,
      assigneeId: 'tm2',
      assigneeName: 'Priya Shah',
      notes: 'Waiting fabric confirm before full cut',
      updatedAt: '2026-04-12',
      photos: [],
    },
  ];
}

function loadJobs(targetKey?: string): ProductionJob[] {
  const key = targetKey ?? getProductionStorageKey();
  const isDemo = key === 'ceriga_production_floor_v7';

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as ProductionJob[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }

  if (isDemo) {
    return seedJobs();
  }

  // Check if active factory workspace has any production orders
  try {
    const ws = getFactoryWorkspace();
    const productionOrders = (ws.orders ?? []).filter(
      (o) => o.status === 'in_production' || o.status === 'completed',
    );
    if (productionOrders.length > 0) {
      const initialJobs: ProductionJob[] = productionOrders.map((o) => ({
        id: `job-${o.id}`,
        factoryOrderId: o.id,
        brandName: o.brandName,
        productName: o.productName,
        garmentType: o.garmentType,
        stage: o.status === 'completed' ? 'done' : 'sew',
        dueAt: o.dueQuoteBy || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        units: o.capacityUnitsEstimate || 100,
        assigneeId: ws.team?.[0]?.id,
        assigneeName: ws.team?.[0]?.name,
        notes: o.fabricNotes || '',
        photos: [],
        updatedAt: new Date().toISOString().slice(0, 10),
      }));
      return initialJobs;
    }
  } catch {
    /* ignore */
  }

  return [];
}

let activeStorageKey =
  typeof window !== 'undefined' ? getProductionStorageKey() : 'ceriga_production_floor_v7';
let jobs: ProductionJob[] =
  typeof window !== 'undefined' ? loadJobs(activeStorageKey) : seedJobs();

function syncJobs(): ProductionJob[] {
  const currentKey = getProductionStorageKey();
  if (currentKey !== activeStorageKey) {
    activeStorageKey = currentKey;
    jobs = loadJobs(currentKey);
  }
  return jobs;
}

function persist() {
  try {
    const key = getProductionStorageKey();
    localStorage.setItem(key, JSON.stringify(jobs));
  } catch {
    /* ignore — data URLs can be large */
  }
}

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ceriga-production-floor'));
  }
}

export function listProductionJobs(): ProductionJob[] {
  syncJobs();
  return [...jobs].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function getProductionJob(id: string): ProductionJob | undefined {
  syncJobs();
  return jobs.find((j) => j.id === id);
}

/** Resolve job by factory, brand, or superadmin order id. */
export function getProductionJobForOrder(orderId: string): ProductionJob | undefined {
  syncJobs();
  const direct = jobs.find(
    (j) =>
      j.factoryOrderId === orderId ||
      j.brandOrderId === orderId ||
      j.superadminOrderId === orderId,
  );
  if (direct) return direct;

  // Search across other stored production floor keys (e.g. when brand or superadmin is viewing)
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ceriga_production_floor_') && key !== activeStorageKey) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw) as ProductionJob[];
            if (Array.isArray(list)) {
              const match = list.find(
                (j) =>
                  j.factoryOrderId === orderId ||
                  j.brandOrderId === orderId ||
                  j.superadminOrderId === orderId,
              );
              if (match) return match;
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Also check demo seed jobs
  return seedJobs().find(
    (j) =>
      j.factoryOrderId === orderId ||
      j.brandOrderId === orderId ||
      j.superadminOrderId === orderId,
  );
}

export function listPublishedPhotosForOrder(orderId: string): ProductionPhoto[] {
  const job = getProductionJobForOrder(orderId);
  if (!job) return [];
  return job.photos
    .filter((p) => p.published)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function createProductionJob(input: {
  productName: string;
  brandName: string;
  garmentType: string;
  units: number;
  stage?: ProductionStage;
  dueAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  notes?: string;
  factoryOrderId?: string;
}): ProductionJob {
  syncJobs();
  const id = `job-${Date.now()}`;
  const now = new Date().toISOString().slice(0, 10);
  const newJob: ProductionJob = {
    id,
    factoryOrderId: input.factoryOrderId || `ord-custom-${Date.now().toString().slice(-4)}`,
    productName: input.productName.trim(),
    brandName: input.brandName.trim(),
    garmentType: input.garmentType.trim() || 'Hoodies',
    units: Number(input.units) || 50,
    stage: input.stage || 'cut',
    dueAt: input.dueAt || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    notes: input.notes?.trim() || '',
    photos: [],
    updatedAt: now,
  };
  jobs = [newJob, ...jobs];
  persist();
  notify();
  return newJob;
}

export function deleteProductionJob(id: string): boolean {
  syncJobs();
  const before = jobs.length;
  jobs = jobs.filter((j) => j.id !== id);
  if (jobs.length !== before) {
    persist();
    notify();
    return true;
  }
  return false;
}

export function resetProductionJobsToDemo(): ProductionJob[] {
  jobs = seedJobs();
  persist();
  notify();
  return jobs;
}

export function updateProductionJob(
  id: string,
  patch: Partial<Omit<ProductionJob, 'id' | 'photos'>>,
): ProductionJob | undefined {
  syncJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return undefined;
  const next = {
    ...jobs[idx],
    ...patch,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  jobs = jobs.map((j, i) => (i === idx ? next : j));
  persist();
  notify();
  return next;
}

export function moveProductionJobStage(
  id: string,
  stage: ProductionStage,
): ProductionJob | undefined {
  return updateProductionJob(id, { stage });
}

export function assignProductionJob(
  id: string,
  assignee: { id: string; name: string } | null,
): ProductionJob | undefined {
  return updateProductionJob(id, {
    assigneeId: assignee?.id,
    assigneeName: assignee?.name,
  });
}

export function addProductionPhoto(
  jobId: string,
  input: {
    url: string;
    caption: string;
    stage: ProductionStage;
    uploadedBy: string;
    published: boolean;
  },
): ProductionPhoto | undefined {
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return undefined;
  const photo: ProductionPhoto = {
    id: `ph-${Date.now()}`,
    url: input.url,
    caption: input.caption.trim() || 'Production photo',
    stage: input.stage,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy,
    published: input.published,
  };
  const next = {
    ...jobs[idx],
    photos: [...jobs[idx].photos, photo],
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  jobs = jobs.map((j, i) => (i === idx ? next : j));
  persist();
  notify();
  return photo;
}

export function publishProductionPhoto(
  jobId: string,
  photoId: string,
  published = true,
): ProductionPhoto | undefined {
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return undefined;
  const photos = jobs[idx].photos.map((p) =>
    p.id === photoId ? { ...p, published } : p,
  );
  const photo = photos.find((p) => p.id === photoId);
  jobs = jobs.map((j, i) =>
    i === idx ? { ...j, photos, updatedAt: new Date().toISOString().slice(0, 10) } : j,
  );
  persist();
  notify();
  return photo;
}

export function removeProductionPhoto(jobId: string, photoId: string): boolean {
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return false;
  const before = jobs[idx].photos.length;
  const photos = jobs[idx].photos.filter((p) => p.id !== photoId);
  if (photos.length === before) return false;
  jobs = jobs.map((j, i) =>
    i === idx ? { ...j, photos, updatedAt: new Date().toISOString().slice(0, 10) } : j,
  );
  persist();
  notify();
  return true;
}

export function productionStageIndex(stage: ProductionStage): number {
  return PRODUCTION_STAGES.indexOf(stage);
}

export function nextProductionStage(stage: ProductionStage): ProductionStage | null {
  const i = productionStageIndex(stage);
  if (i < 0 || i >= PRODUCTION_STAGES.length - 1) return null;
  return PRODUCTION_STAGES[i + 1];
}

export function prevProductionStage(stage: ProductionStage): ProductionStage | null {
  const i = productionStageIndex(stage);
  if (i <= 0) return null;
  return PRODUCTION_STAGES[i - 1];
}
