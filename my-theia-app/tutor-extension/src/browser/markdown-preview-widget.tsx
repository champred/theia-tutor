import * as React from '@theia/core/shared/react';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';

@injectable()
export class MarkdownPreviewWidget extends ReactWidget {

    static readonly ID = 'markdown-preview:widget';
    static readonly LABEL = 'Markdown Preview';

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(MarkdownRenderer)
    protected readonly markdownRenderer!: MarkdownRenderer;

    protected fileName: string | undefined;
    protected renderedHtml = '';
    protected statusMessage = 'Open a Markdown file to preview it.';

    @postConstruct()
    protected init(): void {
        this.id = MarkdownPreviewWidget.ID;
        this.title.label = MarkdownPreviewWidget.LABEL;
        this.title.caption = MarkdownPreviewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-markdown';

        this.editorManager.onCreated(editor => {
            this.trackEditor(editor);
            this.refreshPreview();
        });
        this.editorManager.onCurrentEditorChanged(() => this.refreshPreview());

        for (const editor of this.editorManager.all) {
            this.trackEditor(editor);
        }
        this.refreshPreview();
    }

    protected trackEditor(editor: EditorWidget): void {
        this.toDispose.push(editor.editor.document.onDirtyChanged(() => {
            if (!editor.editor.document.dirty) {
                this.refreshPreview();
            }
        }));
    }

    protected findMarkdownEditor(): EditorWidget | undefined {
        return this.editorManager.all.find(editor => editor.editor.uri.path.toString().toLowerCase().endsWith('.md'));
    }

    protected refreshPreview(): void {
        const editor = this.findMarkdownEditor();
        if (!editor) {
            this.fileName = undefined;
            this.renderedHtml = '';
            this.statusMessage = 'Open a Markdown file to preview it.';
            this.update();
            return;
        }

        try {
            this.fileName = editor.editor.uri.path.name;
            const markdown = new MarkdownStringImpl(editor.editor.document.getText());
            this.renderedHtml = this.markdownRenderer.render(markdown).element.innerHTML;
            this.statusMessage = '';
        } catch (error) {
            this.renderedHtml = '';
            this.statusMessage = error instanceof Error ? error.message : String(error);
        }
        this.update();
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        this.refreshPreview();
    }

    render(): React.ReactElement {
        return <div className='tutor-markdown-preview'>
            {this.statusMessage
                ? <p className='tutor-markdown-preview-status'>{this.statusMessage}</p>
                : <div
                    className='tutor-markdown-preview-content'
                    dangerouslySetInnerHTML={{ __html: this.renderedHtml }}
                />}
        </div>;
    }
}
