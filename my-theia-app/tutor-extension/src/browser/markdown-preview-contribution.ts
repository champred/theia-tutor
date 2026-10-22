import { FrontendApplicationContribution, AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { injectable, inject } from '@theia/core/shared/inversify';
import { MarkdownPreviewWidget } from './markdown-preview-widget';

export const MarkdownPreviewWidgetCommand: Command = {
    id: 'markdown-preview:command'
};

@injectable()
export class MarkdownPreviewContribution extends AbstractViewContribution<MarkdownPreviewWidget> implements FrontendApplicationContribution {

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    constructor() {
        super({
            widgetId: MarkdownPreviewWidget.ID,
            widgetName: MarkdownPreviewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main',
                mode: 'split-right',
            },
            toggleCommandId: MarkdownPreviewWidgetCommand.id
        });
    }

    onStart(): void {
        this.editorManager.onCreated(editor => this.openForMarkdownEditor(editor));
        this.editorManager.onCurrentEditorChanged(editor => {
            if (editor) {
                this.openForMarkdownEditor(editor);
            }
        });
        const markdownEditor = this.editorManager.all.find(editor => this.isMarkdownEditor(editor));
        if (markdownEditor) {
            this.openForMarkdownEditor(markdownEditor);
        }
    }

    protected openForMarkdownEditor(editor: EditorWidget): void {
        if (this.isMarkdownEditor(editor)) {
            void this.openView({ activate: false, reveal: true });
        }
    }

    protected isMarkdownEditor(editor: EditorWidget): boolean {
        return editor.editor.uri.path.toString().toLowerCase().endsWith('.md');
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
    }

    override registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }
}
