import mongoose from "mongoose";

const JsonTestCaseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    expected: { type: mongoose.Schema.Types.Mixed },
    constructorArgs: { type: [mongoose.Schema.Types.Mixed] },
    operations: { type: [{ name: { type: String, required: true }, args: { type: [mongoose.Schema.Types.Mixed], required: true } }] },
  },
  { _id: false, strict: true }
);

const ClassOperationCallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    args: { type: [mongoose.Schema.Types.Mixed], required: true, default: [] },
  },
  { _id: false, strict: true }
);

const ParameterSchema = new mongoose.Schema(
  { name: { type: String, required: true }, type: { type: String, required: true } },
  { _id: false, strict: true }
);

const FunctionMetadataSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    returnType: { type: String, required: true },
    params: { type: [ParameterSchema], required: true },
    comparison: { returnArrayOrder: { type: String, enum: ["unordered"] } },
  },
  { _id: false, strict: true }
);

const ClassMetadataSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    constructor: { params: { type: [ParameterSchema], required: true } },
    operations: {
      type: [{ name: { type: String, required: true }, returnType: { type: String, required: true }, params: { type: [ParameterSchema], required: true } }],
      required: true,
    },
  },
  { _id: false, strict: true }
);

const ExampleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    expected: { type: mongoose.Schema.Types.Mixed },
    constructorArgs: { type: [mongoose.Schema.Types.Mixed] },
    operations: { type: [ClassOperationCallSchema] },
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
      python: { type: String, default: "" },
    },
    function: { type: FunctionMetadataSchema, default: undefined },
    class: { type: ClassMetadataSchema, default: undefined },
  },
  { timestamps: true, strict: true }
);

export default mongoose.models.Problem || mongoose.model("Problem", ProblemSchema);
