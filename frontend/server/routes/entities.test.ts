import { describe, expect, it } from 'vitest';
import {
  buildInquiryAccessFromUserRow,
  buildInquiryVisibilityClause,
  buildSingleUserInquiryAccess,
  canAccessInquiryRecord,
  canMutateInquiryAssignment,
  canRetargetInquiryChildEntity,
  getEntityTableName,
  parseInquiryAccessHeaders,
} from './entities';

describe('entities route inquiry table mapping', () => {
  it('maps inquiry dashboard entities to PostgreSQL tables', () => {
    expect(getEntityTableName('inquiries')).toBe('inquiries');
    expect(getEntityTableName('inquiryMasterDataCategories')).toBe('inquiry_master_data_categories');
    expect(getEntityTableName('inquiryMessages')).toBe('inquiry_messages');
    expect(getEntityTableName('inquiryResponseDrafts')).toBe('inquiry_response_drafts');
  });

  it('does not expose inquiry permission users through generic entities', () => {
    expect(getEntityTableName('inquiryUsers')).toBeUndefined();
  });

  it('maps customer contact person primary-company flag to PostgreSQL', () => {
    expect(getEntityTableName('customerContactPersons')).toBe('customer_contact_persons');
  });

  it('maps inquiry detail attachment and link entities to PostgreSQL tables', () => {
    expect(getEntityTableName('inquiryAttachments')).toBe('inquiry_attachments');
    expect(getEntityTableName('inquiryExternalLinks')).toBe('inquiry_external_links');
  });

  it('maps inquiry scope items so multiple selected assets can be handed over to calculation', () => {
    expect(getEntityTableName('inquiryScopeItems')).toBe('inquiry_scope_items');
  });

  it('maps Arbeitsvorbereitung workshop card entities to PostgreSQL tables', () => {
    expect(getEntityTableName('workshopTaskTemplates')).toBe('workshop_task_templates');
    expect(getEntityTableName('workshopCards')).toBe('workshop_cards');
    expect(getEntityTableName('workshopCardTasks')).toBe('workshop_card_tasks');
  });

  it('maps central checklist entities to PostgreSQL tables', () => {
    expect(getEntityTableName('checklistTemplates')).toBe('checklist_templates');
    expect(getEntityTableName('checklistTemplateGroups')).toBe('checklist_template_groups');
    expect(getEntityTableName('checklistTemplateItems')).toBe('checklist_template_items');
    expect(getEntityTableName('checklistRuns')).toBe('checklist_runs');
    expect(getEntityTableName('checklistRunLinks')).toBe('checklist_run_links');
    expect(getEntityTableName('checklistRunItems')).toBe('checklist_run_items');
  });

  it('maps supplier inquiry master data and capabilities to PostgreSQL tables', () => {
    expect(getEntityTableName('supplierProductCategories')).toBe('supplier_product_categories');
    expect(getEntityTableName('supplierCapabilities')).toBe('supplier_capabilities');
    expect(getEntityTableName('supplierCapabilityTags')).toBe('supplier_capability_tags');
  });

  it('maps transformer inventory sales, reservation and attachment overlays to PostgreSQL tables', () => {
    expect(getEntityTableName('transformerInventoryCalculationLinks')).toBe('transformer_inventory_calculation_links');
    expect(getEntityTableName('transformerInventoryReservations')).toBe('transformer_inventory_reservations');
    expect(getEntityTableName('transformerInventoryDetailOverrides')).toBe('transformer_inventory_detail_overrides');
    expect(getEntityTableName('transformerInventoryAttachments')).toBe('transformer_inventory_attachments');
  });
});

