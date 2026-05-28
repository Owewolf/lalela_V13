// Canonical resolver for "which community charity is currently active?"
//
// Rule (per product spec):
//   - catCycleActive === false  →  CAT (baseline) charity is active.
//   - catCycleActive === true   →  the admin-designated Featured charity is active.
//
// The community row stores a denormalized pointer `catFeaturedCharityId` that the
// backend keeps in sync (CAT id when toggle OFF, featured id when toggle ON).
// We still defend against stale pointers by re-deriving from `catCycleActive`.

type CharityLike = {
  id: string;
  name?: string | null;
  isCATCharity?: boolean | null;
  isCatCharity?: boolean | null;
  isFeatured?: boolean | null;
  status?: string | null;
};

type CommunityLike = {
  catCycleActive?: boolean | null;
  catFeaturedCharityId?: string | null;
} | null
  | undefined;

export const isCatCharity = (charity: CharityLike | null | undefined): boolean => {
  if (!charity) return false;
  if (charity.isCATCharity || charity.isCatCharity) return true;
  const name = String(charity.name ?? '').trim();
  return /^cat\b/i.test(name);
};

const isArchived = (charity: CharityLike): boolean => {
  const status = String(charity.status ?? '').toLowerCase();
  return status === 'archived';
};

export type ActiveCharityResolution<T extends CharityLike> = {
  active: T | null;
  cat: T | null;
  featured: T | null;
  pointer: T | null;
};

/**
 * Resolve the active community charity using the CAT-cycle toggle as the
 * single source of truth.
 */
export function resolveActiveCharity<T extends CharityLike>(
  charities: ReadonlyArray<T> | null | undefined,
  community: CommunityLike,
): ActiveCharityResolution<T> {
  const list = (charities ?? []).filter((c): c is T => !!c && !isArchived(c));
  const cat = list.find((c) => isCatCharity(c)) ?? null;
  const featured =
    list.find((c) => Boolean(c.isFeatured) && !isCatCharity(c)) ?? null;
  const pointer = community?.catFeaturedCharityId
    ? list.find((c) => c.id === community.catFeaturedCharityId) ?? null
    : null;

  const cycleOn = Boolean(community?.catCycleActive);

  let active: T | null;
  if (cycleOn) {
    // Featured wins when the cycle is on. Defend against a stale pointer that
    // still points at CAT by preferring the explicitly-featured charity first.
    active = featured ?? (pointer && !isCatCharity(pointer) ? pointer : null) ?? cat;
  } else {
    // Switch off → CAT is the active charity. Fall back to the featured charity
    // or the pointer only if no CAT row exists (legacy communities).
    active = cat ?? (pointer && !isCatCharity(pointer) ? pointer : null) ?? featured;
  }

  return { active, cat, featured, pointer };
}
