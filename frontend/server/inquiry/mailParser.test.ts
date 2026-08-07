import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildInquiryImportRecords,
  isDuplicateMailMessage,
  parseInquiryMailFixture,
} from './mailParser';

const receivedAt = '2026-05-31T10:30:00.000Z';
const fixtureMail = readFileSync(new URL('./fixtures/rfq-ht42.eml', import.meta.url), 'utf8');

describe('inquiry mail fixture parser', () => {
  it('normalizes subject, sender, reply-to and body from a raw mail fixture', () => {
    expect(parseInquiryMailFixture(fixtureMail)).toEqual({
      sourceMessageId: '<rfq-ht42@example.com>',
      subject: 'Anfrage: Wartung Trafo HT-42',
      senderName: 'Max Mustermann',
      senderEmail: 'max@example.com',
      replyToEmail: 'service@example.com',
      body: [
        'Hallo HWERP,',
        '',
        'bitte Trafo HT-42 prüfen.',
        'Standort: Werk 2',
        'Budget [Betrag entfernt] bitte nicht übernehmen.',
        '',
        '--',
        'Max',
      ].join('\n'),
      receivedAt,
      threadId: '<rfq-ht42@example.com>',
    });
  });

  it('normalizes utf-8 encoded German mail headers', () => {
    const encodedMail = [
      'Message-ID: <encoded@example.com>',
      'Date: Sun, 31 May 2026 10:30:00 +0000',
      'From: =?UTF-8?Q?J=C3=B6rg_M=C3=BCller?= <joerg@example.com>',
      'Reply-To: =?UTF-8?Q?Pr=C3=BCfung?= <pruefung@example.com>',
      'Subject: =?UTF-8?Q?Anfrage:_Pr=C3=BCfung_Trafo?=',
      '',
      'Bitte prüfen.',
    ].join('\r\n');

    expect(parseInquiryMailFixture(encodedMail)).toMatchObject({
      subject: 'Anfrage: Prüfung Trafo',
      senderName: 'Jörg Müller',
      senderEmail: 'joerg@example.com',
      replyToEmail: 'pruefung@example.com',
    });
  });

  it('detects duplicate message ids before import', () => {
    const mail = parseInquiryMailFixture(fixtureMail);

    expect(isDuplicateMailMessage(mail, ['<rfq-ht42@example.com>'])).toBe(true);
    expect(isDuplicateMailMessage(mail, ['other-message'])).toBe(false);
  });

  it('creates a price-free inquiry card and inbound message from the fixture', () => {
    const records = buildInquiryImportRecords(fixtureMail, {
      inquiryId: 'inq-mail-1',
      messageId: 'msg-mail-1',
      now: '2026-05-31T11:00:00.000Z',
    });

    expect(records.inquiry).toMatchObject({
      id: 'inq-mail-1',
      title: 'Anfrage: Wartung Trafo HT-42',
      status: 'new',
      priority: 'normal',
      source: 'email',
      sourceMessageId: '<rfq-ht42@example.com>',
      senderName: 'Max Mustermann',
      senderEmail: 'service@example.com',
      receivedAt,
      needsAttention: true,
      nextAction: 'Mail prüfen und Anfrage triagieren',
      rawText: expect.not.stringContaining('1.250 €'),
    });
    expect(records.message).toMatchObject({
      id: 'msg-mail-1',
      inquiryId: 'inq-mail-1',
      source: 'email',
      direction: 'inbound',
      subject: 'Anfrage: Wartung Trafo HT-42',
      body: expect.not.stringContaining('1.250 €'),
      senderName: 'Max Mustermann',
      senderEmail: 'service@example.com',
      sourceMessageId: '<rfq-ht42@example.com>',
      threadId: '<rfq-ht42@example.com>',
      receivedAt,
    });
  });
});
