import { TextEffectsPanel, type TextEffectsPanelProps } from './TextEffectsPanel';

export function ShapeEffectsPanel(props: Omit<TextEffectsPanelProps, 'target'>) {
  return <TextEffectsPanel {...props} target="shape" />;
}
