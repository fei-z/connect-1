/* @flow */
'use strict';

import type { CoreMessage } from '../../types';

import AbstractMethod from './AbstractMethod';

import BlockchainDisconnect from './blockchain/BlockchainDisconnect';
import BlockchainEstimateFee from './blockchain/BlockchainEstimateFee';
import BlockchainSubscribe from './blockchain/BlockchainSubscribe';
import BlockchainUnsubscribe from './blockchain/BlockchainUnsubscribe';
import CardanoGetAddress from './CardanoGetAddress';
import CardanoGetPublicKey from './CardanoGetPublicKey';
import CardanoSignTransaction from './CardanoSignTransaction';
import CipherKeyValue from './CipherKeyValue';
import ComposeTransaction from './ComposeTransaction';
import CustomMessage from './CustomMessage';
import DebugLinkDecision from './debuglink/DebugLinkDecision';
import DebugLinkGetState from './debuglink/DebugLinkGetState';
import EthereumGetAccountInfo from './EthereumGetAccountInfo';
import EthereumGetAddress from './EthereumGetAddress';
import EthereumGetPublicKey from './EthereumGetPublicKey';
import EthereumSignMessage from './EthereumSignMessage';
import EthereumSignTransaction from './EthereumSignTransaction';
import EthereumVerifyMessage from './EthereumVerifyMessage';
import GetAccountInfo from './GetAccountInfo';
import GetAddress from './GetAddress';
import GetDeviceState from './GetDeviceState';
import GetFeatures from './GetFeatures';
import GetPublicKey from './GetPublicKey';
import GetSettings from './GetSettings';
import LiskGetAddress from './LiskGetAddress';
import LiskGetPublicKey from './LiskGetPublicKey';
import LiskSignMessage from './LiskSignMessage';
import LiskVerifyMessage from './LiskVerifyMessage';
import LiskSignTransaction from './LiskSignTransaction';
import LoadDevice from './LoadDevice';
import PushTransaction from './PushTransaction';
import RequestLogin from './RequestLogin';
import ResetDevice from './ResetDevice';
import RippleGetAccountInfo from './RippleGetAccountInfo';
import RippleGetAddress from './RippleGetAddress';
import RippleSignTransaction from './RippleSignTransaction';
import NEMGetAddress from './NEMGetAddress';
import NEMSignTransaction from './NEMSignTransaction';
import SignMessage from './SignMessage';
import SignTransaction from './SignTransaction';
import StellarGetAddress from './StellarGetAddress';
import StellarSignTransaction from './StellarSignTransaction';
import TezosGetAddress from './TezosGetAddress';
import TezosGetPublicKey from './TezosGetPublicKey';
import TezosSignTransaction from './TezosSignTransaction';
import EosGetPublicKey from './EosGetPublicKey';
import EosSignTransaction from './EosSignTransaction';
import VerifyMessage from './VerifyMessage';
import WipeDevice from './WipeDevice';
import ApplyFlags from './ApplyFlags';
import ApplySettings from './ApplySettings';
import BackupDevice from './BackupDevice';
import ChangePin from './ChangePin';
import FirmwareErase from './FirmwareErase';
import FirmwareUpload from './FirmwareUpload';
import FirmwareUpdate from './FirmwareUpdate';
import RecoveryDevice from './RecoveryDevice';

const classes: {[k: string]: any} = {
    'blockchainDisconnect': BlockchainDisconnect,
    'blockchainEstimateFee': BlockchainEstimateFee,
    'blockchainSubscribe': BlockchainSubscribe,
    'blockchainUnsubscribe': BlockchainUnsubscribe,
    'cardanoGetAddress': CardanoGetAddress,
    'cardanoGetPublicKey': CardanoGetPublicKey,
    'cardanoSignTransaction': CardanoSignTransaction,
    'cipherKeyValue': CipherKeyValue,
    'composeTransaction': ComposeTransaction,
    'customMessage': CustomMessage,
    'debugLinkDecision': DebugLinkDecision,
    'debugLinkGetState': DebugLinkGetState,
    'ethereumGetAccountInfo': EthereumGetAccountInfo,
    'ethereumGetAddress': EthereumGetAddress,
    'ethereumGetPublicKey': EthereumGetPublicKey,
    'ethereumSignMessage': EthereumSignMessage,
    'ethereumSignTransaction': EthereumSignTransaction,
    'ethereumVerifyMessage': EthereumVerifyMessage,
    'getAccountInfo': GetAccountInfo,
    'getAddress': GetAddress,
    'getDeviceState': GetDeviceState,
    'getFeatures': GetFeatures,
    'getPublicKey': GetPublicKey,
    'getSettings': GetSettings,
    'liskGetAddress': LiskGetAddress,
    'liskGetPublicKey': LiskGetPublicKey,
    'liskSignMessage': LiskSignMessage,
    'liskSignTransaction': LiskSignTransaction,
    'liskVerifyMessage': LiskVerifyMessage,
    'loadDevice': LoadDevice,
    'pushTransaction': PushTransaction,
    'requestLogin': RequestLogin,
    'resetDevice': ResetDevice,
    'rippleGetAccountInfo': RippleGetAccountInfo,
    'rippleGetAddress': RippleGetAddress,
    'rippleSignTransaction': RippleSignTransaction,
    'nemGetAddress': NEMGetAddress,
    'nemSignTransaction': NEMSignTransaction,
    'signMessage': SignMessage,
    'signTransaction': SignTransaction,
    'stellarGetAddress': StellarGetAddress,
    'stellarSignTransaction': StellarSignTransaction,
    'tezosGetAddress': TezosGetAddress,
    'tezosGetPublicKey': TezosGetPublicKey,
    'tezosSignTransaction': TezosSignTransaction,
    'eosGetPublicKey': EosGetPublicKey,
    'eosSignTransaction': EosSignTransaction,
    'verifyMessage': VerifyMessage,
    'wipeDevice': WipeDevice,
    'applyFlags': ApplyFlags,
    'applySettings': ApplySettings,
    'backupDevice': BackupDevice,
    'changePin': ChangePin,
    'firmwareErase': FirmwareErase,
    'firmwareUpload': FirmwareUpload,
    'firmwareUpdate': FirmwareUpdate,
    'recoveryDevice': RecoveryDevice,
};

export const find = (message: CoreMessage): AbstractMethod => {
    if (!message.payload) {
        throw new Error('Message payload not found');
    }

    if (!message.payload.method || typeof message.payload.method !== 'string') {
        throw new Error('Message method is not set');
    }

    if (classes[message.payload.method]) {
        return new classes[message.payload.method](message);
    }

    throw new Error(`Method ${message.payload.method} not found`);
};

export default find;
