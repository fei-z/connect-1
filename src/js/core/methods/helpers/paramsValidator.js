/* @flow */
'use strict';

import semvercmp from 'semver-compare';
import { invalidParameter } from '../../../constants/errors';
import { fromHardened } from '../../../utils/pathUtils';
import DataManager from '../../../data/DataManager';
import type { CoinInfo, FirmwareRange } from '../../../types';

type Param = {
    name: string,
    type?: 'string' | 'number' | 'array' | 'buffer' | 'boolean' | 'amount' | 'object',
    obligatory?: true,
}

export const validateParams = (values: Object, fields: Array<Param>): void => {
    fields.forEach(field => {
        if (values.hasOwnProperty(field.name)) {
            const value = values[field.name];
            if (field.type) {
                if (field.type === 'array') {
                    if (!Array.isArray(value)) {
                        // invalid type
                        throw invalidParameter(`Parameter "${ field.name }" has invalid type. "${ field.type }" expected.`);
                    } else if (value.length < 1) {
                        throw invalidParameter(`Parameter "${ field.name }" is empty.`);
                    }
                } else if (field.type === 'amount') {
                    if (typeof value !== 'string') {
                        throw invalidParameter(`Parameter "${ field.name }" has invalid type. "string" expected.`);
                    } else if (isNaN(parseInt(value, 10)) || parseInt(value, 10).toString(10) !== value) {
                        throw invalidParameter(`Parameter "${ field.name }" has invalid value "${value}". Integer representation expected.`);
                    }
                } else if (field.type === 'buffer') {
                    if (typeof value === 'undefined' || (typeof value.constructor.isBuffer === 'function' && value.constructor.isBuffer(value))) {
                        throw invalidParameter(`Parameter "${ field.name }" has invalid type. "buffer" expected.`);
                    }
                } else if (typeof value !== field.type) {
                    // invalid type
                    throw invalidParameter(`Parameter "${ field.name }" has invalid type. "${ field.type }" expected.`);
                }
            }
        } else if (field.obligatory) {
            // not found
            throw invalidParameter(`Parameter "${ field.name }" is missing.`);
        }
    });
};

export const validateCoinPath = (coinInfo: ?CoinInfo, path: Array<number>): void => {
    if (coinInfo && coinInfo.slip44 !== fromHardened(path[1])) {
        throw invalidParameter('Parameters "path" and "coin" do not match.');
    }
};

export const getFirmwareRange = (method: string, coinInfo: ?CoinInfo, current: FirmwareRange): FirmwareRange => {
    // set minimum required firmware from coins.json (coinInfo)
    if (coinInfo) {
        if (!coinInfo.support || typeof coinInfo.support.trezor1 !== 'string') {
            current['1'].min = '0';
        } else if (semvercmp(coinInfo.support.trezor1, current['1'].min) > 0) {
            current['1'].min = coinInfo.support.trezor1;
        }

        if (!coinInfo.support || typeof coinInfo.support.trezor2 !== 'string') {
            current['2'].min = '0';
        } else if (semvercmp(coinInfo.support.trezor2, current['2'].min) > 0) {
            current['2'].min = coinInfo.support.trezor2;
        }
    }

    const coinType = coinInfo ? coinInfo.type : null;
    const shortcut = coinInfo ? coinInfo.shortcut.toLowerCase() : null;
    // find firmware range in config.json
    const range = DataManager.getConfig().supportedFirmware.find(c => {
        if (c.coinType === coinType || c.coin === shortcut) return c;
        if (c.excludedMethods && c.excludedMethods.includes(method)) {
            return c;
        }
    });

    if (range) {
        if (range.excludedMethods && !range.excludedMethods.includes(method)) {
            // not in range. do not change default range
            return current;
        }
        const { min, max } = range;
        // override defaults
        if (min) {
            if (current['1'].min === '0' || semvercmp(current['1'].min, min[0]) < 0) {
                current['1'].min = min[0];
            }
            if (current['2'].min === '0' || semvercmp(current['2'].min, min[1]) < 0) {
                current['2'].min = min[1];
            }
        }
        if (max) {
            if (current['1'].max === '0' || semvercmp(current['1'].max, max[0]) < 0) {
                current['1'].max = max[0];
            }
            if (current['2'].max === '0' || semvercmp(current['2'].max, max[1]) < 0) {
                current['2'].max = max[1];
            }
        }
    }

    return current;
};
