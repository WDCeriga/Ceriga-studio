import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Camera,
  ClipboardList,
  ImagePlus,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { getFactoryWorkspace } from '../../data/manufacturerPortalMock';
import {
  PRODUCTION_STAGE_LABEL,
  PRODUCTION_STAGES,
  SAMPLE_PHOTOS,
  addProductionPhoto,
  assignProductionJob,
  listProductionJobs,
  moveProductionJobStage,
  nextProductionStage,
  prevProductionStage,
  publishProductionPhoto,
  removeProductionPhoto,
  type ProductionJob,
  type ProductionStage,
} from '../../data/productionFloor';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function isOverdue(job: ProductionJob) {
  if (job.stage === 'done') return false;
  return job.dueAt < new Date().toISOString().slice(0, 10);
}

export function ManufacturerProduction() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  void tick;

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener('ceriga-production-floor', onUpdate);
    return () => window.removeEventListener('ceriga-production-floor', onUpdate);
  }, []);

  const ws = getFactoryWorkspace();
  const jobs = listProductionJobs();
  const team = ws.team.filter((t) => t.status === 'active');

  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? jobs[0],
    [jobs, selectedId, tick],
  );

  const [stageConfirm, setStageConfirm] = useState<{
    jobId: string;
    stage: ProductionStage;
    label: string;
  } | null>(null);
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

  useEffect(() => {
    if (selected) setPhotoStage(selected.stage);
  }, [selected?.id, selected?.stage]);

  const byStage = (stage: ProductionStage) => jobs.filter((j) => j.stage === stage);

  const requestMove = (job: ProductionJob, stage: ProductionStage) => {
    setStageConfirm({
      jobId: job.id,
      stage,
      label: PRODUCTION_STAGE_LABEL[stage],
    });
  };

  const confirmMove = () => {
    if (!stageConfirm) return;
    moveProductionJobStage(stageConfirm.jobId, stageConfirm.stage);
    setStageConfirm(null);
    refresh();
    toast.success(`Moved to ${stageConfirm.label}`);
  };

  const onAssignee = (jobId: string, memberId: string) => {
    if (memberId === 'unassigned') {
      assignProductionJob(jobId, null);
    } else {
      const m = team.find((t) => t.id === memberId);
      if (!m) return;
      assignProductionJob(jobId, { id: m.id, name: m.name });
    }
    refresh();
    toast.message('Assignee updated');
  };

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
    if (file.size > 1_500_000) {
      toast.error('Keep photos under ~1.5MB for this mock');
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
      uploadedBy: ws.contactName,
      published: true,
    });
    setPendingPhoto(null);
    setCaption('');
    setPhotoConfirmOpen(false);
    refresh();
    toast.success('Photo published — brand and Ceriga can see it');
  };

  const confirmPhotoAction = () => {
    if (!selected || !publishRemove) return;
    if (publishRemove.action === 'remove') {
      removeProductionPhoto(selected.id, publishRemove.photoId);
      toast.success('Photo removed');
    } else {
      publishProductionPhoto(
        selected.id,
        publishRemove.photoId,
        publishRemove.action === 'publish',
      );
      toast.success(
        publishRemove.action === 'publish' ? 'Photo published' : 'Photo hidden from brand',
      );
    }
    setPublishRemove(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <ClipboardList className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Floor</span>
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Production board
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Track jobs cut → sew → finish → pack → ship. Upload QC photos here — published shots show
          on the brand order and Ceriga. Orders inbox stays for quoting only.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRODUCTION_STAGES.map((stage) => (
          <div
            key={stage}
            className="min-w-[9.5rem] rounded-xl border border-white/[0.08] bg-[#111113] px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {PRODUCTION_STAGE_LABEL[stage]}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
              {byStage(stage).length}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PRODUCTION_STAGES.map((stage) => (
            <div
              key={stage}
              className="flex w-[260px] shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#0c0c0e]"
            >
              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {PRODUCTION_STAGE_LABEL[stage]}
                </p>
              </div>
              <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-2">
                {byStage(stage).length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-white/30">Empty</p>
                ) : (
                  byStage(stage).map((job) => {
                    const active = selected?.id === job.id;
                    const overdue = isOverdue(job);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedId(job.id)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition',
                          active
                            ? 'border-[#CC2D24]/40 bg-[#CC2D24]/10'
                            : 'border-white/[0.08] bg-[#111113] hover:border-white/20',
                        )}
                      >
                        <p className="text-sm font-medium text-white">{job.productName}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">{job.brandName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          <span
                            className={cn(
                              'tabular-nums',
                              overdue ? 'font-semibold text-amber-300' : 'text-white/45',
                            )}
                          >
                            Due {formatDue(job.dueAt)}
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/45">{job.units} u</span>
                          {job.photos.length > 0 ? (
                            <>
                              <span className="text-white/30">·</span>
                              <span className="inline-flex items-center gap-0.5 text-white/45">
                                <Camera className="h-3 w-3" />
                                {job.photos.length}
                              </span>
                            </>
                          ) : null}
                        </div>
                        {job.assigneeName ? (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-white/50">
                            <UserRound className="h-3 w-3" />
                            {job.assigneeName}
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-white/30">Unassigned</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 xl:sticky xl:top-6 xl:self-start">
          {!selected ? (
            <p className="text-sm text-white/45">Select a job on the board.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#CC2D24]">
                  {PRODUCTION_STAGE_LABEL[selected.stage]}
                </p>
                <h2 className="mt-1 text-base font-semibold text-white">{selected.productName}</h2>
                <p className="mt-0.5 text-[12px] text-white/45">
                  {selected.brandName} · {selected.factoryOrderId}
                </p>
                <Link
                  to={`/manufacturer/orders/${selected.factoryOrderId}`}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#CC2D24] hover:underline"
                >
                  Open quote order
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[10px] uppercase text-white/35">Due</p>
                  <p
                    className={cn(
                      'font-medium',
                      isOverdue(selected) ? 'text-amber-300' : 'text-white',
                    )}
                  >
                    {formatDue(selected.dueAt)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[10px] uppercase text-white/35">Units</p>
                  <p className="font-medium text-white">{selected.units}</p>
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-white/40">Assignee</Label>
                <Select
                  value={selected.assigneeId ?? 'unassigned'}
                  onValueChange={(v) => onAssignee(selected.id, v)}
                >
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {prevProductionStage(selected.stage) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 text-white hover:bg-white/5"
                    onClick={() =>
                      requestMove(selected, prevProductionStage(selected.stage)!)
                    }
                  >
                    ← {PRODUCTION_STAGE_LABEL[prevProductionStage(selected.stage)!]}
                  </Button>
                ) : null}
                {nextProductionStage(selected.stage) ? (
                  <Button
                    size="sm"
                    className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                    onClick={() =>
                      requestMove(selected, nextProductionStage(selected.stage)!)
                    }
                  >
                    {PRODUCTION_STAGE_LABEL[nextProductionStage(selected.stage)!]} →
                  </Button>
                ) : null}
              </div>

              {selected.notes ? (
                <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/55">
                  {selected.notes}
                </p>
              ) : null}

              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#CC2D24]" />
                  <h3 className="text-sm font-semibold text-white">QC photos</h3>
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  Publishing shares with the brand and Ceriga superadmin on this order.
                </p>

                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-[10px] text-white/40">Caption</Label>
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="mt-1 border-white/15 bg-white/5 text-white"
                      placeholder="e.g. Final QC — front & back"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/40">Stage tag</Label>
                    <Select
                      value={photoStage}
                      onValueChange={(v) => setPhotoStage(v as ProductionStage)}
                    >
                      <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                        {PRODUCTION_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PRODUCTION_STAGE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-medium text-white hover:bg-white/10">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Upload photo
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
                      className="border-white/15 text-white hover:bg-white/5"
                      onClick={queueSamplePhoto}
                    >
                      Add sample shot
                    </Button>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {selected.photos.length === 0 ? (
                    <li className="text-[12px] text-white/35">No photos yet.</li>
                  ) : (
                    selected.photos.map((p) => (
                      <li
                        key={p.id}
                        className="flex gap-2 rounded-xl border border-white/[0.06] bg-black/25 p-2"
                      >
                        <img
                          src={p.url}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-white">{p.caption}</p>
                          <p className="text-[10px] text-white/40">
                            {PRODUCTION_STAGE_LABEL[p.stage]} ·{' '}
                            {p.published ? (
                              <span className="text-emerald-300">Published</span>
                            ) : (
                              <span className="text-amber-300">Draft</span>
                            )}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="text-[10px] font-medium text-white/50 hover:text-white"
                              onClick={() =>
                                setPublishRemove({
                                  photoId: p.id,
                                  action: p.published ? 'unpublish' : 'publish',
                                })
                              }
                            >
                              {p.published ? 'Hide' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              className="text-[10px] font-medium text-red-300/80 hover:text-red-200"
                              onClick={() =>
                                setPublishRemove({ photoId: p.id, action: 'remove' })
                              }
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

      <ConfirmDialog
        open={Boolean(stageConfirm)}
        onOpenChange={(open) => {
          if (!open) setStageConfirm(null);
        }}
        title={`Move to ${stageConfirm?.label}?`}
        description="This updates the production board only — it does not change the quote order status in your inbox."
        confirmLabel="Move job"
        onConfirm={confirmMove}
      />

      <ConfirmDialog
        open={photoConfirmOpen}
        onOpenChange={setPhotoConfirmOpen}
        title="Publish production photo?"
        description="The brand and Ceriga superadmin will see this on the order once published. Confirm before sharing."
        confirmLabel="Publish photo"
        onConfirm={confirmAddPhoto}
      />

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
            ? 'It will be removed from the factory board and from brand / Ceriga views.'
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
    </div>
  );
}
