import type { EventMerchandiseItem, MerchandiseGuideline, MerchandiseVariation } from "@/lib/firestore/types";

export interface VariationTemplatePreset {
  id: string;
  name: string;
  description: string;
  variation: MerchandiseVariation;
  defaultGuideline?: MerchandiseGuideline;
}

/**
 * Standard variation presets that organizers can apply with a single click.
 */
export const VARIATION_TEMPLATES: VariationTemplatePreset[] = [
  {
    id: "apparel-sizes",
    name: "T-Shirt / Apparel Sizes (S - 3XL)",
    description: "Standard unisex clothing sizes with optional plus-size pricing",
    variation: {
      name: "Size",
      options: ["S", "M", "L", "XL", "2XL", "3XL"],
      option_details: {
        "2XL": { price: 15000, stock: 25 },
        "3XL": { price: 20000, stock: 15 },
      },
    },
    defaultGuideline: {
      title: "T-Shirt Sizing Guideline & Measurements (Unisex)",
      text: "Size chart in cm (Chest Width x Body Length):\n• S: 48 cm x 68 cm\n• M: 50 cm x 70 cm\n• L: 52 cm x 72 cm\n• XL: 54 cm x 74 cm\n• 2XL: 56 cm x 76 cm\n• 3XL: 58 cm x 78 cm\n\nMaterial: Premium 100% Cotton Combed 24s. Preshrunk fabric.\nTolerance: ±1.5 cm due to garment manufacturing.",
      image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "hoodie-jacket-sizes",
    name: "Hoodie / Jacket Sizes (M - 2XL)",
    description: "Outerwear sizes with measurements and stock quotas",
    variation: {
      name: "Size",
      options: ["M", "L", "XL", "2XL"],
      option_details: {
        "2XL": { price: 25000, stock: 20 },
      },
    },
    defaultGuideline: {
      title: "Hoodie & Jacket Sizing Chart",
      text: "Measurements in cm (Chest Width x Body Length x Sleeve Length):\n• M: 52 cm x 68 cm x 60 cm\n• L: 55 cm x 71 cm x 62 cm\n• XL: 58 cm x 74 cm x 64 cm\n• 2XL: 61 cm x 77 cm x 66 cm\n\nMaterial: Heavyweight 330gsm Cotton Fleece with brushed inner lining.",
      image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "gdg-colors",
    name: "GDG & Google Colors",
    description: "Signature Google brand and community colors",
    variation: {
      name: "Color",
      options: ["Google Blue", "Google Red", "Google Yellow", "Google Green", "Midnight Black", "Natural White"],
      option_details: {
        "Google Blue": {
          image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
        },
        "Midnight Black": {
          image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
        },
      },
    },
  },
  {
    id: "neutral-colors",
    name: "Apparel Colors (Neutral)",
    description: "Everyday wearable colorways",
    variation: {
      name: "Color",
      options: ["Charcoal Black", "Navy Blue", "Heather Grey", "Pure White"],
    },
  },
  {
    id: "materials-fabric",
    name: "Fabric / Material Type",
    description: "Cotton combed weight and eco-friendly textiles",
    variation: {
      name: "Material",
      options: ["Cotton Combed 24s", "Cotton Combed 30s", "Organic Heavy Canvas", "Heavy Fleece"],
    },
    defaultGuideline: {
      title: "Material & Fabric Care Guideline",
      text: "Fabric Specifications:\n• Cotton Combed 24s: Heavier, durable, structured drape (180-190 gsm).\n• Cotton Combed 30s: Lighter, breathable, perfect for warm climates (140-150 gsm).\n\nWashing Care:\n1. Machine wash cold with similar colors inside-out.\n2. Do not bleach or dry clean.\n3. Iron on low heat, avoid direct iron over printed graphics.",
    },
  },
  {
    id: "fit-silhouette",
    name: "Fit & Silhouette",
    description: "Apparel cut style",
    variation: {
      name: "Fit",
      options: ["Regular Fit", "Oversized Fit", "Boxy Cut", "Slim Fit"],
    },
  },
  {
    id: "sticker-finish",
    name: "Sticker & Print Finish",
    description: "Die-cut vinyl finish options",
    variation: {
      name: "Finish",
      options: ["Matte Vinyl", "Holographic Metallic", "Glossy Waterproof"],
    },
  },
  {
    id: "pack-tiers",
    name: "Bundle & Pack Tiers",
    description: "Quantity bundles with tiered pricing",
    variation: {
      name: "Pack Tier",
      options: ["Single Unit", "Pack of 3", "Pack of 5", "Complete Collector Box"],
    },
  },
  {
    id: "shoe-sizes",
    name: "Footwear / Shoe Sizes (EU)",
    description: "EU sizes 38 through 45",
    variation: {
      name: "Size",
      options: ["38", "39", "40", "41", "42", "43", "44", "45"],
    },
    defaultGuideline: {
      title: "Footwear Sizing Chart (EU / Insole cm)",
      text: "Foot length / Insole in cm:\n• EU 38: 24.0 cm\n• EU 39: 24.5 cm\n• EU 40: 25.5 cm\n• EU 41: 26.0 cm\n• EU 42: 27.0 cm\n• EU 43: 27.5 cm\n• EU 44: 28.5 cm\n• EU 45: 29.0 cm",
    },
  },
];

/**
 * Pre-configured GDG merchandise templates that organizers can quickly attach
 * to their event without typing everything from scratch.
 */
export const GDG_MERCHANDISE_TEMPLATES: EventMerchandiseItem[] = [
  {
    id: "tpl-gdg-tshirt-2026",
    name: "GDG Jakarta Developer T-Shirt 2026",
    description:
      "Official 100% Cotton Combed 24s community shirt featuring GDG Jakarta developer artwork. Soft, breathable, and durable.",
    price: 0,
    is_free: true,
    tag: "Exclusive Perk",
    image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80",
    ],
    stock: null,
    variations: [
      {
        name: "Size",
        options: ["S", "M", "L", "XL", "2XL", "3XL"],
        option_details: {
          "2XL": { stock: 30 },
          "3XL": { stock: 15 },
        },
      },
      {
        name: "Color",
        options: ["Navy Blue", "Charcoal Black", "White"],
        option_details: {
          "Navy Blue": {
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
          },
          "Charcoal Black": {
            image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
          },
        },
      },
    ],
    guideline: {
      title: "T-Shirt Sizing Guideline (Unisex)",
      text: "Size chart in cm (Chest Width x Body Length):\n• S: 48 cm x 68 cm\n• M: 50 cm x 70 cm\n• L: 52 cm x 72 cm\n• XL: 54 cm x 74 cm\n• 2XL: 56 cm x 76 cm\n• 3XL: 58 cm x 78 cm\n\nFabric: 100% Cotton Combed 24s. Preshrunk fabric.\nMeasurement tolerance ±1.5 cm.",
      image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
    },
    status: "active",
  },
  {
    id: "tpl-gdg-stickers",
    name: "Google Developer Tech Sticker Pack",
    description:
      "Pack of 8 waterproof die-cut vinyl stickers covering Android, Flutter, Firebase, Google Cloud, and Gemini AI.",
    price: 0,
    is_free: true,
    tag: "Free Perk",
    image_url: "https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=800&auto=format&fit=crop&q=80",
    stock: null,
    variations: [{ name: "Finish", options: ["Matte Vinyl", "Holographic Metallic"] }],
    status: "active",
  },
  {
    id: "tpl-gdg-lanyard",
    name: "GDG Jakarta Event Lanyard & Badge",
    description:
      "Custom 2cm woven polyester lanyard in Google tri-color theme with safety breakaway clip and clear acrylic badge holder.",
    price: 0,
    is_free: true,
    tag: "Included with Ticket",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    stock: null,
    variations: [{ name: "Theme", options: ["GDG Tri-color", "Midnight Dark"] }],
    status: "active",
  },
  {
    id: "tpl-gdg-tote-bag",
    name: "GDG Canvas Heavy Tote Bag",
    description:
      "14oz heavy-duty organic canvas tote with reinforced box-stitched handles and inner zipper pocket for laptops or tablets.",
    price: 0,
    is_free: true,
    tag: "Limited Perk",
    image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
    stock: 200,
    variations: [{ name: "Color", options: ["Natural Cream", "Slate Black"] }],
    status: "active",
  },
  {
    id: "tpl-devfest-hoodie",
    name: "DevFest Jakarta Heavy Fleece Hoodie",
    description:
      "Heavyweight 330gsm cotton fleece zip hoodie with embroidered GDG chest emblem and screenprinted back typography.",
    price: 250000,
    is_free: false,
    tag: "Official Apparel",
    image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80",
    ],
    stock: 100,
    variations: [
      {
        name: "Size",
        options: ["M", "L", "XL", "2XL"],
        option_details: {
          "2XL": { price: 275000, stock: 15 },
        },
      },
      {
        name: "Color",
        options: ["Heather Grey", "Black"],
        option_details: {
          Black: {
            image_url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80",
          },
        },
      },
    ],
    guideline: {
      title: "Hoodie & Jacket Sizing Chart",
      text: "Measurements in cm (Chest Width x Body Length x Sleeve Length):\n• M: 52 cm x 68 cm x 60 cm\n• L: 55 cm x 71 cm x 62 cm\n• XL: 58 cm x 74 cm x 64 cm\n• 2XL: 61 cm x 77 cm x 66 cm\n\nMaterial: Heavyweight 330gsm Cotton Fleece with brushed inner lining.",
      image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    },
    status: "active",
  },
  {
    id: "tpl-gdg-tumbler",
    name: "GDG Stainless Steel Tumbler 500ml",
    description:
      "Double-wall 304 food-grade stainless steel vacuum tumbler keeping drinks cold for 24h and hot for 12h. Leak-proof lid.",
    price: 110000,
    is_free: false,
    tag: "Eco Friendly",
    image_url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80",
    stock: 150,
    variations: [{ name: "Color", options: ["Matte Black", "Stainless Silver", "Pure White"] }],
    status: "active",
  },
  {
    id: "tpl-enamel-pins",
    name: "GDG Jakarta Collectible Enamel Pin Set",
    description:
      "Set of 2 die-struck soft enamel metal lapel pins with dual rubber clutch backings and protective glossy coating.",
    price: 35000,
    is_free: false,
    tag: "Collectible",
    image_url: "https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?w=800&auto=format&fit=crop&q=80",
    stock: 300,
    variations: [{ name: "Edition", options: ["DevFest 2026 Edition", "Classic GDG Shield"] }],
    status: "active",
  },
  {
    id: "tpl-desk-mat",
    name: "Android & Gemini Developer Desk Mat",
    description: "800x300mm large micro-woven fabric desk mat with non-slip rubber base and anti-fray stitched edges.",
    price: 140000,
    is_free: false,
    tag: "Desk Accessory",
    image_url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=800&auto=format&fit=crop&q=80",
    stock: 75,
    variations: [{ name: "Design", options: ["Gemini Neural Pattern", "Android Bugdroid Matrix", "Minimalist Code"] }],
    status: "active",
  },
];
