import { TutorTestCase } from './tutor-test-case-schema';

export const TutorTestRunnerService = Symbol('TutorTestRunnerService');
export const tutorTestRunnerServicePath = '/services/tutor-test-runner';

export type TutorTestExecutionState = 'passed' | 'failed' | 'errored';

export interface TutorTestExecutionResult {
    state: TutorTestExecutionState;
    output: string[];
    message?: string;
    expectedOutput?: string;
    actualOutput?: string;
}

export interface TutorTestRunnerService {
    runTestCase(testCase: TutorTestCase): Promise<TutorTestExecutionResult>;
}
