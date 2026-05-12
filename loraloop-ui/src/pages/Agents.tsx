import { Link } from "react-router-dom";
import styles from "./Agents.module.css";

const AGENTS = [
  {
    id: "sophie",
    name: "Sophie",
    role: "SEO + GEO Manager",
    description: "Builds complete SEO briefs with keyword strategy, meta tags, schema markup, and GEO optimisations for generative engines.",
    path: "/agents/sophie",
    live: true,
  },
  {
    id: "lora",
    name: "Lora",
    role: "Brand Strategist",
    description: "Orchestrates brand strategy — positioning, messaging, and campaign briefs that align every agent.",
    path: null,
    live: false,
  },
  {
    id: "clara",
    name: "Clara",
    role: "Content Writer",
    description: "Generates long-form and short-form content optimised for brand voice and platform.",
    path: null,
    live: false,
  },
  {
    id: "steve",
    name: "Steve",
    role: "Social Media Manager",
    description: "Creates and schedules posts across LinkedIn, Twitter/X, Instagram, and TikTok.",
    path: null,
    live: false,
  },
  {
    id: "theo",
    name: "Theo",
    role: "Video Producer",
    description: "Produces shot-by-shot video scripts with platform-specific specs and hook scoring.",
    path: null,
    live: false,
  },
  {
    id: "elena",
    name: "Elena",
    role: "Ads Manager",
    description: "Plans full paid media campaigns: audiences, creatives, budgets, and kill/scale rules.",
    path: null,
    live: false,
  },
  {
    id: "nick",
    name: "Nick",
    role: "Performance Analyst",
    description: "Analyses campaign data, ranks insights by impact, and recommends next actions.",
    path: null,
    live: false,
  },
  {
    id: "sarah",
    name: "Sarah",
    role: "Email Marketer",
    description: "Writes and sequences email campaigns with subject line testing and segmentation.",
    path: null,
    live: false,
  },
  {
    id: "sam",
    name: "Sam",
    role: "Scheduler",
    description: "Coordinates the full content calendar across all agents and channels.",
    path: null,
    live: false,
  },
];

export default function Agents() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Agents</h1>
      <p className={styles.sub}>9 autonomous AI specialists, each with a dedicated role.</p>
      <div className={styles.grid}>
        {AGENTS.map((a) => (
          <div key={a.id} className={styles.card}>
            <div className={styles.header}>
              <div className={styles.avatar}>{a.name[0]}</div>
              <div>
                <div className={styles.name}>{a.name}</div>
                <div className={styles.role}>{a.role}</div>
              </div>
              <span className={`${styles.badge} ${a.live ? styles.live : styles.coming}`}>
                {a.live ? "Live" : "Soon"}
              </span>
            </div>
            <p className={styles.desc}>{a.description}</p>
            {a.path && (
              <Link to={a.path} className={styles.cta}>
                Open agent →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
