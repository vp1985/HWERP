import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

// POST /api/reset
router.post('/', async (_req: Request, res: Response) => {
  try {
    await pool.query(`
      TRUNCATE
        customers, supplier_product_categories, supplier_capabilities,
        supplier_capability_tags, assets, materials, services, calculations,
        calculation_line_items, transformer_inventory_calculation_links,
        transformer_inventory_reservations, transformer_inventory_detail_overrides,
        transformer_inventory_attachments, inquiry_scope_items, inquiry_external_links,
        inquiry_attachments, inquiry_response_drafts, inquiry_messages,
        inquiry_master_data_categories, inquiries, tags, locations, location_customers,
        contact_persons, customer_contact_persons, location_contact_overrides,
        asset_contact_overrides, transfer_receipt_items, transfer_receipts,
        asset_documents, sequences, app_settings,
        workshop_card_tasks, workshop_cards, workshop_task_templates,
        asset_tags, location_tags, contact_person_tags, asset_types
      CASCADE
    `);
    res.json({ reset: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
