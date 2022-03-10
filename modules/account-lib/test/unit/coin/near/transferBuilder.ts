import { register } from '../../../../src';
import { TransactionBuilderFactory } from '../../../../src/coin/near';
import should from 'should';
import * as testData from '../../../resources/near';
import { TransactionType } from '../../../../src/coin/baseCoin';
import Eddsa from '../../../../src/mpc/tss';
import { KeyPair } from '../../../../src/coin/dot';
import * as base58 from 'bs58';

describe('Near Transfer Builder', () => {
  const factory = register('tnear', TransactionBuilderFactory);

  describe('Succeed', () => {
    it('build a transfer tx unsigned', async () => {
      const txBuilder = factory.getTransferBuilder();
      txBuilder.sender(testData.accounts.account1.address);
      txBuilder.nounce(1);
      txBuilder.publicKey(testData.accounts.account1.publicKey);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      const tx = await txBuilder.build();
      should.equal(tx.type, TransactionType.Send);

      tx.inputs.length.should.equal(1);
      tx.inputs[0].should.deepEqual({
        address: testData.accounts.account1.address,
        value: '1',
        coin: 'tnear',
      });
      tx.outputs.length.should.equal(1);
      tx.outputs[0].should.deepEqual({
        address: testData.accounts.account2.address,
        value: '1',
        coin: 'tnear',
      });
      const rawTx = tx.toBroadcastFormat();
      should.equal(rawTx, testData.rawTx.transfer.unsigned);
    });

    it('build a transfer tx signed', async () => {
      const txBuilder = factory.getTransferBuilder();
      txBuilder.sender(testData.accounts.account1.address);
      txBuilder.nounce(1);
      txBuilder.publicKey(testData.accounts.account1.publicKey);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      txBuilder.sign({ key: testData.accounts.account1.secretKey });
      const tx = await txBuilder.build();
      should.equal(tx.type, TransactionType.Send);

      should.equal(tx.type, TransactionType.Send);

      tx.inputs.length.should.equal(1);
      tx.inputs[0].should.deepEqual({
        address: testData.accounts.account1.address,
        value: '1',
        coin: 'tnear',
      });
      tx.outputs.length.should.equal(1);
      tx.outputs[0].should.deepEqual({
        address: testData.accounts.account2.address,
        value: '1',
        coin: 'tnear',
      });
      const txBroadcast = tx.toBroadcastFormat();
      should.equal(txBroadcast, testData.rawTx.transfer.signed);
    });
  });

  describe('add TSS signature', function () {
    it('should add TSS signature', async () => {
      const factory = register('tnear', TransactionBuilderFactory);
      const MPC = await Eddsa();
      const A = MPC.keyShare(1, 2, 3);
      const B = MPC.keyShare(2, 2, 3);
      const C = MPC.keyShare(3, 2, 3);

      const A_combine = MPC.keyCombine(A.uShare, [B.yShares[1], C.yShares[1]]);
      const B_combine = MPC.keyCombine(B.uShare, [A.yShares[2], C.yShares[2]]);
      const C_combine = MPC.keyCombine(C.uShare, [A.yShares[3], B.yShares[3]]);

      const commonPub = A_combine.pShare.y;
      const nearKeyPair = new KeyPair({ pub: commonPub });
      const sender = nearKeyPair.getAddress();

      let txBuilder = factory.getTransferBuilder();
      txBuilder.sender(testData.accounts.account1.address);
      txBuilder.nounce(1);
      txBuilder.publicKey(testData.accounts.account1.publicKey);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      const unsignedTransaction = await txBuilder.build();
      const signablePayload = unsignedTransaction.signablePayload;

      // signing with 3-3 signatures
      let A_sign_share = MPC.signShare(signablePayload, A_combine.pShare, [A_combine.jShares[2], A_combine.jShares[3]]);
      let B_sign_share = MPC.signShare(signablePayload, B_combine.pShare, [B_combine.jShares[1], B_combine.jShares[3]]);
      let C_sign_share = MPC.signShare(signablePayload, C_combine.pShare, [C_combine.jShares[1], C_combine.jShares[2]]);
      let A_sign = MPC.sign(signablePayload, A_sign_share.xShare, [B_sign_share.rShares[1], C_sign_share.rShares[1]]);
      let B_sign = MPC.sign(signablePayload, B_sign_share.xShare, [A_sign_share.rShares[2], C_sign_share.rShares[2]]);
      let C_sign = MPC.sign(signablePayload, C_sign_share.xShare, [A_sign_share.rShares[3], B_sign_share.rShares[3]]);
      let signature = MPC.signCombine([A_sign, B_sign, C_sign]);
      let rawSignature = Buffer.concat([Buffer.from(signature.R, 'hex'), Buffer.from(signature.sigma, 'hex')]);

      txBuilder = factory.getTransferBuilder();
      txBuilder.sender(sender);
      txBuilder.nounce(1);
      txBuilder.publicKey(commonPub);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      txBuilder.addSignature({ pub: nearKeyPair.getKeys().pub }, rawSignature);
      let signedTransaction = await txBuilder.build();
      signedTransaction.signature.length.should.equal(1);
      signedTransaction.signature[0].should.equal(base58.encode(rawSignature));

      // signing with A and B
      A_sign_share = MPC.signShare(signablePayload, A_combine.pShare, [A_combine.jShares[2]]);
      B_sign_share = MPC.signShare(signablePayload, B_combine.pShare, [B_combine.jShares[1]]);
      A_sign = MPC.sign(signablePayload, A_sign_share.xShare, [B_sign_share.rShares[1]]);
      B_sign = MPC.sign(signablePayload, B_sign_share.xShare, [A_sign_share.rShares[2]]);
      // sign the message_buffer (unsigned txHex)
      signature = MPC.signCombine([A_sign, B_sign]);
      rawSignature = Buffer.concat([Buffer.from(signature.R, 'hex'), Buffer.from(signature.sigma, 'hex')]);
      txBuilder = factory.getTransferBuilder();
      txBuilder.sender(sender);
      txBuilder.nounce(1);
      txBuilder.publicKey(commonPub);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      txBuilder.addSignature({ pub: nearKeyPair.getKeys().pub }, rawSignature);
      signedTransaction = await txBuilder.build();
      signedTransaction.signature.length.should.equal(1);
      signedTransaction.signature[0].should.equal(base58.encode(rawSignature));

      // signing with A and C
      A_sign_share = MPC.signShare(signablePayload, A_combine.pShare, [A_combine.jShares[3]]);
      C_sign_share = MPC.signShare(signablePayload, C_combine.pShare, [C_combine.jShares[1]]);
      A_sign = MPC.sign(signablePayload, A_sign_share.xShare, [C_sign_share.rShares[1]]);
      C_sign = MPC.sign(signablePayload, C_sign_share.xShare, [A_sign_share.rShares[3]]);
      signature = MPC.signCombine([A_sign, C_sign]);
      rawSignature = Buffer.concat([Buffer.from(signature.R, 'hex'), Buffer.from(signature.sigma, 'hex')]);
      txBuilder = factory.getTransferBuilder();
      txBuilder.sender(sender);
      txBuilder.nounce(1);
      txBuilder.publicKey(commonPub);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      txBuilder.addSignature({ pub: nearKeyPair.getKeys().pub }, rawSignature);
      signedTransaction = await txBuilder.build();
      signedTransaction.signature.length.should.equal(1);
      signedTransaction.signature[0].should.equal(base58.encode(rawSignature));

      // signing with B and C
      B_sign_share = MPC.signShare(signablePayload, B_combine.pShare, [B_combine.jShares[3]]);
      C_sign_share = MPC.signShare(signablePayload, C_combine.pShare, [C_combine.jShares[2]]);
      B_sign = MPC.sign(signablePayload, B_sign_share.xShare, [C_sign_share.rShares[2]]);
      C_sign = MPC.sign(signablePayload, C_sign_share.xShare, [B_sign_share.rShares[3]]);
      signature = MPC.signCombine([B_sign, C_sign]);
      rawSignature = Buffer.concat([Buffer.from(signature.R, 'hex'), Buffer.from(signature.sigma, 'hex')]);
      txBuilder = factory.getTransferBuilder();
      txBuilder.sender(sender);
      txBuilder.nounce(1);
      txBuilder.publicKey(commonPub);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      txBuilder.addSignature({ pub: nearKeyPair.getKeys().pub }, rawSignature);
      signedTransaction = await txBuilder.build();
      signedTransaction.signature.length.should.equal(1);
      signedTransaction.signature[0].should.equal(base58.encode(rawSignature));

      const rebuiltTransaction = await factory.from(signedTransaction.toBroadcastFormat()).build();

      rebuiltTransaction.signature[0].should.equal(base58.encode(rawSignature));
    });
  });
});