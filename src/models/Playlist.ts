import mongoose from "mongoose";

const PlaylistProblemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true },
    title: { type: String, required: true },
    topic: { type: String, required: true },
  },
  { _id: false, strict: true }
);

const playlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 300 },
    problems: { type: [PlaylistProblemSchema], default: [] },
  },
  { timestamps: true, strict: true }
);

playlistSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Playlist || mongoose.model("Playlist", playlistSchema);
