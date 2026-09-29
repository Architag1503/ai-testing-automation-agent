import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";

/** Resolve the signed-in Clerk identity to its application account. */
export async function getAuthenticatedAccount(): Promise<User | null> {
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!clerkUser || !email) return null;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;

  try {
    const [created] = await db.insert(users).values({
      email,
      name: clerkUser.fullName || clerkUser.username || email,
    }).returning();
    return created;
  } catch {
    // A simultaneous first request may have created the account already.
    const [raced] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (raced) return raced;
    throw new Error("Could not initialize the application account");
  }
}
