"use client";

import { useEffect, useRef, useState } from "react";

import {
  ChevronDown,
  ChevronUp,
  Clock,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Loader2,
  Package,
  Plus,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VARIATION_TEMPLATES } from "@/lib/events/merchandise-templates";
import type { EventMerchandiseItem, MerchandiseVariation } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EventMerchandiseItem | null;
  onSave: (item: EventMerchandiseItem) => void;
}

const COMMON_TAGS = [
  "Free Perk",
  "Included with Ticket",
  "Exclusive Perk",
  "Limited Edition",
  "Official Apparel",
  "Eco Friendly",
  "Collectible",
  "Desk Accessory",
];

const PRESET_GUIDELINE_TEMPLATES = {
  tshirt: {
    title: "T-Shirt Sizing Guideline (Unisex)",
    text: `Size Chart (Chest Width x Body Length in cm):
• S: 48 cm x 68 cm
• M: 50 cm x 70 cm
• L: 52 cm x 72 cm
• XL: 54 cm x 74 cm
• 2XL: 56 cm x 76 cm
• 3XL: 58 cm x 78 cm

Material: 100% Cotton Combed 24s. Soft, preshrunk fabric.
Tolerance: ±1.5 cm due to sewing measurements.`,
    imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
  },
  hoodie: {
    title: "Hoodie & Jacket Sizing Guideline",
    text: `Measurements in cm (Chest Width x Body Length x Sleeve):
• M: 52 cm x 68 cm x 60 cm
• L: 55 cm x 71 cm x 62 cm
• XL: 58 cm x 74 cm x 64 cm
• 2XL: 61 cm x 77 cm x 66 cm

Material: Heavyweight 330gsm Cotton Fleece with warm inner brushed lining.`,
    imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
  },
  care: {
    title: "Apparel Washing & Fabric Care Guideline",
    text: `Garment Care Instructions:
1. Machine wash cold with similar colors inside-out.
2. Do not use chlorine bleach or strong chemical detergents.
3. Tumble dry low or line dry in the shade to preserve garment shape.
4. Iron on medium heat; never iron directly over printed or rubber artwork.`,
    imageUrl: "",
  },
};

/**
 * Converts a stored ISO timestamp (UTC) into the local `YYYY-MM-DDTHH:mm` format
 * expected by `<input type="datetime-local">` and the DatePicker component.
 */
