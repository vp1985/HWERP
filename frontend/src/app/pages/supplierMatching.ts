import { Customer, SupplierCapability, SupplierCapabilityTag, SupplierProductCategory } from '../lib/types';
import { hasSupplierRole } from './customerBusinessPartner';

export interface SupplierMatchCriteria {
  query?: string;
  selectedCategoryId?: string;
  selectedServiceTags?: string[];
}

export interface SupplierMatch {
  supplier: Customer;
  capability: SupplierCapability;
  category: SupplierProductCategory;
  reasons: string[];
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeSupplierCapabilityInput(materials: string, productTerms: string, serviceTags: string): {
  materials: string[];
  productTerms: string[];
  serviceTags: string[];
} {
  return {
    materials: splitList(materials),
    productTerms: splitList(productTerms),
    serviceTags: splitList(serviceTags),
  };
}

function categoryMatchesQuery(category: SupplierProductCategory, query: string): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeToken(query);
  const candidates = [category.name, ...category.aliases].map(normalizeToken);
  return candidates.some((candidate) => normalizedQuery.includes(candidate) || candidate.includes(normalizedQuery));
}

function materialMatchesQuery(capability: SupplierCapability, query: string): boolean {
  if (!query || capability.materials.length === 0) return true;
  const normalizedQuery = normalizeToken(query);
  const capabilityMaterials = capability.materials.map(normalizeToken);
  const queryMentionsKnownMaterial = capabilityMaterials.some((material) => normalizedQuery.includes(material));
  if (queryMentionsKnownMaterial) return true;

  const commonMaterialTerms = ['stahl', 'aluminium', 'alu', 'edelstahl', 'kunststoff', 'folie', 'folienauskleidung'];
  const queryMentionsOtherMaterial = commonMaterialTerms.some((term) => normalizedQuery.includes(term));
  return !queryMentionsOtherMaterial;
}

function productTermMatchesQuery(capability: SupplierCapability, query: string): boolean {
  if (!query) return false;
  const normalizedQuery = normalizeToken(query);
  return (capability.productTerms ?? []).some((term) => {
    const normalizedTerm = normalizeToken(term);
    return normalizedQuery.includes(normalizedTerm) || normalizedTerm.includes(normalizedQuery);
  });
}

function matchingProductTerms(capability: SupplierCapability, query: string): string[] {
  if (!query) return [];
  const normalizedQuery = normalizeToken(query);
  return (capability.productTerms ?? []).filter((term) => {
    const normalizedTerm = normalizeToken(term);
    return normalizedQuery.includes(normalizedTerm) || normalizedTerm.includes(normalizedQuery);
  });
}

function serviceTagMatchesQuery(tag: string, query: string, maintainedTags: SupplierCapabilityTag[]): boolean {
  const normalizedQuery = normalizeToken(query);
  const maintained = maintainedTags.find((candidate) => normalizeToken(candidate.name) === normalizeToken(tag));
  return [tag, ...(maintained?.aliases ?? [])].some((candidate) => normalizedQuery.includes(normalizeToken(candidate)));
}

function capabilityMatchesQuery(
  capability: SupplierCapability,
  category: SupplierProductCategory,
  query: string,
  maintainedTags: SupplierCapabilityTag[],
): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeToken(query);
  return (
    categoryMatchesQuery(category, query) ||
    normalizeToken(capability.capabilityLabel).includes(normalizedQuery) ||
    productTermMatchesQuery(capability, query) ||
    capability.materials.some((material) => normalizedQuery.includes(normalizeToken(material))) ||
    capability.serviceTags.some((tag) => serviceTagMatchesQuery(tag, query, maintainedTags))
  );
}

function hasAllSelectedTags(capability: SupplierCapability, selectedTags: string[]): boolean {
  const available = new Set(capability.serviceTags.map(normalizeToken));
  return selectedTags.every((tag) => available.has(normalizeToken(tag)));
}

function buildReasons(capability: SupplierCapability, category: SupplierProductCategory, query: string): string[] {
  const reasons = [`passt wegen Kategorie ${category.name}`];
  const products = matchingProductTerms(capability, query);
  if (products.length > 0) reasons.push(`Produkt: ${products.join(', ')}`);
  if (capability.materials.length > 0) reasons.push(`Material: ${capability.materials.join(', ')}`);
  if (capability.serviceTags.length > 0) reasons.push(`Chips: ${capability.serviceTags.join(', ')}`);
  return reasons;
}

export function findSupplierMatches(
  criteria: SupplierMatchCriteria,
  suppliers: Customer[],
  categories: SupplierProductCategory[],
  capabilities: SupplierCapability[],
  maintainedTags: SupplierCapabilityTag[],
): SupplierMatch[] {
  const selectedTags = criteria.selectedServiceTags?.filter(Boolean) ?? [];
  const activeCategories = new Map(
    categories.filter((category) => category.active && !category.archivedAt).map((category) => [category.id, category]),
  );
  const activeSuppliers = new Map(
    suppliers.filter((supplier) => hasSupplierRole(supplier.roles)).map((supplier) => [supplier.id, supplier]),
  );

  return capabilities
    .filter((capability) => capability.active)
    .flatMap((capability) => {
      const supplier = activeSuppliers.get(capability.customerId);
      const category = activeCategories.get(capability.categoryId);
      if (!supplier || !category) return [];
      if (criteria.selectedCategoryId && capability.categoryId !== criteria.selectedCategoryId) return [];
      if (!capabilityMatchesQuery(capability, category, criteria.query?.trim() ?? '', maintainedTags)) return [];
      if (!materialMatchesQuery(capability, criteria.query?.trim() ?? '')) return [];
      if (!hasAllSelectedTags(capability, selectedTags)) return [];
      return [{ supplier, capability, category, reasons: buildReasons(capability, category, criteria.query?.trim() ?? '') }];
    })
    .sort((left, right) => left.capability.priorityRank - right.capability.priorityRank || left.supplier.name.localeCompare(right.supplier.name));
}
