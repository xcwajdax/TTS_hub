import type { Generation } from "../types";

export interface OriginGroup {
  key: string;
  originKind: string;
  originUserName: string | null;
  label: string;
  items: Generation[];
}

function originGroupKey(gen: Generation): string {
  const kind = (gen.origin_kind ?? "").trim().toLowerCase();
  const user = (gen.origin_user_name ?? gen.origin_user_id ?? "").trim().toLowerCase();
  return `${kind}::${user}`;
}

export function groupGenerationsByOrigin(items: Generation[]): OriginGroup[] {
  const map = new Map<string, Generation[]>();
  const order: string[] = [];

  for (const gen of items) {
    const key = originGroupKey(gen);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(gen);
  }

  return order.map((key) => {
    const groupItems = [...(map.get(key) ?? [])].sort(
      (a, b) => b.created_at - a.created_at,
    );
    const sample = groupItems[0]!;
    const originKind = (sample.origin_kind ?? "bot").trim();
    const originUserName = sample.origin_user_name?.trim() || null;
    const label = originUserName
      ? `${originKind}: ${originUserName}`
      : originKind;
    return {
      key,
      originKind,
      originUserName,
      label,
      items: groupItems,
    };
  });
}
