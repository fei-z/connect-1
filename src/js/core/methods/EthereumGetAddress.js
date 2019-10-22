/* @flow */

import AbstractMethod from './AbstractMethod';
import { validateParams, getFirmwareRange } from './helpers/paramsValidator';
import { validatePath, getSerializedPath } from '../../utils/pathUtils';
import { toChecksumAddress, getNetworkLabel, stripHexPrefix } from '../../utils/ethereumUtils';
import { getEthereumNetwork } from '../../data/CoinInfo';
import { uniq } from 'lodash';

import * as UI from '../../constants/ui';
import { UiMessage } from '../../message/builder';

import type { EthereumAddress } from '../../types/ethereum';
import type { CoreMessage, UiPromiseResponse, EthereumNetworkInfo } from '../../types';

type Batch = {
    path: Array<number>,
    address: ?string,
    network: ?EthereumNetworkInfo,
    showOnTrezor: boolean,
}

type Params = Array<Batch>;

export default class EthereumGetAddress extends AbstractMethod {
    confirmed: boolean = false;
    params: Params;
    progress: number = 0;

    constructor(message: CoreMessage) {
        super(message);

        this.requiredPermissions = ['read'];

        // create a bundle with only one batch if bundle doesn't exists
        const payload: Object = !message.payload.hasOwnProperty('bundle') ? { ...message.payload, bundle: [ ...message.payload ] } : message.payload;

        // validate bundle type
        validateParams(payload, [
            { name: 'bundle', type: 'array' },
            { name: 'useEventListener', type: 'boolean' },
        ]);

        const bundle = [];
        payload.bundle.forEach(batch => {
            // validate incoming parameters for each batch
            validateParams(batch, [
                { name: 'path', obligatory: true },
                { name: 'address', type: 'string' },
                { name: 'showOnTrezor', type: 'boolean' },
            ]);

            const path: Array<number> = validatePath(batch.path, 3);
            const network: ?EthereumNetworkInfo = getEthereumNetwork(path);
            this.firmwareRange = getFirmwareRange(this.name, network, this.firmwareRange);

            let showOnTrezor: boolean = true;
            if (batch.hasOwnProperty('showOnTrezor')) {
                showOnTrezor = batch.showOnTrezor;
            }

            bundle.push({
                path,
                address: batch.address,
                network,
                showOnTrezor,
            });
        });

        // set info
        if (bundle.length === 1) {
            this.info = getNetworkLabel('Export #NETWORK address', bundle[0].network);
        } else {
            const requestedNetworks: Array<?EthereumNetworkInfo> = bundle.map(b => b.network);
            const uniqNetworks = uniq(requestedNetworks);
            if (uniqNetworks.length === 1 && uniqNetworks[0]) {
                this.info = getNetworkLabel('Export multiple #NETWORK addresses', uniqNetworks[0]);
            } else {
                this.info = 'Export multiple addresses';
            }
        }

        const useEventListener = payload.useEventListener && bundle.length === 1 && typeof bundle[0].address === 'string' && bundle[0].showOnTrezor;
        this.confirmed = useEventListener;
        this.useUi = !useEventListener;

        this.params = bundle;
    }

    getButtonRequestData(code: string) {
        if (code === 'ButtonRequest_Address') {
            const data = {
                type: 'address',
                serializedPath: getSerializedPath(this.params[this.progress].path),
                address: this.params[this.progress].address || 'not-set',
            };
            return data;
        }
        return null;
    }

    async confirmation(): Promise<boolean> {
        if (this.confirmed) return true;
        // wait for popup window
        await this.getPopupPromise().promise;
        // initialize user response promise
        const uiPromise = this.createUiPromise(UI.RECEIVE_CONFIRMATION, this.device);

        const label: string = this.info;
        // request confirmation view
        this.postMessage(new UiMessage(UI.REQUEST_CONFIRMATION, {
            view: 'export-address',
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

    async run(): Promise<EthereumAddress | Array<EthereumAddress>> {
        const responses: Array<EthereumAddress> = [];
        const bundledResponse = this.params.length > 1;

        for (let i = 0; i < this.params.length; i++) {
            const batch: Batch = this.params[i];
            // silently get address and compare with requested address
            // or display as default inside popup
            if (batch.showOnTrezor) {
                const silent = await this.device.getCommands().ethereumGetAddress(
                    batch.path,
                    false
                );
                if (typeof batch.address === 'string') {
                    if (stripHexPrefix(batch.address).toLowerCase() !== stripHexPrefix(silent.address).toLowerCase()) {
                        throw new Error('Addresses do not match');
                    }
                } else {
                    batch.address = toChecksumAddress(silent.address, batch.network);
                }
            }

            const response = await this.device.getCommands().ethereumGetAddress(
                batch.path,
                batch.showOnTrezor
            );

            response.address = toChecksumAddress(response.address, batch.network);
            responses.push({
                address: response.address,
                path: batch.path,
                serializedPath: getSerializedPath(batch.path),
            });

            if (bundledResponse) {
                // send progress
                this.postMessage(new UiMessage(UI.BUNDLE_PROGRESS, {
                    progress: i,
                    response,
                }));
            }

            this.progress++;
        }
        return bundledResponse ? responses : responses[0];
    }
}
