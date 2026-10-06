import { flushSync } from 'react-dom';
import { completeTextListInputMarker, continueTextListInput } from '../../../lib/textListEditing';

export function TextListInput({ value, onChange, onSubmit }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const commit = (input: HTMLTextAreaElement, result: { content: string; caret: number }) => {
    flushSync(() => onChange(result.content));
    input.setSelectionRange(result.caret, result.caret);
  };
  return (
    <textarea
      value={value}
      rows={3}
      aria-label="Type, then add"
      placeholder="Type, then add"
      className="min-h-20 min-w-0 flex-1 resize-y rounded-md border border-white/12 bg-black/35 px-3 py-2 text-[11px] text-white placeholder:text-white/28"
      onChange={event => {
        const input = event.currentTarget;
        const result = (event.nativeEvent as InputEvent).isComposing
          ? null : completeTextListInputMarker(input.value, input.selectionStart);
        if (result) commit(input, result);
        else onChange(input.value);
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onSubmit();
          return;
        }
        if (event.shiftKey) return;
        const input = event.currentTarget;
        const result = continueTextListInput(input.value, input.selectionStart, input.selectionEnd);
        if (result) {
          event.preventDefault();
          commit(input, result);
        }
      }}
    />
  );
}
