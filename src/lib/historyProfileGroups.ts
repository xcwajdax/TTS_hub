import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";
import { resolveProfileForGeneration } from "./voiceProfiles";

export type ProfileFilterId = "__all__" | "__none__" | string;

export interface ProfileGroup {
  profileId: ProfileFilterId;
  profile: TtsVoiceProfile | null;
  label: string;
  items: Generation[];
}

export function profileFilterKey(
  gen: Generation,
  profiles: TtsVoiceProfile[],
): ProfileFilterId {
  const resolved = resolveProfileForGeneration(gen, profiles);
  if (resolved) return resolved.id;
  if (gen.voice_profile_id?.trim()) return gen.voice_profile_id.trim();
  return "__none__";
}

export function countGenerationsByProfile(
  items: Generation[],
  profiles: TtsVoiceProfile[],
): Map<ProfileFilterId, number> {
  const counts = new Map<ProfileFilterId, number>();
  for (const gen of items) {
    const key = profileFilterKey(gen, profiles);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function filterGenerationsByProfile(
  items: Generation[],
  profiles: TtsVoiceProfile[],
  filter: ProfileFilterId,
): Generation[] {
  if (filter === "__all__") return items;
  return items.filter((gen) => profileFilterKey(gen, profiles) === filter);
}

export function groupGenerationsByProfile(
  items: Generation[],
  profiles: TtsVoiceProfile[],
): ProfileGroup[] {
  const map = new Map<ProfileFilterId, Generation[]>();
  const order: ProfileFilterId[] = [];

  for (const gen of items) {
    const key = profileFilterKey(gen, profiles);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(gen);
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const groups: ProfileGroup[] = order.map((profileId) => {
    const profile =
      profileId === "__none__"
        ? null
        : (profileById.get(profileId) ??
          (profileId !== "__all__"
            ? profiles.find((p) => p.id === profileId) ?? null
            : null));
    const label =
      profileId === "__none__"
        ? "Bez profilu"
        : (profile?.name ?? "Profil usunięty");
    const groupItems = [...(map.get(profileId) ?? [])].sort(
      (a, b) => b.created_at - a.created_at,
    );
    return { profileId, profile, label, items: groupItems };
  });

  groups.sort((a, b) => {
    if (a.profileId === "__none__") return 1;
    if (b.profileId === "__none__") return -1;
    return a.label.localeCompare(b.label, "pl");
  });

  return groups;
}
