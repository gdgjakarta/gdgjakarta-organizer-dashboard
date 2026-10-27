/**
 * Payment Gateway Fee Configuration & Calculation Engine.
 * Supports DOKU QRIS official policy (Nov 1, 2026), fixed fees, percentage rates,
 * and combined fixed + percentage fee structures.
 */

export type PaymentFeeBearer = "attendee" | "organizer" | "voluntary";
export type PaymentFeeType = "tiered" | "fixed" | "percent" | "combined" | "none";

export interface PaymentFeeConfig {
  payment_fee_enabled?: boolean;
  payment_fee_bearer?: PaymentFeeBearer;
  payment_fee_type?: PaymentFeeType;
  payment_fee_fixed_amount?: number;
  payment_fee_percentage?: number;
  payment_fee_threshold?: number;
  payment_fee_tier_below_amount?: number;
  payment_fee_tier_above_percent?: number;
  payment_fee_label?: string;
}

export interface PaymentFeeCalculation {
  isEnabled: boolean;
  subtotal: number;
  feeAmount: number;
  fixedComponent: number;
  percentComponent: number;
  feeLabel: string;
  feeType: PaymentFeeType;
  feeBearer: PaymentFeeBearer;
  isPassedToAttendee: boolean;
  isAbsorbedByOrganizer: boolean;
  isVoluntary: boolean;
  feeDescription: string;
  rateDescription: string;
  totalWithFee: number;
  effectiveRatePercent: number;
}

export const DEFAULT_PAYMENT_FEE_LABEL = "Payment Gateway Fee (QRIS)";
export const DEFAULT_DOKU_TIER_THRESHOLD = 100000;
export const DEFAULT_DOKU_TIER_BELOW_FEE = 500;
export const DEFAULT_DOKU_TIER_ABOVE_PERCENT = 0.7;
export const DEFAULT_FIXED_FEE = 500;
export const DEFAULT_PERCENT_FEE = 0.7;

export const DEFAULT_PAYMENT_FEE_CONFIG: Required<PaymentFeeConfig> = {
  payment_fee_enabled: true,
  payment_fee_bearer: "attendee",
  payment_fee_type: "tiered",
  payment_fee_fixed_amount: DEFAULT_FIXED_FEE,
  payment_fee_percentage: DEFAULT_PERCENT_FEE,
  payment_fee_threshold: DEFAULT_DOKU_TIER_THRESHOLD,
  payment_fee_tier_below_amount: DEFAULT_DOKU_TIER_BELOW_FEE,
  payment_fee_tier_above_percent: DEFAULT_DOKU_TIER_ABOVE_PERCENT,
  payment_fee_label: DEFAULT_PAYMENT_FEE_LABEL,
};

/**
 * Calculates the payment gateway fee for a given order subtotal based on event fee configuration.
 */
