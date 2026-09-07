import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SWOT_REPO = "https://github.com/JetBrains/swot.git";
const ROOT_ONLY_FILES = new Set(["tlds.txt", "stoplist.txt", "abused.txt"]);

interface SwotRecord {
    domain: string;
    org: string | null;
    country: string | null;
}

interface Override {
    domain: string;
    country?: string | null;
    org?: string | null;
    note?: string;
}

function loadOverrides(file: string): Override[] {
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Applies overrides in place, keyed by exact domain match. If an
 * override's domain has no matching record in the compiled data, a new
 * record is added for it.
 */
function applyOverrides(records: SwotRecord[], overrides: Override[]): number {
    const byDomain = new Map(records.map((r) => [r.domain, r]));
    let applied = 0;
    for (const o of overrides) {
        let record = byDomain.get(o.domain);
        if (!record) {
            record = {domain: o.domain, org: null, country: countryOf(o.domain)};
            byDomain.set(o.domain, record);
            records.push(record);
        }

        if ("country" in o) record.country = o.country ?? null;
        if ("org" in o) record.org = o.org ?? null;

        applied++;
    }

    records.sort((a, b) => a.domain.localeCompare(b.domain));
    return applied;
}

/**
 * Every two-letter ccTLD label appearing under lib/domains/tlds.txt or as
 * an institution domain's rightmost label, checked against the current
 * ISO 3166-1 alpha-2 list. All are valid ISO country codes as-is *except*
 * the ones below, which are ccTLD quirks:
 */
const CCTLD_TO_ISO: Record<string, string | null> = {
	uk: "GB",
	ac: "SH",
	eu: null,
	su: null,
	yu: null,
};

/**
 * The domain's rightmost label, converted to a valid ISO 3166-1 alpha-2
 * country code where possible.
 */
function countryOf(domain: string): string | null {
	const last = domain.split(".").pop() ?? "";
	if (!/^[a-z]{2}$/.test(last)) return null;
	return last in CCTLD_TO_ISO ? CCTLD_TO_ISO[last] : last.toUpperCase();
}

function cloneSwot(dest: string): string {
	execFileSync("git", ["clone", "--depth", "1", SWOT_REPO, dest], { stdio: "pipe" });
	return execFileSync("git", ["-C", dest, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

/** 
 * Copies swot's own license file verbatim, so its MIT notice
 * travels with the data compiled from it.
 */
function copyThirdPartyLicence(repoDir: string, dest: string) {
	const licence = readFileSync(path.join(repoDir, "LICENSE.txt"), "utf8");
	writeFileSync(dest, licence, "utf8");
}

function readLines(file: string): string[] {
	return readFileSync(file, "utf8")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function walkTxtFiles(dir: string, base = dir): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...walkTxtFiles(full, base));
		} else if (entry.endsWith(".txt")) {
			out.push(full);
		}
	}

	return out;
}

function build(domainsDir: string): SwotRecord[] {
	const records: SwotRecord[] = [];

	// Whole TLDs that are unconditionally academic (e.g. "edu", "ac.uk").
	for (const tld of readLines(path.join(domainsDir, "tlds.txt"))) {
		records.push({domain: tld.toLowerCase(), org: null, country: countryOf(tld)});
	}

	// Named institutions, one .txt file per domain.
	for (const file of walkTxtFiles(domainsDir)) {
		const rel = path.relative(domainsDir, file).split(path.sep);
		if (rel.length === 1 && ROOT_ONLY_FILES.has(rel[0])) continue;

		const parts = rel.map((p, i) => (i === rel.length - 1 ? p.replace(/\.txt$/, "") : p));
		const domain = [...parts].reverse().join(".");

		const lines = readLines(file);
		const group = lines.length > 0 && lines[lines.length - 1].toLowerCase() === ".group";
		const names = group ? lines.slice(0, -1) : lines;

		records.push({
			domain: domain.toLowerCase(),
			org: names[0] ?? null,
			country: countryOf(domain)
		});
	}

	records.sort((a, b) => a.domain.localeCompare(b.domain));
	return records;
}

function main() {
	const outPath = process.argv[2] ?? "data/database.json";
	const metaPath = process.argv[3] ?? "data/database.meta.json";
	const overridesPath = process.argv[4] ?? "overrides.json";
	mkdirSync(path.dirname(outPath), { recursive: true });

	const tmp = mkdtempSync(path.join(tmpdir(), "swot-"));
	const repoDir = path.join(tmp, "swot");
	let sha: string;
	let records: SwotRecord[];

	try {
		sha = cloneSwot(repoDir);
		records = build(path.join(repoDir, "lib", "domains"));
		copyThirdPartyLicence(repoDir, path.join(path.dirname(outPath), "LICENCE"));
	} finally {
		rmSync(tmp, {recursive: true, force: true});
	}

	const overrides = loadOverrides(overridesPath);
	const overridesApplied = applyOverrides(records, overrides);
	const meta = {
		generatedAt: new Date().toISOString(),
		count: records.length,
		overridesApplied,
		source: {
			repo: "https://github.com/JetBrains/swot",
			commit: sha,
			license: "MIT",
		},
	};

	writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
	writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
	
	console.log(`Wrote ${outPath} (${records.length} records) and ${metaPath}`);
}

main();
