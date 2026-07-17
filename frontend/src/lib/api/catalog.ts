import { apiClient } from "@/lib/api/client";

// The backend proxies these through as raw JSON from FlowPOS — types are
// best-effort, not committed field-by-field server-side.
export interface CatalogProduct {
  id: number;
  name: string;
  slug?: string;
  price: number;
  // Confirmed against a real response — there's no flat "image" field, just
  // this attachments array (empty when the product has no photo).
  attachments?: { url: string }[];
  has_variants?: boolean;
  variants_count?: number;
  default_variant_id?: number | null;
  // See utils/tax.ts for how these combine with a picked unit price.
  vat_rate?: number | null;
  is_taxable?: boolean;
  is_vat_inclusive?: boolean;
  [key: string]: unknown;
}

export function productImageUrl(product: CatalogProduct): string | undefined {
  return product.attachments?.[0]?.url;
}

export interface CatalogAddon {
  id: number;
  addon_group_id: number;
  name: string;
  price: number;
  is_active: boolean;
  max_quantity: number | null;
}

export interface CatalogAddonGroup {
  id: number;
  name: string;
  min_selection: number;
  max_selection: number;
  addons: CatalogAddon[];
}

// A variant has no flat "name" — confirmed against a real response. Its
// display name is built from `items`, one per choice dimension (e.g. a Size
// of "S" and a Color of "Red" would be two entries here).
export interface CatalogVariantItem {
  id: number;
  name: string;
  choice_type?: { id: number; label: string };
}

export interface CatalogVariant {
  id: number;
  price: number;
  sku?: string;
  items?: CatalogVariantItem[];
  add_on_groups?: CatalogAddonGroup[];
  [key: string]: unknown;
}

// Joins every choice dimension into one label ("S", or "S • Red" for a
// product with more than one choice type) — same separator convention
// tenant-dashboard's own order flow uses for multi-dimension variants.
export function variantLabel(variant: CatalogVariant): string {
  const names = (variant.items ?? []).map((item) => item.name).filter(Boolean);
  return names.length > 0 ? names.join(" • ") : `Variant #${variant.id}`;
}

// GET /catalog/products/:slug — a simple product resolves default_variant
// directly; a has_variants product lists variants to pick from.
export interface CatalogProductDetail extends CatalogProduct {
  variants?: CatalogVariant[];
  default_variant?: CatalogVariant | null;
}

export interface CatalogCategory {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface CatalogCustomer {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  [key: string]: unknown;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string | null;
}

export interface CatalogLocation {
  id: number;
  name: string;
  type?: string;
  address?: {
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state?: string;
    post_code: string;
    country?: { shortcode: string; name: string };
  };
  [key: string]: unknown;
}

// FlowPOS list endpoints come back as either a Laravel paginator
// ({data: T[], ...}) or (locations) a plain array — normalize both to T[].
function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

export async function listProducts(search?: string): Promise<CatalogProduct[]> {
  const { data } = await apiClient.get<{ products: unknown }>("/catalog/products", {
    params: { search },
  });
  return toArray<CatalogProduct>(data.products);
}

export async function getProduct(slug: string): Promise<CatalogProductDetail> {
  const { data } = await apiClient.get<{ product: CatalogProductDetail }>(
    `/catalog/products/${encodeURIComponent(slug)}`
  );
  return data.product;
}

export async function listCategories(search?: string): Promise<CatalogCategory[]> {
  const { data } = await apiClient.get<{ categories: unknown }>("/catalog/categories", {
    params: { search },
  });
  return toArray<CatalogCategory>(data.categories);
}

export async function listCustomers(search?: string): Promise<CatalogCustomer[]> {
  const { data } = await apiClient.get<{ customers: unknown }>("/catalog/customers", {
    params: { search },
  });
  return toArray<CatalogCustomer>(data.customers);
}

export async function createCustomer(input: CreateCustomerInput): Promise<CatalogCustomer> {
  const { data } = await apiClient.post<{ customer: CatalogCustomer }>("/catalog/customers", input);
  return data.customer;
}

export async function listLocations(search?: string): Promise<CatalogLocation[]> {
  const { data } = await apiClient.get<{ locations: unknown }>("/catalog/locations", {
    params: { search },
  });
  return toArray<CatalogLocation>(data.locations);
}
