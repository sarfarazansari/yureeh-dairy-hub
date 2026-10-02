export type PricingType = 'FIXED_PER_LITRE' | 'FAT_BASED';
export type Shift = 'MORNING' | 'EVENING';
export interface MilkEntry {
  business_date: string;
  shift: Shift;
  customer_id: string;
  milk_quantity: number;
  fat: number | null;
  pricing_type: PricingType;
  applied_rate: number;
  calculated_amount: number;
}
export interface BuffaloMilkProduction {
  business_date: string;
  buffalo_id: string;
  shift: Shift;
  milk_quantity: number;
}

function decimalToScaledInteger(value: number, places: number): bigint {
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText ?? 0),
    negative = mantissa.startsWith('-');
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = BigInt(whole + fraction || '0'),
    shift = places + exponent - fraction.length;
  if (shift >= 0) return (negative ? -BigInt(1) : BigInt(1)) * digits * BigInt(10) ** BigInt(shift);
  const divisor = BigInt(10) ** BigInt(-shift),
    rounded = (digits + divisor / BigInt(2)) / divisor;
  return (negative ? -BigInt(1) : BigInt(1)) * rounded;
}

export function calculateEntryAmount(
  quantity: number,
  pricingType: PricingType,
  rate: number,
  fat: number | null = 0,
): number {
  if (
    ![quantity, rate, fat ?? 0].every(Number.isFinite) ||
    quantity < 0 ||
    rate < 0 ||
    (pricingType === 'FAT_BASED' && (fat === null || fat < 0))
  )
    throw new Error('Enter valid non-negative quantity, rate, and required fat.');
  // Match PostgreSQL numeric scales and round positive half-cents the same way
  // as round(numeric, 2), without binary floating-point drift.
  const quantityMilli = decimalToScaledInteger(quantity, 3),
    rateCents = decimalToScaledInteger(rate, 2);
  const numerator =
    pricingType === 'FAT_BASED'
      ? quantityMilli * decimalToScaledInteger(fat!, 2) * rateCents
      : quantityMilli * rateCents;
  const denominator = pricingType === 'FAT_BASED' ? BigInt(100_000) : BigInt(1_000);
  const cents = (numerator + denominator / BigInt(2)) / denominator;
  return Number(cents) / 100;
}
export function calculateWeightedFat(
  rows: { quantity: number; fat: number | null }[],
): number | null {
  const known = rows.filter((r) => r.fat !== null);
  const milk = known.reduce((s, r) => s + r.quantity, 0);
  return milk ? known.reduce((s, r) => s + r.quantity * r.fat!, 0) / milk : null;
}
export function calculateRevenuePerLitre(revenue: number, milk: number): number | null {
  return milk ? revenue / milk : null;
}
export function calculateBuffaloAverageDailyMilk(
  total: number,
  recordedDays: number,
): number | null {
  return recordedDays ? total / recordedDays : null;
}
export function calculateBuffaloRollingAverage(values: number[], window = 7): number | null {
  const sample = values.slice(-window);
  return sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : null;
}
export function aggregateDailyAnalytics(entries: MilkEntry[]) {
  const map = new Map<
    string,
    {
      date: string;
      morningMilk: number;
      eveningMilk: number;
      totalMilk: number;
      revenue: number;
      fatNumerator: number;
      fatMilk: number;
    }
  >();
  for (const e of entries) {
    const d = map.get(e.business_date) ?? {
      date: e.business_date,
      morningMilk: 0,
      eveningMilk: 0,
      totalMilk: 0,
      revenue: 0,
      fatNumerator: 0,
      fatMilk: 0,
    };
    d[e.shift === 'MORNING' ? 'morningMilk' : 'eveningMilk'] += e.milk_quantity;
    d.totalMilk += e.milk_quantity;
    d.revenue += e.calculated_amount;
    if (e.fat !== null) {
      d.fatNumerator += e.milk_quantity * e.fat;
      d.fatMilk += e.milk_quantity;
    }
    map.set(e.business_date, d);
  }
  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, weightedFat: d.fatMilk ? d.fatNumerator / d.fatMilk : null }));
}
export function aggregateCustomerAnalytics(entries: MilkEntry[]) {
  const map = new Map<
    string,
    {
      customerId: string;
      milk: number;
      revenue: number;
      fatNumerator: number;
      fatMilk: number;
      count: number;
    }
  >();
  for (const e of entries) {
    const d = map.get(e.customer_id) ?? {
      customerId: e.customer_id,
      milk: 0,
      revenue: 0,
      fatNumerator: 0,
      fatMilk: 0,
      count: 0,
    };
    d.milk += e.milk_quantity;
    d.revenue += e.calculated_amount;
    d.count++;
    if (e.fat !== null) {
      d.fatNumerator += e.milk_quantity * e.fat;
      d.fatMilk += e.milk_quantity;
    }
    map.set(e.customer_id, d);
  }
  return [...map.values()].map((d) => ({
    ...d,
    weightedFat: d.fatMilk ? d.fatNumerator / d.fatMilk : null,
  }));
}
export function aggregateShiftAnalytics(entries: MilkEntry[]) {
  return (['MORNING', 'EVENING'] as Shift[]).map((shift) => {
    const rows = entries.filter((e) => e.shift === shift);
    const milk = rows.reduce((s, e) => s + e.milk_quantity, 0);
    return {
      shift,
      milk,
      revenue: rows.reduce((s, e) => s + e.calculated_amount, 0),
      weightedFat: calculateWeightedFat(
        rows.map((e) => ({ quantity: e.milk_quantity, fat: e.fat })),
      ),
    };
  });
}
export function aggregateBuffaloProduction(rows: BuffaloMilkProduction[]) {
  const map = new Map<
    string,
    {
      buffaloId: string;
      totalMilk: number;
      morningMilk: number;
      eveningMilk: number;
      recordedDates: Set<string>;
    }
  >();
  for (const row of rows) {
    const value = map.get(row.buffalo_id) ?? {
      buffaloId: row.buffalo_id,
      totalMilk: 0,
      morningMilk: 0,
      eveningMilk: 0,
      recordedDates: new Set<string>(),
    };
    value.totalMilk += row.milk_quantity;
    value.recordedDates.add(row.business_date);
    if (row.shift === 'MORNING') value.morningMilk += row.milk_quantity;
    else value.eveningMilk += row.milk_quantity;
    map.set(row.buffalo_id, value);
  }
  return [...map.values()].map((value) => ({
    ...value,
    daysRecorded: value.recordedDates.size,
    averagePerRecordedDay: value.recordedDates.size
      ? value.totalMilk / value.recordedDates.size
      : null,
  }));
}
export function aggregateFarmProduction(rows: BuffaloMilkProduction[]) {
  const morningMilk = rows
      .filter((row) => row.shift === 'MORNING')
      .reduce((sum, row) => sum + row.milk_quantity, 0),
    eveningMilk = rows
      .filter((row) => row.shift === 'EVENING')
      .reduce((sum, row) => sum + row.milk_quantity, 0),
    recordedDates = new Set(rows.map((row) => row.business_date));
  return {
    morningMilk,
    eveningMilk,
    totalMilk: morningMilk + eveningMilk,
    daysRecorded: recordedDates.size,
    records: rows.length,
    averagePerRecordedDay: recordedDates.size
      ? (morningMilk + eveningMilk) / recordedDates.size
      : null,
  };
}
