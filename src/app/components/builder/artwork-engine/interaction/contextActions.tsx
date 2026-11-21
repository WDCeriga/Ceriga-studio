import type { ReactNode } from 'react';
import {
  Copy, FlipHorizontal2, FlipVertical2, Trash2, Lock, Unlock, Type, Crop, ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, LayoutGrid, Target, Layers, Group, Blend, MousePointerClick, Flower2, Waves, Sparkles, TypeOutline, SquareDot, Spline, SquareDashed,
} from 'lucide-react';
import type { ContextAction } from './ContextToolbar';
import type { BooleanOperation } from '../../../../lib/booleanArtwork';
import { COMBINE_OPS, type CombinePreview } from '../geometry/combine';
import { CombineThumb } from '../inspector/CombineChoices';
import { REPEAT_MODES, type RepeatMode } from '../geometry/repeat';
import { RECIPE_FAMILIES, TEXT_RECIPES } from '../typography/recipes';
import { RepeatGlyph } from '../inspector/RepeatControls';

export type ArrangeDirection = 'front' | 'forward' | 'backward' | 'back';
export type AlignTo = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** What the editor can do for the current selection (supplied by the host editor). */
export type ContextHandlers = {
  duplicate: () => void;
  remove: () => void;
  flip: (axis: 'x' | 'y') => void;
  toggleLock: () => void;
  arrange: (direction: ArrangeDirection) => void;
  editText?: () => void;
  crop?: () => void;
  align?: (to: AlignTo, scope: 'selection' | 'print-area') => void;
  distribute?: (axis: 'x' | 'y') => void;
  centreOnGarment?: () => void;
  /** Multi-select: group into one editable group (absent when grouping isn't possible). */
  group?: () => void;
  /** Multi-select: combine into one shape (absent when the selection can't combine). Text is allowed. */
  combine?: { previews: CombinePreview[]; run: (op: BooleanOperation) => void; builder?: () => void };
  /** Single object: make a live repeat (around a centre, mirror, 4-way, 180° turn). */
  repeat?: (mode: RepeatMode) => void;
  /** Multi-select of one text + one shape: words take the shape (plan F.2). */
  /** Single text: one-tap styles (plan §9.6). */
  textRecipes?: { active?: string; apply: (id: string) => void; clear?: () => void };
  /** Multi-select of paths: make a live blend. */
  blend?: () => void;
  textInShape?: { warp: () => void; inside: () => void; knockout: () => void };
};

export type ContextSelection =
  | { kind: 'single'; type: string; locked?: boolean; colourControl?: ReactNode }
  | { kind: 'multi'; count: number };

const ICON = 16;
const arrangeMenu = (h: ContextHandlers): ContextAction => ({
  id: 'arrange', label: 'Arrange', icon: <Layers size={ICON} />, menu: [
    { id: 'front', label: 'Bring to front', icon: <ArrowUpToLine size={ICON} />, onSelect: () => h.arrange('front') },
    { id: 'forward', label: 'Bring forward', icon: <ArrowUp size={ICON} />, onSelect: () => h.arrange('forward') },
    { id: 'backward', label: 'Send backward', icon: <ArrowDown size={ICON} />, onSelect: () => h.arrange('backward') },
    { id: 'back', label: 'Send to back', icon: <ArrowDownToLine size={ICON} />, onSelect: () => h.arrange('back') },
  ],
});

const alignMenu = (h: ContextHandlers, scope: 'selection' | 'print-area', label: string): ContextAction => ({
  id: `align-${scope}`, label, icon: scope === 'selection' ? <AlignHorizontalJustifyCenter size={ICON} /> : <Target size={ICON} />, showLabel: scope === 'selection',
  menu: [
    { id: 'l', label: 'Align left', icon: <AlignHorizontalJustifyStart size={ICON} />, onSelect: () => h.align?.('left', scope) },
    { id: 'c', label: 'Align centre', icon: <AlignHorizontalJustifyCenter size={ICON} />, onSelect: () => h.align?.('center', scope) },
    { id: 'r', label: 'Align right', icon: <AlignHorizontalJustifyEnd size={ICON} />, onSelect: () => h.align?.('right', scope) },
    { id: 'sep-a', label: '' },
    { id: 't', label: 'Align top', icon: <AlignVerticalJustifyStart size={ICON} />, onSelect: () => h.align?.('top', scope) },
    { id: 'm', label: 'Align middle', icon: <AlignVerticalJustifyCenter size={ICON} />, onSelect: () => h.align?.('middle', scope) },
    { id: 'b', label: 'Align bottom', icon: <AlignVerticalJustifyEnd size={ICON} />, onSelect: () => h.align?.('bottom', scope) },
  ],
});

/**
 * Plan §7: one action set per selection type — the most frequent actions near the object,
 * everything else in ⋯. Returns { actions, overflow } for <ContextToolbar>.
 */
