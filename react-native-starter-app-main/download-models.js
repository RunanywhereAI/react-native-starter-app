const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'android/app/src/main/assets/models');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const models = [
    {
        url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
        dest: path.join(modelsDir, 'sherpa-onnx-whisper-tiny.en.tar.gz')
    },
    {
        url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
        dest: path.join(modelsDir, 'vits-piper-en_US-lessac-medium.tar.gz')
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Starting download: ${url}`);
        const file = fs.createWriteStream(dest);

        https.get(url, function (response) {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirect
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
                process.stdout.write(`\rDownloading ${path.basename(dest)}: ${percent}%`);
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`\nSuccessfully downloaded to ${dest}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function main() {
    for (const model of models) {
        if (!fs.existsSync(model.dest)) {
            await downloadFile(model.url, model.dest);
        } else {
            console.log(`Already exists: ${model.dest}`);
        }
    }
    console.log('All downloads complete.');
}

main().catch(console.error);
