/**
 * Created by Manuel on 04/10/16.
 */

import {ObjectHelper}               from 'arva-js/utils/ObjectHelper.js';
import {Snapshot}                   from 'arva-js/data/Snapshot.js';

export class FirebaseSnapShot extends Snapshot {

    constructor(dataSnapshot, dataSource = null) {
        super();
        this._data = dataSnapshot.value;
        this._numChildren = dataSnapshot.numChildren;
        this._key = dataSnapshot.key;
        this._dataSource = dataSource;

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);
    }

    get key() {
        return this._key;
    }

    val() {
        return this._data;
    }

    get ref() {
        return this._dataSource;
    }

    getPriority() {
        //TODO: have priority be part of list schema. and makes ordering super easy
    }


    forEach(callback) {
        if (this._data instanceof Array) {
            for (let object of this._data) {
                callback(new FirebaseSnapShot(object, this._dataSource));
            }
        }
        else if (this._data instanceof Object) {
            for (let key in this._data) {
                callback(new FirebaseSnapShot({key: key, value: this._data[key]}, this._dataSource));
            }
        }
    }

    numChildren() {
        if(this._numChildren) return this._numChildren;

        if (this._data instanceof Array) {
            return this._data.length;
        } else if (this._data instanceof Object) {
            return Object.keys(ObjectHelper.getEnumerableProperties(this._data)).length || 0;
        } else {
            return 0;
        }
    }
}