export function contextActionsFor(selection: ContextSelection, h: ContextHandlers): { actions: ContextAction[]; overflow: ContextAction[] } {
  if (selection.kind === 'multi') {
    return {
      actions: [
        ...(h.textInShape ? [{ id: 'text-shape', label: 'Text + shape', icon: <TypeOutline size={ICON} />, showLabel: true, menu: [
          { id: 'inside', label: 'Place inside', icon: <SquareDot size={ICON} />, onSelect: h.textInShape.inside },
          { id: 'warp', label: 'Warp to shape', icon: <Spline size={ICON} />, onSelect: h.textInShape.warp },
          { id: 'knockout', label: 'Cut out of shape', icon: <SquareDashed size={ICON} />, onSelect: h.textInShape.knockout },
        ] } as ContextAction] : []),
        ...(h.blend ? [{ id: 'blend', label: 'Blend', icon: <Waves size={ICON} />, showLabel: true, onSelect: h.blend } as ContextAction] : []),
        ...(h.combine ? [{ id: 'combine', label: 'Combine', icon: <Blend size={ICON} />, showLabel: true, menu: COMBINE_OPS.map(({ op, label }): ContextAction => { const preview = h.combine!.previews.find(item => item.op === op); return { id: op, label, icon: <CombineThumb preview={preview} size={26} />, disabled: Boolean(preview && 'empty' in preview), onSelect: () => h.combine!.run(op) }; }).concat(h.combine.builder ? [{ id: 'sep-builder', label: '' }, { id: 'builder', label: 'Shape builder', icon: <MousePointerClick size={ICON} />, onSelect: h.combine.builder }] : []) } as ContextAction] : []),
        { id: 'group', label: 'Group', icon: <Group size={ICON} />, showLabel: true, disabled: !h.group, onSelect: () => h.group?.() },
        alignMenu(h, 'selection', 'Align'),
        { id: 'dist-x', label: 'Space evenly across', icon: <AlignHorizontalDistributeCenter size={ICON} />, disabled: selection.count < 3, onSelect: () => h.distribute?.('x') },
        { id: 'dist-y', label: 'Space evenly down', icon: <AlignVerticalDistributeCenter size={ICON} />, disabled: selection.count < 3, onSelect: () => h.distribute?.('y') },
        { id: 'sep-1', label: '' },
        alignMenu(h, 'print-area', 'Align to print area'),
        { id: 'garment', label: 'Centre on garment', icon: <LayoutGrid size={ICON} />, onSelect: () => h.centreOnGarment?.() },
        { id: 'sep-2', label: '' },
        { id: 'duplicate', label: 'Duplicate', icon: <Copy size={ICON} />, onSelect: h.duplicate },
        { id: 'delete', label: 'Delete', icon: <Trash2 size={ICON} />, tone: 'danger', onSelect: h.remove },
      ],
      overflow: [],
    };
  }
  const locked = Boolean(selection.locked);
  const primary: ContextAction[] = [];
  if (selection.type === 'text' && h.editText) primary.push({ id: 'edit', label: 'Edit text', icon: <Type size={ICON} />, showLabel: true, disabled: locked, onSelect: h.editText });
  if (selection.type === 'image' && h.crop) primary.push({ id: 'crop', label: 'Crop', icon: <Crop size={ICON} />, showLabel: true, disabled: locked, onSelect: h.crop });
  if (selection.colourControl && !locked) primary.push({ id: 'colour', label: 'Colour', render: selection.colourControl });
  if (selection.type === 'text' && h.textRecipes && !locked) primary.push({ id: 'style', label: 'Style', icon: <Sparkles size={ICON} />, showLabel: true, menu: [
    ...RECIPE_FAMILIES.flatMap((family, index): ContextAction[] => [...(index ? [{ id: 'sep-' + family, label: '' }] : []), ...TEXT_RECIPES.filter(recipe => recipe.family === family).map((recipe): ContextAction => ({ id: recipe.id, label: recipe.label, pressed: h.textRecipes!.active === recipe.id, onSelect: () => h.textRecipes!.apply(recipe.id) }))]),
    ...(h.textRecipes.clear ? [{ id: 'sep-clear', label: '' }, { id: 'clear', label: 'Back to original', onSelect: h.textRecipes.clear }] : []),
  ] });
  if (primary.length) primary.push({ id: 'sep-p', label: '' });
  return {
    actions: [
      ...primary,
      { id: 'center', label: 'Centre on garment', icon: <Target size={ICON} />, disabled: locked, onSelect: () => h.centreOnGarment?.() },
      { id: 'duplicate', label: 'Duplicate', icon: <Copy size={ICON} />, onSelect: h.duplicate },
      ...(h.repeat ? [{ id: 'repeat', label: 'Repeat', icon: <Flower2 size={ICON} />, disabled: locked, menu: REPEAT_MODES.map(({ mode, label }): ContextAction => ({ id: 'repeat-' + mode, label, icon: <RepeatGlyph mode={mode} />, onSelect: () => h.repeat!(mode) })) } as ContextAction] : []),
      { id: 'flip', label: 'Flip horizontally', icon: <FlipHorizontal2 size={ICON} />, disabled: locked, onSelect: () => h.flip('x') },
      arrangeMenu(h),
      { id: 'lock', label: locked ? 'Unlock' : 'Lock', icon: locked ? <Unlock size={ICON} /> : <Lock size={ICON} />, pressed: locked, onSelect: h.toggleLock },
      { id: 'delete', label: 'Delete', icon: <Trash2 size={ICON} />, tone: 'danger', disabled: locked, onSelect: h.remove },
    ],
    overflow: [
      { id: 'flip-y', label: 'Flip vertically', icon: <FlipVertical2 size={ICON} />, disabled: locked, onSelect: () => h.flip('y') },
      { id: 'sep-o', label: '' },
      ...(alignMenu(h, 'print-area', 'Align to print area').menu ?? []).map((item): ContextAction => ({
        ...item, id: 'pa-' + item.id, disabled: locked, label: item.label.replace('Align', 'Print area ·'),
      })),
    ],
  };
}
