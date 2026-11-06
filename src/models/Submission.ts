import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    problemSlug: { type: String, required: true, index: true },
    kind: { type: String, enum: ["submit"], required: true, default: "submit" },
    language: { type: String, enum: ["cpp", "python"], required: true },
    sourceCode: { type: String, required: true, select: false },
    judgeSubmissionId: { type: String, index: true },
    status: { type: String, enum: ["queued", "running", "finished", "failed"], required: true, default: "queued" },
    verdict: { type: String },
    score: { type: Number },
    passedTestCases: { type: Number },
    totalTestCases: { type: Number },
    runtimeMs: { type: Number },
    memoryMb: { type: Number },
    failedTestCase: { type: mongoose.Schema.Types.Mixed },
    errorStage: { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true, strict: true }
);

submissionSchema.index({ userId:  1, problemSlug: 1, createdAt: -1 });
submissionSchema.index({ userId: 1, verdict: 1, problemSlug: 1 });
submissionSchema.index({ userId: 1, status: 1 });

export default mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
