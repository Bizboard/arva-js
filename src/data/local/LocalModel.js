/**
 * Created by Manuel on 22/07/16.
 */
import cloneDeep        from 'lodash/cloneDeep.js'
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
        return LocalModel.fromModelClass(model.constructor, model.id, LocalModel.cloneModelProperties(model));
    }

    static fromModelClass(modelClass, modelID = null, constructionArguments = []) {
        class LocalizedModel extends LocalModel{}
        let modelPrototype = modelClass.prototype;

        /* Define the properties that was defined on the modelClass, but omit things that would mess up the construction */
        Object.defineProperties(LocalizedModel.prototype, omit(ObjectHelper.getMethodDescriptors(modelPrototype),
            ['constructor', 'id', 'dataSource', 'priority', '_inheritable']));
        return new LocalizedModel(modelID, ...constructionArguments);
    }

    static cloneModelProperties(model) {
        return cloneDeep(ObjectHelper.getEnumerableProperties(model));
    }

}
