// supabase/functions/_shared/quiz-personas.ts — quiz scoring + persona profiles
// Single source of truth shared by the edge function (mirrors the website lib).

export type PersonaKey = "builder" | "creator" | "educator" | "connector" | "strategist";

export function scoreQuiz(answers: Record<string, string>): {
  persona: PersonaKey; confidence: number; counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  for (const value of Object.values(answers)) {
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  let persona: PersonaKey = "builder";
  let topCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > topCount) { topCount = count; persona = key as PersonaKey; }
  }
  const answered = Object.values(answers).filter(Boolean).length;
  const confidence = answered > 0 ? Math.round((topCount / answered) * 100) / 100 : 0.5;
  return { persona, confidence, counts };
}

export const PERSONA_PROFILES: Record<PersonaKey, {
  persona: string; superpowerName: string; superpowerDescription: string;
  strengths: string[]; blindspots: string[]; businessModel: string;
}> = {
  builder: {
    persona: "The Builder", superpowerName: "Digital Architect",
    superpowerDescription: "You turn ideas into infrastructure. Your superpower is building systems, assets, and automation that keep running on autopilot.",
    strengths: ["Turns complex workflows into simple, repeatable systems", "Tests small and scales what works", "Prefers tools and assets over talk and visibility"],
    blindspots: ["May over-build before validating demand", "Can underestimate the importance of a clear monetization story"],
    businessModel: "Owner of faceless digital real estate (rank-and-rent, templates, micro-SaaS)",
  },
  creator: {
    persona: "The Creator", superpowerName: "Content Alchemist",
    superpowerDescription: "You think in story, insight, and audience experience. Your superpower is turning private insights into assets that keep generating value.",
    strengths: ["Turns insight into publishable assets without needing to be on camera", "Senses audience emotion and shapes messaging quickly"],
    blindspots: ["Private output can feel invisible without a public persona", "Monetization paths are not always clear for content-first models"],
    businessModel: "Content-driven products with automated delivery pipelines",
  },
  educator: {
    persona: "The Educator", superpowerName: "Clarity Catalyst",
    superpowerDescription: "You learn deeply and translate complexity into simple, trusted paths for others. Your superpower is packaging knowledge into evergreen assets.",
    strengths: ["Organizes confusing topics into simple, proven paths", "Builds trust through clarity and consistency"],
    blindspots: ["May wait too long for the perfect curriculum", "Sometimes struggles with self-promotion"],
    businessModel: "Guides, templates, courses, and teaching systems on autopilot",
  },
  connector: {
    persona: "The Connector", superpowerName: "Network Weaver",
    superpowerDescription: "You see relationships, partnerships, and group dynamics that others miss. Your superpower is matching people, offers, and opportunities.",
    strengths: ["Sees relationship opportunities others miss", "Creates win-win partnerships that compound"],
    blindspots: ["May rely on relationships before building owned assets", "Can spread thin across too many people or offers"],
    businessModel: "Community, referrals, and partner-offer ecosystems",
  },
  strategist: {
    persona: "The Strategist", superpowerName: "Opportunity Scout",
    superpowerDescription: "You prioritize outcomes over activity and cut through noise to find what actually works.",
    strengths: ["Chooses the right model and cuts the rest", "Prevents wasted effort by aligning assets with outcomes"],
    blindspots: ["May over-plan and under-build", "Can delay launch waiting for the perfect model"],
    businessModel: "High-leverage planning tools and portfolio-style digital assets",
  },
};

export const PERSONA_PATHWAYS: Record<PersonaKey, string[]> = {
  builder: ["Rank-and-rent landing pages in local home services", "Template and checklist products", "Micro-SaaS wrappers"],
  creator: ["Private content libraries with automated email delivery", "AI-assisted repurpose pipelines", "Quiet hobby communities"],
  educator: ["Workbook and checklist products", "Email course sequences", "Notion template bundles"],
  connector: ["Referral and partner-introduction systems", "Micro-community platforms", "Affiliate and JV ecosystems"],
  strategist: ["Portfolio of small rank-and-rent assets", "Decision-framework products", "Automated lead-gen funnels"],
};
