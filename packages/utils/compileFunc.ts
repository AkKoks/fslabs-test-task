//
// Unlike ton-compiler's compileFunc this function don't include stdlib.fc
//
import {compileFift, compileFunc} from "./tonCompiler";
import {Cell} from "ton";


export async function buildFunc(source: string): Promise<{ fiftContent: string, cell: Cell  }> {

    let fiftContent = await compileFunc(source);

    let codeCell = Cell.fromBoc(await compileFift(fiftContent))[0];

    return { fiftContent, cell: codeCell }
}