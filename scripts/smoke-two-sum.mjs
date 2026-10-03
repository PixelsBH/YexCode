import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import http from "node:http";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const judgeBase = (process.env.JUDGE_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const fixtures = JSON.parse(readFileSync(new URL("../data/problems.json", import.meta.url), "utf8"));
const allProblems = process.argv.includes("--all");
const testProblems = allProblems ? fixtures : fixtures.filter((problem) => problem.slug === "two-sum");
if (testProblems.length === 0) throw new Error("No problem fixtures selected for the smoke test.");

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

async function waitForProblem(baseUrl, server, slug) {
  let lastError = "no response";
  for (let attempt = 0; attempt < 18; attempt++) {
    if (server.exitCode !== null) throw new Error(`YexCode exited during startup (${server.exitCode}).`);
    try {
      const response = await localRequest(`${baseUrl}/api/problems/${encodeURIComponent(slug)}`, { timeoutMs: 5000 });
      if (response.status >= 200 && response.status < 300) return JSON.parse(response.body);
      lastError = `problem API returned ${response.status}: ${response.body.slice(0, 200)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`YexCode did not load ${slug} within 108 seconds (${lastError}).`);
}

async function submitAndWait(baseUrl, problem, operation, expectedTotal, sourceCode = problem.referenceSolution.cpp, expectAccepted = true) {
  const endpoint = operation === "run" ? "/api/run" : "/api/submissions";
  const response = await localRequest(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: problem.slug, language: "cpp", sourceCode }),
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
      const invalidAcceptedResult = expectAccepted && (
        result.result?.status !== "accepted" ||
        result.result?.passedTestCases !== result.result?.totalTestCases ||
        (expectedTotal !== null && result.result?.totalTestCases !== expectedTotal)
      );
      const invalidTemplateResult = !expectAccepted && (
        !result.result || ["compilation_error", "infrastructure_error"].includes(result.result.status)
      );
      if (result.status !== "finished" || invalidAcceptedResult || invalidTemplateResult) {
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
  console.log(`Starting YexCode and checking ${testProblems.length} problem fixture(s).`);
  await waitForServer(baseUrl, server);
  console.log("YexCode is serving pages; checking paginated problem discovery.");

  const pageOneResponse = await localRequest(`${baseUrl}/api/problems?page=1&pageSize=2`);
  const pageOneRepeatResponse = await localRequest(`${baseUrl}/api/problems?page=1&pageSize=2`);
  const pageTwoResponse = await localRequest(`${baseUrl}/api/problems?page=2&pageSize=2`);
  if (pageOneResponse.status !== 200 || pageOneRepeatResponse.status !== 200 || pageTwoResponse.status !== 200) {
    throw new Error("Paginated problem-list request failed.");
  }
  const pageOne = JSON.parse(pageOneResponse.body);
  const pageOneRepeat = JSON.parse(pageOneRepeatResponse.body);
  const pageTwo = JSON.parse(pageTwoResponse.body);
  if (pageOne.page !== 1 || pageOne.pageSize !== 2 || pageTwo.page !== 2 || !Array.isArray(pageOne.items) || !Array.isArray(pageOne.topics)) {
    throw new Error("Problem list did not return the paginated response contract.");
  }
  const pageOneSlugs = pageOne.items.map((entry) => entry.slug);
  const pageTwoSlugs = pageTwo.items.map((entry) => entry.slug);
  const repeatedSlugs = pageOneRepeat.items.map((entry) => entry.slug);
  if (JSON.stringify(pageOneSlugs) !== JSON.stringify(repeatedSlugs)) throw new Error("Problem pagination order is unstable.");
  if (pageOneSlugs.some((slug) => pageTwoSlugs.includes(slug))) throw new Error("Problem pages contain duplicate records.");
  for (const entry of [...pageOne.items, ...pageTwo.items]) {
    for (const privateField of ["hiddenTestCases", "referenceSolution", "testCasesJson", "testCases", "category"]) {
      if (Object.hasOwn(entry, privateField)) throw new Error(`Problem list response contains ${privateField}.`);
    }
  }

  const topic = testProblems[0].topics[0];
  const topicResponse = await localRequest(`${baseUrl}/api/problems?topic=${encodeURIComponent(topic)}`);
  const topicData = JSON.parse(topicResponse.body);
  if (topicResponse.status !== 200 || !topicData.items.every((entry) => entry.topics.includes(topic))) {
    throw new Error(`Topic filter returned a problem outside ${topic}.`);
  }

  const malformedPage = await localRequest(`${baseUrl}/api/problems?page=zero`);
  if (malformedPage.status !== 400) throw new Error("Problem list accepted invalid pagination parameters.");

  const results = [];
  for (const fixture of testProblems) {
    console.log(`Checking public problem ${fixture.slug}.`);
    const problem = await waitForProblem(baseUrl, server, fixture.slug);
    for (const privateField of ["hiddenTestCases", "referenceSolution", "testCasesJson", "testCases", "category"]) {
      if (Object.hasOwn(problem, privateField)) throw new Error(`Public ${fixture.slug} response contains ${privateField}.`);
    }
    if (problem.schemaVersion !== 1 || !Array.isArray(problem.topics) || !Array.isArray(problem.companies)) {
      throw new Error(`${fixture.slug} does not use the versioned public content shape.`);
    }

    const forgedTests = await localRequest(`${baseUrl}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: fixture.slug,
        language: "cpp",
        sourceCode: fixture.referenceSolution.cpp,
        testCases: [],
      }),
    });
    if (forgedTests.status !== 400) throw new Error(`Run accepted client-supplied tests for ${fixture.slug}.`);

    const templateResult = await submitAndWait(
      baseUrl,
      fixture,
      "run",
      problem.examples.length,
      fixture.templates.cpp,
      false,
    );
    const runResult = await submitAndWait(baseUrl, fixture, "run", problem.examples.length);
    const submitResult = await submitAndWait(baseUrl, fixture, "submit", null);
    if (submitResult.totalTestCases <= runResult.totalTestCases) {
      throw new Error(`Submit omitted server-only cases for ${fixture.slug}.`);
    }
    results.push({
      problem: fixture.slug,
      templateStatus: templateResult.status,
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
    });
  }

  console.log(JSON.stringify({
    publicResponsesExcludeHiddenTestsAndReferences: true,
    topicFilterAndStablePagination: true,
    clientSuppliedTestsRejected: true,
    results,
  }, null, 2));
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
