import { apiClient } from "@/lib/api/client";

/**
 * The backend proxies these straight through as raw JSON from FlowPOS (see
 * backend/internal/service/catalog.go) rather than committing to an exact
 * field-by-field shape server-side — so these types are best-effort based on
 * the tenant dashboard's own product/customer pickers, which hit the same
 * underlying FlowPOS endpoints. Extra/renamed fields are tolerated.
 */
export interface CatalogProduct {
  id: number;
  name: string;
  slug?: string;
  price: number;
  image?: string | null;
  has_variants?: boolean;
  variants_count?: number;
  default_variant_id?: number | null;
  // VAT config — confirmed fields on the real product response. price is
  // gross (VAT-inclusive) when is_vat_inclusive is true, net (VAT added on
  // top) when false; not taxable at all when is_taxable is false. See
  // utils/tax.ts for how these combine with a picked unit price.
  vat_rate?: number | null;
  is_taxable?: boolean;
  is_vat_inclusive?: boolean;
  [key: string]: unknown;
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

export interface CatalogVariant {
  id: number;
  name?: string;
  price: number;
  sku?: string;
  add_on_groups?: CatalogAddonGroup[];
  [key: string]: unknown;
}

// The product-detail endpoint (GET /catalog/products/:slug) — fetched
// before adding any product to a quote, mirroring the tenant dashboard's own
// order flow: a simple product resolves its default_variant and is added
// directly; a has_variants product's variants are shown for the staff
// member to pick individually.
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
