import { readFileSync } from "node:fs";

const DEFAULT_DATABASE_URL = "https://raw.githubusercontent.com/TechStreetDev/education/main/data/database.json";

export interface SwotRecord {
    domain: string;
    org: string | null;
    country: string | null;
}

export interface SwotIndex {
    records: SwotRecord[];
    byDomain: Map<string, SwotRecord>;
}

export interface EducationalEmailResult {
    educational: boolean;
    organization: string | null;
    country: string | null;
}

function isSwotRecord(value: unknown): value is SwotRecord {
    if (typeof value !== "object" || value === null) return false;
    const r = value as Record<string, unknown>;
    
    return (
        typeof r.domain === "string" &&
        (r.org === null || typeof r.org === "string") &&
        (r.country === null || typeof r.country === "string")
    );
}

/**
 * Reads and indexes a swot-format database.json. If `dbPath` is omitted,
 * fetches the latest database straight from the GitHub repo instead of a
 * local file. Throws if the source isn't reachable, isn't valid JSON, or
 * isn't an array of `SwotRecord`s.
 */
export async function loadSwotIndex(dbPath?: string): Promise<SwotIndex> {
    const raw = dbPath !== undefined ? readFileSync(dbPath, "utf8") : await fetchRemoteDatabase();
    const source = dbPath ?? DEFAULT_DATABASE_URL;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isSwotRecord)) {
        throw new Error(`${source} is not a valid swot database.json (expected an array of {domain, org, country} records)`);
    }

    const records = parsed;
    return {records, byDomain: new Map(records.map((r) => [r.domain, r]))};
}

async function fetchRemoteDatabase(): Promise<string> {
    const response = await fetch(DEFAULT_DATABASE_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${DEFAULT_DATABASE_URL}: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

/**
 * Checks whether `email`'s domain matches an entry in `index`, or is a
 * subdomain of one. Walks from the most specific suffix (the full domain)
 * down to the TLD, returning the first (most specific) match.
 */
export function checkEducationalEmail(email: string, index: SwotIndex): EducationalEmailResult {
    const domain = email.split("@").pop()?.toLowerCase() ?? "";
    const labels = domain.split(".");

    for (let i = 0; i < labels.length; i++) {
        const record = index.byDomain.get(labels.slice(i).join("."));
        if (record) {
            return {educational: true, organization: record.org, country: record.country};
        }
    }

    return {educational: false, organization: null, country: null};
}