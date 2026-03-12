import ReactMarkdown from "react-markdown";

interface ProseProps {
  children: string;
  className?: string;
}

/**
 * Renders markdown text with compact, dark-theme prose styling.
 * Use for D&D descriptions (spells, features, items, traits, etc.)
 */
export function Prose({ children, className = "" }: ProseProps) {
  return (
    <div
      className={`prose prose-invert prose-sm max-w-none leading-relaxed [&_strong]:text-gray-300 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 ${className}`}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
