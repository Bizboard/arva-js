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
        super(id, data, {dataSource: new DataSource()});
        this.id = id;
        this._dataSource.ready = true;
    }
}