function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MerchandiseItemDialog({ open, onOpenChange, item, onSave }: MerchandiseItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number>(0);
  const [tag, setTag] = useState("Free Perk");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");

  // Multiple product images
  const [images, setImages] = useState<string[]>([]);
  const [newImageInput, setNewImageInput] = useState("");
  const [productImageMode, setProductImageMode] = useState<"upload" | "url">("upload");
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const productFileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasStockLimit, setHasStockLimit] = useState(false);
  const [stock, setStock] = useState<number | null>(null);
  const [maxPerPerson, setMaxPerPerson] = useState<number | null>(null);
  const [variations, setVariations] = useState<MerchandiseVariation[]>([]);
  const [expandedVarDetails, setExpandedVarDetails] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<"active" | "draft" | "out_of_stock">("active");

  // Product Guideline fields (Text and/or Image, e.g. T-Shirt Size Guideline)
  const [guidelineTitle, setGuidelineTitle] = useState("");
  const [guidelineText, setGuidelineText] = useState("");
  const [guidelineImageUrl, setGuidelineImageUrl] = useState("");
  const [guidelineImageMode, setGuidelineImageMode] = useState<"upload" | "url">("upload");
  const [isUploadingGuideline, setIsUploadingGuideline] = useState(false);
  const [isDraggingGuideline, setIsDraggingGuideline] = useState(false);
  const guidelineFileInputRef = useRef<HTMLInputElement | null>(null);

  // Temporary input states for adding variation options
  const [newVarName, setNewVarName] = useState("");
  const [newOptionInput, setNewOptionInput] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setIsFree(Boolean(item.is_free));
      setPrice(item.price || 0);
      setTag(item.tag || "Free Perk");

      // Multiple images support with backwards compatibility
      if (item.images && item.images.length > 0) {
        setImages([...item.images]);
      } else if (item.image_url) {
        setImages([item.image_url]);
      } else {
        setImages([]);
      }

      setHasStockLimit(item.stock !== null && item.stock !== undefined);
      setStock(item.stock ?? null);
      setMaxPerPerson(item.max_per_person ?? null);
      setVariations(JSON.parse(JSON.stringify(item.variations ?? [])));
      setStatus(item.status);

      // Product guideline
      setGuidelineTitle(item.guideline?.title ?? "");
      setGuidelineText(item.guideline?.text ?? "");
      setGuidelineImageUrl(item.guideline?.image_url ?? "");

      // Sales window dates
      setSalesStartDate(toDateTimeLocalValue(item.sales_start_date));
      setSalesEndDate(toDateTimeLocalValue(item.sales_end_date));
    } else {
      setName("");
      setDescription("");
      setIsFree(true);
      setPrice(0);
      setTag("Free Perk");
      setSalesStartDate("");
      setSalesEndDate("");
      setImages([]);
      setHasStockLimit(false);
      setStock(null);
      setMaxPerPerson(null);
      setVariations([
        {
          name: "Size",
          options: ["S", "M", "L", "XL", "2XL", "3XL"],
          option_details: {
            "2XL": { stock: 25 },
            "3XL": { stock: 15 },
          },
        },
      ]);
      setStatus("active");
      setGuidelineTitle("");
      setGuidelineText("");
      setGuidelineImageUrl("");
    }
    setNewImageInput("");
    setNewVarName("");
    setNewOptionInput({});
    setExpandedVarDetails({});
  }, [item, open]);

  // Image handlers
  const handleAddImage = () => {
    const trimmed = newImageInput.trim();
    if (!trimmed) return;
    if (images.includes(trimmed)) {
      toast.error("Image URL already added.");
      return;
    }
    setImages((prev) => [...prev, trimmed]);
    setNewImageInput("");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      return [selected, ...copy];
    });
  };

  const handleProductFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast.error("Please select valid image files (JPG, PNG, WebP).");
      return;
    }

    setIsUploadingProduct(true);
    try {
      const formData = new FormData();
      formData.append("prefix", "merchandise/products/");
      for (const file of validFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; error?: string; items?: Array<{ url: string }> };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to upload images");
      }

      const newUrls = (data.items ?? []).map((i) => i.url).filter(Boolean);
      if (newUrls.length > 0) {
        setImages((prev) => {
          const existingSet = new Set(prev);
          const uniqueNew = newUrls.filter((u: string) => !existingSet.has(u));
          return [...prev, ...uniqueNew];
        });
        toast.success(`Successfully uploaded ${newUrls.length} ${newUrls.length === 1 ? "image" : "images"}.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload images";
      toast.error(message);
    } finally {
      setIsUploadingProduct(false);
      if (productFileInputRef.current) {
        productFileInputRef.current.value = "";
      }
    }
  };

  const handleGuidelineFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    setIsUploadingGuideline(true);
    try {
      const formData = new FormData();
      formData.append("prefix", "merchandise/guidelines/");
      formData.append("files", file);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; error?: string; items?: Array<{ url: string }> };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to upload guideline image");
      }

      const uploadedUrl = data.items?.[0]?.url;
      if (uploadedUrl) {
        setGuidelineImageUrl(uploadedUrl);
        toast.success("Guideline image uploaded successfully.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload image";
      toast.error(message);
    } finally {
      setIsUploadingGuideline(false);
      if (guidelineFileInputRef.current) {
        guidelineFileInputRef.current.value = "";
      }
    }
  };

  // Variation handlers
  const handleAddVariationType = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) return;
    if (variations.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Variation "${trimmed}" already exists.`);
      return;
    }
    setVariations((prev) => [...prev, { name: trimmed, options: [] }]);
    setNewVarName("");
  };

  const handleApplyVariationTemplate = (templateId: string) => {
    const template = VARIATION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setVariations((prev) => {
      const existingIdx = prev.findIndex((v) => v.name.toLowerCase() === template.variation.name.toLowerCase());
      if (existingIdx >= 0) {
        // Merge options
        const copy = [...prev];
        const existing = copy[existingIdx];
        const mergedOptions = Array.from(new Set([...existing.options, ...template.variation.options]));
        copy[existingIdx] = {
          ...existing,
          options: mergedOptions,
          option_details: {
            ...existing.option_details,
            ...template.variation.option_details,
          },
        };
        return copy;
      }
      return [...prev, JSON.parse(JSON.stringify(template.variation))];
    });

    // If guideline is currently empty and template has a default guideline, auto-fill it
    if (template.defaultGuideline && !guidelineTitle && !guidelineText) {
      setGuidelineTitle(template.defaultGuideline.title || "");
      setGuidelineText(template.defaultGuideline.text || "");
      if (template.defaultGuideline.image_url && !guidelineImageUrl) {
        setGuidelineImageUrl(template.defaultGuideline.image_url);
      }
      toast.success(`Applied "${template.name}" variation & pre-filled Sizing Guideline!`);
    } else {
      toast.success(`Applied "${template.name}" variation template.`);
    }
  };

  const handleRemoveVariationType = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddOption = (varIndex: number) => {
    const text = (newOptionInput[varIndex] || "").trim();
    if (!text) return;
    setVariations((prev) => {
      const copy = [...prev];
      const target = copy[varIndex];
      if (target && !target.options.includes(text)) {
        target.options.push(text);
      }
      return copy;
    });
    setNewOptionInput((prev) => ({ ...prev, [varIndex]: "" }));
  };

  const handleRemoveOption = (varIndex: number, optionToRemove: string) => {
    setVariations((prev) => {
      const copy = [...prev];
      const target = copy[varIndex];
      if (target) {
        target.options = target.options.filter((o) => o !== optionToRemove);
        if (target.option_details?.[optionToRemove]) {
          const newDetails = { ...target.option_details };
          delete newDetails[optionToRemove];
          target.option_details = newDetails;
        }
      }
      return copy;
    });
  };

  // Option overrides (price, quota/stock, image_url)
  const handleUpdateOptionDetail = (
    vIdx: number,
    optionName: string,
    field: "price" | "stock" | "image_url",
    value: string | number | null,
  ) => {
    setVariations((prev) => {
      const copy = [...prev];
      const target = { ...copy[vIdx] };
      const details = { ...(target.option_details || {}) };
      const currentOpt = { ...(details[optionName] || {}) };

      if (field === "price") {
        currentOpt.price = value === "" || value === null ? null : Number(value);
      } else if (field === "stock") {
        currentOpt.stock = value === "" || value === null ? null : Number(value);
      } else if (field === "image_url") {
        currentOpt.image_url = typeof value === "string" && value.trim() ? value.trim() : null;
      }

      // Cleanup empty objects
      if (
        (currentOpt.price === null || currentOpt.price === undefined) &&
        (currentOpt.stock === null || currentOpt.stock === undefined) &&
        !currentOpt.image_url
      ) {
        delete details[optionName];
      } else {
        details[optionName] = currentOpt;
      }

      target.option_details = details;
      copy[vIdx] = target;
      return copy;
    });
  };

  const handleApplyPresetGuideline = (key: keyof typeof PRESET_GUIDELINE_TEMPLATES) => {
    const preset = PRESET_GUIDELINE_TEMPLATES[key];
    setGuidelineTitle(preset.title);
    setGuidelineText(preset.text);
    if (preset.imageUrl) {
      setGuidelineImageUrl(preset.imageUrl);
    }
    toast.success(`Inserted ${preset.title}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter an item name.");
      return;
    }

    if (salesStartDate && salesEndDate) {
      const startMs = new Date(salesStartDate).getTime();
      const endMs = new Date(salesEndDate).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
        toast.error("Sales Close date must be after Sales Open date.");
        return;
      }
    }

    const cleanedImages = images.map((img) => img.trim()).filter((img) => img.length > 0);
    const primaryImage = cleanedImages[0] || "";

    const hasGuidelineContent =
      guidelineTitle.trim().length > 0 || guidelineText.trim().length > 0 || guidelineImageUrl.trim().length > 0;

    const savedItem: EventMerchandiseItem = {
      id: item?.id ?? `merch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: description.trim(),
      is_free: isFree,
      price: isFree ? 0 : Number(price) || 0,
      tag: tag.trim() || "Free Perk",
      image_url: primaryImage,
      images: cleanedImages,
      stock: hasStockLimit && stock !== null ? Number(stock) : null,
      max_per_person: maxPerPerson && maxPerPerson > 0 ? Number(maxPerPerson) : null,
      variations: variations.filter((v) => v.name.trim().length > 0),
      status,
      sales_start_date: salesStartDate ? new Date(salesStartDate).toISOString() : null,
      sales_end_date: salesEndDate ? new Date(salesEndDate).toISOString() : null,
      guideline: hasGuidelineContent
        ? {
            title: guidelineTitle.trim() || "Product Guideline",
            text: guidelineText.trim() || undefined,
            image_url: guidelineImageUrl.trim() || undefined,
          }
        : undefined,
      created_at: item?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(savedItem);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl md:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {item ? "Edit Merchandise Item" : "Create Merchandise Item"}
            </DialogTitle>
            <DialogDescription>
              Configure attendee perks or merchandise items, multiple photos, variation pricing/stock, and sizing
              guidelines.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Item Name */}
            <div className="space-y-1.5">
              <Label htmlFor="merch-name">Item Name *</Label>
              <Input
                id="merch-name"
                required
                placeholder="e.g. GDG Jakarta Developer T-Shirt 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Pricing & Free Perk Toggle */}
            <div className="grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-free-toggle" className="cursor-pointer font-medium text-sm">
                    Free / Ticket Perk
                  </Label>
                  <Switch
                    id="is-free-toggle"
                    checked={isFree}
                    onCheckedChange={(checked) => {
                      setIsFree(checked);
                      if (checked) {
                        setPrice(0);
                        if (tag === "Official Apparel" || tag === "Paid Merch") {
                          setTag("Free Perk");
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  Free perks are included with attendee tickets and don&apos;t require payment.
                </p>
              </div>

              {!isFree ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="merch-price">Base Price (IDR) *</Label>
                    <Badge variant="outline" className="font-mono text-xs">
                      Rp {price.toLocaleString("id-ID")}
                    </Badge>
                  </div>
                  <div className="relative">
                    <span className="absolute top-2.5 left-3 font-mono text-muted-foreground text-xs">Rp</span>
                    <Input
                      id="merch-price"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="e.g. 125000"
                      value={price || ""}
                      onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="h-9 pl-9 text-xs"
                      required
                    />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Can be overridden per variation in the variation settings below.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Included Free with Registration
                </div>
              )}
            </div>

            {/* Tag / Category Badge & Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="merch-tag">Tag / Badge</Label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger id="merch-tag">
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TAGS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="merch-status">Listing Status</Label>
                <Select value={status} onValueChange={(val: "active" | "draft" | "out_of_stock") => setStatus(val)}>
                  <SelectTrigger id="merch-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Available)</SelectItem>
                    <SelectItem value="draft">Draft (Hidden)</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="merch-desc">Description</Label>
              <Textarea
                id="merch-desc"
                rows={3}
                placeholder="Product specs, materials, pickup instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Product Images (Multiple Supported) */}
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Product Images</div>
                  <div className="text-muted-foreground text-xs">
                    Add multiple photos (front, back, lifestyle). The first image will be the primary catalog cover.
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {images.length} {images.length === 1 ? "photo" : "photos"}
                </Badge>
              </div>

              {/* Recommendation Note */}
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground">Image Size Recommendation:</span>
                  <p>
                    Square <strong>1:1 aspect ratio</strong> (recommended: <strong>1000 × 1000 px</strong>, min. 800 ×
                    800 px). Max file size 5MB (JPG, PNG, WebP).
                  </p>
                </div>
              </div>

              {/* Add Image: Tabs for Upload vs URL */}
              <Tabs
                value={productImageMode}
                onValueChange={(val) => setProductImageMode(val as "upload" | "url")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="upload" className="text-xs gap-1.5">
                    <UploadCloud className="size-3.5" /> Upload Files
                  </TabsTrigger>
                  <TabsTrigger value="url" className="text-xs gap-1.5">
                    <LinkIcon className="size-3.5" /> Image URL
                  </TabsTrigger>
                </TabsList>

                {/* Upload File Tab */}
                {productImageMode === "upload" && (
                  <div className="mt-2.5">
                    <input
                      ref={productFileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => void handleProductFilesUpload(e.target.files)}
                    />
                    <button
                      type="button"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingProduct(true);
                      }}
                      onDragLeave={() => setIsDraggingProduct(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingProduct(false);
                        void handleProductFilesUpload(e.dataTransfer.files);
                      }}
                      onClick={() => productFileInputRef.current?.click()}
                      className={cn(
                        "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
                        isDraggingProduct
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
                        isUploadingProduct && "pointer-events-none opacity-60",
                      )}
                    >
                      {isUploadingProduct ? (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" />
                          <span>Uploading images to Cloudflare R2...</span>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="size-6 text-muted-foreground" />
                          <div className="text-xs font-medium">Click to browse or drag and drop photos here</div>
                          <div className="text-[11px] text-muted-foreground">
                            Supports multiple files (PNG, JPG, WebP up to 5MB each)
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* URL Input Tab */}
                {productImageMode === "url" && (
                  <div className="mt-2.5 flex gap-2">
                    <Input
                      id="merch-image"
                      placeholder="Paste image URL (e.g. https://example.com/front.jpg)"
                      value={newImageInput}
                      onChange={(e) => setNewImageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddImage();
                        }
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1 text-xs shrink-0"
                      onClick={handleAddImage}
                    >
                      <Plus className="size-3" /> Add Photo
                    </Button>
                  </div>
                )}
              </Tabs>

              {/* Photos Gallery */}
              {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 pt-1">
                  {images.map((imgUrl, imgIdx) => (
                    <div
                      key={`${imgUrl}-${imgIdx}`}
                      className="group relative flex flex-col overflow-hidden rounded-lg border bg-muted shadow-2xs"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {/* biome-ignore lint/performance/noImgElement: photo preview */}
                        <img
                          src={imgUrl}
                          alt={`Merchandise preview ${imgIdx + 1}`}
                          className="size-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/400x400/202124/ffffff?text=Broken+Image";
                          }}
                        />

                        {/* Primary Badge */}
                        {imgIdx === 0 && (
                          <div className="absolute top-1.5 left-1.5">
                            <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 px-1.5 py-0 shadow-xs">
                              <Star className="size-2.5 fill-current" /> Cover
                            </Badge>
                          </div>
                        )}

                        {/* Actions overlay */}
                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(imgIdx)}
                            className="flex size-6 items-center justify-center rounded-md bg-background/90 text-destructive shadow-xs hover:bg-destructive hover:text-white transition-colors"
                            title="Remove photo"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      {imgIdx === 0 ? (
                        <div className="border-t bg-card px-2 py-1 text-[10px] font-medium text-primary text-center flex items-center justify-center gap-1 select-none">
                          <Star className="size-2.5 fill-current" /> Cover
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(imgIdx)}
                          className="border-t bg-card px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center font-medium"
                        >
                          Make Cover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground text-xs">
                  <ImageIcon className="size-4" />
                  <span>No product images added yet. Add at least one image URL above.</span>
                </div>
              )}
            </div>

            {/* Inventory / Stock Quota */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="stock-toggle" className="font-medium text-xs">
                    Limited Inventory Quota
                  </Label>
                  <p className="text-muted-foreground text-[11px]">
                    Limit overall available items or leave unlimited for on-demand perks.
                  </p>
                </div>
                <Switch
                  id="stock-toggle"
                  checked={hasStockLimit}
                  onCheckedChange={(checked) => {
                    setHasStockLimit(checked);
                    if (!checked) setStock(null);
                    else if (stock === null) setStock(100);
                  }}
                />
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasStockLimit ? (
                  <div className="space-y-1">
                    <Label htmlFor="item-stock-limit" className="text-xs">
                      Default Total Quota
                    </Label>
                    <Input
                      id="item-stock-limit"
                      type="number"
                      min="1"
                      placeholder="Available quota (e.g. 100)"
                      value={stock ?? ""}
                      onChange={(e) => setStock(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-muted-foreground">Unlimited base stock quota</div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="item-max-person" className="text-xs">
                    Max Units / Person (Optional)
                  </Label>
                  <Input
                    id="item-max-person"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="e.g. 1 (blank = no limit)"
                    value={maxPerPerson ?? ""}
                    onChange={(e) => setMaxPerPerson(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Listing Sales Window (Optional) */}
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <Clock className="size-4 text-primary" />
                  <span>Listing Sales Window (Optional)</span>
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  Configure when sales open and close for this merchandise item. Leave blank to open immediately and
                  remain available indefinitely while active.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="merch-sales-start" className="font-medium text-xs">
                    Sales Open (Optional)
                  </Label>
                  <DatePicker
                    id="merch-sales-start"
                    withTime
                    value={salesStartDate}
                    onChange={setSalesStartDate}
                    size="sm"
                    placeholder="Open immediately"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="merch-sales-end" className="font-medium text-xs">
                    Sales Close (Optional)
                  </Label>
                  <DatePicker
                    id="merch-sales-end"
                    withTime
                    value={salesEndDate}
                    onChange={setSalesEndDate}
                    size="sm"
                    placeholder="Close when out of stock"
                  />
                </div>
              </div>
            </div>

            {/* Product Variations Manager */}
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-sm">Product Variations</div>
                  <div className="text-muted-foreground text-xs">
                    Configure options attendees choose (Size, Color, etc.). Each variation can have custom pricing,
                    quota, and photo.
                  </div>
                </div>

                {/* Preset Templates Selector */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Select onValueChange={handleApplyVariationTemplate}>
                    <SelectTrigger className="h-7 text-xs gap-1.5 border-dashed">
                      <Sparkles className="size-3 text-amber-500" />
                      <SelectValue placeholder="Add from Template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIATION_TEMPLATES.map((tmpl) => (
                        <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                          {tmpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Variations List */}
              <div className="space-y-3">
                {variations.map((v, vIdx) => {
                  const isExpanded = Boolean(expandedVarDetails[vIdx]);
                  const optionDetails = v.option_details || {};

                  return (
                    <div key={v.name || `custom-var-${vIdx}`} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                            {v.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                            {v.options.length} {v.options.length === 1 ? "option" : "options"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setExpandedVarDetails((prev) => ({
                                ...prev,
                                [vIdx]: !prev[vIdx],
                              }))
                            }
                          >
                            <SlidersHorizontal className="size-3" />
                            {isExpanded ? "Hide Details" : "Configure Pricing/Quota"}
                            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          </Button>

                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            className="size-6 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveVariationType(vIdx)}
                            title="Remove variation type"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Option Chips with badges for overrides */}
                      <div className="flex flex-wrap gap-1.5">
                        {v.options.map((opt) => {
                          const detail = optionDetails[opt];
                          const hasCustomPrice = detail?.price !== null && detail?.price !== undefined;
                          const hasCustomStock = detail?.stock !== null && detail?.stock !== undefined;
                          const hasCustomImage = Boolean(detail?.image_url);

                          return (
                            <Badge
                              key={opt}
                              variant="secondary"
                              className="gap-1 pr-1 font-medium text-xs shadow-2xs items-center"
                            >
                              <span>{opt}</span>
                              {hasCustomPrice && (
                                <span className="rounded-xs bg-primary/10 px-1 text-[9px] font-mono text-primary">
                                  Rp {detail?.price?.toLocaleString("id-ID")}
                                </span>
                              )}
                              {hasCustomStock && (
                                <span className="rounded-xs bg-amber-500/10 px-1 text-[9px] font-mono text-amber-600 dark:text-amber-400">
                                  Q: {detail?.stock}
                                </span>
                              )}
                              {hasCustomImage && (
                                <span className="rounded-xs bg-blue-500/10 px-1 text-[9px] font-mono text-blue-600 dark:text-blue-400">
                                  📷
                                </span>
                              )}
                              <button
                                type="button"
                                className="cursor-pointer rounded-xs p-0.5 hover:bg-muted-foreground/20 ml-0.5"
                                onClick={() => handleRemoveOption(vIdx, opt)}
                                title="Remove option"
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>

                      {/* Add Option Input */}
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder={`Add ${v.name} option (e.g. XL, Charcoal)`}
                          className="h-8 text-xs"
                          value={newOptionInput[vIdx] || ""}
                          onChange={(e) => setNewOptionInput((prev) => ({ ...prev, [vIdx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddOption(vIdx);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs shrink-0"
                          onClick={() => handleAddOption(vIdx)}
                        >
                          Add
                        </Button>
                      </div>

                      {/* Advanced Overrides Table (Price, Quota, Image URL) */}
                      {isExpanded && v.options.length > 0 && (
                        <div className="space-y-2 rounded-md border bg-background p-3 pt-2 text-xs">
                          <div className="font-medium text-[11px] text-muted-foreground">
                            Per-Option Custom Overrides (leave blank to inherit base price, quota, or photo):
                          </div>

                          <div className="space-y-2 pt-1">
                            {v.options.map((opt) => {
                              const detail = optionDetails[opt] || {};
                              return (
                                <div
                                  key={`detail-${vIdx}-${opt}`}
                                  className="grid grid-cols-1 gap-2 rounded-md border p-2.5 sm:grid-cols-12 sm:items-center bg-muted/10"
                                >
                                  {/* Option badge */}
                                  <div className="sm:col-span-2 font-semibold text-xs text-foreground truncate">
                                    {opt}
                                  </div>

                                  {/* Price override */}
                                  <div className="sm:col-span-3 space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Price (IDR)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1000"
                                      placeholder={isFree ? "Free" : `Base (${price})`}
                                      className="h-7 text-xs"
                                      value={detail.price ?? ""}
                                      onChange={(e) =>
                                        handleUpdateOptionDetail(
                                          vIdx,
                                          opt,
                                          "price",
                                          e.target.value ? Number(e.target.value) : null,
                                        )
                                      }
                                    />
                                  </div>

                                  {/* Quota override */}
                                  <div className="sm:col-span-3 space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Quota</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder={stock !== null ? `Base (${stock})` : "Unlimited"}
                                      className="h-7 text-xs"
                                      value={detail.stock ?? ""}
                                      onChange={(e) =>
                                        handleUpdateOptionDetail(
                                          vIdx,
                                          opt,
                                          "stock",
                                          e.target.value ? Number(e.target.value) : null,
                                        )
                                      }
                                    />
                                  </div>

                                  {/* Image URL override */}
                                  <div className="sm:col-span-4 space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Specific Photo URL</Label>
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        placeholder="https://...photo.jpg"
                                        className="h-7 text-xs"
                                        value={detail.image_url ?? ""}
                                        onChange={(e) =>
                                          handleUpdateOptionDetail(vIdx, opt, "image_url", e.target.value)
                                        }
                                      />
                                      {detail.image_url && (
                                        <div className="size-7 shrink-0 overflow-hidden rounded border bg-muted">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          {/* biome-ignore lint/performance/noImgElement: opt preview */}
                                          <img
                                            src={detail.image_url}
                                            alt={opt}
                                            className="size-full object-cover"
                                            onError={(e) => {
                                              (e.currentTarget as HTMLImageElement).src =
                                                "https://placehold.co/100x100/202124/ffffff?text=!";
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add New Custom Variation Type */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="New variation name (e.g. Size, Color, Material)"
                    className="h-8 text-xs"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddVariationType();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs shrink-0"
                    onClick={handleAddVariationType}
                  >
                    <Plus className="size-3" /> Add Variation Type
                  </Button>
                </div>
              </div>
            </div>

            {/* Dedicated Product Guidelines & Sizing Notes */}
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="size-4 text-primary" />
                  <div>
                    <div className="font-semibold text-sm">Product Guideline & Sizing Notes</div>
                    <div className="text-muted-foreground text-xs">
                      Provide sizing chart diagrams, measurement tables, material specs, or care notes.
                    </div>
                  </div>
                </div>

                {/* Quick Presets for Guidelines */}
                <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto pt-1 sm:pt-0">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-6 text-[11px]"
                    onClick={() => handleApplyPresetGuideline("tshirt")}
                  >
                    👕 T-Shirt Guide
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-6 text-[11px]"
                    onClick={() => handleApplyPresetGuideline("hoodie")}
                  >
                    🧥 Hoodie Guide
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-6 text-[11px]"
                    onClick={() => handleApplyPresetGuideline("care")}
                  >
                    🧼 Wash Care
                  </Button>
                </div>
              </div>

              {/* Guideline Title */}
              <div className="space-y-1.5">
                <Label htmlFor="guideline-title" className="text-xs">
                  Guideline Title
                </Label>
                <Input
                  id="guideline-title"
                  placeholder="e.g. T-Shirt Size Guideline & Measurements"
                  value={guidelineTitle}
                  onChange={(e) => setGuidelineTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Guideline Text / Measurements Table */}
              <div className="space-y-1.5">
                <Label htmlFor="guideline-text" className="text-xs">
                  Guideline Notes / Size Table (Text)
                </Label>
                <Textarea
                  id="guideline-text"
                  rows={4}
                  placeholder="Enter size chart (e.g. Chest Width x Body Length in cm), fit advice, or care notes..."
                  value={guidelineText}
                  onChange={(e) => setGuidelineText(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* Guideline Image / Sizing Chart Diagram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="guideline-image" className="text-xs">
                    Guideline Image / Sizing Chart Diagram
                  </Label>
                  {guidelineImageUrl ? (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      Image Attached
                    </Badge>
                  ) : null}
                </div>

                {/* Sizing Chart Recommendation Note */}
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                  <Info className="size-4 shrink-0 text-primary mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-medium text-foreground">Sizing Chart Image Recommendation:</span>
                    <p>
                      Landscape <strong>16:9 or 4:3 ratio</strong> (recommended: <strong>1200 × 800 px</strong> or
                      higher) with clear contrast for measurement tables and diagrams. Max file size 5MB (PNG, JPG,
                      WebP).
                    </p>
                  </div>
                </div>

                <Tabs
                  value={guidelineImageMode}
                  onValueChange={(val) => setGuidelineImageMode(val as "upload" | "url")}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="upload" className="text-xs gap-1.5">
                      <UploadCloud className="size-3.5" /> Upload File
                    </TabsTrigger>
                    <TabsTrigger value="url" className="text-xs gap-1.5">
                      <LinkIcon className="size-3.5" /> Image URL
                    </TabsTrigger>
                  </TabsList>

                  {/* Upload File Tab */}
                  {guidelineImageMode === "upload" && (
                    <div className="mt-2.5">
                      <input
                        ref={guidelineFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => void handleGuidelineFileUpload(e.target.files)}
                      />
                      <button
                        type="button"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingGuideline(true);
                        }}
                        onDragLeave={() => setIsDraggingGuideline(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingGuideline(false);
                          void handleGuidelineFileUpload(e.dataTransfer.files);
                        }}
                        onClick={() => guidelineFileInputRef.current?.click()}
                        className={cn(
                          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
                          isDraggingGuideline
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
                          isUploadingGuideline && "pointer-events-none opacity-60",
                        )}
                      >
                        {isUploadingGuideline ? (
                          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                            <Loader2 className="size-4 animate-spin text-primary" />
                            <span>Uploading size chart image to Cloudflare R2...</span>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="size-6 text-muted-foreground" />
                            <div className="text-xs font-medium">Click to browse or drag and drop chart image</div>
                            <div className="text-[11px] text-muted-foreground">Supports PNG, JPG, WebP (up to 5MB)</div>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* URL Input Tab */}
                  {guidelineImageMode === "url" && (
                    <div className="mt-2.5">
                      <Input
                        id="guideline-image"
                        placeholder="https://example.com/size-chart-diagram.png"
                        value={guidelineImageUrl}
                        onChange={(e) => setGuidelineImageUrl(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </Tabs>

                {guidelineImageUrl ? (
                  <div className="relative mt-2 overflow-hidden rounded-lg border bg-muted p-3">
                    <div className="flex items-center justify-between pb-2 text-[11px] font-medium text-muted-foreground">
                      <span>Size Chart Graphic Preview:</span>
                      <button
                        type="button"
                        onClick={() => setGuidelineImageUrl("")}
                        className="text-destructive hover:underline text-[10px]"
                      >
                        Remove Image
                      </button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/* biome-ignore lint/performance/noImgElement: size chart preview */}
                    <img
                      src={guidelineImageUrl}
                      alt="Size chart graphic"
                      className="max-h-56 w-auto rounded object-contain mx-auto"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://placehold.co/600x300/202124/ffffff?text=Invalid+Guideline+Image+URL";
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Adjusted Button Spacing */}
          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{item ? "Save Changes" : "Create Item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
