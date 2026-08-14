import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { useIntl } from 'react-intl';
import { Box, Flex, Typography, IconButton, inputFocusStyle } from '@strapi/design-system';
import { Earth, Bold, Minus, Code, StrikeThrough, Cross } from '@strapi/icons';
import ReactContentEditable, {
    getPasteHtml,
    getPlainTextFromHtml,
    getValueToUpdate,
    htmlToClipboardHtml,
    NBSP,
    normalizeHtmlValue,
} from './ContentEditable';
import { getTranslation } from '../utils/getTranslation';
import showdown from 'showdown';

interface InputProps {
    name: string;
    value?: string;
    onChange: (e: any) => void;
    attribute: Record<any, any>;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    label?: string;
    placeholder?: string;
    hint?: string;
}

const converter = new showdown.Converter();
converter.setOption('simpleLineBreaks', true);

const ContentEditable = styled(ReactContentEditable)`
    flex: 1;
    width: 100%;
    font-size: ${({ theme }) => theme.fontSizes[2]};
    line-height: ${({ theme }) => theme.lineHeights[2]};
    border-radius: ${({ theme }) => theme.borderRadius};
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    background: ${({ theme }) => theme.colors.neutral0};
    padding: ${({ theme }) => `${theme.spaces[2]} ${theme.spaces[4]}`};
    color: ${({ theme }) => theme.colors.neutral800};
    white-space: pre-wrap;
    ${inputFocusStyle()}

    b, strong {
        font-weight: ${({ theme }) => theme.fontWeights.bold};
    }
`;

const Preview = styled.div`
    background: ${({ theme }) => theme.colors.neutral100};
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    padding: ${({ theme }) => `${theme.spaces[2]} ${theme.spaces[4]}`};
    border-radius: ${({ theme }) => theme.borderRadius};
    font-size: ${({ theme }) => theme.fontSizes[2]};
    line-height: ${({ theme }) => theme.lineHeights[1]};
    color: ${({ theme }) => theme.colors.neutral500};
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: anywhere;
`;

const NbspMarker = styled.span`
    background: ${({ theme }) => theme.colors.warning100};
    border-radius: 2px;
    padding: 0 1px;
`;

const executeCommand = (commandId: string, value?: string) => {
    // execCommand() is officially obsolete/deprecated but there's no alternative.
    // User agents cannot drop support for execCommand()
    // because so many services require support for it.
    document.execCommand(commandId, false, value);
};

const insertTextAtSelection = (element: HTMLDivElement | null, text: string) => {
    if (!element) {
        return;
    }

    element.focus();

    if (document.queryCommandSupported?.('insertText') ?? true) {
        document.execCommand('insertText', false, text);
        return;
    }

    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);

    if (!selection || !range) {
        return;
    }

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

const getSelectionPayload = (element: HTMLDivElement | null) => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !element) {
        return null;
    }

    const range = selection.getRangeAt(0);

    if (!element.contains(range.commonAncestorContainer)) {
        return null;
    }

    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    const html = normalizeHtmlValue(container.innerHTML);

    return {
        html: htmlToClipboardHtml(html),
        text: getPlainTextFromHtml(html),
    };
};

const writeClipboardContent = (event: React.ClipboardEvent<HTMLDivElement>, html: string, text: string) => {
    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', html);
    event.preventDefault();
};

const renderCodePreview = (value: string) => {
    const parts = value.split(/(\u00A0|&nbsp;)/gi);

    return parts.map((part, index) => {
        if (part === NBSP || part.toLowerCase() === '&nbsp;') {
            return <NbspMarker key={`nbsp-${index}`}>·</NbspMarker>;
        }

        return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
    });
};

const getHtml = (value: any, markdown: any) => {
    return value && markdown ? converter.makeHtml(value) : (value ?? '');
};

