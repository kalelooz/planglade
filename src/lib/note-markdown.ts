export type UncheckedNoteTask = {
  lineIndex: number;
  indent: string;
  title: string;
};

export function splitNoteMarkdown(markdown: string): { title: string; body: string } {
  const lines = markdown.split("\n");
  let titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex === -1) {
    titleIndex = lines.findIndex((line) => line.trim().length > 0);
    if (titleIndex === -1) return { title: "Untitled", body: "" };
    return {
      title: lines[titleIndex].trim() || "Untitled",
      body: lines.slice(titleIndex + 1).join("\n").replace(/^\n+/, ""),
    };
  }

  return {
    title: lines[titleIndex].replace(/^#\s+/, "").trim() || "Untitled",
    body: lines.slice(titleIndex + 1).join("\n").replace(/^\n+/, ""),
  };
}

export function findUncheckedNoteTasks(markdown: string): UncheckedNoteTask[] {
  const tasks: UncheckedNoteTask[] = [];
  markdown.split("\n").forEach((line, lineIndex) => {
    const match = line.match(/^(\s*)[-*] \[ \] (?!.*\bFB-\d+\b)(.+)$/);
    const title = match?.[2].trim();
    if (match && title) tasks.push({ lineIndex, indent: match[1], title });
  });
  return tasks;
}
