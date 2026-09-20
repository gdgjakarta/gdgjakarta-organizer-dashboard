"use client";

import { useState } from "react";

import { Mail, Maximize2, Minimize2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { EmailBlastForm } from "./email-blast-form";

interface EmailBlastDialogProps {
  trigger?: React.ReactNode;
}

export function EmailBlastDialog({ trigger }: EmailBlastDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 shadow-xs">
            <Send className="size-4" />
            Email Blast
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "overflow-y-auto p-0 transition-all duration-200",
          isExpanded
            ? "max-w-[95vw] sm:max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh]"
            : "max-w-5xl sm:max-w-5xl max-h-[90vh]",
        )}
      >
        <div className="p-6 border-b bg-muted/30">
          <DialogHeader className="pr-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Email Blast Campaign</DialogTitle>
                  <DialogDescription className="text-xs">
                    Compose and dispatch personalized bulk emails using Google Sheets and n8n workflow.
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground hover:text-foreground shrink-0 mr-2"
                title={isExpanded ? "Collapse modal size" : "Expand modal size"}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                <span className="sr-only">{isExpanded ? "Collapse modal size" : "Expand modal size"}</span>
              </Button>
            </div>
          </DialogHeader>
        </div>
        <div className="p-6">
          <EmailBlastForm showHeader={false} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
