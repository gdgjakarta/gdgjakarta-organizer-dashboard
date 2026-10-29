import { NextResponse } from "next/server";

import { type ValidateVoucherActionParams, validateVoucherAction } from "@/server/voucher-actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateVoucherActionParams;
    const result = await validateVoucherAction(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API validate-voucher] Error:", error);
    return NextResponse.json({ isValid: false, error: "Failed to validate voucher." }, { status: 500 });
  }
}
