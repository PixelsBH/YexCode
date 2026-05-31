import mongoose from "mongoose";

const TestCaseSchema = new mongoose.Schema({
  id: { type: Number },
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true }
}, { _id: false });

const ProblemSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
  category: { type: String, required: true },
  
  description: { type: String, required: true },
  constraints: { type: [String], required: true },
  
  examples: [
    {
      input: { type: String, required: true },
      output: { type: String, required: true },
      explanation: { type: String }
    }
  ],

  // flat array of test cases suitable for presentation/submission
  testCases: { type: [TestCaseSchema], default: [] },

  // nested limits object consumed by the frontend
  limits: {
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 128 },
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Problem || mongoose.model("Problem", ProblemSchema);
