/* @flow */
'use strict';

import AbstractMethod from './AbstractMethod';
import { validateParams, validateCoinPath, getFirmwareRange } from './helpers/paramsValidator';
import Discovery from './helpers/Discovery';
import * as UI from '../../constants/ui';
import { NO_COIN_INFO } from '../../constants/errors';

import {
    validatePath,
    getAccountLabel,
    getSerializedPath,
} from '../../utils/pathUtils';
import { create as createDeferred } from '../../utils/deferred';

import Account, { create as createAccount } from '../../account';
import BlockBook, { create as createBackend } from '../../backend';
import { getBitcoinNetwork, fixCoinInfoNetwork } from '../../data/CoinInfo';
import { UiMessage } from '../../message/builder';
import type { HDNodeResponse } from '../../types/trezor';
import type { Deferred, CoreMessage, UiPromiseResponse, BitcoinNetworkInfo } from '../../types';
import type { AccountInfoPayload } from '../../types/response';

type Params = {
    path: ?Array<number>,
    xpub: ?string,
    coinInfo: BitcoinNetworkInfo,
}

type Response = AccountInfoPayload;

export default class GetAccountInfo extends AbstractMethod {
    params: Params;
    confirmed: boolean = false;
    backend: BlockBook;
    discovery: ?Discovery;

    constructor(message: CoreMessage) {
        super(message);
        this.requiredPermissions = ['read'];
        this.info = 'Export account info';

        const payload: Object = message.payload;

        // validate incoming parameters
        validateParams(payload, [
            { name: 'coin', type: 'string' },
            { name: 'xpub', type: 'string' },
            { name: 'crossChain', type: 'boolean' },
        ]);

        let path: Array<number>;
        let coinInfo: ?BitcoinNetworkInfo;
        if (payload.coin) {
            coinInfo = getBitcoinNetwork(payload.coin);
        }

        if (payload.path) {
            path = validatePath(payload.path, 3, true);
            if (!coinInfo) {
                coinInfo = getBitcoinNetwork(path);
            } else if (!payload.crossChain) {
                validateCoinPath(coinInfo, path);
            }
        }

        // if there is no coinInfo at this point return error
        if (!coinInfo) {
            throw NO_COIN_INFO;
        } else {
            // check required firmware with coinInfo support
            this.firmwareRange = getFirmwareRange(this.name, coinInfo, this.firmwareRange);
        }

        // delete payload.path;
        // payload.xpub = 'ypub6XKbB5DSkq8Royg8isNtGktj6bmEfGJXDs83Ad5CZ5tpDV8QofwSWQFTWP2Pv24vNdrPhquehL7vRMvSTj2GpKv6UaTQCBKZALm6RJAmxG6'
        // payload.xpub = 'xpub6BiVtCpG9fQQNBuKZoKzhzmENDKdCeXQsNVPF2Ynt8rhyYznmPURQNDmnNnX9SYahZ1DVTaNtsh3pJ4b2jKvsZhpv2oVj76YETCGztKJ3LM'

        this.params = {
            path: path,
            xpub: payload.xpub,
            coinInfo,
        };
    }

    async confirmation(): Promise<boolean> {
        if (this.confirmed) return true;
        // wait for popup window
        await this.getPopupPromise().promise;
        // initialize user response promise
        const uiPromise = this.createUiPromise(UI.RECEIVE_CONFIRMATION, this.device);

        let label: string;
        if (this.params.path) {
            label = getAccountLabel(this.params.path, this.params.coinInfo);
        } else if (this.params.xpub) {
            label = `Export ${ this.params.coinInfo.label } account for public key <span>${ this.params.xpub }</span>`;
        } else {
            return true;
        }

        // request confirmation view
        this.postMessage(new UiMessage(UI.REQUEST_CONFIRMATION, {
            view: 'export-account-info',
            label,
        }));

        // wait for user action
        const uiResp: UiPromiseResponse = await uiPromise.promise;

        this.confirmed = uiResp.payload;
        return this.confirmed;
    }

    async noBackupConfirmation(): Promise<boolean> {
        // wait for popup window
        await this.getPopupPromise().promise;
        // initialize user response promise
        const uiPromise = this.createUiPromise(UI.RECEIVE_CONFIRMATION, this.device);

        // request confirmation view
        this.postMessage(new UiMessage(UI.REQUEST_CONFIRMATION, {
            view: 'no-backup',
        }));

        // wait for user action
        const uiResp: UiPromiseResponse = await uiPromise.promise;
        return uiResp.payload;
    }

