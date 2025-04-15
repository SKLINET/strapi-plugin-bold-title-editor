import React, { forwardRef, SyntheticEvent, useEffect, useRef, useState } from 'react';

type ContentEditableEvent = React.SyntheticEvent<any, Event> & { target: { value: string } };
type Modify<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R;
type DivProps = Modify<React.JSX.IntrinsicElements["div"], { onChange: ((event: ContentEditableEvent) => void) }>;

interface Props extends DivProps {
  html: string;
  disabled?: boolean;
  tagName?: string;
  className?: string;
  style?: Object;
  innerRef?: React.RefObject<HTMLElement> | Function;
}

const ContentEditable = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const { html, innerRef, children, ...rest } = props;
  const [lastHtml, setLastHtml] = useState('');
  const divRef = ref as React.RefObject<HTMLDivElement>;
  const caretRangeRef = useRef<Range | null>(null);

  const saveCaretPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      caretRangeRef.current = selection.getRangeAt(0);
    }
  };

  const emitChange = (originalEvt: SyntheticEvent<any>) => {
    const el = divRef.current;
    if (!el) return;
    saveCaretPosition();

    const currentHtml = el.innerHTML;
    if (currentHtml !== lastHtml) {
      const evt = Object.assign({}, originalEvt, {
        target: {
          value: currentHtml,
        },
      });
      props.onChange(evt);
      setLastHtml(currentHtml);
    }
  };

  useEffect(() => {
    const el = divRef.current;
    if (el && html !== lastHtml) {
      el.innerHTML = html;
      setLastHtml(html);
    }
  }, [html]);

  return (
    <div
      {...rest}
      ref={divRef}
      onInput={emitChange}
      onBlur={rest.onBlur || emitChange}
      onKeyUp={rest.onKeyUp || emitChange}
      onKeyDown={rest.onKeyDown || emitChange}
      contentEditable={!rest.disabled}
      style={{ whiteSpace: 'pre-wrap', ...props.style }}
    >
      {children}
    </div>
  );
});

export default ContentEditable;
