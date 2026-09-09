"use client";

import { useState } from "react";

import { Package, Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { FirestoreEvent } from "@/lib/firestore/types";

interface MerchandiseTabProps {
  event: FirestoreEvent;
}

const GDG_MERCH_CATALOG = [
  {
    id: "gdg-tshirt-2026",
    name: "GDG Jakarta Developer T-Shirt",
    description: "Official cotton GDG Jakarta 2026 community edition shirt (S, M, L, XL, XXL).",
    tag: "Exclusive",
  },
  {
    id: "gdg-sticker-pack",
    name: "Google Tech Sticker Pack",
    description: "Android, Flutter, Firebase, Google Cloud, and AI Developer vinyl stickers.",
    tag: "Free Perk",
  },
  {
    id: "gdg-lanyard",
    name: "GDG Jakarta Event Lanyard & Badge",
    description: "Custom badge holder and commemorative event lanyard.",
    tag: "Included",
  },
  {
    id: "gdg-tote-bag",
    name: "GDG Canvas Tote Bag",
    description: "Eco-friendly canvas tote bag with GDG Jakarta branding.",
    tag: "Limited",
  },
];

export function MerchandiseTab({ event: _event }: MerchandiseTabProps) {
  const [selectedMerch, setSelectedMerch] = useState<Set<string>>(new Set(["gdg-sticker-pack", "gdg-lanyard"]));

  const toggleMerch = (id: string) => {
    const next = new Set(selectedMerch);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMerch(next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Event Merchandise & Attendee Perks</CardTitle>
            <CardDescription>
              Select merchandise packages and perks made available to approved attendees of this event.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 self-start">
            <Plus className="size-3.5" />
            New Item
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {GDG_MERCH_CATALOG.map((item) => {
              const isSelected = selectedMerch.has(item.id);

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleMerch(item.id)}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    isSelected ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`rounded-lg p-2 ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        <Package className="size-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">{item.name}</div>
                        <Badge variant="secondary" className="mt-1 font-normal text-[10px]">
                          {item.tag}
                        </Badge>
                      </div>
                    </div>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMerch(item.id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </div>

                  <p className="mt-3 text-muted-foreground text-xs leading-relaxed">{item.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Sparkles className="size-4 text-amber-500" />
              <span>{selectedMerch.size} merchandise items attached to this event.</span>
            </div>
            <Button size="sm">Save Merchandise Bundle</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