    async run(): Promise<Response> {
        // initialize backend
        this.backend = await createBackend(this.params.coinInfo);

        if (this.params.path) {
            return await this._getAccountFromPath(this.params.path);
        } else if (this.params.xpub) {
            return await this._getAccountFromPublicKey();
        } else {
            return await this._getAccountFromDiscovery();
        }
    }

    async _getAccountFromPath(path: Array<number>): Promise<Response> {
        const coinInfo: BitcoinNetworkInfo = fixCoinInfoNetwork(this.params.coinInfo, path);
        const node: HDNodeResponse = await this.device.getCommands().getHDNode(path, coinInfo);
        const account = createAccount(path, node.xpub, coinInfo);

        const discovery: Discovery = this.discovery = new Discovery({
            getHDNode: this.device.getCommands().getHDNode.bind(this.device.getCommands()),
            coinInfo: this.params.coinInfo,
            backend: this.backend,
            loadInfo: false,
        });

        await discovery.getAccountInfo(account);
        return this._response(account);
    }

    async _getAccountFromPublicKey(): Promise<Response> {
        const discovery: Discovery = this.discovery = new Discovery({
            getHDNode: this.device.getCommands().getHDNode.bind(this.device.getCommands()),
            coinInfo: this.params.coinInfo,
            backend: this.backend,
            loadInfo: false,
        });

        const deferred: Deferred<Response> = createDeferred('account_discovery');
        discovery.on('update', async (accounts: Array<Account>) => {
            const account = accounts.find(a => a.xpub === this.params.xpub);
            if (account) {
                discovery.removeAllListeners();
                discovery.completed = true;

                await discovery.getAccountInfo(account);
                discovery.stop();
                deferred.resolve(this._response(account));
            }
        });
        discovery.on('complete', () => {
            deferred.resolve(this._response(null));
        });

        discovery.start();

        return await deferred.promise;
    }

    async _getAccountFromDiscovery(): Promise<Response> {
        const discovery: Discovery = this.discovery = new Discovery({
            getHDNode: this.device.getCommands().getHDNode.bind(this.device.getCommands()),
            coinInfo: this.params.coinInfo,
            backend: this.backend,
        });

        discovery.on('update', (accounts: Array<Account>) => {
            this.postMessage(new UiMessage(UI.SELECT_ACCOUNT, {
                coinInfo: this.params.coinInfo,
                accounts: accounts.map(a => a.toMessage()),
            }));
        });

        discovery.on('complete', (accounts: Array<Account>) => {
            this.postMessage(new UiMessage(UI.SELECT_ACCOUNT, {
                coinInfo: this.params.coinInfo,
                accounts: accounts.map(a => a.toMessage()),
                complete: true,
            }));
        });

        try {
            discovery.start();
        } catch (error) {
            throw error;
        }

        // set select account view
        // this view will be updated from discovery events
        this.postMessage(new UiMessage(UI.SELECT_ACCOUNT, {
            coinInfo: this.params.coinInfo,
            accounts: [],
            start: true,
        }));

        // wait for user action
        const uiResp: UiPromiseResponse = await this.createUiPromise(UI.RECEIVE_ACCOUNT, this.device).promise;
        discovery.stop();

        const resp: number = parseInt(uiResp.payload);
        const account = discovery.accounts[resp];

        return this._response(account);
    }

    _response(account: ?Account): Response {
        if (!account) {
            throw new Error('Account not found');
        }

        const nextAddress: string = account.getNextAddress();
        return {
            id: account.id,
            path: account.path,
            serializedPath: getSerializedPath(account.path),
            address: nextAddress,
            addressIndex: account.getNextAddressId(),
            addressPath: account.getAddressPath(nextAddress),
            addressSerializedPath: getSerializedPath(account.getAddressPath(nextAddress)),
            xpub: account.xpub,
            balance: account.getBalance(),
            confirmed: account.getConfirmedBalance(),
            transactions: account.getTransactionsCount(),
            utxo: account.getUtxos(),
            usedAddresses: account.getUsedAddresses(),
            unusedAddresses: account.getUnusedAddresses(),
        };
    }

    dispose() {
        if (this.discovery) {
            const d = this.discovery;
            d.stop();
            d.removeAllListeners();
        }
    }
}
