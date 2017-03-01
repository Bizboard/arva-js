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

    static fromPrioritisedArray(prioritisedArray) {
        let LocalizedModel = LocalModel.createLocalizedModelClass(prioritisedArray._dataType);
        let localPrioritisedArray = new LocalPrioritisedArray(LocalizedModel);

        prioritisedArray.once('value', () => {
            for(let item of prioritisedArray){
                /* Just add the shadow so that everything stays local by converting it to a localizedModel */
                let newItem = localPrioritisedArray.add(item.shadow);
                let originalRemoveFunction = newItem.remove;
                newItem.remove = function() {
                    this._onChildRemoved({key: newItem.id, val: () => newItem.shadow});
                    originalRemoveFunction.apply(newItem, arguments);
                }.bind(localPrioritisedArray);
            }
        });
        return localPrioritisedArray;
    }
    
}