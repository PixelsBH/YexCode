import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function getOrSyncUser() {
  const providerUser = await currentUser();
  if (!providerUser) return null;
  const email = providerUser.emailAddresses.find((item) => item.id === providerUser.primaryEmailAddressId)?.emailAddress
    || providerUser.emailAddresses[0]?.emailAddress
    || "";
  const name = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(" ") || providerUser.username || email;
  await dbConnect();
  return User.findOneAndUpdate(
    { authProviderUserId: providerUser.id },
    { $set: { name, email, avatarUrl: providerUser.imageUrl || "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
