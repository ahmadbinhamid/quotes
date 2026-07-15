import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils";

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function SectionCard({ title, icon, children, defaultOpen = true, className }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between space-y-0 py-3 hover:bg-secondary/40 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
        {open ? (
          <ChevronUp className="size-4 text-content-tertiary" />
        ) : (
          <ChevronDown className="size-4 text-content-tertiary" />
        )}
      </CardHeader>
      {open && <CardContent className="border-t border-border pt-3">{children}</CardContent>}
    </Card>
  );
}
