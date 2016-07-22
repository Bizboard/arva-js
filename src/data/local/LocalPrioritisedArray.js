/**
 * Created by Manuel on 22/07/16.
 */
import {PrioritisedArray} from "../PrioritisedArray";

export class LocalPrioritisedArray extends PrioritisedArray {
    constructor(dataType) {
        super(dataType);
        this._dataSource = {ready: true};
    }

    _buildFromDataSource() {
    }
}