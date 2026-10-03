import { spawn } from "node:child_process";
import net from "node:net";
import http from "node:http";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const judgeBase = (process.env.JUDGE_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const solution = `#include <bits/stdc++.h>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < static_cast<int>(nums.size()); ++i) {
            auto match = seen.find(target - nums[i]);
            if (match != seen.end()) return {match->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`;

function localRequest(url, { method = "GET", headers = {}, body, timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = http.request({
      hostname: parsed.hostname.replace(/^\[|\]$/g, ""),
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode || 500,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Local YexCode request timed out.")));
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (!address || typeof address === "string") {
        listener.close();
        reject(new Error("Could not allocate a local test port."));
        return;
      }
      listener.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, server) {
  let lastError = "no response";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (server.exitCode !== null) throw new Error(`YexCode exited during startup (${server.exitCode}).`);
    try {
      const response = await localRequest(`${baseUrl}/api/users`, { timeoutMs: 3000 });
      return response.status;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`YexCode did not answer the local API (${lastError}).`);
}

async function waitForProblem(baseUrl, server) {
  let lastError = "no response";
  for (let attempt = 0; attempt < 18; attempt++) {
    if (server.exitCode !== null) throw new Error(`YexCode exited during startup (${server.exitCode}).`);
    try {
      const response = await localRequest(`${baseUrl}/api/problems/two-sum`, { timeoutMs: 5000 });
      if (response.status >= 200 && response.status < 300) return JSON.parse(response.body);
      lastError = `problem API returned ${response.status}: ${response.body.slice(0, 200)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`YexCode did not load two-sum within 108 seconds (${lastError}).`);
}

async function submitAndWait(baseUrl, operation, expectedTotal) {
  const endpoint = operation === "run" ? "/api/run" : "/api/submissions";
  const response = await localRequest(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "two-sum", language: "cpp", sourceCode: solution }),
    timeoutMs: 30_000,
  });
  const created = JSON.parse(response.body);
  if (response.status < 200 || response.status >= 300) throw new Error(`${operation} request failed (${response.status}): ${JSON.stringify(created)}`);

  const id = created.submissionId || created.id;
  if (typeof id !== "string") throw new Error(`${operation} response did not include a submission ID.`);
  console.log(`${operation} queued; polling the judge.`);
  const resultPath = operation === "run" ? `/api/run/${encodeURIComponent(id)}` : `/api/submissions/${encodeURIComponent(id)}`;

  for (let attempt = 0; attempt < 120; attempt++) {
    const resultResponse = await localRequest(`${baseUrl}${resultPath}`, { timeoutMs: 10_000 });
    const result = JSON.parse(resultResponse.body);
    if (resultResponse.status < 200 || resultResponse.status >= 300) throw new Error(`${operation} polling failed (${resultResponse.status}).`);
    if (result.status === "finished" || result.status === "failed") {
      if (
        result.status !== "finished" ||
        result.result?.status !== "accepted" ||
        result.result?.passedTestCases !== result.result?.totalTestCases ||
        (expectedTotal !== null && result.result?.totalTestCases !== expectedTotal)
      ) {
        const summary = {
          status: result.result?.status,
          passedTestCases: result.result?.passedTestCases,
          totalTestCases: result.result?.totalTestCases,
        };
        throw new Error(`${operation} failed its pass-count assertion: ${JSON.stringify(summary)}`);
      }
      return result.result;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${operation} timed out while waiting for YexJudge.`);
}

const port = await availablePort();
const baseUrl = `http://localhost:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", String(port)],
  {
    cwd: process.cwd(),
    detached: true,
    stdio: "inherit",
    env: {
      ...process.env,
      JUDGE_BASE_URL: judgeBase,
      NEXT_PUBLIC_BASE_URL: baseUrl,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--dns-result-order=ipv4first"].filter(Boolean).join(" "),
    },
  }
);

try {
  console.log("Starting YexCode and loading the public two-sum record.");
  await waitForServer(baseUrl, server);
  console.log("YexCode is serving pages; waiting for the problem API.");
  const problem = await waitForProblem(baseUrl, server);
  console.log("Public two-sum response loaded.");
  const listResponse = await localRequest(`${baseUrl}/api/problems`);
  if (listResponse.status !== 200) throw new Error(`Problem list request failed (${listResponse.status}).`);
  const problemList = JSON.parse(listResponse.body);
  if (!Array.isArray(problemList) || !problemList.some((entry) => entry.slug === "two-sum")) {
    throw new Error("Two-sum is missing from the problem list.");
  }
  for (const entry of problemList) {
    for (const privateField of ["hiddenTestCases", "testCasesJson", "testCases", "category"]) {
      if (Object.hasOwn(entry, privateField)) throw new Error(`Problem list response contains ${privateField}.`);
    }
  }
  for (const privateField of ["hiddenTestCases", "testCasesJson", "testCases", "category"]) {
    if (Object.hasOwn(problem, privateField)) throw new Error(`Public problem response contains ${privateField}.`);
  }
  if (problem.schemaVersion !== 1 || !Array.isArray(problem.topics) || !Array.isArray(problem.companies)) {
    throw new Error("Two-sum problem response does not use the versioned public content shape.");
  }

  const forgedTests = await localRequest(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "two-sum", language: "cpp", sourceCode: solution, testCases: [] }),
  });
  if (forgedTests.status !== 400) throw new Error("Run endpoint accepted client-supplied test cases.");

  const runResult = await submitAndWait(baseUrl, "run", problem.examples.length);
  const submitResult = await submitAndWait(baseUrl, "submit", null);
  if (submitResult.totalTestCases <= runResult.totalTestCases) {
    throw new Error("Submit did not include any server-only cases beyond the visible examples.");
  }

  console.log(JSON.stringify({
    problem: problem.slug,
    publicResponseExcludesHiddenCases: true,
    clientSuppliedTestsRejected: true,
    run: {
      status: runResult.status,
      passedTestCases: runResult.passedTestCases,
      totalTestCases: runResult.totalTestCases,
      runtimeMs: runResult.runtimeMs,
    },
    submit: {
      status: submitResult.status,
      passedTestCases: submitResult.passedTestCases,
      totalTestCases: submitResult.totalTestCases,
      runtimeMs: submitResult.runtimeMs,
    },
  }, null, 2));
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