const Input = ({
    name,
    value,
    onChange,
    attribute,
    required,
    disabled,
    error,
    label,
    placeholder,
    hint,
}: InputProps) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [preview, setPreview] = useState(false);
    const { formatMessage } = useIntl();

    const markdown = !!(attribute.options && attribute.options.output === 'markdown');

    // Methods.
    const update = (value: any) => {
        onChange({ target: { name, value } });
    };

    const handleOnPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const plainText = event.clipboardData.getData('text/plain') ?? '';
        const html = event.clipboardData.getData('text/html') ?? '';
        const pastedHtml = getPasteHtml(html, plainText);

        executeCommand('insertHTML', pastedHtml);
        update(getValueToUpdate(ref.current?.innerHTML ?? '', markdown));
    };

    const handleOnCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const payload = getSelectionPayload(ref.current);

        if (!payload) {
            return;
        }

        writeClipboardContent(event, payload.html, payload.text);
    };

    const handleOnCut = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const payload = getSelectionPayload(ref.current);

        if (!payload) {
            return;
        }

        writeClipboardContent(event, payload.html, payload.text);

        if (document.queryCommandSupported?.('delete') ?? true) {
            document.execCommand('delete');
        }
    };

    const handleOnChange = (event: any) => {
        update(getValueToUpdate(event.target.value, markdown));
    };

    const handleOnClear = () => {
        update(getValueToUpdate(getHtml(value, markdown), markdown, true));
    };

    const handleOnPreview = () => {
        setPreview((preview) => !preview);
    };

    const handleOnKeyDown = (event: any) => {
        if (event.key === 'Escape') {
            ref.current?.blur();
        }
    };

    const localized = Boolean(attribute?.pluginOptions?.i18n?.localized || false);

    const _disabled = Boolean(disabled || false);

    return (
        <Box>
            {label && (
                <Flex paddingBottom={1}>
                    <Typography variant="pi" fontWeight="bold" textColor="neutral800">
                        {label}
                    </Typography>
                    {required && (
                        <Typography variant="omega" fontWeight="bold" textColor="danger600">
                            *
                        </Typography>
                    )}
                    {localized && (
                        <Flex paddingLeft={1}>
                            <Earth width={12} height={12} />
                        </Flex>
                    )}
                </Flex>
            )}
            <Flex gap={2}>
                <ContentEditable
                    ref={ref}
                    html={getHtml(value, markdown)}
                    onPaste={handleOnPaste}
                    onCopy={handleOnCopy}
                    onCut={handleOnCut}
                    onChange={handleOnChange}
                    onKeyDown={handleOnKeyDown}
                    disabled={_disabled}
                />
                <IconButton
                    label={formatMessage({
                        id: getTranslation('action.bold'),
                        defaultMessage: 'Bold',
                    })}
                    onClick={() => executeCommand('bold')}
                    disabled={_disabled}
                >
                    <Bold />
                </IconButton>
                <IconButton
                    label={formatMessage({
                        id: getTranslation('action.insert-nbsp'),
                        defaultMessage: 'Insert non-breaking space',
                    })}
                    onClick={() => insertTextAtSelection(ref.current, NBSP)}
                    disabled={_disabled}
                >
                    <Minus />
                </IconButton>
                <IconButton
                    label={formatMessage({
                        id: getTranslation('action.clear-format'),
                        defaultMessage: 'Clear formatting',
                    })}
                    onClick={handleOnClear}
                    disabled={_disabled}
                >
                    <StrikeThrough />
                </IconButton>
                <IconButton
                    label={formatMessage({
                        id: getTranslation('action.toggle-code'),
                        defaultMessage: 'Show code',
                    })}
                    onClick={handleOnPreview}
                    disabled={_disabled}
                >
                    {preview ? <Cross /> : <Code />}
                </IconButton>
            </Flex>
            {value && preview && (
                <Box marginTop={2}>
                    <Preview>{renderCodePreview(value)}</Preview>
                </Box>
            )}
            {(error || hint) && (
                <Box paddingTop={1}>
                    {error ? (
                        <Typography variant="pi" textColor="danger600">
                            {error}
                        </Typography>
                    ) : (
                        <Typography variant="pi" textColor="neutral600">
                            {hint}
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default Input;
