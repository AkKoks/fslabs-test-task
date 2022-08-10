import {Address, Cell, CellMessage, contractAddress, StateInit} from "ton";
import {KeyPair, sign} from "ton-crypto";

export type P2PPurchStorageData = {
    sellerAddress: Address,
    buyerAddress: Address,
    guarantorPubKey: Buffer
}

//
// storage#_ seller_address:MsgAddress buyer_address:MsgAddress
//          guarantor_pubk:uint256 = Storage;

export function buildP2PPurchDataCell(data: P2PPurchStorageData): Cell {
    let dataCell = new Cell()

    dataCell.bits.writeAddress(data.sellerAddress);
    dataCell.bits.writeAddress(data.buyerAddress);
    dataCell.bits.writeBuffer(data.guarantorPubKey);

    return dataCell;
}

export function buildP2PPurchStateInit(dataCell: Cell, codeCell: Cell): {address: Address, stateInit: StateInit} {

    let stateInit = new StateInit({
        code: codeCell,
        data: dataCell
    });
    let address = contractAddress({workchain: 0, initialCode: codeCell, initialData: dataCell});

    return {
        address,
        stateInit
    }
}

export const OperationCodes = {
    Accept: 1,
    Decline: 2
}

export const ErrorCodes = {
    InvalideSignature: 33,
    InvalideOpcode: 34,
    InternalMessage: 0xffff
}

export function buildSignature(opcode: number, keyPair: KeyPair): Buffer {
    let bodyCell = new Cell();
    bodyCell.bits.writeUint(opcode, 8);

    return sign(bodyCell.hash(), keyPair.secretKey);
}

export const Queries = {
    signedSendOpcode: (opcode: number, keyPair: KeyPair): Cell => {
        let signature = buildSignature(opcode, keyPair);
        let msgBody = new Cell();
        msgBody.bits.writeBuffer(signature);
        msgBody.bits.writeUint(opcode, 8);

        return msgBody;
    }
}