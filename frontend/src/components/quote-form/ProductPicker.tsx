import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge, Button, Checkbox, Input, Sheet, SheetContent } from "@flowposltd/ui";
import { Minus, Package, Plus, Search } from "lucide-react";
import {
  getProduct,
  listProducts,
  productImageUrl,
  type CatalogAddonGroup,
  type CatalogProduct,
  type CatalogProductDetail,
  type CatalogVariant,
} from "@/lib/api/catalog";
import { cn, useDebouncedValue } from "@/utils";
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
  quantity: number;
  taxPerUnit?: number;
  // Whether taxPerUnit is baked into unitPrice (VAT-inclusive) or added on
  // top of it (VAT-exclusive) — see computeItemTax. Undefined when there's
  // no tax at all.
  taxInclusive?: boolean;
  addons?: PickedAddon[];
  image?: string;
}

interface ProductPickerProps {
  onAdd: (product: PickedProduct) => void;
}

// One product being configured at a time — mirrors tenant-dashboard's own
// product-detail drawer: image, variant pills (if more than one), that
// variant's addon groups, a quantity stepper, then a single "Add" action.
interface Stage {
  detail: CatalogProductDetail;
  selectedVariantId: number | null;
  selectedAddonIds: Set<number>;
  qty: number;
}

function activeAddonGroups(groups: CatalogAddonGroup[] | undefined): CatalogAddonGroup[] {
  return (groups ?? []).filter((g) => g.addons.some((a) => a.is_active));
}

