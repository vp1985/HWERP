import type { Inquiry, InquiryMessage } from '../../src/app/lib/types';
import { redactInquirySensitiveAmountText } from '../../src/app/lib/inquiryTextUtils';

export interface ParsedInquiryMail {
  sourceMessageId: string | null;
  subject: string;
  senderName: string | null;
  senderEmail: string | null;
  replyToEmail: string | null;
  body: string;
  receivedAt: string;
  threadId: string | null;
}

export interface InquiryImportRecords {
  inquiry: Inquiry;
  message: InquiryMessage;
}

interface MailAddress {
  name: string | null;
  email: string | null;
}

const DEFAULT_NEXT_ACTION = 'Mail prüfen und Anfrage triagieren';

export function parseInquiryMailFixture(rawMail: string): ParsedInquiryMail {
  const { headers, body } = splitRawMail(rawMail);
  const messageId = normalizeOptionalHeader(headers.get('message-id'));
  const subject = normalizeHeader(headers.get('subject')) || 'Anfrage ohne Betreff';
  const from = parseMailAddress(headers.get('from'));
  const replyTo = parseMailAddress(headers.get('reply-to'));
  const receivedAt = parseMailDate(headers.get('date'));

  return {
    sourceMessageId: messageId,
    subject,
    senderName: from.name,
    senderEmail: from.email,
    replyToEmail: replyTo.email,
    body: redactInquirySensitiveAmountText(normalizeMailBody(body)),
    receivedAt,
    threadId: normalizeThreadId(headers, messageId),
  };
}

export function isDuplicateMailMessage(mail: ParsedInquiryMail, importedMessageIds: Iterable<string | null | undefined>): boolean {
  if (!mail.sourceMessageId) {
    return false;
  }

  const normalizedMessageId = normalizeMessageId(mail.sourceMessageId);
  for (const importedMessageId of importedMessageIds) {
    if (normalizeMessageId(importedMessageId) === normalizedMessageId) {
      return true;
    }
  }
  return false;
}

export function buildInquiryImportRecords(rawMail: string, options: {
  inquiryId: string;
  messageId: string;
  now?: string;
}): InquiryImportRecords {
  const mail = parseInquiryMailFixture(rawMail);
  const now = options.now ?? new Date().toISOString();
  const senderEmail = mail.replyToEmail ?? mail.senderEmail;

  const inquiry: Inquiry = {
    id: options.inquiryId,
    createdAt: now,
    updatedAt: now,
    title: mail.subject,
    status: 'new',
    priority: 'normal',
    source: 'email',
    sourceMessageId: mail.sourceMessageId,
    senderName: mail.senderName,
    senderEmail,
    senderPhone: null,
    customerId: null,
    locationId: null,
    assetId: null,
    relatedCalculationId: null,
    assigneeUserId: null,
    assignedByUserId: null,
    assignedAt: null,
    createdByUserId: null,
    summary: buildInquirySummary(mail),
    rawText: mail.body,
    receivedAt: mail.receivedAt,
    lastActionAt: null,
    nextAction: DEFAULT_NEXT_ACTION,
    needsAttention: true,
  };

  const message: InquiryMessage = {
    id: options.messageId,
    createdAt: now,
    updatedAt: now,
    inquiryId: options.inquiryId,
    source: 'email',
    direction: 'inbound',
    subject: mail.subject,
    body: mail.body,
    senderName: mail.senderName,
    senderEmail,
    sourceMessageId: mail.sourceMessageId,
    threadId: mail.threadId,
    attachmentIds: [],
    receivedAt: mail.receivedAt,
  };

  return { inquiry, message };
}

function splitRawMail(rawMail: string): { headers: Map<string, string>; body: string } {
  const normalized = rawMail.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const separatorIndex = normalized.indexOf('\n\n');
  const rawHeaders = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized;
  const body = separatorIndex >= 0 ? normalized.slice(separatorIndex + 2) : '';
  const unfoldedHeaders = rawHeaders.replace(/\n[\t ]+/g, ' ');
  const headers = new Map<string, string>();

  for (const line of unfoldedHeaders.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) {
      continue;
    }
    headers.set(line.slice(0, colonIndex).trim().toLowerCase(), line.slice(colonIndex + 1).trim());
  }

  return { headers, body };
}

function normalizeHeader(value: string | null | undefined): string {
  return decodeMimeWords(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeOptionalHeader(value: string | null | undefined): string | null {
  const normalized = normalizeHeader(value);
  return normalized.length > 0 ? normalized : null;
}

function parseMailAddress(value: string | null | undefined): MailAddress {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return { name: null, email: null };
  }

  const angleMatch = normalized.match(/^(.*?)<([^<>\s]+@[^<>\s]+)>$/);
  if (angleMatch) {
    const name = angleMatch[1].trim().replace(/^"|"$/g, '').trim();
    return { name: name || null, email: angleMatch[2].toLowerCase() };
  }

  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return {
    name: emailMatch ? normalized.replace(emailMatch[0], '').replace(/[<>"()]/g, '').trim() || null : normalized,
    email: emailMatch ? emailMatch[0].toLowerCase() : null,
  };
}

function normalizeMailBody(body: string): string {
  const withoutHtml = body
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  const lines = withoutHtml
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .map((line) => line === '-- ' ? '--' : line);

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function parseMailDate(value: string | null | undefined): string {
  const normalized = normalizeHeader(value);
  const parsedTime = normalized ? Date.parse(normalized) : Number.NaN;
  return Number.isNaN(parsedTime) ? new Date(0).toISOString() : new Date(parsedTime).toISOString();
}

function normalizeThreadId(headers: Map<string, string>, messageId: string | null): string | null {
  const references = normalizeOptionalHeader(headers.get('references'));
  if (references) {
    const referenceIds = references.match(/<[^<>]+>/g);
    return referenceIds?.[0] ?? references;
  }

  return normalizeOptionalHeader(headers.get('in-reply-to')) ?? messageId;
}

function normalizeMessageId(value: string | null | undefined): string | null {
  return normalizeOptionalHeader(value)?.toLowerCase() ?? null;
}

function buildInquirySummary(mail: ParsedInquiryMail): string {
  const firstNonEmptyLine = mail.body.split('\n').find((line) => line.trim().length > 0);
  return firstNonEmptyLine ?? mail.subject;
}

function decodeMimeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_match, charset: string, encoding: string, text: string) => {
    if (!/^utf-?8$/i.test(charset)) {
      return text;
    }

    if (encoding.toLowerCase() === 'b') {
      return Buffer.from(text, 'base64').toString('utf8');
    }

    const bytes: number[] = [];
    const normalizedText = text.replace(/_/g, ' ');
    for (let index = 0; index < normalizedText.length; index += 1) {
      if (normalizedText[index] === '=' && /^[0-9A-F]{2}$/i.test(normalizedText.slice(index + 1, index + 3))) {
        bytes.push(Number.parseInt(normalizedText.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(normalizedText.charCodeAt(index));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  });
}
