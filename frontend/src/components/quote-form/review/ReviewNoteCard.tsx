import { useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@flowposltd/ui";
import { Pencil, StickyNote } from "lucide-react";

interface ReviewNoteCardProps {
  value: string;
  onChange: (value: string) => void;
}

export function ReviewNoteCard({ value, onChange }: ReviewNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  function startEdit() {
    setDraft(value);
    setIsEditing(true);
  }

  function save() {
    onChange(draft.trim());
    setIsEditing(false);
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="size-3.5 text-content-tertiary" />
          Note
        </CardTitle>
        {!isEditing && value && (
          <button
            type="button"
            onClick={startEdit}
            className="text-content-tertiary hover:text-primary transition-colors"
            aria-label="Edit note"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div
            ref={containerRef}
            className="flex flex-col gap-2"
            onBlur={(e) => {
              if (!containerRef.current?.contains(e.relatedTarget as Node)) save();
            }}
          >
            <Textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancel()}
              placeholder="Add a note for this quote…"
              className="resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={save}>
                Save note
              </Button>
            </div>
          </div>
        ) : value ? (
          <p className="whitespace-pre-wrap text-sm italic text-content-secondary">{value}</p>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-xs text-content-tertiary hover:text-primary transition-colors"
          >
            <StickyNote className="size-3" />
            Add a note for this quote
          </button>
        )}
      </CardContent>
    </Card>
  );
}
