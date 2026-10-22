import {
    ContributionFilterRegistry,
    FilterContribution,
} from '@theia/core/lib/common';
import { injectable } from '@theia/core/shared/inversify';
import { TerminalFrontendContribution } from '@theia/terminal/lib/browser/terminal-frontend-contribution';

@injectable()
export class TerminalFilterContribution implements FilterContribution {

    registerContributionFilters(registry: ContributionFilterRegistry): void {
        registry.addFilters('*', [
            contribution => !(contribution instanceof TerminalFrontendContribution)
        ]);
    }
}


