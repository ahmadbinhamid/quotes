import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  ToggleButtonGroup,
} from "@flowposltd/ui";
import { FormField } from "@/components/ui/form-field";
import { listLocations } from "@/lib/api/catalog";
import type { ConvertQuoteInput, FulfillmentType } from "@/lib/api/quotes";

// Same single seeded shortcode used throughout the quote/order forms — see
// QuoteFormPage's own COUNTRIES constant for why.
const COUNTRIES = [{ value: "GB", label: "United Kingdom" }];

const FULFILLMENT_OPTIONS: { label: string; value: FulfillmentType }[] = [
  { label: "Collection", value: "collection" },
  { label: "Delivery", value: "delivery" },
];

interface ConvertToOrderPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ConvertQuoteInput) => void;
  submitting: boolean;
}

export function ConvertToOrderPanel({ open, onOpenChange, onConfirm, submitting }: ConvertToOrderPanelProps) {
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["catalog", "locations"],
    queryFn: () => listLocations(),
    enabled: open,
  });

  const [locationId, setLocationId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("collection");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("GB");

  // Every time the panel (re)opens, start from a clean slate — this is a
  // one-off decision made at conversion time, never pre-filled from the quote.
  useEffect(() => {
    if (!open) return;
    setLocationId("");
    setFulfillmentType("collection");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setPostcode("");
    setCountry("GB");
  }, [open]);

  const isDelivery = fulfillmentType === "delivery";
  const addressValid = !isDelivery || Boolean(addressLine1.trim() && city.trim() && postcode.trim() && country.trim());
  const canSubmit = Boolean(locationId) && addressValid;

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm({
      location_id: Number(locationId),
      fulfillment_type: fulfillmentType,
      ...(isDelivery && {
        delivery_address: { address_line1: addressLine1, address_line2: addressLine2, city, state, postcode, country },
      }),
    });
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Convert to order"
      description="Choose the location and fulfillment for the order this creates."
      width="sm:max-w-[440px]"
    >
      <SidePanelBody className="flex flex-col gap-4">
        <FormField label="Location" required>
          <Select value={locationId} onValueChange={setLocationId} disabled={locationsLoading}>
            <SelectTrigger>
              <SelectValue placeholder={locationsLoading ? "Loading locations…" : "Select a location"} />
            </SelectTrigger>
            <SelectContent>
              {locations?.map((loc) => (
                <SelectItem key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Fulfillment" required>
          <ToggleButtonGroup options={FULFILLMENT_OPTIONS} value={fulfillmentType} onChange={setFulfillmentType} />
        </FormField>

        {isDelivery && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Address line 1" required className="col-span-2">
              <Input maxLength={255} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </FormField>
            <FormField label="Address line 2" className="col-span-2">
              <Input maxLength={255} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            </FormField>
            <FormField label="City" required>
              <Input maxLength={120} value={city} onChange={(e) => setCity(e.target.value)} />
            </FormField>
            <FormField label="State / county">
              <Input maxLength={120} value={state} onChange={(e) => setState(e.target.value)} />
            </FormField>
            <FormField label="Postcode" required>
              <Input maxLength={32} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </FormField>
            <FormField label="Country" required>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        )}
      </SidePanelBody>

      <SidePanelFooter className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={!canSubmit} loading={submitting}>
          Convert to order
        </Button>
      </SidePanelFooter>
    </SidePanel>
  );
}
