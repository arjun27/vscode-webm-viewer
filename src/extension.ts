import * as vscode from 'vscode';
import * as path from 'path';

interface WebmDocumentDelegate {
	getFileData(): Promise<Uint8Array>;
}

class WebmDocument implements vscode.CustomDocument {
	private readonly _uri: vscode.Uri;
	private _documentData: Uint8Array;
	private readonly _delegate: WebmDocumentDelegate;

	dispose(): void {
		// throw new Error('Method not implemented.');
	}

	public get uri() { return this._uri; }
	public get documentData(): Uint8Array { return this._documentData; }

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
		delegate: WebmDocumentDelegate,
	): Promise<WebmDocument | PromiseLike<WebmDocument>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await WebmDocument.readFile(dataFile);
		return new WebmDocument(uri, fileData, delegate);
	}

	private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
		delegate: WebmDocumentDelegate
	) {
		// super();
		this._uri = uri;
		this._documentData = initialContent;
		this._delegate = delegate;
	}


	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		return vscode.workspace.fs.readFile(uri);
	}
}

class WebmEditorProvider implements vscode.CustomReadonlyEditorProvider {
	private static readonly viewType = 'webm-viewer.webmViewer';
	private readonly webviews = new WebviewCollection();

	public static register(context: vscode.ExtensionContext): vscode.Disposable { 
		const provider = new WebmEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(WebmEditorProvider.viewType, provider);
		return providerRegistration;
	}

	constructor(private readonly context: vscode.ExtensionContext) { }

	async openCustomDocument(uri: vscode.Uri,
					   openContext: vscode.CustomDocumentOpenContext,
					   token: vscode.CancellationToken): Promise<WebmDocument> {
		console.log('here 1', uri, openContext);
		const document: WebmDocument = await WebmDocument.create(uri, openContext.backupId, {
			getFileData: async () => {
				const webviewsForDocument = Array.from(this.webviews.get(uri));
				if (!webviewsForDocument.length) {
					throw new Error('Could not find webview to save for');
				}
				const panel = webviewsForDocument[0];
				// const response = await this.postMessageWithResponse<number[]>(panel, 'getFileData', {});
				// return new Uint8Array(response);
				return new Uint8Array(8);
			}
		});
		return document;
	}

	resolveCustomEditor(document: WebmDocument,
						webviewPanel: vscode.WebviewPanel,
						token: vscode.CancellationToken): void | Thenable<void> {
		console.log('here 2');
		this.webviews.add(document.uri, webviewPanel);
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		// webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(e => {
			if (e.type === 'ready') {
				if (document.uri.scheme === 'untitled') {
					this.postMessage(webviewPanel, 'init', {
						untitled: true
					});
				} else {
					this.postMessage(webviewPanel, 'init', {
						value: document.documentData
					});
				}
			}
		});
	}

	private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'media', 'webview.js')
		));
		const styleUri = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'media', 'webview.css')
		));
		const video = webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, 'media', 'big-buck-bunny_trailer.webm')
		));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; media-src * data: blob: 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet" />
				<title>Paw Draw</title>
			</head>
			<body>
				<div class="drawing-canvas">hello!!!</div>
				<video><source src="${video}" type="video/webm"></video>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('webm-viewer.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from vscode-webm-viewer!');
		})
	);
	context.subscriptions.push(WebmEditorProvider.register(context));
}

export function deactivate() {}

class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}