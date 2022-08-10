import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child from 'child_process';
import { createTempFile } from './createTempFile';

const platform = os.platform();
const arch = os.arch();

type BinPath = {
    func: string [],
    fift: string []
}

const platformPathMap = new Map<string, BinPath>([
    ['linux_x64', {
            func: ['linux', 'func'],
            fift: ['linux', 'fift']
        }
    ],
    ['darwin_x64', {
        func: ['macos', 'func'],
        fift: ['macos', 'fift']
    }],
    ['darwin_arm64', {
        func: ['macos', 'func-arm64'],
        fift: ['macos', 'fift-arm64']
    }]
]);

let keyPlatform = (platform + '_' + arch);

const funcPath = path.resolve(__dirname, '..', 'bin', ... platformPathMap.get(keyPlatform)!.func);
const fiftPath = path.resolve(__dirname, '..', 'bin', ... platformPathMap.get(keyPlatform)!.fift);
const fiftLibPath = path.resolve(__dirname, '..', 'bin', 'fiftlib');

async function writeFile(name: string, content: string) {
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(name, content, 'utf-8', (e) => {
            if (e) {
                reject(e);
            } else {
                resolve();
            }
        });
    })
}

async function readFile(name: string) {
    return await new Promise<string>((resolve, reject) => {
        fs.readFile(name, 'utf-8', (e, d) => {
            if (e) {
                reject(e);
            } else {
                resolve(d);
            }
        });
    })
}
async function readFileBuffer(name: string) {
    return await new Promise<Buffer>((resolve, reject) => {
        fs.readFile(name, (e, d) => {
            if (e) {
                reject(e);
            } else {
                resolve(d);
            }
        });
    })
}

export function executeFunc(args: string[]) {
    child.execSync(funcPath + ' ' + args.join(' '), {
        stdio: 'inherit'
    });
}

export function executeFift(args: string[]) {
    child.execSync(fiftPath + ' ' + args.join(' '), {
        stdio: 'inherit',
        env: {
            FIFTPATH: fiftLibPath
        }
    });
}

export async function compileFunc(source: string): Promise<string> {
    let sourceFile = await createTempFile('.fc');
    let fiftFile = await createTempFile('.fif');
    try {
        await writeFile(sourceFile.name, source);
        executeFunc(['-o', fiftFile.name, '-PS', sourceFile.name]);
        let fiftContent = await readFile(fiftFile.name);
        fiftContent = fiftContent.slice(fiftContent.indexOf('\n') + 1); // Remove first line
        return fiftContent;
    } finally {
        sourceFile.destroy();
        fiftFile.destroy();
    }
}

export async function compileFift(source: string): Promise<Buffer> {
    let fiftOpFile = await createTempFile('.fif');
    let cellFile = await createTempFile('.cell');
    try {
        let body = '';
        body += `"Asm.fif" include\n`;
        body += source;
        body += '\n';
        body += `boc>B "${cellFile.name}" B>file`;

        //console.log('\n\n\n\n' + body + '\n\n\n\n');
        fs.writeFileSync(fiftOpFile.name, body, 'utf-8');
        executeFift([fiftOpFile.name]);
        return await readFileBuffer(cellFile.name);
    } finally {
        fiftOpFile.destroy();
        cellFile.destroy();
    }
}