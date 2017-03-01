/**
 * Created by Manuel on 22/07/16.
 */
import omit             from 'lodash/omit.js';
import {Model}          from '../../core/Model';
import {DataSource}     from '../DataSource.js';
import {ObjectHelper}   from 'arva-js/utils/ObjectHelper.js';

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
        super(id, data, {dataSource: new DataSource()});
        this.id = id;
        this._dataSource.ready = true;
        this._dataSource.remove = () => {};
    }

    static fromModel(model) {
        let modelClass = LocalModel.createLocalizedModelClass(model.constructor);
        /* Create an inherit class */
        return new modelClass(model.id, model.shadow);
    }

    static createLocalizedModelClass(modelClass) {
        class LocalizedModel extends LocalModel{};
        let modelPrototype = modelClass.prototype;
        Object.defineProperties(LocalizedModel.prototype, omit(ObjectHelper.getMethodDescriptors(modelPrototype), ['constructor', 'id', 'dataSource', 'priority', '_inheritable']));
        return LocalizedModel;
    }

}
