"use client";

import { useState } from "react";

import { Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { EmailBlastForm } from "./email-blast-form";

interface EmailBlastDialogProps {
  trigger?: React.ReactNode;
}

export function EmailBlastDialog({ trigger }: EmailBlastDialogProps) {
  const [open, setOpen] = useState(false);

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:max-w-5xl">
        <div className="p-6 border-b bg-muted/30">
          <DialogHeader>
            <div className="flex items-center gap-2">
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
          </DialogHeader>
        </div>
        <div className="p-6">
          <EmailBlastForm showHeader={false} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