export function calculatePaymentGatewayFee(
  subtotal: number,
  config?: Partial<PaymentFeeConfig> | null,
): PaymentFeeCalculation {
  const isEnabled = config?.payment_fee_enabled ?? true;
  const bearer: PaymentFeeBearer = config?.payment_fee_bearer ?? "attendee";
  const feeType: PaymentFeeType = config?.payment_fee_type ?? "tiered";
  const label = config?.payment_fee_label?.trim() || DEFAULT_PAYMENT_FEE_LABEL;

  const baseResult: PaymentFeeCalculation = {
    isEnabled: Boolean(isEnabled && feeType !== "none"),
    subtotal,
    feeAmount: 0,
    fixedComponent: 0,
    percentComponent: 0,
    feeLabel: label,
    feeType,
    feeBearer: bearer,
    isPassedToAttendee: false,
    isAbsorbedByOrganizer: bearer === "organizer",
    isVoluntary: bearer === "voluntary",
    feeDescription: "No payment gateway fee applied",
    rateDescription: "No payment gateway fee applied",
    totalWithFee: subtotal,
    effectiveRatePercent: 0,
  };

  if (!isEnabled || feeType === "none" || subtotal <= 0) {
    return baseResult;
  }

  let fixedComponent = 0;
  let percentComponent = 0;
  let feeAmount = 0;
  let feeDescription = "";

  switch (feeType) {
    case "tiered": {
      const threshold =
        typeof config?.payment_fee_threshold === "number" ? config.payment_fee_threshold : DEFAULT_DOKU_TIER_THRESHOLD;
      const belowFee =
        typeof config?.payment_fee_tier_below_amount === "number"
          ? config.payment_fee_tier_below_amount
          : DEFAULT_DOKU_TIER_BELOW_FEE;
      const abovePct =
        typeof config?.payment_fee_tier_above_percent === "number"
          ? config.payment_fee_tier_above_percent
          : DEFAULT_DOKU_TIER_ABOVE_PERCENT;

      if (subtotal <= threshold) {
        fixedComponent = Math.max(0, belowFee);
        percentComponent = 0;
        feeAmount = fixedComponent;
        feeDescription = `DOKU QRIS (≤ Rp ${threshold.toLocaleString("id-ID")}): Fixed Rp ${fixedComponent.toLocaleString("id-ID")}`;
      } else {
        fixedComponent = 0;
        percentComponent = Math.max(0, Math.round((subtotal * abovePct) / 100));
        feeAmount = percentComponent;
        feeDescription = `DOKU QRIS (> Rp ${threshold.toLocaleString("id-ID")}): ${abovePct}% MDR`;
      }
      break;
    }

    case "fixed": {
      const fixedVal =
        typeof config?.payment_fee_fixed_amount === "number" ? config.payment_fee_fixed_amount : DEFAULT_FIXED_FEE;
      fixedComponent = Math.max(0, fixedVal);
      percentComponent = 0;
      feeAmount = fixedComponent;
      feeDescription = `Fixed Fee: Rp ${fixedComponent.toLocaleString("id-ID")}`;
      break;
    }

    case "percent": {
      const pctVal =
        typeof config?.payment_fee_percentage === "number" ? config.payment_fee_percentage : DEFAULT_PERCENT_FEE;
      fixedComponent = 0;
      percentComponent = Math.max(0, Math.round((subtotal * pctVal) / 100));
      feeAmount = percentComponent;
      feeDescription = `Percentage Fee: ${pctVal}% MDR`;
      break;
    }

    case "combined": {
      const fixedVal =
        typeof config?.payment_fee_fixed_amount === "number" ? config.payment_fee_fixed_amount : DEFAULT_FIXED_FEE;
      const pctVal =
        typeof config?.payment_fee_percentage === "number" ? config.payment_fee_percentage : DEFAULT_PERCENT_FEE;

      fixedComponent = Math.max(0, fixedVal);
      percentComponent = Math.max(0, Math.round((subtotal * pctVal) / 100));
      feeAmount = fixedComponent + percentComponent;
      feeDescription = `Combined: Rp ${fixedComponent.toLocaleString("id-ID")} + ${pctVal}%`;
      break;
    }

    default:
      feeAmount = 0;
      break;
  }

  const isPassedToAttendee = bearer === "attendee" || bearer === "voluntary";
  const isAbsorbedByOrganizer = bearer === "organizer";
  const isVoluntary = bearer === "voluntary";
  const totalWithFee = subtotal + (isPassedToAttendee ? feeAmount : 0);
  const effectiveRate = subtotal > 0 ? (feeAmount / subtotal) * 100 : 0;

  return {
    isEnabled: true,
    subtotal,
    feeAmount,
    fixedComponent,
    percentComponent,
    feeLabel: label,
    feeType,
    feeBearer: bearer,
    isPassedToAttendee,
    isAbsorbedByOrganizer,
    isVoluntary,
    feeDescription,
    rateDescription: feeDescription,
    totalWithFee,
    effectiveRatePercent: Number(effectiveRate.toFixed(2)),
  };
}

/**
 * Resolves the effective fee bearer ('attendee' vs 'organizer')
 * based on event bearer configuration and attendee's voluntary opt-in agreement.
 */
export function resolveEffectiveFeeBearer(
  configuredBearer: PaymentFeeBearer = "voluntary",
  attendeeAgreesToCover = true,
): "attendee" | "organizer" {
  if (configuredBearer === "organizer") {
    return "organizer";
  }
  if (configuredBearer === "voluntary") {
    return attendeeAgreesToCover ? "attendee" : "organizer";
  }
  return attendeeAgreesToCover ? "attendee" : "organizer";
}
