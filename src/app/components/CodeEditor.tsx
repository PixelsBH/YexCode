"use client";

import React, { useEffect, useRef, useState } from "react";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";

let CodeMirrorWrapper: any = null;

const languageExtensions: Record<string, any> = {
  JavaScript: javascript(),
  "C++": cpp(),
  Python: python(),
  Java: java(),
};

const themeMap: Record<string, any> = {
  Light: githubLight,
  Dracula: dracula,
  Dark: oneDark,
};


type CodeEditorProps = {
  initialCode: string;
};

const CodeEditor: React.FC<CodeEditorProps> = ({ initialCode }) => {
  const [code, setCode] = useState(initialCode);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);

  const [language, setLanguage] = useState("C++");
  const [theme, setTheme] = useState("Dark");

  useEffect(() => {
    mountedRef.current = true;

    import("@uiw/react-codemirror").then((mod) => {
      CodeMirrorWrapper = mod.default || mod;
      if (mountedRef.current) setLoaded(true);
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30">
        <div className="flex gap-3">
          {/* Language Select */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-black/50 border border-white/15 text-white text-sm rounded-md px-3 py-1.5"
          >
            {Object.keys(languageExtensions).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          {/* Theme Select */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-black/50 border border-white/15 text-white text-sm rounded-md px-3 py-1.5"
          >
            {Object.keys(themeMap).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor */}
      <div>
        {loaded && CodeMirrorWrapper ? (
          <CodeMirrorWrapper
            value={code}
            height="320px"
            theme={themeMap[theme]}
            extensions={[languageExtensions[language]]}
            onChange={(val: string) => setCode(val || "")}
          />
        ) : (
          <div className="h-[320px] flex items-center justify-center text-white/50">
            Loading editor...
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-white/10 bg-black/30">
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition">
          ▶ Run Code
        </button>

        <button className="px-4 py-1.5 rounded-md text-sm font-medium text-white bg-[#6c47ff] hover:opacity-90 transition">
          Submit Code
        </button>
      </div>
    </div>
  );
};

export default CodeEditor;