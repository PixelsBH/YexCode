import mongoose from "mongoose";

const playlistProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    playlistId: { type: String, required: true },
    problemSlug: { type: String, required: true },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, strict: true }
);

playlistProgressSchema.index({ userId: 1, playlistId: 1, problemSlug: 1 }, { unique: true });

export default mongoose.models.PlaylistProgress || mongoose.model("PlaylistProgress", playlistProgressSchema);
