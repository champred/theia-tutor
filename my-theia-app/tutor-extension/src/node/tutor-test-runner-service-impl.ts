import { inject, injectable } from '@theia/core/shared/inversify';
import { ChildProcess, spawn } from 'child_process';
import {
    TutorTestExecutionResult,
    TutorTestRunnerService
} from '../common/tutor-test-runner-service';
import { TutorTestCase } from '../common/tutor-test-case-schema';

export const TutorTestCaseExecutor = Symbol('TutorTestCaseExecutor');

export interface TutorTestCaseExecutor {
    execute(testCase: TutorTestCase, workspacePath: string): Promise<TutorTestExecutionResult>;
}

interface ProcessResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

function runProcess(
    command: string,
    args: string[],
    cwd: string
): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        let child: ChildProcess;
        try {
            child = spawn(command, args, {
                cwd,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (error) {
            reject(error);
            return;
        }

        let stdout = '';
        let stderr = '';
        let settled = false;

        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');

        child.stdout?.on('data', data => {
            stdout += data;
        });

        child.stderr?.on('data', data => {
            stderr += data;
        });

        const timeout = setTimeout(() => {
            child.kill();
            finish(new Error(`Process timed out: ${command}`));
        }, 30_000);

        const finish = (error?: Error): void => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);

            if (error) {
                const processError = error as NodeJS.ErrnoException & {
                    stdout?: string;
                    stderr?: string;
                };
                processError.stdout = stdout;
                processError.stderr = stderr;
                reject(processError);
                return;
            }

            resolve({
                stdout,
                stderr,
                exitCode: child.exitCode
            });
        };

        child.once('error', error => finish(error));
        child.once('close', code => {
            if (code !== 0) {
                const error = new Error(
                    `${command} exited with status ${String(code)}`
                ) as NodeJS.ErrnoException & {
                    stdout?: string;
                    stderr?: string;
                };
                error.stdout = stdout;
                error.stderr = stderr;
                finish(error);
                return;
            }

            finish();
        });
    });
}

@injectable()
export class JavaTutorTestCaseExecutor implements TutorTestCaseExecutor {
    async execute(testCase: TutorTestCase, workspacePath: string): Promise<TutorTestExecutionResult> {
        if (!testCase.expectedOutput.trim()) {
            return {
                state: 'errored',
                output: [`Input: ${testCase.input}`],
                message: 'Expected output must not be empty.'
            };
        }
        let actualOutput: string;
        try {
            const result = await runProcess(
                `${process.env.JAVA_HOME}/bin/java`,
                ['Solution.java', testCase.input],
                `${workspacePath}/${testCase.title.substring(0, 6).replace(' ', '-')}`
            );
            actualOutput = result.stdout.trimEnd();
        } catch (error) {
            const executionError = error as {
                message?: string;
                stdout?: string;
                stderr?: string;
            };
            const diagnostics = [
                executionError.stderr,
                executionError.stdout,
                executionError.message
            ].filter((value): value is string => Boolean(value?.trim()));

            return {
                state: 'errored',
                output: diagnostics,
                message: 'Failed to compile or execute Solution.java.'
            };
        }

        const passed = testCase.matchMode === 'equals'
            ? actualOutput === testCase.expectedOutput
            : actualOutput.includes(testCase.expectedOutput);

        const output = `${testCase.title}
Input: ${testCase.input}
Expected (${testCase.matchMode}): ${testCase.expectedOutput}
Actual: ${actualOutput}
        `;

        const result: TutorTestExecutionResult = {
            state: passed ? 'passed' : 'failed',
            output: [output],
            actualOutput,
            expectedOutput: testCase.expectedOutput
        };
        if (!passed) result.message = 'Output did not match expectation.';
        return result;
    }
}

@injectable()
export class TutorTestRunnerServiceImpl implements TutorTestRunnerService {
    @inject(TutorTestCaseExecutor)
    protected readonly executor!: TutorTestCaseExecutor;

    async runTestCase(testCase: TutorTestCase, root: string): Promise<TutorTestExecutionResult> {
        return this.executor.execute(testCase, root);
    }
}
