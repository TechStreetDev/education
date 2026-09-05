import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { checkEducationalEmail, loadSwotIndex } from "./check-educational-email.js";

const REAL_DATABASE_PATH = path.join(import.meta.dirname, "..", "data", "database.json");
const index = await loadSwotIndex(REAL_DATABASE_PATH);

describe("loadSwotIndex", () => {
    test("loads a non-trivial number of records from the real database", () => {
        assert.ok(index.records.length > 10000, `expected many records, got ${index.records.length}`);
    });

    test("indexes records by domain", () => {
        assert.deepEqual(index.byDomain.get("acu.edu.au"), {
            domain: "acu.edu.au",
            org: "Australian Catholic University",
            country: "AU",
        });
    });
});

describe("checkEducationalEmail", () => {
    test("matches the domain exactly", () => {
        assert.deepEqual(checkEducationalEmail("staff@acu.edu.au", index), {
            educational: true,
            organization: "Australian Catholic University",
            country: "AU",
        });
    });

    test("matches a subdomain against its ancestor record", () => {
        assert.deepEqual(checkEducationalEmail("student@cs.acu.edu.au", index), {
            educational: true,
            organization: "Australian Catholic University",
            country: "AU",
        });
    });

    test("is case-insensitive on the domain", () => {
        assert.deepEqual(checkEducationalEmail("Student@MIT.EDU", index), {
            educational: true,
            organization: "Massachusetts Institute of Technology",
            country: null,
        });
    });

    test("returns not-educational for a common non-educational provider", () => {
        assert.deepEqual(checkEducationalEmail("me@gmail.com", index), {
            educational: false,
            organization: null,
            country: null,
        });
    });
});
