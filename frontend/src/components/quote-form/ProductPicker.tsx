import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Checkbox, Input, SidePanel, SidePanelBody, SidePanelFooter } from "@flowposltd/ui";
import { Plus, Search } from "lucide-react";
import {
  getProduct,
  listProducts,
  type CatalogAddonGroup,
  type CatalogProduct,
  type CatalogVariant,
} from "@/lib/api/catalog";
import { useDebouncedValue } from "@/utils";
import { formatMoney } from "@/utils/quote-helpers";
import { computeItemTax } from "@/utils/tax";

export interface PickedAddon {
  extensionId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface PickedProduct {
  variantId?: number;
  name: string;
  unitPrice: number;
  taxPerUnit?: number;
  // Whether taxPerUnit is baked into unitPrice (VAT-inclusive) or added on
  // top of it (VAT-exclusive) — see computeItemTax. Undefined when there's
  // no tax at all.
  taxInclusive?: boolean;
  addons?: PickedAddon[];
}

interface ProductPickerProps {
  onAdd: (product: PickedProduct) => void;
}

// VAT config lives on the product, not the variant.
interface TaxInfo {
  vatRate: number | null | undefined;
  isTaxable: boolean | undefined;
  isVatInclusive: boolean | undefined;
}

// Pick a variant if the product has more than one, then pick add-ons if the
// chosen variant has any.
type Stage =
  | { kind: "variants"; productName: string; variants: CatalogVariant[]; tax: TaxInfo }
  | { kind: "addons"; productName: string; variant: CatalogVariant; groups: CatalogAddonGroup[]; tax: TaxInfo }
  | null;

function activeAddonGroups(variant?: CatalogVariant): CatalogAddonGroup[] {
  return (variant?.add_on_groups ?? [])
    .map((group) => ({ ...group, addons: group.addons.filter((a) => a.is_active) }))
    .filter((group) => group.addons.length > 0);
}

export function ProductPicker({ onAdd }: ProductPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [stage, setStage] = useState<Stage>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<number>>(new Set());

  const { data: products, isFetching } = useQuery({
    queryKey: ["catalog", "products", debouncedSearch],
    queryFn: () => listProducts(debouncedSearch || undefined),
  });

  // Always resolved via the detail endpoint first — add-on groups are never
  // eager-loaded on the list response.
  const resolveMutation = useMutation({
    mutationFn: (product: CatalogProduct) => getProduct(product.slug ?? String(product.id)),
    onSuccess: (detail) => {
      const tax: TaxInfo = {
        vatRate: detail.vat_rate,
        isTaxable: detail.is_taxable,
        isVatInclusive: detail.is_vat_inclusive,
      };
      if (detail.has_variants && detail.variants && detail.variants.length > 0) {
        setStage({ kind: "variants", productName: detail.name, variants: detail.variants, tax });
        return;
      }
      proceedWithVariant(detail.name, detail.default_variant ?? undefined, detail.price, tax);
    },
  });

  function proceedWithVariant(
    productName: string,
    variant: CatalogVariant | undefined,
    fallbackPrice: number,
    tax: TaxInfo
  ) {
    const groups = activeAddonGroups(variant);
    if (groups.length > 0) {
      setSelectedAddonIds(new Set());
      setStage({ kind: "addons", productName, variant: variant!, groups, tax });
      return;
    }
    addProduct(productName, variant, fallbackPrice, tax, []);
  }

  function addProduct(
    productName: string,
    variant: CatalogVariant | undefined,
    fallbackPrice: number,
    tax: TaxInfo,
    addons: PickedAddon[]
  ) {
    const basePrice = variant?.price ?? fallbackPrice;
    const { unitPrice, taxPerUnit } = computeItemTax(basePrice, tax.vatRate, tax.isTaxable, tax.isVatInclusive);
    onAdd({
      variantId: variant?.id,
      name: variant?.name ? `${productName} - ${variant.name}` : productName,
      unitPrice,
      taxPerUnit: taxPerUnit > 0 ? taxPerUnit : undefined,
      taxInclusive: taxPerUnit > 0 ? Boolean(tax.isVatInclusive) : undefined,
      addons: addons.length > 0 ? addons : undefined,
    });
    setStage(null);
  }

  // Checkbox-only — quantity is fixed at 1 per addon.
  function toggleAddon(id: number, group: CatalogAddonGroup) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const selectedInGroup = group.addons.filter((a) => next.has(a.id)).length;
      if (group.max_selection > 0 && selectedInGroup >= group.max_selection) return prev;
      next.add(id);
      return next;
    });
  }

  const addonsValid = useMemo(() => {
    if (!stage || stage.kind !== "addons") return true;
    return stage.groups.every((g) => g.addons.filter((a) => selectedAddonIds.has(a.id)).length >= g.min_selection);
  }, [stage, selectedAddonIds]);

  function confirmAddons() {
    if (!stage || stage.kind !== "addons" || !addonsValid) return;
    const addons: PickedAddon[] = stage.groups
      .flatMap((g) => g.addons)
      .filter((a) => selectedAddonIds.has(a.id))
      .map((a) => ({ extensionId: a.id, name: a.name, price: a.price, quantity: 1 }));
    addProduct(stage.productName, stage.variant, stage.variant.price, stage.tax, addons);
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-content-secondary" />
        <Input
          className="pl-8"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {isFetching && <p className="p-3 text-sm text-content-secondary">Searching…</p>}
        {!isFetching && (products?.length ?? 0) === 0 && (
          <p className="p-3 text-sm text-content-secondary">No products found.</p>
        )}
        {products?.map((product) => (
          <div key={product.id} className="flex items-center justify-between gap-3 p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {product.image && (
                <img src={product.image} alt="" className="size-8 rounded object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-content-secondary">
                  {formatMoney(product.price)}
                  {product.has_variants && product.variants_count ? ` · ${product.variants_count} variants` : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={resolveMutation.isPending && resolveMutation.variables?.id === product.id}
              onClick={() => resolveMutation.mutate(product)}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        ))}
      </div>

      <SidePanel
        open={stage?.kind === "variants"}
        onOpenChange={(open) => !open && setStage(null)}
        title={stage?.kind === "variants" ? stage.productName : ""}
        description="Choose a variant"
      >
        <SidePanelBody className="flex flex-col gap-1.5">
          {stage?.kind === "variants" &&
            stage.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-left hover:bg-primary/5"
                onClick={() => proceedWithVariant(stage.productName, variant, variant.price, stage.tax)}
              >
                <span className="text-sm font-medium text-foreground">
                  {variant.name ?? `Variant #${variant.id}`}
                </span>
                <span className="text-sm text-content-secondary">{formatMoney(variant.price)}</span>
              </button>
            ))}
        </SidePanelBody>
      </SidePanel>

      <SidePanel
        open={stage?.kind === "addons"}
        onOpenChange={(open) => !open && setStage(null)}
        title={stage?.kind === "addons" ? stage.productName : ""}
        description="Add-ons"
      >
        <SidePanelBody className="flex flex-col gap-4">
          {stage?.kind === "addons" &&
            stage.groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-foreground">
                  {group.name}
                  {group.min_selection > 0 && <span className="text-destructive ml-1">*</span>}
                  <span className="ml-2 text-xs font-normal text-content-secondary">
                    {group.min_selection > 0
                      ? `Pick ${group.min_selection}${
                          group.max_selection > group.min_selection ? `–${group.max_selection}` : ""
                        }`
                      : group.max_selection > 0
                        ? `Pick up to ${group.max_selection}`
                        : "Optional"}
                  </span>
                </p>
                {group.addons.map((addon) => (
                  <label
                    key={addon.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedAddonIds.has(addon.id)}
                        onCheckedChange={() => toggleAddon(addon.id, group)}
                      />
                      {addon.name}
                    </span>
                    <span className="text-content-secondary">+{formatMoney(addon.price)}</span>
                  </label>
                ))}
              </div>
            ))}
        </SidePanelBody>
        <SidePanelFooter>
          <Button type="button" className="w-full" disabled={!addonsValid} onClick={confirmAddons}>
            Add to quote
          </Button>
        </SidePanelFooter>
      </SidePanel>
    </div>
  );
}
