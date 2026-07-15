import { toast as uiToast } from "@flowposltd/ui";

// Thin adapter over @flowposltd/ui's toast({ description, variant }) API so
// call sites keep the terser toast.success(...)/toast.error(...) shape.
export const toast = {
  success: (message: string) => uiToast({ description: message, variant: "success" }),
  error: (message: string) => uiToast({ description: message, variant: "destructive" }),
};
