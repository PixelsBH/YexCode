import mongoose from "mongoose";

const JsonTestCaseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    args: { type: mongoose.Schema.Types.Mixed, required: true },
    expected: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false, strict: true }
);

const ExampleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    args: { type: mongoose.Schema.Types.Mixed, required: true },
    expected: { type: mongoose.Schema.Types.Mixed, required: true },
    explanation: { type: String },
  },
  { _id: false, strict: true }
);

const ProblemSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, required: true, default: 1 },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
    description: { type: String, required: true },
    constraints: { type: [String], required: true, default: [] },
    topics: { type: [String], required: true, default: [] },
    companies: { type: [String], required: true, default: [] },
    hints: { type: [String], required: true, default: [] },
    referenceSolution: {
      cpp: { type: String, required: true, select: false },
    },
    examples: { type: [ExampleSchema], required: true, default: [] },
    hiddenTestCases: { type: [JsonTestCaseSchema], required: true, default: [] },
    limits: {
      timeLimitMs: { type: Number, required: true, default: 1000 },
      memoryLimitMb: { type: Number, required: true, default: 128 },
    },
    templates: {
      cpp: { type: String, default: "" },
    },
    function: {
      name: { type: String, required: true },
      returnType: { type: String, required: true },
      params: [
        {
          name: { type: String, required: true },
          type: { type: String, required: true },
          _id: false,
        },
      ],
      comparison: {
        returnArrayOrder: { type: String, enum: ["unordered"] },
      },
    },
  },
  { timestamps: true, strict: true }
);

export default mongoose.models.Problem || mongoose.model("Problem", ProblemSchema);
