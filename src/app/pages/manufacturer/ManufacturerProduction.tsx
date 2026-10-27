import { ReleasedProductionOrders } from '../../components/manufacturer/ReleasedProductionOrders';
import { QualityControlQueue } from '../../components/quality/QualityControlQueue';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Maximize2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_FACTORY_GARMENTS,
  getFactoryWorkspace,
  type FactoryOrder,
} from '../../data/manufacturerPortalMock';
import {
  PRODUCTION_STAGE_LABEL,
  PRODUCTION_STAGES,
  SAMPLE_PHOTOS,
  addProductionPhoto,
  assignProductionJob,
  createProductionJob,
  deleteProductionJob,
  listProductionJobs,
  moveProductionJobStage,
  nextProductionStage,
  prevProductionStage,
  publishProductionPhoto,
  removeProductionPhoto,
  resetProductionJobsToDemo,
  updateProductionJob,
  type ProductionJob,
  type ProductionPhoto,
  type ProductionStage,
} from '../../data/productionFloor';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

function formatDue(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function isOverdue(job: ProductionJob) {
  if (job.stage === 'done') return false;
  return job.dueAt < new Date().toISOString().slice(0, 10);
}

export function ManufacturerProduction() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener('ceriga-production-floor', onUpdate);
    return () => window.removeEventListener('ceriga-production-floor', onUpdate);
  }, []);

  const ws = getFactoryWorkspace();
  const jobs = listProductionJobs();
  const team = ws.team.filter((t) => t.status === 'active');
  const availableOrders = ws.orders ?? [];

  // Filtering & search
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const selected = useMemo(() => {
    return jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;
  }, [jobs, selectedId, tick]);

  // Drag and Drop state
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ProductionStage | null>(null);

  // Create Job Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newJobMode, setNewJobMode] = useState<'custom' | 'order'>('custom');
  const [newSelectedOrderId, setNewSelectedOrderId] = useState<string>('');
  const [newProductName, setNewProductName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newGarmentType, setNewGarmentType] = useState('Hoodies');
  const [newUnits, setNewUnits] = useState('100');
  const [newStage, setNewStage] = useState<ProductionStage>('cut');
  const [newDueAt, setNewDueAt] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const [newAssigneeId, setNewAssigneeId] = useState<string>('unassigned');
  const [newNotes, setNewNotes] = useState('');

  // Edit Job Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProductName, setEditProductName] = useState('');
  const [editBrandName, setEditBrandName] = useState('');
  const [editGarmentType, setEditGarmentType] = useState('');
  const [editUnits, setEditUnits] = useState('100');
  const [editStage, setEditStage] = useState<ProductionStage>('cut');
  const [editDueAt, setEditDueAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState<string>('unassigned');

  // Delete Job Confirm
  const [deleteJobConfirm, setDeleteJobConfirm] = useState<ProductionJob | null>(null);

  // QC Photos
  const [photoConfirmOpen, setPhotoConfirmOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    url: string;
    caption: string;
    stage: ProductionStage;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [photoStage, setPhotoStage] = useState<ProductionStage>('sew');
  const [publishRemove, setPublishRemove] = useState<{
    photoId: string;
    action: 'publish' | 'unpublish' | 'remove';
  } | null>(null);

  // Lightbox Modal
  const [lightboxPhoto, setLightboxPhoto] = useState<ProductionPhoto | null>(null);

  useEffect(() => {
    if (selected) {
      setPhotoStage(selected.stage);
    }
  }, [selected?.id, selected?.stage]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesQuery =
          j.productName.toLowerCase().includes(q) ||
          j.brandName.toLowerCase().includes(q) ||
          j.garmentType.toLowerCase().includes(q) ||
          j.factoryOrderId.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned') {
          if (j.assigneeId) return false;
        } else if (j.assigneeId !== filterAssignee) {
          return false;
        }
      }
      if (filterOverdue && !isOverdue(j)) {
        return false;
      }
      return true;
    });
  }, [jobs, search, filterAssignee, filterOverdue]);

  const byStage = (stage: ProductionStage) =>
    filteredJobs.filter((j) => j.stage === stage);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingJobId(id);
  };

  const handleDragEnd = () => {
    setDraggingJobId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: ProductionStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (stage: ProductionStage) => {
    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: ProductionStage) => {
    e.preventDefault();
    setDragOverStage(null);
    setDraggingJobId(null);
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.stage === targetStage) return;

    moveProductionJobStage(jobId, targetStage);
    refresh();
    toast.success(`Moved ${job.productName} to ${PRODUCTION_STAGE_LABEL[targetStage]}`);
  };

  // Quick move stage without confirm dialog
  const quickMove = (e: React.MouseEvent, job: ProductionJob, targetStage: ProductionStage) => {
    e.stopPropagation();
    moveProductionJobStage(job.id, targetStage);
    refresh();
    toast.success(`Moved to ${PRODUCTION_STAGE_LABEL[targetStage]}`);
  };

  // Assignee change
  const onAssignee = (jobId: string, memberId: string) => {
    if (memberId === 'unassigned') {
      assignProductionJob(jobId, null);
    } else {
      const m = team.find((t) => t.id === memberId);
      if (!m) return;
      assignProductionJob(jobId, { id: m.id, name: m.name });
    }
    refresh();
    toast.success('Assignee updated');
  };

  // Create job open
  const openCreateDialog = (initialStage?: ProductionStage) => {
    setNewJobMode('custom');
    setNewSelectedOrderId('');
    setNewProductName('');
    setNewBrandName('');
    setNewGarmentType(ws.garments?.[0] || 'Hoodies');
    setNewUnits('100');
    setNewStage(initialStage ?? 'cut');
    setNewDueAt(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    setNewAssigneeId(team[0]?.id || 'unassigned');
    setNewNotes('');
    setCreateDialogOpen(true);
  };

  const handleSelectOrderForNewJob = (orderId: string) => {
    setNewSelectedOrderId(orderId);
    const ord = availableOrders.find((o) => o.id === orderId);
    if (ord) {
      setNewProductName(ord.productName);
      setNewBrandName(ord.brandName);
      setNewGarmentType(ord.garmentType);
      setNewUnits(String(ord.capacityUnitsEstimate || 100));
      setNewDueAt(ord.dueQuoteBy || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
      setNewNotes(ord.fabricNotes || '');
    }
  };

  const handleCreateJob = () => {
    if (!newProductName.trim()) {
      toast.error('Please enter a product name');
      return;
    }
    if (!newBrandName.trim()) {
      toast.error('Please enter a brand or client name');
      return;
    }
    const assignee = team.find((m) => m.id === newAssigneeId);
    const created = createProductionJob({
      productName: newProductName.trim(),
      brandName: newBrandName.trim(),
      garmentType: newGarmentType,
      units: Number(newUnits) || 50,
      stage: newStage,
      dueAt: newDueAt,
      assigneeId: assignee?.id,
      assigneeName: assignee?.name,
      notes: newNotes.trim(),
      factoryOrderId: newSelectedOrderId || undefined,
    });
    setCreateDialogOpen(false);
    setSelectedId(created.id);
    refresh();
    toast.success(`Created job "${created.productName}"`);
  };

  // Edit job open
  const openEditDialog = (job: ProductionJob) => {
    setEditProductName(job.productName);
    setEditBrandName(job.brandName);
    setEditGarmentType(job.garmentType);
    setEditUnits(String(job.units));
    setEditStage(job.stage);
    setEditDueAt(job.dueAt);
    setEditNotes(job.notes || '');
    setEditAssigneeId(job.assigneeId || 'unassigned');
    setEditDialogOpen(true);
  };

  const handleSaveEditJob = () => {
    if (!selected) return;
    if (!editProductName.trim()) {
      toast.error('Product name cannot be empty');
      return;
    }
    const assignee = team.find((m) => m.id === editAssigneeId);
    updateProductionJob(selected.id, {
      productName: editProductName.trim(),
      brandName: editBrandName.trim(),
      garmentType: editGarmentType.trim() || 'Hoodies',
      units: Number(editUnits) || 50,
      stage: editStage,
      dueAt: editDueAt,
      notes: editNotes.trim(),
      assigneeId: assignee?.id,
      assigneeName: assignee?.name,
    });
    setEditDialogOpen(false);
    refresh();
    toast.success('Production job details updated');
  };

  // Delete job
  const handleDeleteJob = () => {
    if (!deleteJobConfirm) return;
    deleteProductionJob(deleteJobConfirm.id);
    if (selectedId === deleteJobConfirm.id) {
      setSelectedId(null);
    }
    setDeleteJobConfirm(null);
    refresh();
    toast.success('Job removed from production floor');
  };

  // Photos
  const queueSamplePhoto = () => {
    if (!selected) return;
    const url = SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)];
    setPendingPhoto({
      url,
      caption: caption.trim() || `${PRODUCTION_STAGE_LABEL[photoStage]} check`,
      stage: photoStage,
    });
    setPhotoConfirmOpen(true);
  };

  const onFile = (file: File | null) => {
    if (!file || !selected) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      return;
    }
    if (file.size > 2_000_000) {
      toast.error('Keep photos under ~2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      setPendingPhoto({
        url,
        caption: caption.trim() || file.name,
        stage: photoStage,
      });
      setPhotoConfirmOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const confirmAddPhoto = () => {
    if (!selected || !pendingPhoto) return;
    addProductionPhoto(selected.id, {
      ...pendingPhoto,
      uploadedBy: ws.contactName || 'Production team',
      published: true,
    });
    setPendingPhoto(null);
    setCaption('');
    setPhotoConfirmOpen(false);
    refresh();
    toast.success('Photo published to brand and Ceriga');
  };

  const confirmPhotoAction = () => {
    if (!selected || !publishRemove) return;
    if (publishRemove.action === 'remove') {
      removeProductionPhoto(selected.id, publishRemove.photoId);
      if (lightboxPhoto?.id === publishRemove.photoId) {
        setLightboxPhoto(null);
      }
      toast.success('Photo removed');
    } else {
      const published = publishRemove.action === 'publish';
      publishProductionPhoto(selected.id, publishRemove.photoId, published);
      if (lightboxPhoto?.id === publishRemove.photoId) {
        setLightboxPhoto((prev) => (prev ? { ...prev, published } : null));
      }
      toast.success(published ? 'Photo published' : 'Photo hidden from brand');
    }
    setPublishRemove(null);
    refresh();
  };

  const totalUnits = jobs.reduce((s, j) => s + (j.units || 0), 0);
  const overdueCount = jobs.filter(isOverdue).length;
  const activeCount = jobs.filter((j) => j.stage !== 'done').length;

  if (isSupabaseConfigured) return <div className="space-y-6"><header><p className="text-xs uppercase tracking-widest text-[#CC2D24]">Factory floor</p><h1 className="mt-2 text-3xl font-semibold text-white">Production</h1><p className="mt-2 text-sm text-white/50">Open an order to update production progress and report delays.</p></header><ReleasedProductionOrders /></div>;

  return (
    <div className="space-y-6">
      {isSupabaseConfigured && <ReleasedProductionOrders />}
      {isSupabaseConfigured && <QualityControlQueue compact />}
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <ClipboardList className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              Floor Kanban
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Production board
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Drag and drop jobs across cut, sew, finish, pack, ship, and done. Track units, upload QC
            photos, and keep production in sync with brands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {jobs.length === 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetProductionJobsToDemo();
                refresh();
                toast.success('Loaded demo production runs');
              }}
              className="border-white/15 text-white hover:bg-white/10"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Load demo runs
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => openCreateDialog()}
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      {/* KPI & Stage Quick Counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PRODUCTION_STAGES.map((stage) => {
          const count = byStage(stage).length;
          return (
            <div
              key={stage}
              className="rounded-xl border border-[#252528] bg-[#111113] p-3 transition hover:border-[#CC2D24]/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {PRODUCTION_STAGE_LABEL[stage]}
                </span>
                <span className="h-2 w-2 rounded-full bg-[#CC2D24]/60" />
              </div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-white">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#252528] bg-[#111113] p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, brand, garment, order ID..."
            className="border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/35"
          />
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[170px]">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="border-white/10 bg-white/5 text-xs text-white">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent className="border-[#252528] bg-[#161618] text-white">
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned Only</SelectItem>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={cn(
              'border-white/10 text-xs transition',
              filterOverdue
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                : 'bg-white/5 text-white/60 hover:text-white',
            )}
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Overdue ({overdueCount})
          </Button>

          {(search || filterAssignee !== 'all' || filterOverdue) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setFilterAssignee('all');
                setFilterOverdue(false);
              }}
              className="text-xs text-white/40 hover:text-white"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Kanban Columns + Details Sidebar */}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PRODUCTION_STAGES.map((stage) => {
            const stageJobs = byStage(stage);
            const isDragTarget = dragOverStage === stage;

            return (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={() => handleDragLeave(stage)}
                onDrop={(e) => handleDrop(e, stage)}
                className={cn(
                  'flex w-[270px] shrink-0 flex-col rounded-2xl border bg-[#0c0c0e] transition-all',
                  isDragTarget
                    ? 'border-[#CC2D24] bg-[#CC2D24]/10 ring-2 ring-[#CC2D24]/40'
                    : 'border-[#252528]',
                )}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-[#252528] px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                      {PRODUCTION_STAGE_LABEL[stage]}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                      {stageJobs.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateDialog(stage)}
                    title={`Add job in ${PRODUCTION_STAGE_LABEL[stage]}`}
                    className="rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Cards Container */}
                <div className="flex min-h-[480px] max-h-[640px] flex-col gap-2.5 overflow-y-auto p-2.5">
                  {stageJobs.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#252528] p-6 text-center">
                      <p className="text-[11px] font-medium text-white/30">Drag jobs here</p>
                      <button
                        type="button"
                        onClick={() => openCreateDialog(stage)}
                        className="mt-2 text-[11px] text-[#CC2D24] hover:underline"
                      >
                        + Add job
                      </button>
                    </div>
                  ) : (
                    stageJobs.map((job) => {
                      const isSelected = selected?.id === job.id;
                      const overdue = isOverdue(job);
                      const isDragging = draggingJobId === job.id;
                      const prevStage = prevProductionStage(job.stage);
                      const nextStage = nextProductionStage(job.stage);

                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedId(job.id)}
                          className={cn(
                            'group relative cursor-grab rounded-xl border p-3.5 text-left transition-all active:cursor-grabbing',
                            isDragging ? 'opacity-40 ring-2 ring-[#CC2D24]' : '',
                            isSelected
                              ? 'border-[#CC2D24] bg-[#CC2D24]/10 shadow-lg ring-1 ring-[#CC2D24]/30'
                              : 'border-[#252528] bg-[#111113] hover:border-white/20 hover:bg-[#151518]',
                          )}
                        >
                          {/* Drag handle & Order Header */}
                          <div className="flex items-center justify-between gap-1 text-[10px] text-white/40">
                            <div className="flex items-center gap-1">
                              <GripVertical className="h-3.5 w-3.5 text-white/20 group-hover:text-white/60" />
                              <span className="font-mono">{job.factoryOrderId}</span>
                            </div>
                            <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/50">
                              {job.garmentType}
                            </span>
                          </div>

                          {/* Product & Brand */}
                          <p className="mt-1.5 text-sm font-semibold text-white group-hover:text-white">
                            {job.productName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/45">{job.brandName}</p>

                          {/* Meta: Due, Units, Photos */}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 font-medium tabular-nums',
                                overdue
                                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
                                  : 'bg-white/5 text-white/55',
                              )}
                            >
                              Due {formatDue(job.dueAt)}
                            </span>
                            <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/55">
                              {job.units} u
                            </span>
                            {job.photos.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[#CC2D24]/15 px-1.5 py-0.5 font-medium text-red-200">
                                <Camera className="h-3 w-3" />
                                {job.photos.length}
                              </span>
                            ) : null}
                          </div>

                          {/* Assignee & Quick Move Controls */}
                          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
                            <div className="flex items-center gap-1.5 text-white/50">
                              <UserRound className="h-3 w-3 text-white/30" />
                              <span className="truncate max-w-[100px]">
                                {job.assigneeName || 'Unassigned'}
                              </span>
                            </div>

                            {/* Direct click stage transitions */}
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                              {prevStage ? (
                                <button
                                  type="button"
                                  onClick={(e) => quickMove(e, job, prevStage)}
                                  title={`Move back to ${PRODUCTION_STAGE_LABEL[prevStage]}`}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {nextStage ? (
                                <button
                                  type="button"
                                  onClick={(e) => quickMove(e, job, nextStage)}
                                  title={`Advance to ${PRODUCTION_STAGE_LABEL[nextStage]}`}
                                  className="rounded p-1 text-[#CC2D24] hover:bg-[#CC2D24]/15 hover:text-red-300"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Job Details Sidebar */}
        <aside className="rounded-2xl border border-[#252528] bg-[#111113] p-5 xl:sticky xl:top-6 xl:self-start">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-10 w-10 text-white/20" />
              <h3 className="mt-3 text-sm font-semibold text-white">No job selected</h3>
              <p className="mt-1 max-w-xs text-xs text-white/40">
                Click any job card on the Kanban board to view specifications, reassign work, or
                upload QC photos.
              </p>
              <Button
                size="sm"
                onClick={() => openCreateDialog()}
                className="mt-4 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create New Job
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Job Header & Actions */}
              <div className="flex items-start justify-between gap-3 border-b border-[#252528] pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#CC2D24]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                      {PRODUCTION_STAGE_LABEL[selected.stage]}
                    </span>
                    <span className="font-mono text-[11px] text-white/40">
                      {selected.factoryOrderId}
                    </span>
                  </div>
                  <h2 className="mt-1.5 truncate text-lg font-bold text-white">
                    {selected.productName}
                  </h2>
                  <p className="text-xs text-white/45">{selected.brandName}</p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(selected)}
                    title="Edit job specs"
                    className="h-8 w-8 p-0 text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteJobConfirm(selected)}
                    title="Delete job"
                    className="h-8 w-8 p-0 text-white/50 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Direct Stage Jump / Progress Bar */}
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Floor Stage
                </Label>
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {PRODUCTION_STAGES.map((st) => {
                    const active = selected.stage === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          moveProductionJobStage(selected.id, st);
                          refresh();
                          toast.success(`Moved to ${PRODUCTION_STAGE_LABEL[st]}`);
                        }}
                        className={cn(
                          'rounded-lg border px-2 py-1.5 text-center text-[11px] font-semibold transition',
                          active
                            ? 'border-[#CC2D24] bg-[#CC2D24] text-white shadow-md'
                            : 'border-[#252528] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white',
                        )}
                      >
                        {PRODUCTION_STAGE_LABEL[st]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick specs grid */}
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <div className="rounded-xl border border-[#252528] bg-white/[0.02] p-2.5">
                  <span className="text-[10px] uppercase text-white/35">Garment</span>
                  <p className="mt-0.5 truncate font-semibold text-white">
                    {selected.garmentType}
                  </p>
                </div>
                <div className="rounded-xl border border-[#252528] bg-white/[0.02] p-2.5">
                  <span className="text-[10px] uppercase text-white/35">Units</span>
                  <p className="mt-0.5 font-semibold text-white">{selected.units}</p>
                </div>
                <div className="rounded-xl border border-[#252528] bg-white/[0.02] p-2.5">
                  <span className="text-[10px] uppercase text-white/35">Target Due</span>
                  <p
                    className={cn(
                      'mt-0.5 truncate font-semibold',
                      isOverdue(selected) ? 'text-amber-300' : 'text-white',
                    )}
                  >
                    {formatDue(selected.dueAt)}
                  </p>
                </div>
              </div>

              {/* Assignee Control */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Assigned Floor Lead
                  </Label>
                  <span className="text-[11px] text-white/35">
                    {selected.assigneeName || 'Unassigned'}
                  </span>
                </div>
                <Select
                  value={selected.assigneeId ?? 'unassigned'}
                  onValueChange={(v) => onAssignee(selected.id, v)}
                >
                  <SelectTrigger className="mt-1.5 border-white/10 bg-white/5 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              {selected.notes ? (
                <div>
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Production Notes
                  </Label>
                  <p className="mt-1.5 rounded-xl border border-[#252528] bg-white/[0.02] p-3 text-xs text-white/70">
                    {selected.notes}
                  </p>
                </div>
              ) : null}

              {/* QC Photos Section */}
              <div className="border-t border-[#252528] pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-[#CC2D24]" />
                    <h3 className="text-sm font-semibold text-white">Quality Control Photos</h3>
                  </div>
                  <span className="text-[11px] font-medium text-white/40">
                    {selected.photos.length} shot{selected.photos.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  Published QC shots are immediately visible to the brand and Ceriga superadmin.
                </p>

                {/* Upload & Sample buttons */}
                <div className="mt-3 space-y-2.5">
                  <Input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Photo caption (e.g. Cut pieces verified, Sew detail)"
                    className="border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-[120px]">
                      <Select
                        value={photoStage}
                        onValueChange={(v) => setPhotoStage(v as ProductionStage)}
                      >
                        <SelectTrigger className="border-white/10 bg-white/5 text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#252528] bg-[#161618] text-white">
                          {PRODUCTION_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PRODUCTION_STAGE_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Upload File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          onFile(e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={queueSamplePhoto}
                      className="border-white/15 bg-transparent text-xs text-white hover:bg-white/5"
                    >
                      Sample
                    </Button>
                  </div>
                </div>

                {/* Photos List */}
                <ul className="mt-4 space-y-2">
                  {selected.photos.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-[#252528] p-4 text-center text-xs text-white/30">
                      No QC photos attached yet.
                    </li>
                  ) : (
                    selected.photos.map((p) => (
                      <li
                        key={p.id}
                        className="group flex gap-2.5 rounded-xl border border-[#252528] bg-black/30 p-2 transition hover:border-white/20"
                      >
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(p)}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                        >
                          <img
                            src={p.url}
                            alt=""
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                            <Maximize2 className="h-3.5 w-3.5 text-white" />
                          </div>
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{p.caption}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40">
                            <span>{PRODUCTION_STAGE_LABEL[p.stage]}</span>
                            <span>•</span>
                            {p.published ? (
                              <span className="font-semibold text-emerald-400">Published</span>
                            ) : (
                              <span className="font-semibold text-amber-400">Draft / Hidden</span>
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPublishRemove({
                                  photoId: p.id,
                                  action: p.published ? 'unpublish' : 'publish',
                                })
                              }
                              className="text-[10px] font-semibold text-[#CC2D24] hover:underline"
                            >
                              {p.published ? 'Hide' : 'Publish to Brand'}
                            </button>
                            <span className="text-white/20">•</span>
                            <button
                              type="button"
                              onClick={() =>
                                setPublishRemove({ photoId: p.id, action: 'remove' })
                              }
                              className="text-[10px] text-red-400/80 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* CREATE JOB DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#252528] bg-[#111113] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Production Job</DialogTitle>
            <DialogDescription className="text-white/50">
              Start a new production run on the floor. Choose to import from existing orders or
              enter custom job details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {availableOrders.length > 0 ? (
              <div className="flex gap-2 rounded-lg border border-[#252528] bg-white/[0.02] p-1">
                <button
                  type="button"
                  onClick={() => setNewJobMode('custom')}
                  className={cn(
                    'flex-1 rounded-md py-1 text-xs font-medium transition',
                    newJobMode === 'custom'
                      ? 'bg-[#CC2D24] text-white'
                      : 'text-white/45 hover:text-white',
                  )}
                >
                  Custom Job
                </button>
                <button
                  type="button"
                  onClick={() => setNewJobMode('order')}
                  className={cn(
                    'flex-1 rounded-md py-1 text-xs font-medium transition',
                    newJobMode === 'order'
                      ? 'bg-[#CC2D24] text-white'
                      : 'text-white/45 hover:text-white',
                  )}
                >
                  From Factory Order ({availableOrders.length})
                </button>
              </div>
            ) : null}

            {newJobMode === 'order' && availableOrders.length > 0 ? (
              <div>
                <Label className="text-xs text-white/60">Select Order to Import</Label>
                <Select
                  value={newSelectedOrderId}
                  onValueChange={handleSelectOrderForNewJob}
                >
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue placeholder="Pick an order..." />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {availableOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.id} · {o.productName} ({o.brandName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs text-white/60">
                  Product / Run Name <span className="text-[#CC2D24]">*</span>
                </Label>
                <Input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Oversized Heavyweight Hoodie"
                  className="mt-1 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-white/60">
                  Brand / Client Name <span className="text-[#CC2D24]">*</span>
                </Label>
                <Input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Acme Clothing"
                  className="mt-1 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-white/60">Garment Type</Label>
                <Select value={newGarmentType} onValueChange={setNewGarmentType}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {ALL_FACTORY_GARMENTS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-white/60">Total Units</Label>
                <Input
                  type="number"
                  value={newUnits}
                  onChange={(e) => setNewUnits(e.target.value)}
                  className="mt-1 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-white/60">Initial Stage</Label>
                <Select
                  value={newStage}
                  onValueChange={(v) => setNewStage(v as ProductionStage)}
                >
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {PRODUCTION_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PRODUCTION_STAGE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-white/60">Target Completion Date</Label>
                <Input
                  type="date"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="mt-1 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-white/60">Floor Lead / Assignee</Label>
                <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs text-white/60">Production Notes / Specs</Label>
                <Textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Fabric GSM, thread colour, special cut instructions..."
                  className="mt-1 border-white/15 bg-white/5 text-xs text-white"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-white/15 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            >
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT JOB DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#252528] bg-[#111113] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Production Job</DialogTitle>
            <DialogDescription className="text-white/50">
              Update units, target completion date, garment specs, and notes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs text-white/60">Product Name</Label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-white/60">Brand Name</Label>
              <Input
                value={editBrandName}
                onChange={(e) => setEditBrandName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-white/60">Garment Type</Label>
              <Input
                value={editGarmentType}
                onChange={(e) => setEditGarmentType(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-white/60">Units</Label>
              <Input
                type="number"
                value={editUnits}
                onChange={(e) => setEditUnits(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-white/60">Floor Stage</Label>
              <Select
                value={editStage}
                onValueChange={(v) => setEditStage(v as ProductionStage)}
              >
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {PRODUCTION_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PRODUCTION_STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-white/60">Target Due Date</Label>
              <Input
                type="date"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-white/60">Floor Lead</Label>
              <Select value={editAssigneeId} onValueChange={setEditAssigneeId}>
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-white/60">Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-xs text-white"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-white/15 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditJob}
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE JOB CONFIRM */}
      <ConfirmDialog
        open={Boolean(deleteJobConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteJobConfirm(null);
        }}
        title={`Delete "${deleteJobConfirm?.productName}"?`}
        description="This will permanently remove this production job and its attached QC photos from the floor board."
        confirmLabel="Delete Job"
        tone="danger"
        onConfirm={handleDeleteJob}
      />

      {/* PUBLISH PHOTO CONFIRM */}
      <ConfirmDialog
        open={photoConfirmOpen}
        onOpenChange={setPhotoConfirmOpen}
        title="Publish production photo?"
        description="The brand and Ceriga superadmin will see this photo on their order view once published."
        confirmLabel="Publish Photo"
        onConfirm={confirmAddPhoto}
      />

      {/* PUBLISH/UNPUBLISH/REMOVE PHOTO ACTION CONFIRM */}
      <ConfirmDialog
        open={Boolean(publishRemove)}
        onOpenChange={(open) => {
          if (!open) setPublishRemove(null);
        }}
        title={
          publishRemove?.action === 'remove'
            ? 'Remove this photo?'
            : publishRemove?.action === 'publish'
              ? 'Publish this photo?'
              : 'Hide from brand?'
        }
        description={
          publishRemove?.action === 'remove'
            ? 'It will be permanently removed from this job and from brand / Ceriga views.'
            : publishRemove?.action === 'publish'
              ? 'Brand and Ceriga will be able to see this photo on the order.'
              : 'The photo stays on your board but brand and Ceriga will no longer see it.'
        }
        confirmLabel={
          publishRemove?.action === 'remove'
            ? 'Remove'
            : publishRemove?.action === 'publish'
              ? 'Publish'
              : 'Hide'
        }
        tone={publishRemove?.action === 'remove' ? 'danger' : 'default'}
        onConfirm={confirmPhotoAction}
      />

      {/* PHOTO LIGHTBOX MODAL */}
      <Dialog
        open={Boolean(lightboxPhoto)}
        onOpenChange={(open) => {
          if (!open) setLightboxPhoto(null);
        }}
      >
        <DialogContent className="max-w-3xl border-[#252528] bg-[#0c0c0e] p-6 text-white">
          {lightboxPhoto && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-white">
                  {lightboxPhoto.caption}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-xs text-white/50">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-white/70">
                    {PRODUCTION_STAGE_LABEL[lightboxPhoto.stage]}
                  </span>
                  <span>•</span>
                  <span>Uploaded by {lightboxPhoto.uploadedBy}</span>
                  <span>•</span>
                  {lightboxPhoto.published ? (
                    <span className="font-semibold text-emerald-400">Published</span>
                  ) : (
                    <span className="font-semibold text-amber-400">Hidden / Draft</span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-xl border border-[#252528] bg-black">
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.caption}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const pub = !lightboxPhoto.published;
                    if (selected) {
                      publishProductionPhoto(selected.id, lightboxPhoto.id, pub);
                      setLightboxPhoto({ ...lightboxPhoto, published: pub });
                      refresh();
                      toast.success(pub ? 'Photo published' : 'Photo hidden');
                    }
                  }}
                  className="border-white/15 text-xs text-white hover:bg-white/10"
                >
                  {lightboxPhoto.published ? (
                    <>
                      <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                      Hide from Brand
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Publish to Brand
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (selected) {
                      removeProductionPhoto(selected.id, lightboxPhoto.id);
                      setLightboxPhoto(null);
                      refresh();
                      toast.success('Photo removed');
                    }
                  }}
                  className="text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove Photo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
