/**
 * Created by Manuel on 22/07/16.
 */
import {PrioritisedArray}   from '../PrioritisedArray.js';
import {LocalModel}         from './LocalModel.js';
import {ObjectHelper}       from 'arva-js/utils/ObjectHelper.js';

export class LocalPrioritisedArray extends PrioritisedArray {
    constructor(dataType) {
        super(dataType, {});
        this._dataSource = {ready: true, push: () => {}};
    }

    _buildFromDataSource() {
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
        if(!(item instanceof this._dataType)){
            let originalRemoveFunction = resultingModel.remove;
            let onChildRemoved = this._onChildRemoved;
            resultingModel.remove = function () {
                onChildRemoved({key: this.id, val: () => this.shadow});
                originalRemoveFunction.apply(this, arguments);
            }.bind(resultingModel);
        }
        return resultingModel;
    }

    static fromPrioritisedArray(prioritisedArray) {
        let LocalizedModel = LocalModel.createLocalizedModelClass(prioritisedArray._dataType);
        let localPrioritisedArray = new LocalPrioritisedArray(LocalizedModel);

        prioritisedArray.once('value', () => {
            for(let item of prioritisedArray){
                /* Add a copy so that everything stays local by converting it to a localizedModel */
                localPrioritisedArray.add(LocalModel.cloneModelProperties(item));
            }
        });
        return localPrioritisedArray;
    }
    
}