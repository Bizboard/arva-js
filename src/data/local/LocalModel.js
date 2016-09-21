/**
 * Created by Manuel on 22/07/16.
 */

import {Model}      from "../../core/Model";
import {DataSource} from "../DataSource.js";

export class LocalModel extends Model {

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
    }

    _buildFromDataSource() {
    }

    constructor(id, data) {
        if(id === null) { id = `${Math.random() * 100000}`; }
        super(id, data, {dataSource: { setWithPriority: async function(){} }});
        this.id = id;
        this._dataSource.ready = true;
        this._dataSource.remove = () => {};
    }
}
