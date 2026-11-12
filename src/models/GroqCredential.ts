import mongoose from "mongoose";

const groqCredentialSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, required: true, default: "v1" },
  },
  { timestamps: true, strict: true },
);

export default mongoose.models.GroqCredential || mongoose.model("GroqCredential", groqCredentialSchema);
