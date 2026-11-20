import type { ReportRow } from "./admin-types.ts";

export type DemographicDistribution = { answered: number; missing: number; categories: ReportRow[] };

const GENDER_LABELS: Record<string, string> = {
  female: "زن",
  male: "مرد",
  prefer_not_to_say: "ترجیح می‌دهم نگویم",
};
const AGE_LABELS: Record<string, string> = {
  under_18: "کمتر از ۱۸",
  "18_24": "۱۸–۲۴",
  "25_34": "۲۵–۳۴",
  "35_44": "۳۵–۴۴",
  "45_54": "۴۵–۵۴",
  "55_plus": "۵۵+",
  prefer_not_to_say: "ترجیح می‌دهم اعلام نکنم",
};

export function demographicDistribution(
  rows: Array<{ value: string; count: number }>,
  totalCustomers: number,
  kind: "gender" | "ageGroup",
): DemographicDistribution {
  const labels = kind === "gender" ? GENDER_LABELS : AGE_LABELS;
  const recognizedRows = rows.filter((row) => Boolean(labels[row.value]) && row.count > 0);
  const answered = recognizedRows.reduce((sum, row) => sum + Math.trunc(row.count), 0);
  const missing = Math.max(0, Math.trunc(totalCustomers) - answered);
  const categories = recognizedRows.map((row) => {
      const count = Math.trunc(row.count);
      const percent = answered === 0 ? 0 : Math.round((count / answered) * 1000) / 10;
      return { label: labels[row.value]!, value: `${count} (${percent}%)` };
    });
  return { answered, missing, categories };
}
