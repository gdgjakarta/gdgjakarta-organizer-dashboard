import type { EventMerchandiseItem } from "@/lib/firestore/types";

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
    stock: null,
    variations: [
      { name: "Size", options: ["S", "M", "L", "XL", "XXL", "3XL"] },
      { name: "Color", options: ["Navy Blue", "Charcoal Black", "White"] },
    ],
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
    stock: 100,
    variations: [
      { name: "Size", options: ["M", "L", "XL", "XXL"] },
      { name: "Color", options: ["Heather Grey", "Black"] },
    ],
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
