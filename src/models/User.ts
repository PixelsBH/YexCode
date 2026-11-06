import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    authProviderUserId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, default: "" },
    email: { type: String, required: true, default: "" },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true, strict: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
