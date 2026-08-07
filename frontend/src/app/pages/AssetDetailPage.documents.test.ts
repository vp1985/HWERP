import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = () => readFileSync('src/app/pages/AssetDetailPage.tsx', 'utf8');

describe('AssetDetailPage media/document tabs', () => {
  it('offers separate Bilder and Dokumente tabs backed by assetDocuments', () => {
    const page = source();

    expect(page).toContain("tabId: 'asset-images'");
    expect(page).toContain("tabLabel: 'Bilder'");
    expect(page).toContain("tabId: 'asset-documents'");
    expect(page).toContain("tabLabel: 'Dokumente'");
    expect(page).toContain("tabId: 'asset-history'");
    expect(page).toContain("tabLabel: 'Historie'");
    expect(page).toContain("tabId: 'asset-links'");
    expect(page).toContain("tabLabel: 'Verknüpfungen'");
    expect(page).toContain("repository.list<AssetDocument>('assetDocuments')");
    expect(page).toContain("repository.create<AssetDocument>('assetDocuments'");
  });

  it('separates photo uploads from document uploads in the UI', () => {
    const page = source();

    expect(page).toContain("accept=\"image/*\"");
    expect(page).toContain("handleAssetDocumentUpload(event, 'photo')");
    expect(page).toContain('Foto hochladen');
    expect(page).toContain('Dokument hochladen');
    expect(page).toContain('assetDocumentKindOptions');
    expect(page).toContain("getSelectOptionsForList(selectOptions, 'assetDocument.kind')");
  });

  it('stores upload audit data, supports comments and shows newest media first', () => {
    const page = source();

    expect(page).toContain('uploadedAt: now');
    expect(page).toContain('uploadedBy: currentRole');
    expect(page).toContain('comment: uploadComment');
    expect(page).toContain('Kommentar beim Hochladen');
    expect(page).toContain('Kommentar speichern');
    expect(page).toContain('handleSaveAssetDocumentComment');
    expect(page).toContain('formatAssetDocumentTimestamp(getAssetDocumentUploadTimestamp(document))');
    expect(page).toContain('sortAssetDocumentsNewestFirst');
  });

  it('builds history from assignments, documents and maintenance records', () => {
    const page = source();

    expect(page).toContain("repository.list<AssetHistoryEntry>('assetHistoryEntries')");
    expect(page).toContain('createAssignmentHistoryEntry');
    expect(page).toContain("repository.create<AssetHistoryEntry>('assetHistoryEntries'");
    expect(page).toContain('Wartung ausgeführt');
    expect(page).toContain('Dokument hinzugefügt');
    expect(page).toContain('assetHistoryItems.map');
    expect(page).toContain("getAssetDocumentKindLabel(kind, selectOptions)");
  });

  it('shows inquiry links in history and in a dedicated Verknüpfungen tab', () => {
    const page = source();

    expect(page).toContain("repository.list<Inquiry>('inquiries')");
    expect(page).toContain("repository.list<InquiryScopeItem>('inquiryScopeItems')");
    expect(page).toContain('assetInquiryLinks');
    expect(page).toContain("Aktuelle und vergangene Anfrage-Verknüpfungen dieses Assets.");
    expect(page).toContain('Anfrage öffnen');
    expect(page).toContain("entry.metadata?.source === 'inquiry'");
    expect(page).toContain("linkTo: getAssetHistoryEntryMetadataText(entry, 'inquiryId')");
  });
});
