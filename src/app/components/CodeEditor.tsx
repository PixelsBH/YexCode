"use client";

import React, { useState, useEffect, useRef } from "react";
let CodeMirrorWrapper: any = null;

type CodeEditorProps = {
  initialCode: string;
};

const CodeEditor: React.FC<CodeEditorProps> = ({ initialCode }) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    // only import on client after mount
    import("@uiw/react-codemirror").then((mod) => {
      CodeMirrorWrapper = mod.default || mod;
      if (mountedRef.current) setLoaded(true);
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runCode = () => {
    try {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      const start = performance.now();
      new Function(code)();
      const end = performance.now();

      console.log = originalLog;
      setOutput(`${logs.join("\n")}\nExecution Time: ${(end - start).toFixed(2)} ms`);
    } catch (err: any) {
      setOutput("Error: " + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {loaded && CodeMirrorWrapper ? (
        <CodeMirrorWrapper
          value={code}
          height="300px"
          extensions={[]}
          onChange={(val: string) => setCode(val || "")}
        />
      ) : (
        <div className="h-72 flex items-center justify-center bg-gray-900 text-gray-400">
          Loading editor...
        </div>
      )}
      <button
        onClick={runCode}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Run Code
      </button>
      <pre className="mt-2 bg-gray-900 p-2 rounded">{output}</pre>
    </div>
  );
};

export default CodeEditor;
