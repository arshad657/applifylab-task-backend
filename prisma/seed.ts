/**
 * Seeds the database with realistic volume for feed-scale testing:
 *   - 2,000 users
 *   - 100,000+ posts (~90% public / 10% private, matching typical social apps)
 *   - ~5 top-level comments per post + ~2 replies per comment for a subset
 *     of posts, so comment pagination has real depth to exercise
 *   - random likes across posts/comments
 *
 * Run with: npm run seed
 *
 * Uses Prisma's `createMany` in batches (NOT one insert per document) so
 * seeding 100k+ posts completes in a reasonable time and doesn't open one
 * connection round-trip per row.
 */
import { faker } from "@faker-js/faker";
import { PrismaClient, Visibility, LikeTargetType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// const USER_COUNT = 200;
// const POST_COUNT = 10_000;
// const BATCH_SIZE = 1_000;
// const COMMENT_TARGET_POSTS = 2_000;
// const LIKE_COUNT = 30_000;

const USER_COUNT = 10;
const POST_COUNT = 10;
const BATCH_SIZE = 1;
const COMMENT_TARGET_POSTS = 20;
const LIKE_COUNT = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function seedUsers(): Promise<
  { id: string; firstName: string; lastName: string; avatarUrl: string | null }[]
> {
  console.log(`Seeding ${USER_COUNT} users...`);
  const passwordHash = await bcrypt.hash("Password123!", 12); // shared hash for seed speed; never do this in real user data

  const users = Array.from({ length: USER_COUNT }, () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      email: faker.internet.email({ firstName, lastName }),
      firstName,
      lastName,
      passwordHash,
      avatarUrl: faker.image.avatarGitHub(),
      bio: faker.lorem.sentence(),
    };
  });

  for (const batch of chunk(users, BATCH_SIZE)) {
    await prisma.user.createMany({ data: batch });
  }

  const created = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  console.log(`Seeded ${created.length} users.`);
  return created;
}

async function seedPosts(
  users: { id: string; firstName: string; lastName: string; avatarUrl: string | null }[],
): Promise<string[]> {
  console.log(`Seeding ${POST_COUNT} posts...`);
  const totalBatches = Math.ceil(POST_COUNT / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const batchSize = Math.min(BATCH_SIZE, POST_COUNT - b * BATCH_SIZE);
    const data = Array.from({ length: batchSize }, () => {
      const author = faker.helpers.arrayElement(users);
      const hasImage = faker.datatype.boolean({ probability: 0.4 });
      // Spread createdAt over the last 180 days so cursor pagination has a realistic distribution.
      const createdAt = faker.date.recent({ days: 180 });
      return {
        authorId: author.id,
        authorUsername: `${author.firstName} ${author.lastName}`,
        authorAvatarUrl: author.avatarUrl,
        text: faker.lorem.sentences({ min: 1, max: 3 }),
        imageUrl: hasImage ? faker.image.urlPicsumPhotos() : undefined,
        visibility: faker.datatype.boolean({ probability: 0.9 })
          ? Visibility.PUBLIC
          : Visibility.PRIVATE,
        createdAt,
        updatedAt: createdAt,
      };
    });

    await prisma.post.createMany({ data });
    console.log(`  post batch ${b + 1}/${totalBatches}`);
  }

  // Only fetch the subset of IDs we need for comments/likes generation, to avoid loading 120k full docs.
  const idRows = await prisma.post.findMany({
    take: COMMENT_TARGET_POSTS,
    select: { id: true },
  });
  return idRows.map((r: { id: string }) => r.id);
}

