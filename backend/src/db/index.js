import mongoose from 'mongoose';

const profileCacheSchema = new mongoose.Schema(
  {
    vanityName: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    profileUrl: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

profileCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProfileCache =
  mongoose.models.ProfileCache ||
  mongoose.model('ProfileCache', profileCacheSchema);

const requestLogSchema = new mongoose.Schema(
  {
    vanityName: String,
    profileUrl: String,
    success: Boolean,
    statusCode: Number,
    durationMs: Number,
    cached: Boolean,
    error: String,
    ip: String,
  },
  { timestamps: true }
);

export const RequestLog =
  mongoose.models.RequestLog || mongoose.model('RequestLog', requestLogSchema);

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI not set — caching and logging disabled');
    return false;
  }

  try {
    await mongoose.connect(uri);
    console.log('[db] Connected to MongoDB');
    return true;
  } catch (error) {
    console.warn('[db] MongoDB connection failed — running without cache:', error.message);
    return false;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function getCachedProfile(vanityName) {
  if (!isDatabaseConnected()) return null;

  const cached = await ProfileCache.findOne({
    vanityName: vanityName.toLowerCase(),
    expiresAt: { $gt: new Date() },
  }).lean();

  return cached || null;
}

export async function setCachedProfile({ vanityName, profileUrl, data, fetchedAt, ttlSeconds }) {
  if (!isDatabaseConnected()) return;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await ProfileCache.findOneAndUpdate(
    { vanityName: vanityName.toLowerCase() },
    { vanityName: vanityName.toLowerCase(), profileUrl, data, fetchedAt, expiresAt },
    { upsert: true, new: true }
  );
}

export async function logRequest(entry) {
  if (!isDatabaseConnected()) return;
  try {
    await RequestLog.create(entry);
  } catch {
    // Non-critical
  }
}
