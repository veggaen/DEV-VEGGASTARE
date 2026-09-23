"use client";

/**
 * @fileOverview Reusable content report dialog (DSA notice-and-action).
 * @stability active
 */

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitContentReport } from "@/actions/content-report";
import type { ReportContentType, ReportReason } from "@/generated/prisma/client";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "ILLEGAL_CONTENT", label: "Ulovlig innhold" },
  { value: "HATE_SPEECH", label: "Hatefulle ytringer" },
  { value: "HARASSMENT", label: "Trakassering / mobbing" },
  { value: "VIOLENCE", label: "Vold / trusler" },
  { value: "SEXUAL_CONTENT", label: "Seksuelt innhold" },
  { value: "CHILD_EXPLOITATION", label: "Overgrep mot barn" },
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Svindel / bedrageri" },
  { value: "IMPERSONATION", label: "Utgir seg for å være noen andre" },
  { value: "COPYRIGHT_INFRINGEMENT", label: "Opphavsrettskrenkelse" },
  { value: "MISINFORMATION", label: "Villedende informasjon" },
  { value: "PLATFORM_MANIPULATION", label: "Manipulering av plattformen" },
  { value: "OTHER", label: "Annet" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ReportContentType;
  contentId: string;
  /** Optional label for what's being reported (e.g. "denne pulsen") */
  contentLabel?: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentLabel = "dette innholdet",
}: ReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!selectedReason) {
      toast.error("Velg en grunn for rapportering.");
      return;
    }

    startTransition(async () => {
      const result = await submitContentReport({
        contentType,
        contentId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      if (result.success) {
        toast.success("Rapport sendt. Vi vurderer innholdet og gir beskjed.");
        onOpenChange(false);
        setSelectedReason(null);
        setDescription("");
      } else {
        toast.error(result.error || "Noe gikk galt.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain rounded-xl motion-reduce:animate-none sm:max-w-md [&>button]:right-2 [&>button]:top-2 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center">
        <DialogHeader className="pr-8">
          <DialogTitle>Rapporter {contentLabel}</DialogTitle>
          <DialogDescription>
            Velg grunn for rapportering. Vi behandler rapporter innen 48 timer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p id="report-reasons-label" className="text-sm font-medium">Grunn *</p>
            <div role="group" aria-labelledby="report-reasons-label" className="grid max-h-48 gap-1.5 overflow-y-auto overscroll-contain pr-1">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  aria-pressed={selectedReason === reason.value}
                  onClick={() => setSelectedReason(reason.value)}
                  className={`min-h-11 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200 motion-reduce:transition-none ${
                    selectedReason === reason.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description" className="text-sm font-medium">
              Beskrivelse (valgfritt)
            </Label>
            <Textarea
              id="report-description"
              placeholder="Gi gjerne flere detaljer om hva som er problematisk..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-base sm:text-sm"
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter className="sticky -bottom-6 gap-2 border-t border-border bg-background pt-3 pb-6 sm:gap-0">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button
            className="min-h-11"
            onClick={handleSubmit}
            disabled={isPending || !selectedReason}
          >
            {isPending ? "Sender..." : "Send rapport"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
