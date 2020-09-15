//@ts-check
(function () {
	// @ts-ignore
    const vscode = acquireVsCodeApi();
    console.log('inside', vscode);

    // Handle messages from the extension
	window.addEventListener('message', async e => {
		const { type, body, requestId } = e.data;
		switch (type) {
			case 'init':
				{
					if (body.untitled) {
						// await editor.resetUntitled();
						return;
					} else {
						// Load the initial image into the canvas.
                        const data = new Uint8Array(body.value.data);
                        console.log('data', data);
                        // let video = document.querySelector('video'); 
                        // let blobArray = [];
                        // // https://stackoverflow.com/a/56833053
                        // blobArray.push(new Blob([new Uint8Array(data)], {'type':'video/webm'}));
                        // let blob = new Blob(blobArray, {'type':'video/webm'});
                        // video.src = window.URL.createObjectURL(blob);
                        // video.play();
						return;
					}
				}
			// case 'update':
			// 	{
			// 		const data = body.content ? new Uint8Array(body.content.data) : undefined;
			// 		const strokes = body.edits.map(edit => new Stroke(edit.color, edit.stroke));
			// 		await editor.reset(data, strokes)
			// 		return;
			// 	}
			// case 'getFileData':
			// 	{
			// 		// Get the image data for the canvas and post it back to the extension.
			// 		editor.getImageData().then(data => {
			// 			vscode.postMessage({ type: 'response', requestId, body: Array.from(data) });
			// 		});
			// 		return;
			// 	}
		}
	});

    // Loading done
    vscode.postMessage({ type: 'ready' });
}());