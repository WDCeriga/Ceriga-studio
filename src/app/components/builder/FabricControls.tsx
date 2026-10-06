import { useState } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  FABRIC_LIBRARY, FABRIC_PRESETS, applyFabricPreset, assignFabric, fabricTargets,
  resolvePartFabric, setFabricGroupLinked, type FabricAssignments, type FabricPart,
} from '../../data/garmentFabrics';
import { fabricAssignmentIssues, fabricSourceRecord } from '../../lib/fabricTextureScans';

export function FabricControls({ parts, value, onChange, legacyFabric }: {
  parts: FabricPart[];
  value?: FabricAssignments;
  onChange: (value: FabricAssignments | undefined) => void;
  legacyFabric?: string;
}) {
  const [selected, setSelected] = useState('');
  const targets = fabricTargets(parts, value);
  const target = targets.find(item => item.id === selected)
    ?? targets.find(item => item.partIds.some(id => parts.some(part => part.id === id && part.role === 'body')))
    ?? targets[0];
  const members = parts.filter(part => target?.partIds.includes(part.id));
  const issues = fabricAssignmentIssues(parts, value);
  const missing = issues.filter((issue, index) => issues.findIndex(other => other.fabricId === issue.fabricId && other.reason === issue.reason) === index);
  const materials = members.map(part => resolvePartFabric(value, part));
  const mixed = new Set(materials.map(material => material?.id ?? '')).size > 1;
  const fabric = mixed ? undefined : materials[0];
  const linked = !!target?.group && !value?.unlinkedGroups.includes(target.group);
  const controlClass = 'h-9 border-[#252528] bg-white/5 text-[11px] text-white';
  const labelClass = 'mb-1.5 block text-[10px] uppercase tracking-wider text-white/60';

  if (!target) return <p className="text-[11px] text-white/50">Select garment parts to assign fabrics.</p>;

  return <div className="space-y-3" data-fabric-controls>
    <div>
      <Label htmlFor="fabric-part" className={labelClass}>Apply fabric to</Label>
      <Select value={target.id} onValueChange={setSelected}>
        <SelectTrigger id="fabric-part" className={controlClass}><SelectValue /></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          {targets.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {target.group && <label className="flex items-center gap-2 text-[11px] text-white/65">
      <input type="checkbox" checked={linked} onChange={event => onChange(setFabricGroupLinked(value, parts, target.group!, event.target.checked))} />
      Link matching parts' fabrics
    </label>}
    <div>
      <Label htmlFor="fabric-type" className={labelClass}>Fabric Type</Label>
      <Select value={fabric?.id ?? ''} onValueChange={id => onChange(assignFabric(value, parts, target.id, id))}>
        <SelectTrigger id="fabric-type" className={controlClass}><SelectValue placeholder={mixed ? 'Mixed fabrics' : 'Select fabric'} /></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          {FABRIC_LIBRARY.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{fabricSourceRecord(item).sourceStatus === 'unresolved' ? ' — texture unavailable' : ''}</SelectItem>)}
        </SelectContent>
      </Select>
      {fabric ? <p className="mt-2 text-[11px] leading-relaxed text-white/55" data-fabric-spec>
        Composition: {fabric.composition}<br />Weight: {fabric.gsm} GSM
      </p> : legacyFabric && !value ? <p className="mt-2 text-[10px] text-white/45">Previous specification: {legacyFabric.replaceAll('-', ' ')}. Select a fabric to render this part.</p> : null}
    </div>
    {missing.length > 0 && <div role="alert" data-fabric-availability="unresolved" className="rounded border border-amber-400/35 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-100">
      <strong>Fabric textures unavailable</strong>
      <p>Assignments are saved, but these requested textures are unavailable. Plain colour is not a fabric preview.</p>
      <ul className="mt-1 space-y-1">{missing.map(issue => <li key={`${issue.fabricId}:${issue.reason}`} data-missing-fabric={issue.fabricId}>
        <strong>{issue.fabricName}</strong> ({issue.fabricId}) · {issues.filter(other => other.fabricId === issue.fabricId && other.reason === issue.reason).map(other => other.partLabel).join(', ')}<br />{issue.reason}
      </li>)}</ul>
    </div>}
    <div>
      <Label htmlFor="fabric-preset" className={labelClass}>Quick preset</Label>
      <Select value="" onValueChange={id => onChange(applyFabricPreset(value, parts, id))}>
        <SelectTrigger id="fabric-preset" className={controlClass}><SelectValue placeholder="Apply a fabric preset" /></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          {FABRIC_PRESETS.map(preset => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {value && <button type="button" className="text-[10px] text-white/50 underline hover:text-white" onClick={() => onChange(undefined)}>Reset fabrics</button>}
  </div>;
}
