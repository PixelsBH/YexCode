"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = { children: ReactNode; className?: string; delay?: number };

export default function ScrollReveal({ children, className = "", delay = 0 }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.scrollReveal = "visible";
      return;
    }

    element.dataset.scrollReveal = "pending";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.dataset.scrollReveal = "visible";
        observer.unobserve(element);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -48px 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={elementRef} className={className} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}
