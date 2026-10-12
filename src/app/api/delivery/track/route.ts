import { type NextRequest, NextResponse } from "next/server";

import { trackPackageWithCekResi } from "@/lib/shipping/cek-resi";

export const dynamic = "force-dynamic";

/**
 * GET /api/delivery/track?noresi=<number>&courier=<courier>
 * Integrates with Leuthra/cek-resi engine to track Indonesian courier packages.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const noresi = searchParams.get("noresi") ?? searchParams.get("number") ?? "";
  const courier = searchParams.get("courier") ?? searchParams.get("e") ?? undefined;

  if (!noresi || noresi.trim().length === 0) {
    return NextResponse.json(
      { status: 400, error: "Nomor resi tidak boleh kosong (parameter 'noresi' is required)" },
      { status: 400 },
    );
  }

  try {
    const result = await trackPackageWithCekResi(noresi, courier);
    if (!result.valid) {
      return NextResponse.json(
        {
          status: 404,
          valid: false,
          message: result.message ?? result.error ?? "Nomor resi tidak ditemukan",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      status: 200,
      valid: true,
      data: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