export function ProductPicker({ onAdd }: ProductPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [stage, setStage] = useState<Stage | null>(null);

  const { data: products, isFetching } = useQuery({
    queryKey: ["catalog", "products", debouncedSearch],
    queryFn: () => listProducts(debouncedSearch || undefined),
  });

  // Always resolved via the detail endpoint first — add-on groups are never
  // eager-loaded on the list response.
  const resolveMutation = useMutation({
    mutationFn: (product: CatalogProduct) => getProduct(product.slug ?? String(product.id)),
    onSuccess: (detail) => {
      const variants = detail.variants ?? [];
      const defaultVariant = detail.default_variant ?? variants[0] ?? null;
      const groups = activeAddonGroups(defaultVariant?.add_on_groups);

      // Nothing to choose — add it straight away instead of opening the
      // drawer just to show a single "Add" button.
      if (variants.length <= 1 && groups.length === 0) {
        const tax = computeItemTax(defaultVariant?.price ?? detail.price, detail.vat_rate, detail.is_taxable, detail.is_vat_inclusive);
        onAdd({
          variantId: defaultVariant?.id,
          name: defaultVariant?.name ? `${detail.name} - ${defaultVariant.name}` : detail.name,
          unitPrice: tax.unitPrice,
          quantity: 1,
          taxPerUnit: tax.taxPerUnit > 0 ? tax.taxPerUnit : undefined,
          taxInclusive: tax.taxPerUnit > 0 ? Boolean(detail.is_vat_inclusive) : undefined,
          image: productImageUrl(detail),
        });
        return;
      }

      setStage({
        detail,
        selectedVariantId: defaultVariant?.id ?? null,
        selectedAddonIds: new Set(),
        qty: 1,
      });
    },
  });

  const variants = stage?.detail.variants ?? [];
  const activeVariant: CatalogVariant | null = stage
    ? (variants.find((v) => v.id === stage.selectedVariantId) ?? stage.detail.default_variant ?? null)
    : null;
  const addonGroups: CatalogAddonGroup[] = activeAddonGroups(
    activeVariant?.add_on_groups ?? stage?.detail.default_variant?.add_on_groups
  );

  const tax = stage
    ? computeItemTax(activeVariant?.price ?? stage.detail.price, stage.detail.vat_rate, stage.detail.is_taxable, stage.detail.is_vat_inclusive)
    : null;
  const addonsTotal = addonGroups
    .flatMap((g) => g.addons)
    .filter((a) => stage?.selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const totalPrice = tax ? (tax.unitPrice + addonsTotal) * (stage?.qty ?? 1) : 0;

  const addonsValid = useMemo(() => {
    if (!stage) return true;
    return addonGroups.every((g) => g.addons.filter((a) => stage.selectedAddonIds.has(a.id)).length >= g.min_selection);
  }, [stage, addonGroups]);

  function toggleAddon(addonId: number, group: CatalogAddonGroup) {
    setStage((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selectedAddonIds);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        const selectedInGroup = group.addons.filter((a) => next.has(a.id)).length;
        if (group.max_selection > 0 && selectedInGroup >= group.max_selection) return prev;
        next.add(addonId);
      }
      return { ...prev, selectedAddonIds: next };
    });
  }

  function confirmAdd() {
    if (!stage || !tax || !addonsValid) return;
    const addons: PickedAddon[] = addonGroups
      .flatMap((g) => g.addons)
      .filter((a) => stage.selectedAddonIds.has(a.id))
      .map((a) => ({ extensionId: a.id, name: a.name, price: a.price, quantity: 1 }));
    onAdd({
      variantId: activeVariant?.id,
      name: activeVariant?.name ? `${stage.detail.name} - ${activeVariant.name}` : stage.detail.name,
      unitPrice: tax.unitPrice,
      quantity: stage.qty,
      taxPerUnit: tax.taxPerUnit > 0 ? tax.taxPerUnit : undefined,
      taxInclusive: tax.taxPerUnit > 0 ? Boolean(stage.detail.is_vat_inclusive) : undefined,
      addons: addons.length > 0 ? addons : undefined,
      image: productImageUrl(stage.detail),
    });
    setStage(null);
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
        {products?.map((product) => {
          const image = productImageUrl(product);
          return (
            <div
              key={product.id}
              className="flex items-center gap-3 border-l-2 border-transparent p-2.5 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary">
                {image ? (
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="size-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-content-secondary">{formatMoney(product.price)}</span>
                  {product.has_variants && product.variants_count ? (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {product.variants_count} variants
                    </Badge>
                  ) : null}
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
          );
        })}
      </div>

      <Sheet open={Boolean(stage)} onOpenChange={(open) => !open && setStage(null)}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-95">
          {stage && tax && (
            <>
              <div className="flex h-44 w-full shrink-0 items-center justify-center bg-secondary">
                {productImageUrl(stage.detail) ? (
                  <img src={productImageUrl(stage.detail)} alt={stage.detail.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="size-12 text-content-tertiary" />
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="text-center">
                  <h2 className="text-lg font-medium text-foreground">{stage.detail.name}</h2>
                  <p className="mt-0.5 text-sm text-content-tertiary">{formatMoney(tax.unitPrice)}</p>
                </div>

                <div className="mt-5 flex flex-col gap-5">
                  {variants.length > 1 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-content-secondary">Variant</p>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() =>
                              setStage((prev) =>
                                prev ? { ...prev, selectedVariantId: variant.id, selectedAddonIds: new Set() } : prev
                              )
                            }
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                              variant.id === stage.selectedVariantId
                                ? "border-primary bg-primary/10 font-medium text-primary"
                                : "border-border text-content-secondary hover:border-primary/50"
                            )}
                          >
                            {variant.name ?? `Variant #${variant.id}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {addonGroups.map((group) => (
                    <div key={group.id} className="overflow-hidden rounded-lg border border-border">
                      <div className="bg-secondary/60 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {group.name}
                          {group.min_selection > 0 && <span className="ml-1 text-destructive">*</span>}
                        </p>
                        <p className="text-xs text-content-tertiary">
                          {group.min_selection > 0
                            ? `Pick ${group.min_selection}${
                                group.max_selection > group.min_selection ? `–${group.max_selection}` : ""
                              }`
                            : group.max_selection > 0
                              ? `Pick up to ${group.max_selection}`
                              : "Optional"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 p-3">
                        {group.addons
                          .filter((a) => a.is_active)
                          .map((addon) => (
                            <label key={addon.id} className="flex cursor-pointer items-center gap-2 text-sm">
                              <Checkbox
                                checked={stage.selectedAddonIds.has(addon.id)}
                                onCheckedChange={() => toggleAddon(addon.id, group)}
                              />
                              <span className="flex-1 text-foreground">{addon.name}</span>
                              {addon.price > 0 && <span className="text-content-tertiary">+{formatMoney(addon.price)}</span>}
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="tertiary"
                      size="icon"
                      className="size-7"
                      onClick={() => setStage((prev) => (prev ? { ...prev, qty: Math.max(1, prev.qty - 1) } : prev))}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm">{stage.qty}</span>
                    <Button
                      type="button"
                      variant="tertiary"
                      size="icon"
                      className="size-7"
                      onClick={() => setStage((prev) => (prev ? { ...prev, qty: prev.qty + 1 } : prev))}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-content-tertiary">
                    Total <span className="text-base font-semibold text-foreground">{formatMoney(totalPrice)}</span>
                  </p>
                </div>
                <Button type="button" className="w-full" disabled={!addonsValid} onClick={confirmAdd}>
                  Add to quote
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
