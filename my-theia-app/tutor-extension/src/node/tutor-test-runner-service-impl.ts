import { inject, injectable } from '@theia/core/shared/inversify';
import {
    TutorTestExecutionResult,
    TutorTestRunnerService
} from '../common/tutor-test-runner-service';
import { TutorTestCase } from '../common/tutor-test-case-schema';

export const TutorTestCaseExecutor = Symbol('TutorTestCaseExecutor');

export interface TutorTestCaseExecutor {
    execute(testCase: TutorTestCase): Promise<TutorTestExecutionResult>;
}

@injectable()
export class DeterministicTutorTestCaseExecutor implements TutorTestCaseExecutor {
    async execute(testCase: TutorTestCase): Promise<TutorTestExecutionResult> {
        if (!testCase.expectedOutput.trim()) {
            return {
                state: 'errored',
                output: [`Input: ${testCase.input}`],
                message: 'Expected output must not be empty.'
            };
        }

        const actualOutput = testCase.input;
        const passed = testCase.matchMode === 'equals'
            ? actualOutput === testCase.expectedOutput
            : actualOutput.includes(testCase.expectedOutput);

        const output = `${testCase.title}
Input: ${testCase.input}
Expected (${testCase.matchMode}): ${testCase.expectedOutput}
Actual: ${actualOutput}
        `;

        if (passed) {
            return {
                state: 'passed',
                output: [output],
                actualOutput,
                expectedOutput: testCase.expectedOutput
            };
        }

        return {
            state: 'failed',
            output: [output],
            actualOutput,
            expectedOutput: testCase.expectedOutput,
            message: 'Output did not match expectation.'
        };
    }
}

@injectable()
export class TutorTestRunnerServiceImpl implements TutorTestRunnerService {
    @inject(TutorTestCaseExecutor)
    protected readonly executor!: TutorTestCaseExecutor;

    async runTestCase(testCase: TutorTestCase): Promise<TutorTestExecutionResult> {
        return this.executor.execute(testCase);
    }
}
