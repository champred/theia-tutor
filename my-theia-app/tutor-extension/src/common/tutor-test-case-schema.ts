export const TUTOR_TEST_CASES_FILE_PATH = '.theia/tutor-test-cases.json';
export const TUTOR_TEST_CASES_SCHEMA_VERSION = 1;

export type TutorTestMatchMode = 'equals' | 'contains';

export interface TutorTestCase {
    id: string;
    title: string;
    input: string;
    expectedOutput: string;
    matchMode: TutorTestMatchMode;
}

export interface TutorTestCasesFile {
    schemaVersion: number;
    cases: TutorTestCase[];
}

export interface TutorTestCaseParseResult {
    testCases?: TutorTestCase[];
    error?: string;
}

export function createTutorTestCaseId(existingIds: ReadonlySet<string>): string {
    let counter = existingIds.size + 1;
    while (true) {
        const id = `test-case-${counter}`;
        if (!existingIds.has(id)) {
            return id;
        }
        counter += 1;
    }
}

export function parseTutorTestCasesFile(content: string): TutorTestCaseParseResult {
    try {
        const value: unknown = JSON.parse(content);
        const file = asTutorTestCasesFile(value);
        return { testCases: file.cases };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
    }
}

export function serializeTutorTestCasesFile(testCases: readonly TutorTestCase[]): string {
    const file: TutorTestCasesFile = {
        schemaVersion: TUTOR_TEST_CASES_SCHEMA_VERSION,
        cases: testCases.map(testCase => ({
            id: testCase.id,
            title: testCase.title,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            matchMode: testCase.matchMode
        }))
    };
    return JSON.stringify(file, undefined, 2);
}

function asTutorTestCasesFile(value: unknown): TutorTestCasesFile {
    if (!isObject(value)) {
        throw new Error('Test case file must contain a JSON object.');
    }

    const schemaVersion = value['schemaVersion'];
    if (schemaVersion !== TUTOR_TEST_CASES_SCHEMA_VERSION) {
        throw new Error(`Unsupported schemaVersion: ${String(schemaVersion)}`);
    }

    const rawCases = value['cases'];
    if (!Array.isArray(rawCases)) {
        throw new Error('The "cases" property must be an array.');
    }

    return {
        schemaVersion,
        cases: rawCases.map((rawCase, index) => asTutorTestCase(rawCase, index))
    };
}

function asTutorTestCase(value: unknown, index: number): TutorTestCase {
    if (!isObject(value)) {
        throw new Error(`Case at index ${index} must be an object.`);
    }

    const id = asString(value['id'], `Case at index ${index} has an invalid "id".`);
    const title = asString(value['title'], `Case "${id}" has an invalid "title".`);
    const input = asString(value['input'], `Case "${id}" has an invalid "input".`);
    const expectedOutput = asString(value['expectedOutput'], `Case "${id}" has an invalid "expectedOutput".`);
    const matchMode = asMatchMode(value['matchMode'], `Case "${id}" has an invalid "matchMode".`);

    return {
        id,
        title,
        input,
        expectedOutput,
        matchMode
    };
}

function asMatchMode(value: unknown, errorMessage: string): TutorTestMatchMode {
    if (value === 'equals' || value === 'contains') {
        return value;
    }
    throw new Error(errorMessage);
}

function asString(value: unknown, errorMessage: string): string {
    if (typeof value === 'string') {
        return value;
    }
    throw new Error(errorMessage);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== undefined && value !== null;
}
