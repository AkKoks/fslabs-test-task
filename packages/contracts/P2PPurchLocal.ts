import {SmartContract} from "ton-contract-executor";
import {Address, Cell, CellMessage, CommonMessageInfo, contractAddress, ExternalMessage, toNano, StateInit, Slice} from "ton";
import {
    buildP2PPurchDataCell,
    buildP2PPurchStateInit,
    P2PPurchStorageData,
    OperationCodes,
    ErrorCodes,
    Queries
} from "./P2PPurch.data";
import BN from "bn.js";
import {KeyPair} from "ton-crypto";
import {buildFunc} from "../utils/compileFunc";
import {P2PPurchSource} from "./P2PPurch.source";


export class P2PPurchLocal {
    private constructor(
        public readonly contract: SmartContract,
        public readonly address: Address
    ) {

    }

    static operationCodes = OperationCodes;
    static errorCodes = ErrorCodes;
    static queries = Queries;

    static buildStateInit(data: P2PPurchStorageData, codeCell: Cell): {address: Address, stateInit: StateInit} {
        let dataCell = buildP2PPurchDataCell(data);
        return buildP2PPurchStateInit(dataCell, codeCell);
    }

    async getInfo(): Promise<{balance: number, sellerAddress: Address, buyerAddress: Address, guarantorPubKey: Buffer}> {
        let res = await this.contract.invokeGetMethod('get_info', [])
        if (res.exit_code !== 0) {
            throw new Error(`Unable to invoke get_info on contract`)
        }
        let [ balance, sellerAddress, buyerAddress, bnPubKey ] = res.result as [BN, Slice, Slice, BN];

        return {
            balance: balance.toNumber(),
            sellerAddress: sellerAddress.readAddress()!,
            buyerAddress: buyerAddress.readAddress()!,
            guarantorPubKey: bnPubKey.toBuffer()
        };
    }

    async sendSignedOpcode(opcode: number, keyPair: KeyPair): Promise<any> {
        let msgBody: Cell = Queries.signedSendOpcode(opcode, keyPair);

        return await this.contract.sendExternalMessage(new ExternalMessage({
                to: this.address,
                body: new CommonMessageInfo({
                    body: new CellMessage(msgBody)
                })
            })
        );
    }

    static async createFromData(data: P2PPurchStorageData, balance: BN): Promise<P2PPurchLocal> {
        let code = await buildFunc(P2PPurchSource);

        let stateInit = this.buildStateInit(data, code.cell);
        let contract = await SmartContract.fromCell(code.cell, stateInit.stateInit.data as Cell);

        contract.setC7Config({
            myself: stateInit.address
        });
        contract.setBalance(balance);

        return new P2PPurchLocal(contract, stateInit.address);
    }
}