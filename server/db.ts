import { PrismaClient } from './generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reuse client across hot-reloads in development
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = global.__prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

export default prisma;

// ─── Public communities (no auth) ─────────────────────────────────────────────

export async function getPublicCommunities() {
  const communities = await prisma.community.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: {
        select: {
          members: true,
          posts: { where: { type: 'listing', status: 'Active' } },
        },
      },
    },
  });

  const businessCounts = await Promise.all(
    communities.map((c) =>
      prisma.business
        .count({ where: { communityIds: { has: c.id }, status: 'ACTIVE' } })
        .then((count) => ({ id: c.id, count }))
    )
  );

  const bizMap = Object.fromEntries(businessCounts.map((b) => [b.id, b.count]));

  return communities
    .filter((c) => c.coverageLat && c.coverageLng)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      coverageArea: {
        latitude: c.coverageLat,
        longitude: c.coverageLng,
        radius: c.coverageRadius,
        location_name: c.coverageLocation,
      },
      memberCount: c._count.members,
      listingCount: c._count.posts,
      businessCount: bizMap[c.id] ?? 0,
    }));
}
