import should from 'should';
import { register } from '../../../../src';
import { TransactionBuilderFactory } from '../../../../src/coin/near';
import { TransactionType } from '../../../../src/coin/baseCoin';
import * as testData from '../../../resources/near';

describe('NEAR Transaction Builder', async () => {
  let builders;

  const factory = register('tnear', TransactionBuilderFactory);

  beforeEach(function (done) {
    builders = [factory.getTransferBuilder()];
    done();
  });

  it('start and build an empty a transfer tx', async () => {
    const txBuilder = factory.getTransferBuilder();
    txBuilder.sender(testData.accounts.account1.address);
    txBuilder.nounce(1);
    txBuilder.publicKey(testData.accounts.account1.publicKey);
    txBuilder.receiverId(testData.accounts.account2.address);
    txBuilder.recentBlockHash(testData.blockHash.block1);
    txBuilder.amount('1');
    const tx = await txBuilder.build();
    should.equal(tx.type, TransactionType.Send);

    const txBroadcast = tx.toBroadcastFormat();
    should.equal(txBroadcast, testData.rawTx.transfer.unsigned);
  });

  it('build and sign a transfer tx', async () => {
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

    const txBroadcast = tx.toBroadcastFormat();
    should.equal(txBroadcast, testData.rawTx.transfer.signed);
  });

  it('should fail to build if missing sender', async () => {
    for (const txBuilder of builders) {
      txBuilder.nounce(1);
      txBuilder.publicKey(testData.accounts.account1.publicKey);
      txBuilder.receiverId(testData.accounts.account2.address);
      txBuilder.recentBlockHash(testData.blockHash.block1);
      txBuilder.amount('1');
      await txBuilder.build().should.rejectedWith('sender is required before building');
    }
  });

  it('build a send from rawTx', async () => {
    const txBuilder = factory.from(testData.rawTx.transfer.unsigned);
    const builtTx = await txBuilder.build();
    should.equal(builtTx.type, TransactionType.Send);
    should.equal(builtTx.id, '5jTEPuDcMCeEgp1iyEbNBKsnhYz4F4c1EPDtRmxm3wCw');
    builtTx.inputs.length.should.equal(1);
    builtTx.inputs[0].should.deepEqual({
      address: testData.accounts.account1.address,
      value: '1',
      coin: 'tnear',
    });
    builtTx.outputs.length.should.equal(1);
    builtTx.outputs[0].should.deepEqual({
      address: testData.accounts.account2.address,
      value: '1',
      coin: 'tnear',
    });
    const jsonTx = builtTx.toJson();
    jsonTx.signerId.should.equal(testData.accounts.account1.address);
  });

  it('build a send from signed rawTx', async () => {
    const txBuilder = factory.from(testData.rawTx.transfer.signed);
    const builtTx = await txBuilder.build();
    should.equal(builtTx.type, TransactionType.Send);
    should.equal(builtTx.id, '5jTEPuDcMCeEgp1iyEbNBKsnhYz4F4c1EPDtRmxm3wCw');
    builtTx.inputs.length.should.equal(1);
    builtTx.inputs[0].should.deepEqual({
      address: testData.accounts.account1.address,
      value: '1',
      coin: 'tnear',
    });
    builtTx.outputs.length.should.equal(1);
    builtTx.outputs[0].should.deepEqual({
      address: testData.accounts.account2.address,
      value: '1',
      coin: 'tnear',
    });
    const jsonTx = builtTx.toJson();

    jsonTx.signerId.should.equal(testData.accounts.account1.address);
  });
});