/**
 * Created by Manuel on 22/07/16.
 */
import {PrioritisedArray} from "../PrioritisedArray";

export class LocalPrioritisedArray extends PrioritisedArray {
    constructor(dataType) {
        super(dataType, {});
        this._dataSource = {ready: true};
    }

    remove(index) {
        if(this[index]){
            this._eventEmitter.emit('child_removed', this[index]);
        }
        super.remove(index);
    }

    _buildFromDataSource() {
    }
}