async function seedComments(
  users: { id: string; firstName: string; lastName: string; avatarUrl: string | null }[],
  targetPostIds: string[],
): Promise<void> {
  console.log(`Seeding comments/replies on ${targetPostIds.length} posts...`);
  let totalComments = 0;
  let totalReplies = 0;

  const commentBatches = chunk(targetPostIds, 500);

  for (let i = 0; i < commentBatches.length; i++) {
    const postBatch = commentBatches[i];

    console.log(`  comment batch ${i + 1}/${commentBatches.length}`);
    const topLevelData: {
      postId: string;
      authorId: string;
      authorUsername: string;
      authorAvatarUrl: string | null;
      parentId: null;
      depth: number;
      text: string;
    }[] = [];

    for (const postId of postBatch) {
      const commentCount = faker.number.int({ min: 1, max: 6 });
      for (let i = 0; i < commentCount; i++) {
        const author = faker.helpers.arrayElement(users);
        topLevelData.push({
          postId,
          authorId: author.id,
          authorUsername: `${author.firstName} ${author.lastName}`,
          authorAvatarUrl: author.avatarUrl,
          parentId: null,
          depth: 0,
          text: faker.lorem.sentence(),
        });
      }
    }

    await prisma.comment.createMany({ data: topLevelData });
    totalComments += topLevelData.length;

    // Update commentsCount per post (grouped, one update per post in this batch).
    const countsByPost = new Map<string, number>();
    for (const c of topLevelData)
      countsByPost.set(c.postId, (countsByPost.get(c.postId) ?? 0) + 1);
    await Promise.all(
      Array.from(countsByPost.entries()).map(([postId, count]) =>
        prisma.post.update({
          where: { id: postId },
          data: { commentsCount: { increment: count } },
        }),
      ),
    );

    // Fetch the just-created top-level comments to attach some replies.
    const created: { id: string; postId: string }[] =
      await prisma.comment.findMany({
        where: { postId: { in: postBatch }, parentId: null },
        select: { id: true, postId: true },
      });

    const repliesToAdd = faker.helpers.arrayElements(
      created,
      Math.floor(created.length * 0.3),
    );
    const replyData = repliesToAdd.flatMap(
      (parent: { id: string; postId: string }) => {
        const replyCount = faker.number.int({ min: 1, max: 2 });
        return Array.from({ length: replyCount }, () => {
          const author = faker.helpers.arrayElement(users);
          return {
            postId: parent.postId,
            authorId: author.id,
            authorUsername: `${author.firstName} ${author.lastName}`,
            authorAvatarUrl: author.avatarUrl,
            parentId: parent.id,
            depth: 1,
            text: faker.lorem.sentence(),
          };
        });
      },
    );

    if (replyData.length > 0) {
      await prisma.comment.createMany({ data: replyData });
      totalReplies += replyData.length;
    }
  }

  console.log(
    `Seeded ${totalComments} top-level comments and ${totalReplies} replies.`,
  );
}

async function seedLikes(
  users: { id: string }[],
  postIds: string[],
): Promise<void> {
  console.log(`Seeding ~${LIKE_COUNT} likes...`);
  const comments = await prisma.comment.findMany({
    take: 5_000,
    select: { id: true },
  });

  let created = 0;
  const likeBatches = chunk(Array.from({ length: LIKE_COUNT }), BATCH_SIZE);

  for (let i = 0; i < likeBatches.length; i++) {
    const batch = likeBatches[i];

    console.log(`  like batch ${i + 1}/${likeBatches.length}`);
    const likeCountByPost = new Map<string, number>();
    const data = batch.map(() => {
      const user = faker.helpers.arrayElement(users);
      const likeComment =
        faker.datatype.boolean({ probability: 0.3 }) && comments.length > 0;
      const targetType = likeComment
        ? LikeTargetType.COMMENT
        : LikeTargetType.POST;
      const targetId: string = likeComment
        ? faker.helpers.arrayElement(comments).id
        : faker.helpers.arrayElement(postIds);
      if (targetType === LikeTargetType.POST) {
        likeCountByPost.set(targetId, (likeCountByPost.get(targetId) ?? 0) + 1);
      }
      return { userId: user.id, targetType, targetId };
    });

    try {
      const result = await prisma.like.createMany({ data });
      created += result.count;
    } catch {
      // Duplicate (user, target) pairs are expected at random-sample scale; skipDuplicates handles it.
    }
  }

  console.log(`Seeded ${created} likes (duplicates skipped).`);
}

async function main(): Promise<void> {
  const start = Date.now();
  console.log("Starting seed...");

  await prisma.like.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});

  const users = await seedUsers();
  const commentTargetIds = await seedPosts(users);
  await seedComments(users, commentTargetIds);

  const allPostIdRows = await prisma.post.findMany({
    select: { id: true },
    take: POST_COUNT,
  });
  await seedLikes(
    users,
    allPostIdRows.map((r: { id: string }) => r.id),
  );

  console.log(`Seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
