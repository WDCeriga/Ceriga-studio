import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { listAssetProjects, listLocalAssetProjects, saveAssetProject, type AssetProject } from '../../../lib/assetLibrary';
import { deleteStoredAsset, readStoredAssets, withAssetLock, writeStoredAsset } from '../../../lib/assetLibraryStorage';
import { exportAssetArtboard } from '../../../lib/exportAssetArtboard';
import type { DesignElement } from '../PrintsDesignStep';


type Point = { x: number; y: number };
type Snapshot = { project: AssetProject; selectedId: string | null };
const signature = (project: AssetProject) => JSON.stringify([project.name, project.width, project.height, project.elements]);
const clone = <T,>(value: T): T => structuredClone(value);
const message = (error: unknown) => error instanceof Error ? error.message : 'The asset could not be saved. Please retry.';

export function useAssetWorkspace({ onPlaceOnGarment }: { onPlaceOnGarment: (asset: AssetProject, point?: Point) => void }) {
  const { user, authReady } = useAuth();
  const userId = user?.id ?? null;
  const scope = `asset-draft:${userId ?? 'guest'}`;
  const scopeRef = useRef(scope);
  const documentScope = useRef(scope);
  scopeRef.current = scope;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  const [baseline, setBaseline] = useState('');
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [library, setLibrary] = useState<AssetProject[]>([]);
  const [recovery, setRecovery] = useState<AssetProject | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const [nameRequest, setNameRequest] = useState<{ asNew: boolean } | null>(null);
  const [nameInput, setNameInput] = useState('');
  const project = snapshot?.project ?? null;
  const dirty = project !== null && signature(project) !== baseline;
  const updateSnapshot = useCallback((next: Snapshot | null) => { snapshotRef.current = next; setSnapshot(next); }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    updateSnapshot(null); setPast([]); setFuture([]); setLibrary([]); setRecovery(null); setError(null); setLibraryError(null);
    setConfirmBack(false); setNameRequest(null);
    void listAssetProjects(userId).then(assets => { if (!cancelled) setLibrary(assets); }).catch(async error => {
      if (cancelled) return;
      setLibraryError(`Cloud library unavailable: ${message(error)} Local copies are shown; saves will require cloud confirmation.`);
      try { const assets = await listLocalAssetProjects(userId); if (!cancelled) setLibrary(assets); } catch { /* Keep the original failure visible. */ }
    });
    void readStoredAssets(scope).then(records => { if (!cancelled) setRecovery(records.find(record => record.id === 'current')?.asset ?? null); }).catch(error => { if (!cancelled) setError(message(error)); });
    return () => { cancelled = true; };
  }, [userId, scope, authReady, updateSnapshot]);

  useEffect(() => {
    if (!project || busy || documentScope.current !== scope) return;
    if (!dirty) {
      void withAssetLock(scope, () => deleteStoredAsset(scope, 'current')).catch(error => setError(message(error)));
      return;
    }
    const captured = clone(project);
    void withAssetLock(scope, () => writeStoredAsset({ scope, id: 'current', asset: captured, pending: true }))
      .catch(error => { if (scopeRef.current === scope) setError(`Draft recovery unavailable: ${message(error)}`); });
  }, [project, dirty, busy, scope]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, busy]);

  const enter = useCallback((asset?: AssetProject) => {
    if (busyRef.current || snapshotRef.current || !authReady) return;
    const now = new Date().toISOString();
    const next = clone(asset ?? { id: crypto.randomUUID(), name: 'Untitled Asset', width: 600, height: 600, elements: [], preview: '', createdAt: now, updatedAt: now });
    documentScope.current = scope;
    setBaseline(signature(next)); setPast([]); setFuture([]); setError(null);
    updateSnapshot({ project: next, selectedId: null });
  }, [authReady, scope, updateSnapshot]);
  const resume = () => {
    if (!recovery || busyRef.current || snapshotRef.current) return;
    enter(recovery); setBaseline(''); setRecovery(null);
  };
  const changeProject = useCallback((patch: Partial<Pick<AssetProject, 'name' | 'width' | 'height' | 'elements'>>, selectedId?: string | null) => {
    const current = snapshotRef.current;
    if (!current || busyRef.current) return;
    const next = { project: { ...current.project, ...patch }, selectedId: selectedId === undefined ? current.selectedId : selectedId };
    if (signature(next.project) !== signature(current.project)) { setPast(items => [...items.slice(-99), current]); setFuture([]); }
    updateSnapshot(next);
  }, [updateSnapshot]);
  const change = useCallback((elements: DesignElement[], selectedId?: string | null) => changeProject({ elements }, selectedId), [changeProject]);
  const select = useCallback((id: string | null) => {
    if (snapshotRef.current && !busyRef.current) updateSnapshot({ ...snapshotRef.current, selectedId: id });
  }, [updateSnapshot]);
  const undo = useCallback(() => {
    if (busyRef.current || !snapshotRef.current || !past.length) return;
    setFuture(items => [...items, snapshotRef.current!]); updateSnapshot(past[past.length - 1]!); setPast(items => items.slice(0, -1));
  }, [past, updateSnapshot]);
  const redo = useCallback(() => {
    if (busyRef.current || !snapshotRef.current || !future.length) return;
    setPast(items => [...items, snapshotRef.current!]); updateSnapshot(future[future.length - 1]!); setFuture(items => items.slice(0, -1));
  }, [future, updateSnapshot]);
  const clearDraft = useCallback(() => withAssetLock(scope, () => deleteStoredAsset(scope, 'current')), [scope]);
  const discard = async () => {
    if (busyRef.current) return;
    try { await clearDraft(); updateSnapshot(null); setConfirmBack(false); setRecovery(null); setError(null); }
    catch (error) { setError(message(error)); }
  };
  const back = useCallback(() => {
    if (busyRef.current) return;
    if (dirty) setConfirmBack(true);
    else { updateSnapshot(null); void clearDraft().catch(error => setError(message(error))); }
  }, [dirty, clearDraft, updateSnapshot]);
  const save = useCallback(async (asNew = false, suppliedName?: string) => {
    const current = snapshotRef.current;
    if (!current || busyRef.current) return;
    const name = (suppliedName ?? current.project.name).trim();
    if (!name || name === 'Untitled Asset') { setNameInput(''); setNameRequest({ asNew }); return; }
    busyRef.current = true; setBusy(true); setError(null); setNameRequest(null); setConfirmBack(false);
    const savingScope = scope;
    try {
      const preview = await exportAssetArtboard(current.project.width, current.project.height, current.project.elements);
      const now = new Date().toISOString();
      const saved = await saveAssetProject({ ...clone(current.project), name, preview, id: asNew ? crypto.randomUUID() : current.project.id, createdAt: asNew ? now : current.project.createdAt, updatedAt: now }, userId);
      if (scopeRef.current !== savingScope) throw new Error('The signed-in account changed. The saved asset remains in its original account.');
      setLibrary(items => [saved, ...items.filter(item => item.id !== saved.id)]);
      await clearDraft();
      setRecovery(null); updateSnapshot(null); setPast([]); setFuture([]);
      onPlaceOnGarment(saved);
    } catch (error) { setError(message(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }, [scope, userId, clearDraft, onPlaceOnGarment, updateSnapshot]);
  const insert = useCallback((asset: AssetProject, point?: Point) => {
    if (busyRef.current) return;
    const current = snapshotRef.current;
    if (!current) { onPlaceOnGarment(asset, point); return; }
    const width = Math.min(180, current.project.width * .5);
    const id = `asset-${crypto.randomUUID()}`;
    change([...current.project.elements, { id, type: 'image', content: asset.preview, layerName: asset.name, x: point?.x ?? current.project.width / 2, y: point?.y ?? current.project.height / 2, width, height: width * asset.height / asset.width, rotation: 0, opacity: 100, aspectLocked: true, side: 'front', printMethod: 'DTG' }], id);
  }, [change, onPlaceOnGarment]);
  return { project, selectedId: snapshot?.selectedId ?? null, select, change, changeProject, undo, redo, canUndo: !busy && past.length > 0, canRedo: !busy && future.length > 0, busy, dirty, enter, back, save, insert, library, error, libraryError, recovery, resume, confirmBack, setConfirmBack, discard, nameRequest, setNameRequest, nameInput, setNameInput, authReady };
}
