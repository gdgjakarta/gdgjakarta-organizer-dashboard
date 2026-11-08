"use client";

import * as React from "react";

import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BEVY_PREDEFINED_TAGS } from "@/lib/bevy/types";
import { cn } from "@/lib/utils";

interface EventTagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function EventTagsInput({ tags, onChange, className }: EventTagsInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const handleToggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      onChange(tags.filter((t) => t !== tag));
    } else {
      onChange([...tags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const cleanSearch = searchValue.trim();
  const isExactPredefined = BEVY_PREDEFINED_TAGS.some((t) => t.toLowerCase() === cleanSearch.toLowerCase());
  const isAlreadySelected = tags.some((t) => t.toLowerCase() === cleanSearch.toLowerCase());
  const canAddCustom = cleanSearch.length > 0 && !isExactPredefined && !isAlreadySelected;

  const handleAddCustom = () => {
    if (canAddCustom) {
      onChange([...tags, cleanSearch]);
      setSearchValue("");
      setOpen(false);
    }
  };

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/20 p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Tags ({tags.length} selected)
        </span>
        {tags.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Selected Tags list */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 px-2 py-0.5 font-normal text-xs">
              <span>{t}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3 opacity-70 hover:opacity-100" />
                <span className="sr-only">Remove {t}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown Combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between bg-background px-3 font-normal text-xs"
          >
            <span className="truncate text-muted-foreground">
              {tags.length === 0
                ? "Select predefined Bevy tags or type custom tag..."
                : `${tags.length} tag${tags.length > 1 ? "s" : ""} selected — click to add more`}
            </span>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Search or enter custom tag..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAddCustom) {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <CommandList className="max-h-60">
              <CommandEmpty className="py-2 text-center text-muted-foreground text-xs">
                {canAddCustom ? (
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-primary text-xs transition-colors hover:bg-muted/50"
                  >
                    <Plus className="size-3.5" />
                    <span>
                      Add <strong>&quot;{cleanSearch}&quot;</strong> as custom tag
                    </span>
                  </button>
                ) : (
                  "No matching tag found."
                )}
              </CommandEmpty>

              {canAddCustom && (
                <>
                  <CommandGroup heading="New Custom Tag">
                    <CommandItem
                      value={`new-custom-${cleanSearch}`}
                      onSelect={handleAddCustom}
                      className="cursor-pointer gap-2 text-primary text-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>
                        Add <strong>&quot;{cleanSearch}&quot;</strong>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup heading="Predefined Bevy Tags">
                {BEVY_PREDEFINED_TAGS.map((tag) => {
                  const isSelected = tags.includes(tag);
                  return (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleToggleTag(tag)}
                      className="cursor-pointer justify-between text-xs"
                    >
                      <span className={isSelected ? "font-medium text-foreground" : "text-muted-foreground"}>
                        {tag}
                      </span>
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