describe('inquiry server-side access helpers', () => {
  it('treats headers as identity hints, not permission grants', () => {
    expect(parseInquiryAccessHeaders({
      'x-hwerp-user-id': 'dispatcher-1',
      'x-hwerp-inquiry-role': 'dispatcher',
      'x-hwerp-inquiry-can-assign': 'true',
    })).toEqual({
      userId: 'dispatcher-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    });
  });

  it('derives dispatcher/admin permissions from server-side user rows', () => {
    expect(buildInquiryAccessFromUserRow({
      id: 'dispatcher-1',
      role: 'dispatcher',
      active: true,
      can_view_all_inquiries: true,
      can_assign_inquiries: true,
    }, 'ignored')).toEqual({
      userId: 'dispatcher-1',
      role: 'dispatcher',
      canViewAllInquiries: true,
      canAssignInquiries: true,
    });

    expect(buildInquiryAccessFromUserRow({
      id: 'user-1',
      role: 'employee',
      active: true,
      can_view_all_inquiries: true,
      can_assign_inquiries: true,
    }, 'ignored')).toEqual({
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    });
  });

  it('filters normal employees to their assigned inquiry board', () => {
    const clause = buildInquiryVisibilityClause('inquiries', {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    }, 2);

    expect(clause).toEqual({ sql: 'inquiries.assignee_user_id = $2', values: ['user-1'] });
  });

  it('filters inquiry child entities through the assigned parent inquiry', () => {
    const clause = buildInquiryVisibilityClause('inquiryScopeItems', {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    });

    expect(clause).toEqual({
      sql: 'EXISTS (SELECT 1 FROM inquiries visible_inquiry WHERE visible_inquiry.id = inquiry_scope_items.inquiry_id AND visible_inquiry.assignee_user_id = $1)',
      values: ['user-1'],
    });
  });

  it('uses an explicit single-user fallback when trusted inquiry identity headers are disabled', () => {
    expect(buildSingleUserInquiryAccess()).toEqual({
      userId: 'hwerp-single-user',
      role: 'admin',
      canViewAllInquiries: true,
      canAssignInquiries: true,
    });
  });

  it('denies inquiry rows when trusted identity mode has no current user', () => {
    expect(buildInquiryVisibilityClause('inquiries', {
      userId: null,
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toEqual({ sql: '1 = 0', values: [] });
  });

  it('does not filter dispatcher/admin inquiry boards', () => {
    const dispatcherClause = buildInquiryVisibilityClause('inquiries', {
      userId: 'dispatcher-1',
      role: 'dispatcher',
      canViewAllInquiries: true,
      canAssignInquiries: true,
    });
    const adminClause = buildInquiryVisibilityClause('inquiries', {
      userId: 'admin-1',
      role: 'admin',
      canViewAllInquiries: true,
      canAssignInquiries: true,
    });

    expect(dispatcherClause).toEqual({ sql: '', values: [] });
    expect(adminClause).toEqual({ sql: '', values: [] });
  });

  it('blocks assignment changes for users without assignment permission', () => {
    const current = { id: 'inq-1', assignee_user_id: 'user-1' };
    const next = { id: 'inq-1', assignee_user_id: 'user-2' };

    expect(canMutateInquiryAssignment(current, next, {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toBe(false);
  });

  it('does not falsely block unchanged assignment timestamps', () => {
    const current = { id: 'inq-1', assigned_at: new Date('2026-05-31T12:00:00.000Z') };
    const next = { id: 'inq-1', assigned_at: '2026-05-31T12:00:00.000Z' };

    expect(canMutateInquiryAssignment(current, next, {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toBe(true);
  });

  it('blocks assignment changes without a current user', () => {
    const current = { id: 'inq-1', assignee_user_id: 'user-1' };
    const next = { id: 'inq-1', assignee_user_id: 'user-2' };

    expect(canMutateInquiryAssignment(current, next, {
      userId: null,
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toBe(false);
  });

  it('allows dispatcher assignment changes without implying price access', () => {
    const current = { id: 'inq-1', assignee_user_id: 'user-1' };
    const next = { id: 'inq-1', assignee_user_id: 'user-2' };

    expect(canMutateInquiryAssignment(current, next, {
      userId: 'dispatcher-1',
      role: 'dispatcher',
      canViewAllInquiries: true,
      canAssignInquiries: true,
    })).toBe(true);
  });

  it('allows normal users to access only assigned inquiry records', () => {
    expect(canAccessInquiryRecord({ id: 'inq-1', assignee_user_id: 'user-1' }, {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toBe(true);

    expect(canAccessInquiryRecord({ id: 'inq-2', assignee_user_id: 'user-2' }, {
      userId: 'user-1',
      role: 'employee',
      canViewAllInquiries: false,
      canAssignInquiries: false,
    })).toBe(false);
  });

  it('prevents retargeting an existing child row to another inquiry', () => {
    expect(canRetargetInquiryChildEntity('inq-1', 'inq-1')).toBe(true);
    expect(canRetargetInquiryChildEntity('inq-2', 'inq-1')).toBe(false);
    expect(canRetargetInquiryChildEntity(undefined, 'inq-1')).toBe(true);
  });
});
