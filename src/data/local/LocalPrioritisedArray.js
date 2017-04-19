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
        this._dataSource = {
            ready: true, push: () => {
            }
        };
    }


    /**
     * Override to make sure that we catch the 'removed' events by patching the model.remove function
     * of whatever is added
     * @param item
     * @param previousSiblingId
     * @returns {Object}
     */
    add(item, previousSiblingId) {
        let resultingModel = super.add(item, previousSiblingId);
        if (!(item instanceof this._dataType)) {
            let originalRemoveFunction = resultingModel.remove;
            let onChildRemoved = this._onChildRemoved;
            resultingModel.remove = function () {
                onChildRemoved({ key: this.id, val: () => this.shadow });
                originalRemoveFunction.apply(this, arguments);
            }.bind(resultingModel);
        }
        return resultingModel;
    }

    _buildFromDataSource() {
    }

    static fromPrioritisedArray(prioritisedArray) {
        let LocalizedModel = LocalModel.createClassFromModel(prioritisedArray._dataType);
        let LocalisedPrioritisedArray = LocalPrioritisedArray.classFromPrioritisedArray(prioritisedArray);
        let localPrioritisedArray = new LocalisedPrioritisedArray(LocalizedModel);
        prioritisedArray.once('value', () => {
            for (let item of prioritisedArray) {
                /* Add a copy so that everything stays local by converting it to a localizedModel */
                localPrioritisedArray.add(LocalModel.cloneModelProperties(item));
            }
        });
        return localPrioritisedArray;
    }

    //TODO This function isn't bullet proof, since it won't execute the constructor of the prioritisedArray
    static classFromPrioritisedArray(prioritisedArray) {
        class LocalisedPrioritisedArray extends LocalPrioritisedArray {}
        let modelPrototype = Object.getPrototypeOf(prioritisedArray);

        /* Define the properties that was defined on the modelClass, but omit things that would mess up the construction */
        Object.defineProperties(LocalisedPrioritisedArray.prototype,
            omit(
                ObjectHelper.getMethodDescriptors(modelPrototype),
                ['constructor', 'length', ...Object.getOwnPropertyNames(LocalPrioritisedArray.prototype)
                ]));
        return LocalisedPrioritisedArray;
    }

}