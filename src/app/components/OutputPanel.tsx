"use client"
import React from 'react';

export default function OutputPanel({ output } : { output: string }) {
  return (
    <div className="p-4 bg-gray-900 text-green-300 rounded-md h-40 overflow-auto">
      <pre>{output || "Run code to see output..."}</pre>
    </div>
  );
};
