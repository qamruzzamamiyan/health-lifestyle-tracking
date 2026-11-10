import { parseRoadmapText } from "./roadmapParser.js";

/** Convert the existing free/offline task-list parser's output into editable roadmap phases. */
export function parseSkillRoadmapText(text, filename = "") {
  const parsed = parseRoadmapText(text, filename);
  const phases = [];
  const phaseIndex = new Map();
  for (const item of parsed.items) {
    const divider = item.indexOf(" — ");
    let title = "General";
    let stepTitle = item.trim();
    if (divider !== -1) {
      const section = item.slice(0, divider).trim();
      if (/^(?:phase|week|day|module|unit|milestone|section|chapter|stage|part|topic|sprint|slide|sheet)\b/i.test(section)) {
        title = section.slice(0, 120);
        stepTitle = item.slice(divider + 3).trim();
      }
    }
    if (!stepTitle) continue;
    if (!phaseIndex.has(title)) {
      phaseIndex.set(title, phases.length);
      phases.push({ title, steps: [] });
    }
    phases[phaseIndex.get(title)].steps.push({ title: stepTitle.slice(0, 220), done: false, completedAt: null });
  }
  return {title: parsed.title || "Imported Roadmap", phases, warnings: parsed.warnings};
}

export function countDraftSteps(phases) {
  return (phases || []).reduce((total, phase) => total + phase.steps.length, 0);
}
