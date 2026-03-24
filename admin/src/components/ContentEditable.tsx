import React, { forwardRef, SyntheticEvent, useEffect, useRef } from 'react';
import { parse, NodeType } from 'node-html-parser';

type ParsedNode = { type: 'break' } | { type: 'text'; bold: boolean; text: string };

const normalizeText = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const textToNodes = (text: string, bold: boolean) => {
    return normalizeText(text).split('\n').reduce((nodes: ParsedNode[], segment: string, index: number) => {
        if (index > 0) {
            nodes.push({ type: 'break' });
        }

        if (segment.length > 0) {
            nodes.push({ type: 'text', text: segment, bold });
        }

        return nodes;
    }, []);
};

const isPlaceholderBlock = (node: any) => {
    return (
        (node.tagName === 'DIV' || node.tagName === 'P') &&
        node.childNodes.length === 1 &&
        node.childNodes[0].nodeType === NodeType.ELEMENT_NODE &&
        node.childNodes[0].tagName === 'BR'
    );
};

const isBoldElement = (node: any) => {
    if (node.tagName === 'B' || node.tagName === 'STRONG') {
        return true;
    }

    const style = node.getAttribute?.('style') ?? '';
    return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
};

const reduceParsed = (html: any, bold: boolean = false) => {
    return html.childNodes.reduce((nodes: ParsedNode[], child: any, index: number) => {
        if (child.nodeType === NodeType.TEXT_NODE) {
            return [...nodes, ...textToNodes(child.text, bold)];
        }

        if (child.nodeType !== NodeType.ELEMENT_NODE) {
            return nodes;
        }

        if (child.tagName === 'BR') {
            return [...nodes, { type: 'break' }];
        }

        if (child.tagName === 'DIV' || child.tagName === 'P') {
            const withBreak = index > 0 ? [...nodes, { type: 'break' }] : nodes;

            if (child.childNodes.length === 0 || isPlaceholderBlock(child)) {
                return withBreak;
            }

            return [...withBreak, ...reduceParsed(child, bold)];
        }

        if (isBoldElement(child)) {
            return [...nodes, ...reduceParsed(child, true)];
        }

        if (child.childNodes && child.childNodes.length > 0) {
            return [...nodes, ...reduceParsed(child, bold)];
        }

        return nodes;
    }, []);
};

const escapeHtml = (text: string) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const onlyBreaks = (parsed: ParsedNode[]) => parsed.length > 0 && parsed.every((node) => node.type === 'break');

const toMarkdown = (parsed: ParsedNode[], clear: boolean) => {
    return parsed.reduce((html: string, node: ParsedNode) => {
        if (node.type === 'break') {
            return `${html}  \n`;
        }

        if (node.type === 'text' && node.bold && !clear) {
            return `${html}**${clear ? node.text.replace(/(\n)/gm, '') : node.text}**`;
        }

        if (node.type === 'text') {
            return html + (clear ? node.text.replace(/(\n)/gm, '') : node.text);
        }

        return html;
    }, '');
};

const toHtml = (parsed: ParsedNode[], clear: boolean) => {
    return parsed.reduce((html: string, node: ParsedNode) => {
        if (node.type === 'break') {
            return `${html}<br>`;
        }

        if (node.type === 'text' && node.bold && !clear) {
            return `${html}<b>${escapeHtml(node.text)}</b>`;
        }

        if (node.type === 'text') {
            return html + escapeHtml(node.text);
        }

        return html;
    }, '');
};

const normalizeHtmlValue = (html: string) => {
    const parsed = reduceParsed(parse(html ?? ''));

    if (onlyBreaks(parsed)) {
        return '';
    }

    return toHtml(parsed, false);
};

export const getValueToUpdate = (html: string, markdown: boolean, clear: boolean = false) => {
    const parsed = reduceParsed(parse(html ?? ''));

    if (onlyBreaks(parsed)) {
        return '';
    }

    return markdown ? toMarkdown(parsed, clear) : toHtml(parsed, clear);
};

export const getPasteHtml = (html: string, plainText: string) => {
    if (html) {
        return normalizeHtmlValue(html);
    }

    return normalizeText(plainText).split('\n').map(escapeHtml).join('<br>');
};

type ContentEditableEvent = React.SyntheticEvent<any, Event> & { target: { value: string } };
type Modify<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R;
type DivProps = Modify<React.JSX.IntrinsicElements['div'], { onChange: (event: ContentEditableEvent) => void }>;

interface Props extends DivProps {
    html: string;
    disabled?: boolean;
    tagName?: string;
    className?: string;
    style?: Object;
    innerRef?: React.RefObject<HTMLElement> | Function;
}

const updateRef = (ref: React.Ref<HTMLElement> | undefined, value: HTMLElement | null) => {
    if (!ref) {
        return;
    }

    if (typeof ref === 'function') {
        ref(value);
        return;
    }

    (ref as React.MutableRefObject<HTMLElement | null>).current = value;
};

const ContentEditable = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
    const { html, innerRef, children, ...rest } = props;
    const divRef = useRef<HTMLDivElement | null>(null);
    const lastHtmlRef = useRef('');

    const emitChange = (originalEvt: SyntheticEvent<any>) => {
        const el = divRef.current;
        if (!el) return;

        const currentHtml = normalizeHtmlValue(el.innerHTML);

        if (currentHtml !== lastHtmlRef.current) {
            const evt = Object.assign({}, originalEvt, {
                target: {
                    value: currentHtml,
                },
            });
            props.onChange(evt);
        }

        lastHtmlRef.current = currentHtml;
    };

    useEffect(() => {
        const el = divRef.current;
        const nextHtml = normalizeHtmlValue(html);

        if (!el) {
            return;
        }

        if (nextHtml !== normalizeHtmlValue(el.innerHTML)) {
            el.innerHTML = html;
        }

        lastHtmlRef.current = nextHtml;
    }, [html]);

    useEffect(() => {
        updateRef(ref as React.Ref<HTMLElement> | undefined, divRef.current);
        updateRef(innerRef as React.Ref<HTMLElement> | undefined, divRef.current);
    }, [innerRef, ref]);

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
