/**
 * Created by Manuel on 22/07/16.
 */
import omit             from 'lodash/omit.js';

import {LocalModel}         from './LocalModel.js';
import {DataSource}         from '../DataSource';
import {PrioritisedArray}   from '../PrioritisedArray.js';
import {ObjectHelper}       from '../../utils/ObjectHelper.js';

export class LocalPrioritisedArray extends PrioritisedArray {

    constructor(dataType) {
        super(dataType, new DataSource());
        this._dataSource.ready = true;
    }

    /**
     * Override to make sure that we catch the 'removed' events by patching the model.remove function
     * of whatever is added, and also that we can follow 'changed' events
     * @param {*} item
     * @param {String} previousSiblingId
     * @param {Boolean} emitValueEvent Passed to parent function
     * @returns {Object}
     */
    add(item, previousSiblingId, emitValueEvent) {
        let resultingModel = super.add(item, previousSiblingId, emitValueEvent);
        if (!(resultingModel instanceof this._dataType)) {
            resultingModel = item;
        }
        let originalRemoveFunction = resultingModel.remove;
        let onChildRemoved = this._onChildRemoved.bind(this);
        resultingModel.remove = function () {
            onChildRemoved({ key: this.id, val: () => this.shadow });
            originalRemoveFunction.apply(this, arguments);
        }.bind(resultingModel);

        resultingModel.on('changed', () => {
            this._eventEmitter.emit('child_changed', resultingModel, null);
            this._eventEmitter.emit('value', this);
        });

        return resultingModel;
    }

    _buildFromDataSource() {
    }

    static mergePrioritisedArrays(...prioritisedArrays) {
        let LocalizedModel = LocalModel.createMergedModelClass(...prioritisedArrays.map((prioritisedArray) => prioritisedArray._dataType));
        let LocalisedPrioritisedArray = LocalPrioritisedArray.createMergedPrioritisedArrayClass(...prioritisedArrays);
        let localPrioritisedArray = new LocalisedPrioritisedArray(LocalizedModel);
        for(let prioritisedArray of prioritisedArrays){
            prioritisedArray.once('value', () => {
                for (let item of prioritisedArray) {
                    /* Add a copy so that everything stays local by converting it to a localizedModel */
                    localPrioritisedArray.add(new LocalizedModel(item.id, LocalModel.cloneModelProperties(item)));
                }
            });
        }
        return localPrioritisedArray;
    }

    static fromPrioritisedArray(prioritisedArray) {
        return this.mergePrioritisedArrays(prioritisedArray);
    }

    static classFromPrioritisedArray(prioritisedArray) {
        return this.createMergedPrioritisedArrayClass(prioritisedArray);
    }

    //TODO This function isn't bullet proof, since it won't execute the constructor of the prioritisedArray and might miss some setup from the original class
    static createMergedPrioritisedArrayClass(...prioritisedArrays) {
        class LocalisedPrioritisedArray extends LocalPrioritisedArray {}
        for(let prioritisedArray of prioritisedArrays){
            let prioritisedArrayPrototype  = Object.getPrototypeOf(prioritisedArray);
            /* Define the properties that was defined on the modelClass, but omit things that would mess up the construction */
            Object.defineProperties(LocalisedPrioritisedArray.prototype,
                omit(
                    ObjectHelper.getMethodDescriptors(prioritisedArrayPrototype),
                    ['constructor', 'length', ...Object.getOwnPropertyNames(LocalPrioritisedArray.prototype)]
                )
            );
        }
        return LocalisedPrioritisedArray;
    }

}