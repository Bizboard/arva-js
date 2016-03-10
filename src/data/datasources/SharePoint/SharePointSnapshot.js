
/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {ObjectHelper}               from '../../../utils/ObjectHelper.js';
import {Snapshot}                   from '../../Snapshot.js';

export class SharePointSnapshot extends Snapshot {

    constructor(dataSnapshot, dataSource = null, kvpair = null) {
        super();
        this._data = dataSnapshot;
        this._dataSource = dataSource;
        this._kvpair = kvpair;

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);
    }

    key() {

        if (this._kvpair) return this._kvpair.key;

        else if (this._data instanceof Array && this._data.length==1)
            return this._data[0].id;
        else if (this._data instanceof Object)
            return this._data.id;

        //return this._data.id ? this._data.id : this._dataSource.key();
    }

    val() {
        if (this._kvpair) return this._kvpair.value;
        else return this._data;
    }

    ref() {
        return this._dataSource;
    }

    getPriority() { /* Not implemented for SharePoint */
        //TODO: have priority be part of list schema. and makes ordering super easy
    }


    forEach(callback) {

        if (this._data instanceof Array) {
            for (let object of this._data) {
                callback(new SharePointSnapshot(object, this._dataSource));
            }
        }
        else if (this._data instanceof Object) {
            for (let key in this._data) {
                callback(new SharePointSnapshot(object, this._dataSource, { key: key, value: this._data[key] }));
            }
        }
    }

    numChildren() {
        if (this._data instanceof Array) {
            return this._data.length;
        } else if (this._data instanceof Object) {
            return ObjectHelper.getEnumerableProperties(this._data).length;
        } else {
            return 0;
        }
    }
}

