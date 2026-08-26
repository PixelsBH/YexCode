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
  
  // Structured examples matching function parameters (similar to testCasesJson)
  examples: [
    {
      args: { type: mongoose.Schema.Types.Mixed },
      expected: { type: mongoose.Schema.Types.Mixed },
      explanation: { type: String },
      _id: false
    }
  ],

  testCases: { type: [TestCaseSchema], default: [] },

  limits: {
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 128 },
  },

  templates: {
    cpp: { type: String, default: "" },
    python: { type: String, default: "" },
    java: { type: String, default: "" },
    javascript: { type: String, default: "" },
    c: { type: String, default: "" },
    go: { type: String, default: "" },
  },

  function: {
    name: { type: String, default: "" },
    returnType: { type: String, default: "" },
    params: [
      {
        name: { type: String },
        type: { type: String },
        _id: false
      }
    ]
  },

  testCasesJson: [
    {
      id: { type: Number },
      args: { type: mongoose.Schema.Types.Mixed },
      expected: { type: mongoose.Schema.Types.Mixed },
      _id: false
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Problem || mongoose.model("Problem", ProblemSchema);
