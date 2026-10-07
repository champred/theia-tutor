import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ILogger } from '@theia/core';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import {
    parseTutorTestCasesFile,
    serializeTutorTestCasesFile,
    TUTOR_TEST_CASES_FILE_PATH,
    TutorTestCase
} from '../common/tutor-test-case-schema';

export interface TutorTestCaseLoadResult {
    testCases: TutorTestCase[];
    fileUri?: URI;
    errorMessage?: string;
    malformedFile: boolean;
}

@injectable()
export class TutorTestCaseStore {
    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(ILogger) @named('tutor-extension:TutorTestCaseStore')
    protected readonly logger!: ILogger;

    async load(): Promise<TutorTestCaseLoadResult> {
        const fileUri = await this.resolveFileUri();
        if (!fileUri) {
            return {
                testCases: [],
                malformedFile: false,
                errorMessage: 'No workspace folder is open.'
            };
        }

        try {
            const exists = await this.fileService.exists(fileUri);
            if (!exists) {
                return {
                    testCases: [],
                    malformedFile: false,
                    fileUri
                };
            }

            const content = await this.fileService.readFile(fileUri);
            const parsed = parseTutorTestCasesFile(content.value.toString());
            if (parsed.error) {
                return {
                    testCases: [],
                    malformedFile: true,
                    fileUri,
                    errorMessage: `Could not parse ${fileUri.path.base}: ${parsed.error}`
                };
            }

            return {
                testCases: parsed.testCases ?? [],
                malformedFile: false,
                fileUri
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to load test cases from ${fileUri.toString()}`, error);
            return {
                testCases: [],
                malformedFile: false,
                fileUri,
                errorMessage: `Could not read ${fileUri.path.base}: ${message}`
            };
        }
    }

    async save(testCases: readonly TutorTestCase[]): Promise<URI> {
        const fileUri = await this.resolveFileUri();
        if (!fileUri) {
            throw new Error('No workspace folder is open.');
        }

        await this.assertFileIsSafeToOverwrite(fileUri);

        const rootFolderUri = fileUri.parent;
        await this.fileService.createFolder(rootFolderUri);

        const content = serializeTutorTestCasesFile(testCases);
        await this.fileService.writeFile(fileUri, BinaryBuffer.fromString(content));
        return fileUri;
    }

    protected async resolveFileUri(): Promise<URI | undefined> {
        const roots = await this.workspaceService.roots;
        if (roots.length === 0) {
            return undefined;
        }

        return roots[0].resource.resolve(TUTOR_TEST_CASES_FILE_PATH);
    }

    protected async assertFileIsSafeToOverwrite(fileUri: URI): Promise<void> {
        const exists = await this.fileService.exists(fileUri);
        if (!exists) {
            return;
        }

        const content = await this.fileService.readFile(fileUri);
        const parsed = parseTutorTestCasesFile(content.value.toString());
        if (parsed.error) {
            throw new Error(
                `Refusing to overwrite malformed test-case file ${fileUri.path.base}. ` +
                'Fix or delete the file manually before saving from the widget.'
            );
        }
    }
}
