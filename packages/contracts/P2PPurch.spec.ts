import {P2PPurchStorageData} from "./P2PPurch.data";
import {randomAddress} from "../utils/randomAddress";
import {Address, Cell, CellMessage, CommonMessageInfo, ExternalMessage, InternalMessage, StateInit, toNano} from "ton";
import {KeyPair} from "ton-crypto";
import {P2PPurchLocal} from "./P2PPurchLocal";
import {randomKeyPair} from "../utils/randomKeyPair";
import BN from "bn.js";
import {SendMsgAction} from "ton-contract-executor";

describe("P2P purchase with guarantor contract", () => {
    let validKeyPair: KeyPair;
    let invalidKeyPair: KeyPair;
    let sellerAddress: Address;
    let buyerAddress: Address;
    let defaultData: P2PPurchStorageData;
    let contractBalance: BN;

    beforeAll(async () => {
        validKeyPair = await randomKeyPair();
        invalidKeyPair = await randomKeyPair();

        sellerAddress = randomAddress();
        buyerAddress = randomAddress();

        contractBalance = toNano(1000);

        defaultData = {
            sellerAddress: sellerAddress,
            buyerAddress: buyerAddress,
            guarantorPubKey: validKeyPair.publicKey
        }
    });

    it("should ignore internal message", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);

        let res = await p2pContract.contract.sendInternalMessage(new InternalMessage({
            to: p2pContract.address,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(new Cell())
            })
        }));

        expect(res.type === 'failed').toBe(true);
        expect(res.exit_code).toEqual(P2PPurchLocal.errorCodes.InternalMessage);
    });

    it("should return info", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);

        let res = await p2pContract.getInfo();

        expect(res.balance.toString()).toEqual(contractBalance.toString());
        expect(res.sellerAddress.equals(defaultData.sellerAddress)).toBe(true);
        expect(res.buyerAddress.equals(defaultData.buyerAddress)).toBe(true);
        expect(res.guarantorPubKey.equals(defaultData.guarantorPubKey)).toBe(true);
    });

    it("should drop msg with invalid signature", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);

        let res = await p2pContract.sendSignedOpcode(P2PPurchLocal.operationCodes.Accept, invalidKeyPair);
        expect(res.type === 'failed').toBe(true);
        expect(res.exit_code).toEqual(P2PPurchLocal.errorCodes.InvalideSignature);
    });

    it("should drop msg with invalid opcode", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);

        let res = await p2pContract.sendSignedOpcode(3, validKeyPair);
        expect(res.type === 'failed').toBe(true);
        expect(res.exit_code).toEqual(P2PPurchLocal.errorCodes.InvalideOpcode);
    });

    it("should accept contract and send msg to seller", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);
        let res = await p2pContract.sendSignedOpcode(P2PPurchLocal.operationCodes.Accept, validKeyPair);

        expect(res.exit_code).toEqual(0);
        expect(res.type === 'success').toBe(true);

        let [contractMessage] = res.actionList as [SendMsgAction];

        // console.log(contractMessage);

        // mode 128 + 32 - send all the remaining balance of the smart contract and destroy it
        expect(contractMessage.mode).toEqual(128 + 32);
        expect(contractMessage.message.info.dest!.equals(defaultData.sellerAddress)).toBe(true);
    });

    it("should decline contract and send msg to buyer", async () => {
        let p2pContract = await P2PPurchLocal.createFromData(defaultData, contractBalance);
        let res = await p2pContract.sendSignedOpcode(P2PPurchLocal.operationCodes.Decline, validKeyPair);

        expect(res.exit_code).toEqual(0);
        expect(res.type === 'success').toBe(true);

        let [contractMessage] = res.actionList as [SendMsgAction];

        // console.log(contractMessage);

        // mode 128 + 32 - send all the remaining balance of the smart contract and destroy it
        expect(contractMessage.mode).toEqual(128 + 32);
        expect(contractMessage.message.info.dest!.equals(defaultData.buyerAddress)).toBe(true);
    });

});
