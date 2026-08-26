import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI in .env.local");
}
const mongoUri: string = MONGODB_URI;

const globalWithMongoose = globalThis as typeof globalThis & {
  mongoose?: MongooseCache;
};
const cached: MongooseCache = globalWithMongoose.mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose.mongoose = cached;

async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri).then(() => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
